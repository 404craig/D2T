"""Simulate DROP2TOP Classic as written in "DROP2TOP Game Rules v0.2" (D2T main session).

Usage: python3 tools/sim_rules_v02.py

Rules followed:
- Club roll: three random relegated club-seasons, pick one (a re-roll costs a respin).
- Your team is exactly 11 (best XI 1-4-4-2 from the real squad here; most-used XI later).
- 17 rolls: 3 before GW1, 1 before GW4, 7, 10, 13, 16, 19, 3 in January (before GW21),
  then 1 before GW24, 27, 30, 33, 36.
- Each roll shows 3 cards; sign one (it replaces a player in the same broad position) or pass.
  5 respins a season re-spin all three cards.
- Cards: players with 10+ games in your club's season, never your club, never the same player twice.
  Levels by share: bronze 45% (lower third in his position), silver 35%, gold 17% (top fifth),
  purple 2.5% (the season's best in his position), legend 0.5% (an all-time great's best season).
- Raiding: signing a player lowers his old club's strength by what he added to their XI; each of
  their remaining real wins becomes a draw, and each draw a defeat, with chance 3x the strength lost.
- Your 38 matches are simulated with the goals model fitted on every real result; the other
  342 results are history, changed only by raiding.
Not modelled: detailed positions and fit colours (every signing is a natural fit), formations.
Recruiting styles: none; casual (signs a random improving card, never respins);
strong (signs the best card, respins when no card adds 2+ to the XI).
"""
import csv
import glob
import json
import math
from collections import defaultdict

import numpy as np

rng = np.random.default_rng(11)
REPO = "/home/user/404craig/tenaball"
SCHEDULE = {1: 3, 4: 1, 7: 1, 10: 1, 13: 1, 16: 1, 19: 1, 21: 3, 24: 1, 27: 1, 30: 1, 33: 1, 36: 1}
import os as _o
SHARES = json.loads(_o.environ.get("SHARES", '{"bronze": 0.45, "silver": 0.35, "gold": 0.17, "purple": 0.025, "legend": 0.005}'))
# Position fit: share of cards that only fit your open shirt at amber (90%) or red (70%) - starting values from the rules
FIT = json.loads(_o.environ.get("FIT", '{"green": 1.0, "amber": 0.0, "red": 0.0}'))
NEED = {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2}
import os
B = float(os.environ.get("ENGINE_B", 0.0475))  # 0.0475 = fitted on all 13,166 results; steeper is harsher on weak sides
A0, HADV = 0.104, 0.276

seasons = {}
for f in sorted(glob.glob("docs/cards/feed/rated_fit_*.json")):
    t = f.split("rated_fit_")[1][:7]
    seasons[t[:4] + "/" + t[5:]] = json.load(open(f, encoding="utf-8"))["players"]

# legends (Craig, 11 Oct 2026): the top 3 players of every season
LEGENDS = []
for s, ps in seasons.items():
    LEGENDS += sorted(ps, key=lambda r: -r["ovr"])[:3]


def levels(players, season_all):
    """Card levels (Craig, 11 Oct 2026): purple = the season's top 5 players league-wide;
    gold 80+, silver 70 to 79, bronze under 70."""
    top5 = {id(r) for r in sorted(season_all, key=lambda r: -r["ovr"])[:5]}
    out = defaultdict(list)
    for r in players:
        if r["apps"] < 10:
            continue
        lvl = "purple" if id(r) in top5 else "gold" if r["ovr"] >= 80 else "silver" if r["ovr"] >= 70 else "bronze"
        out[lvl].append(r)
    return out


def xi_of(players):
    xi = {}
    for pos, n in NEED.items():
        xs = sorted([r["ovr"] for r in players if r["pos"] == pos], reverse=True)[:n]
        xi[pos] = xs + [55] * (n - len(xs))
    return xi


def rating(xi):
    return sum(sum(v) for v in xi.values()) / 11


results = defaultdict(list)
for m in csv.DictReader(open(f"{REPO}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
    results[m["season"]].append(m)


def table_order(rows):
    pts = defaultdict(int); gd = defaultdict(int)
    for m in rows:
        hg, ag = int(m["home_goals"]), int(m["away_goals"])
        pts[m["home"]] += 3 if hg > ag else 1 if hg == ag else 0
        pts[m["away"]] += 3 if ag > hg else 1 if hg == ag else 0
        gd[m["home"]] += hg - ag; gd[m["away"]] += ag - hg
    return sorted(pts, key=lambda c: (-pts[c], -gd[c]))


RELEGATED = []
for s, rows in results.items():
    if s in seasons:
        order = table_order(rows)
        RELEGATED += [(s, c) for c in order[-(4 if s == "1994/95" else 3):]]

# gameweek of each real match (by date order)
GW = {}
for s, rows in results.items():
    played = defaultdict(int)
    for i, m in enumerate(sorted(rows, key=lambda m: m["date"])):
        gw = max(played[m["home"]], played[m["away"]]) + 1
        played[m["home"]] += 1; played[m["away"]] += 1
        GW[(s, m["date"], m["home"], m["away"])] = gw


def run(s, club, style):
    players = seasons[s]
    by_club = defaultdict(list)
    for r in players:
        by_club[r["club"]].append(r)
    xi = xi_of(by_club[club])
    lv = levels([r for r in players if r["club"] != club], players)
    club_xi = {c: xi_of(ps) for c, ps in by_club.items()}
    base = {c: rating(x) for c, x in club_xi.items()}
    strength = dict(base)
    weakened_from = {}  # club -> (gameweek, fraction lost)
    seen = set()
    respins = 5
    counts = defaultdict(int)

    def draw3():
        cards = []
        for _ in range(3):
            for _try in range(20):
                lvl = rng.choice(list(SHARES), p=list(SHARES.values()))
                pool = LEGENDS if lvl == "legend" else lv[lvl]
                if not pool:
                    continue
                r = pool[rng.integers(len(pool))]
                key = (r.get("id", r["player"]), r["club"])
                if key not in seen:
                    seen.add(key); counts[lvl] += 1
                    cards.append((lvl, r)); break
        return cards

    fitmult = {}

    def eff(r):
        k = id(r)
        if k not in fitmult:
            fitmult[k] = rng.choice([1.0, 0.9, 0.7], p=[FIT["green"], FIT["amber"], FIT["red"]])
        return r["ovr"] * fitmult[k]

    def gain(r):
        return max(0, eff(r) - min(xi[r["pos"]])) / 11

    def sign(lvl, r, gw):
        row = xi[r["pos"]]
        row[row.index(min(row))] = eff(r)
        if lvl != "legend" and r["club"] in club_xi:
            cx = club_xi[r["club"]][r["pos"]]
            if r["ovr"] in cx:
                cx[cx.index(r["ovr"])] = 60  # replaced by a squad player
            new = rating(club_xi[r["club"]])
            frac = max(0.0, (strength[r["club"]] - new) / strength[r["club"]])
            strength[r["club"]] = new
            g0, f0 = weakened_from.get(r["club"], (gw, 0.0))
            weakened_from[r["club"]] = (min(g0, gw), f0 + frac)

    our_rating_at = {}
    last_gw = max(GW[(s, m['date'], m['home'], m['away'])] for m in results[s])
    for gw in range(1, last_gw + 1):
        for _ in range(SCHEDULE.get(gw, 0) if style != "none" else 0):
            cards = draw3()
            while style == "strong" and respins > 0 and max((gain(r) for _, r in cards), default=0) < 2 / 11:  # no card adds 2+ to a shirt
                respins -= 1
                cards = draw3()
            good = [(lvl, r) for lvl, r in cards if gain(r) > 0]
            if good:
                lvl, r = max(good, key=lambda c: gain(c[1])) if style == "strong" else good[rng.integers(len(good))]
                sign(lvl, r, gw)
        our_rating_at[gw] = rating(xi)

    # league: history for others, raided clubs lose points; our games simulated
    pts = defaultdict(int)
    for m in results[s]:
        h, a = m["home"], m["away"]
        gw = GW[(s, m["date"], h, a)]
        if club in (h, a):
            opp = a if h == club else h
            d = our_rating_at[gw] - strength[opp] if weakened_from.get(opp, (99,))[0] <= gw else our_rating_at[gw] - base[opp]
            if h == club:
                us = rng.poisson(math.exp(A0 + HADV + B * d)); them = rng.poisson(math.exp(A0 - B * d))
            else:
                us = rng.poisson(math.exp(A0 + B * d)); them = rng.poisson(math.exp(A0 + HADV - B * d))
            pts[club] += 3 if us > them else 1 if us == them else 0
            pts[opp] += 3 if them > us else 1 if us == them else 0
            continue
        hg, ag = int(m["home_goals"]), int(m["away_goals"])
        res = "H" if hg > ag else "D" if hg == ag else "A"
        for side, other, win in ((h, a, "H"), (a, h, "A")):
            w = weakened_from.get(side)
            if w and w[0] <= gw:
                p = min(0.9, 3 * w[1])
                if res == win and rng.random() < p:
                    res = "D"
                elif res == "D" and rng.random() < p:
                    res = "A" if side == h else "H"
        pts[h] += 3 if res == "H" else 1 if res == "D" else 0
        pts[a] += 3 if res == "A" else 1 if res == "D" else 0
    order = sorted(pts, key=lambda c: -pts[c])
    return order.index(club) + 1, pts[club], len(order), rating(club_xi_start[(s, club)]), rating(xi), counts


club_xi_start = {}
for s, ps in seasons.items():
    by = defaultdict(list)
    for r in ps:
        by[r["club"]].append(r)
    for c, rs in by.items():
        club_xi_start[(s, c)] = xi_of(rs)


def summary(style, runs, pick="random"):
    out = defaultdict(float); lv = defaultdict(float)
    for _ in range(runs):
        opts = [RELEGATED[i] for i in rng.choice(len(RELEGATED), 3, replace=False)]
        s, c = max(opts, key=lambda o: rating(club_xi_start[o])) if pick == "best" else opts[0]
        pos, p, n, r0, r1, counts = run(s, c, style)
        out["title"] += pos == 1; out["top4"] += pos <= 4; out["tophalf"] += pos <= n // 2
        out["survive"] += pos <= n - 3; out["pts"] += p; out["pos"] += pos; out["r0"] += r0; out["r1"] += r1
        for k, v in counts.items():
            lv[k] += v
    return {k: v / runs for k, v in out.items()}, {k: v / runs for k, v in lv.items()}


if __name__ == "__main__":
    print(f"relegated club-seasons: {len(RELEGATED)}; legends (top 3 of every season): {len(LEGENDS)}")
    d = [run("2007/08", "Derby", "none") for _ in range(300)]
    print(f"Derby 2007/08, no signings: avg finish {np.mean([x[0] for x in d]):.1f}, avg points {np.mean([x[1] for x in d]):.1f} (real: 20th, 11 pts)")
    rows = {}
    for style, pick in (("none", "random"), ("casual", "random"), ("strong", "best")):
        r, lv = summary(style, int(os.environ.get("RUNS", 1500)), pick)
        rows[style] = (r, lv)
        print(f"{style:7} title {100 * r['title']:4.1f}%  top4 {100 * r['top4']:4.1f}%  top half {100 * r['tophalf']:4.1f}%  stay up {100 * r['survive']:4.1f}%  "
              f"avg {r['pts']:.0f} pts, {r['pos']:.1f}th  XI {r['r0']:.1f} -> {r['r1']:.1f}  | cards seen: " + ", ".join(f"{k} {v:.2f}" for k, v in sorted(lv.items())))
    json.dump({k: {"result": v[0], "cards_seen": v[1]} for k, v in rows.items()}, open("docs/cards/sim_rules_v02.json", "w"), indent=1)
