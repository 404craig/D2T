"""Draft D2T game simulator: how often does spinning for cards win the league?

Usage: python3 tools/sim_game.py

Assumptions (a proposal, not agreed rules):
- You take over a relegated club (a real bottom-three side, any season) with its real squad.
- Each spin gives one card from any season. You keep it if it beats the weakest player
  in your best XI (1-4-4-2) at that position.
- Spins come before the season (PRE) and before each matchday (PER_GAME), 38 or 42 games.
- Matches use a goals model fitted on every real Premier League result: each side's goals
  are Poisson with a rate set by the two best-XI ratings and home advantage.
- The other 19 clubs are that season's real sides with their real best XIs.
Card categories, checked in this order: Legend (93+), Club's best (purple), Gold (80+),
Silver (70 to 79), Bronze (under 70). Spin odds set the chance of each category; the card
is then drawn at random from that category (cards with 10+ apps only).
"""
import csv
import glob
import json
import math
from collections import defaultdict

import numpy as np

rng = np.random.default_rng(7)
REPO = "/home/user/404craig/tenaball"


def best_xi(players):
    need = {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2}
    by = defaultdict(list)
    for p in players:
        by[p["pos"]].append(p["ovr"])
    xi = []
    for pos, n in need.items():
        xs = sorted(by[pos], reverse=True)[:n]
        xs += [55] * (n - len(xs))
        xi.append(xs)
    return xi  # list per position, sorted high to low


def xi_rating(xi):
    return sum(sum(x) for x in xi) / 11


# --- club ratings and the card pool ---
club_xi, pool, relegated = {}, [], []
for f in sorted(glob.glob("docs/cards/feed/rated_fit_*.json")):
    t = f.split("rated_fit_")[1][:7]
    season = t[:4] + "/" + t[5:]
    by_club = defaultdict(list)
    for r in json.load(open(f, encoding="utf-8"))["players"]:
        by_club[r["club"]].append(r)
        if r["apps"] >= 10:
            cat = "legend" if r["ovr"] >= 93 else "purple" if r["tier"] == "best" else "gold" if r["ovr"] >= 80 else "silver" if r["ovr"] >= 70 else "bronze"
            pool.append((cat, r["pos"], r["ovr"]))
    for c, ps in by_club.items():
        club_xi[(season, c)] = best_xi(ps)

results = [m for m in csv.DictReader(open(f"{REPO}/docs/data/pl_results/pl_results.csv", encoding="utf-8")) if (m["season"], m["home"]) in club_xi]
H = np.array([xi_rating(club_xi[(m["season"], m["home"])]) for m in results])
A = np.array([xi_rating(club_xi[(m["season"], m["away"])]) for m in results])
HG = np.array([int(m["home_goals"]) for m in results])
AG = np.array([int(m["away_goals"]) for m in results])

# --- fit the goals model: log rate = a + h*home + b*(own - opponent) ---
best = None
for b in np.arange(0.02, 0.20, 0.0025):
    d = H - A
    # for fixed b, a and h have closed forms
    eh = np.exp(b * d); ea = np.exp(-b * d)
    a_plus_h = math.log(HG.sum() / eh.sum()); a = math.log(AG.sum() / ea.sum())
    ll = (HG * (a_plus_h + b * d) - np.exp(a_plus_h) * eh).sum() + (AG * (a - b * d) - np.exp(a) * ea).sum()
    if best is None or ll > best[0]:
        best = (ll, b, a, a_plus_h - a)
_, B, A0, HADV = best
print(f"goals model: rate = exp({A0:.3f} + {HADV:.3f} if home + {B:.4f} x rating gap)  ({len(results)} matches)")

# check: does the model reproduce real title winners from real XIs?
seasons = sorted({s for s, _ in club_xi})


def sim_league(ratings, n, our_ratings=None):
    """ratings: dict club -> rating. our_ratings: optional (n, 38) array for club 'YOU'. Returns points (n, clubs)."""
    clubs = list(ratings)
    if our_ratings is not None:
        clubs = clubs + ["YOU"]
    k = len(clubs)
    pts = np.zeros((n, k))
    idx = {c: i for i, c in enumerate(clubs)}
    for i, hc in enumerate(clubs):
        for j, ac in enumerate(clubs):
            if i == j:
                continue
            if "YOU" in (hc, ac):
                continue
            d = ratings[hc] - ratings[ac]
            hg = rng.poisson(math.exp(A0 + HADV + B * d), n)
            ag = rng.poisson(math.exp(A0 - B * d), n)
            pts[:, i] += np.where(hg > ag, 3, np.where(hg == ag, 1, 0))
            pts[:, j] += np.where(ag > hg, 3, np.where(hg == ag, 1, 0))
    if our_ratings is not None:
        y = idx["YOU"]
        opp = [c for c in clubs if c != "YOU"]
        fixtures = [(c, True) for c in opp] + [(c, False) for c in opp]
        order = rng.permutation(len(fixtures))
        for mdn, fi in enumerate(order):
            c, home = fixtures[fi]
            d = our_ratings[:, mdn] - ratings[c]
            if home:
                us = rng.poisson(np.exp(A0 + HADV + B * d)); them = rng.poisson(np.exp(A0 - B * d))
            else:
                us = rng.poisson(np.exp(A0 + B * d)); them = rng.poisson(np.exp(A0 + HADV - B * d))
            pts[:, y] += np.where(us > them, 3, np.where(us == them, 1, 0))
            pts[:, idx[c]] += np.where(them > us, 3, np.where(us == them, 1, 0))
    return clubs, pts


hits = 0
for s in seasons:
    ratings = {c: xi_rating(x) for (ss, c), x in club_xi.items() if ss == s}
    clubs, pts = sim_league(ratings, 200)
    real = {}
    for m in csv.DictReader(open(f"{REPO}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
        if m["season"] == s:
            hg, ag = int(m["home_goals"]), int(m["away_goals"])
            real[m["home"]] = real.get(m["home"], 0) + (3 if hg > ag else 1 if hg == ag else 0)
            real[m["away"]] = real.get(m["away"], 0) + (3 if ag > hg else 1 if hg == ag else 0)
    champ = max(real, key=real.get)
    hits += (pts.argmax(1) == clubs.index(champ)).mean()
    sorted_c = sorted(real, key=real.get)
    for c in sorted_c[:3]:
        relegated.append((s, c))
print(f"model check: the real champion wins the simulated league {100 * hits / len(seasons):.0f}% of the time on average")

cats = ["legend", "purple", "gold", "silver", "bronze"]
by_cat = {c: [(p, o) for cc, p, o in pool if cc == c] for c in cats}
natural = {c: len(by_cat[c]) / len(pool) for c in cats}
print("natural share of 10+ app cards:", {c: f"{100 * v:.1f}%" for c, v in natural.items()})


def play(odds, pre, per_game, n_scen=60, per_scen=40):
    p = np.array([odds[c] for c in cats]); p = p / p.sum()
    out = defaultdict(float); got = defaultdict(float)
    scen = [relegated[i] for i in rng.choice(len(relegated), n_scen)]
    for s, club in scen:
        others = {c: xi_rating(x) for (ss, c), x in club_xi.items() if ss == s and c != club}
        games = 2 * len(others)
        traj = np.zeros((per_scen, games))
        for k in range(per_scen):
            xi = [list(x) for x in club_xi[(s, club)]]
            posi = {"GK": 0, "DEF": 1, "MID": 2, "FWD": 3}

            def spin():
                c = cats[rng.choice(5, p=p)]
                pos, o = by_cat[c][rng.integers(len(by_cat[c]))]
                got[c] += 1
                row = xi[posi[pos]]
                if o > row[-1]:
                    row[-1] = o
                    row.sort(reverse=True)
            for _ in range(pre):
                spin()
            for mdn in range(games):
                for _ in range(per_game):
                    spin()
                traj[k, mdn] = xi_rating(xi)
        clubs, pts = sim_league(others, per_scen, traj)
        y = clubs.index("YOU")
        pos = (pts > pts[:, [y]]).sum(1) + 1
        out["title"] += (pos == 1).sum(); out["top4"] += (pos <= 4).sum(); out["survive"] += (pos <= 17).sum()
        out["avgpos"] += pos.sum(); out["start"] += xi_rating(club_xi[(s, club)]) * per_scen
        out["end"] += traj[:, -1].sum()
    n = n_scen * per_scen
    return {k: v / n for k, v in out.items()}, {c: got[c] / n for c in cats}


if __name__ == "__main__":
    configs = [
        ("natural odds", natural),
        ("boosted", {"legend": 0.005, "purple": 0.04, "gold": 0.15, "silver": 0.45, "bronze": 0.355}),
        ("generous", {"legend": 0.01, "purple": 0.06, "gold": 0.20, "silver": 0.45, "bronze": 0.28}),
    ]
    rows = []
    for name, odds in configs:
        for pre, pg in [(0, 1), (5, 1), (10, 1), (0, 2), (10, 2), (20, 2), (0, 3), (20, 3)]:
            r, got = play(odds, pre, pg)
            rows.append((name, pre, pg, r, got))
            print(f"{name:13} pre {pre:2} per game {pg}: title {100 * r['title']:4.1f}%  top4 {100 * r['top4']:4.1f}%  survive {100 * r['survive']:4.1f}%  avg pos {r['avgpos']:4.1f}  XI {r['start']:.1f} -> {r['end']:.1f}  | per season: legend {got['legend']:.2f} purple {got['purple']:.1f} gold {got['gold']:.1f} silver {got['silver']:.1f} bronze {got['bronze']:.1f}", flush=True)
    json.dump([{"odds": n, "pre": a, "per_game": b, **r, **{"spins_" + k: v for k, v in g.items()}} for n, a, b, r, g in rows],
              open("docs/cards/sim_results.json", "w"), indent=1)
