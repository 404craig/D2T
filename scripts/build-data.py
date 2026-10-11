#!/usr/bin/env python3
"""Build data/game/game.json and data/game/crests.json from the source data.

Run from the repo root:  python3 scripts/build-data.py

Inputs
- data/source/pl_results.csv   every Premier League result 1992/93 to 2025/26 (from Tenaball, two sources)
- data/source/pl_players.csv   every player-season: club, broad position, apps, goals (from Tenaball, two sources)
- data/ratings/*.csv           card ratings and detailed positions, when present (from the player data work)
- data/source/clubs.json       club display names and accent colours
- assets/crests/72, /128       crest PNGs

Ratings: where data/ratings has a row for a player-season it wins. Otherwise a fallback model rates
each player against everyone in his broad position that season (goals for forwards, team defence for
defenders and keepers, a mix for midfielders), weighted by games played. The fallback is marked so the
game can say which ratings are provisional.
"""
import base64, csv, glob, json, math, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "data", "game")

DEDUCTIONS = {("1996/97", "Middlesbrough"): 3, ("2009/10", "Portsmouth"): 9,
              ("2023/24", "Everton"): 8, ("2023/24", "Nottingham Forest"): 4}


def season_tables(results):
    by = defaultdict(list)
    for r in results:
        by[r["season"]].append(r)
    tables = {}
    for s, ms in by.items():
        T = defaultdict(lambda: {"p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0})
        for m in ms:
            h, a, hg, ag = m["home"], m["away"], int(m["home_goals"]), int(m["away_goals"])
            for c, f, g in ((h, hg, ag), (a, ag, hg)):
                t = T[c]; t["p"] += 1; t["gf"] += f; t["ga"] += g
                if f > g: t["w"] += 1; t["pts"] += 3
                elif f == g: t["d"] += 1; t["pts"] += 1
                else: t["l"] += 1
        for m in ms:
            h, a, hg, ag = m["home"], m["away"], int(m["home_goals"]), int(m["away_goals"])
            T[h].setdefault("cs", 0); T[a].setdefault("cs", 0)
            if ag == 0: T[h]["cs"] += 1
            if hg == 0: T[a]["cs"] += 1
        for (ds, dc), d in DEDUCTIONS.items():
            if ds == s and dc in T: T[dc]["pts"] -= d
        order = sorted(T.items(), key=lambda kv: (-kv[1]["pts"], -(kv[1]["gf"] - kv[1]["ga"]), -kv[1]["gf"], kv[0]))
        tables[s] = order
    return by, tables


def zscores(vals):
    if not vals: return []
    m = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals)) or 1
    return [(v - m) / sd for v in vals]


def fallback_ratings(season, rows, table):
    """Season-relative rating per player-row, 0-99 scale, plus level 0-3."""
    team = {c: t for c, t in table}
    n = len(table)
    games = 2 * (n - 1)
    out = {}
    by_pos = defaultdict(list)
    for r in rows:
        by_pos[r["position"]].append(r)
    for pos, rs in by_pos.items():
        raw = []
        for r in rs:
            a, g = int(r["apps"]), int(r["goals"])
            t = team[r["club"]]
            ppg, gapg = t["pts"] / t["p"], t["ga"] / t["p"]
            gpg = g / max(a, 1)
            if pos == "FWD": s = 3.0 * gpg + 0.25 * ppg
            elif pos == "MID": s = 1.6 * gpg + 0.6 * ppg - 0.15 * gapg
            elif pos == "DEF": s = 0.7 * ppg - 0.55 * gapg + 0.8 * gpg
            else: s = 0.5 * ppg - 0.75 * gapg
            share = min(a, games * 0.8) / (games * 0.8)
            raw.append(s * (0.55 + 0.45 * share) + 0.25 * share)
        z = zscores(raw)
        # Regulars (10+ apps) are ranked among themselves, to line up with the externally rated spread.
        regular = [i for i in range(len(rs)) if int(rs[i]["apps"]) >= 10]
        rank_of = {i: k for k, i in enumerate(sorted(regular, key=lambda i: z[i]))}
        for i in range(len(rs)):
            r = rs[i]
            a = int(r["apps"])
            if i in rank_of: pct = (rank_of[i] + 0.5) / len(regular)
            else: pct = sum(1 for j in regular if z[j] < z[i]) / max(1, len(regular))
            out[(r["club"], r["player_id"])] = (pct, a)
    return out


def levels_for(players):
    """The player data work's tiers: best = the top-rated player at each club, gold 80+, silver 70 to 79, bronze below.
    External ratings bring their own tier; this fills the fallback seasons the same way."""
    best = {}
    for p in players:
        if p["src"] == "f" and (p["c"] not in best or p["r"] > best[p["c"]]["r"]): best[p["c"]] = p
    for p in players:
        if "lv" in p: continue
        p["lv"] = 3 if best.get(p["c"]) is p else 2 if p["r"] >= 80 else 1 if p["r"] >= 70 else 0


def load_external_ratings():
    """data/ratings/rated_fit_<YYYY-YY>.json from the player data work (ovr, tier, stats, assists, clean sheets).
    Keyed by (season, club, player_id), and by (season, club, player name) for files that predate the id field."""
    ext = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "ratings", "rated_fit_*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        season = d["season"].replace("-", "/")
        for r in d["players"]:
            ext[(season, r["club"], r.get("id") or r["player"])] = r
            ext.setdefault((season, r["club"], "name:" + r["player"]), r)
    return ext


def quantile_map(ext):
    """Per broad position, the sorted ratings of every externally rated player-season with 10+ apps."""
    q = defaultdict(list)
    for (season, club, key), r in ext.items():
        if key.startswith("name:") or (r.get("apps") or 0) < 10: continue
        q[r["pos"]].append(r["ovr"])
    return {k: sorted(v) for k, v in q.items()}


def from_quantile(qs, pct):
    if not qs: return round(58 + 34 * pct ** 1.7)
    i = min(len(qs) - 1, max(0, int(pct * len(qs))))
    return qs[i]


TIER_LEVEL = {"bronze": 0, "silver": 1, "gold": 2, "best": 3}
_mp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "moves.json")
MOVES = json.load(open(_mp, encoding="utf-8")) if os.path.exists(_mp) else {}


def card_stats(q, team, games, career_apps):
    """The six card numbers (20 to 99), all worked out from verified season numbers:
    GOL scoring rate, IMP share of the club's goals, FIT games played, WIN club points per game,
    DEF club goals conceded per game, EXP Premier League appearances so far.
    Goalkeepers: WAL (club goals conceded, fewer is higher), CLN clean sheets, FIT, WIN, EXP."""
    sc = lambda x: int(round(20 + 79 * max(0.0, min(1.0, x))))
    a, g = q["a"], q["g"]
    ppg, gapg = team["pts"] / team["p"], team["ga"] / team["p"]
    fit = sc(a / games)
    win = sc((ppg - 0.6) / 1.9)
    defn = sc(1 - (gapg - 0.6) / 1.7)
    exp = sc(math.log(1 + career_apps) / math.log(1 + 450))
    if q["b"] == "GK":
        cs = q.get("cs")
        if cs is None: cs = team.get("cs", 0) * a / games
        return [defn, sc(cs / 18), fit, win, exp]
    gpg = g / max(a, 1)
    gol = sc(math.sqrt(min(gpg / 0.75, 1)))
    imp = sc(min(g / max(team["gf"], 1) / 0.3, 1) ** 0.75)
    return [gol, imp, fit, win, defn, exp]


def main():
    results = list(csv.DictReader(open(os.path.join(SRC, "pl_results.csv"), encoding="utf-8")))
    players = list(csv.DictReader(open(os.path.join(SRC, "pl_players.csv"), encoding="utf-8")))
    clubs_meta = json.load(open(os.path.join(SRC, "clubs.json"), encoding="utf-8"))
    ext = load_external_ratings()
    qmap = quantile_map(ext)
    by_season, tables = season_tables(results)
    prow = defaultdict(list)
    for p in players:
        prow[p["season"]].append(p)

    game = {"v": 1, "seasons": {}, "catalogue": [], "clubSeasons": [], "clubs": clubs_meta}
    # Whole Premier League careers (every season in the data) for the big card: games, goals, seasons, clubs in order.
    careers, cidx = [], {}
    for r in sorted(players, key=lambda r: (r["player_id"], r["season"], r["club"])):
        pid = r["player_id"]
        if pid not in cidx:
            cidx[pid] = len(careers)
            careers.append({"a": 0, "g": 0, "s": [], "c": []})
        k = careers[cidx[pid]]
        k["a"] += int(r["apps"]); k["g"] += int(r["goals"])
        if r["season"] not in k["s"]: k["s"].append(r["season"])
        if r["club"] not in k["c"]: k["c"].append(r["club"])
    game["careers"] = [{"a": k["a"], "g": k["g"], "n": len(k["s"]), "f": k["s"][0], "l": k["s"][-1], "c": k["c"]} for k in careers]
    career = defaultdict(int)   # Premier League appearances before the current season, per person
    for season in sorted(by_season):
        table = tables[season]
        names = sorted(c for c, _ in table)
        cix = {c: i for i, c in enumerate(names)}
        fb = fallback_ratings(season, prow[season], table)
        # One card per person per season: a January mover keeps both clubs (c, c2) and combined numbers.
        people = {}
        # A January mover's clubs in the order he played for them (dates from the match line-ups,
        # data/source/moves.json); without dates, the club with more games first.
        mv = MOVES.get(season, {})
        def club_order(r):
            d = mv.get(r["player_id"], {}).get(r["club"])
            return (r["player_id"], d[0] if d else "9999", -int(r["apps"]), r["club"])
        order = sorted(prow[season], key=club_order)
        for r in order:
            pid = r["player_id"]
            e = ext.get((season, r["club"], pid)) or ext.get((season, r["club"], "name:" + r["player"]))
            if e:
                rating = int(e["ovr"])
            else:
                pct, a = fb[(r["club"], pid)]
                rating = from_quantile(qmap.get(r["position"]), pct)
                if a < 10: rating = round(55 + (rating - 55) * (0.55 + 0.045 * a))
            pos = [r["position"]]
            if pid in people:
                q = people[pid]
                q["c2"] = cix[r["club"]]; q["a2"] = int(r["apps"]); q["g2"] = int(r["goals"])
                d2 = mv.get(pid, {}).get(r["club"])
                if d2: q["m2"] = d2[0]  # first game for his second club: the card shows that club from this date
                q["a"] += int(r["apps"]); q["g"] += int(r["goals"])
                q["r"] = max(q["r"], rating)
                continue
            people[pid] = {"k": cidx[pid], "n": r["player"], "c": cix[r["club"]], "b": r["position"], "p": pos,
                           "r": rating, "a": int(r["apps"]), "g": int(r["goals"]), "nat": r["nationality"],
                           "a1": int(r["apps"]), "g1": int(r["goals"]), "src": "x" if e else "f"}
            if e:
                people[pid]["lv"] = TIER_LEVEL.get(e.get("tier"), 0)
                for k_in, k_out in (("assists", "as"), ("cleanSheets", "cs"), ("minutes", "mi"), ("stats", "st")):
                    if e.get(k_in) is not None: people[pid][k_out] = e[k_in]
        # Purple (Craig, 11 Oct 2026): the season's top 5 players league-wide. Gold 80+, silver 70 to 79, bronze below.
        ranked = sorted(people.values(), key=lambda q: (-q["r"], -q["a"], q["n"]))
        top5 = {id(q) for q in ranked[:5]}
        for q in people.values():
            q["lv"] = 3 if id(q) in top5 else 2 if q["r"] >= 80 else 1 if q["r"] >= 70 else 0
        plist = []
        tmap = {c: t for c, t in table}
        games = 2 * (len(table) - 1)
        for i, (pid, q) in enumerate(sorted(people.items())):
            q["id"] = i
            main_club = names[q["c2"]] if q.get("c2") is not None and q.get("a2", 0) > q["a1"] else names[q["c"]]
            q["s6"] = card_stats(q, tmap[main_club], games, career[pid] + q["a"])
            plist.append(q)
        for pid, q in people.items():
            career[pid] += q["a"]
        levels_for(plist)
        # Order matches by date; club indexes refer to names.
        ms = sorted(by_season[season], key=lambda m: (m["date"], m["home"]))
        matches = [[m["date"], cix[m["home"]], cix[m["away"]], int(m["home_goals"]), int(m["away_goals"])] for m in ms]
        n = len(table)
        rel_n = 4 if season == "1994/95" else 3
        relegated = []
        for pos, (c, t) in enumerate(table, start=1):
            if pos > n - rel_n:
                relegated.append({"c": cix[c], "pos": pos, "pts": t["pts"], "w": t["w"], "d": t["d"], "l": t["l"],
                                  "gf": t["gf"], "ga": t["ga"], "f": "4-4-2", "xi": []})
        deductions = {str(cix[dc]): d for (ds, dc), d in DEDUCTIONS.items() if ds == season and dc in cix}
        game["seasons"][season] = {"season": season, "clubs": [{"id": i, "name": c} for i, c in enumerate(names)],
                                   "matches": matches, "players": plist, "relegated": relegated,
                                   "deductions": deductions, "relegationPlaces": rel_n}
        # every club-season with its real finish (Dare2Dream spins any of these)
        for pos, (c, t) in enumerate(table, start=1):
            game["clubSeasons"].append({"key": f"{season}:{c}", "season": season, "club": c, "pos": pos, "pts": t["pts"],
                                        "w": t["w"], "d": t["d"], "l": t["l"], "gf": t["gf"], "ga": t["ga"]})
        for r in relegated:
            game["catalogue"].append({"key": f"{season}:{names[r['c']]}", "season": season, "club": names[r["c"]],
                                      "pos": r["pos"], "pts": r["pts"]})

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "game.json"), "w", encoding="utf-8") as f:
        json.dump(game, f, separators=(",", ":"), ensure_ascii=False)
    crests = {}
    for c, meta in clubs_meta.items():
        f = meta["crest"]
        for size in ("72", "128"):
            path = os.path.join(ROOT, "assets", "crests", size, f)
            if os.path.exists(path):
                crests.setdefault(c, {})[size] = "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
    with open(os.path.join(OUT, "crests.json"), "w", encoding="utf-8") as f:
        json.dump(crests, f, separators=(",", ":"))
    size = os.path.getsize(os.path.join(OUT, "game.json")) / 1e6
    print(f"game.json {size:.2f} MB, {len(game['seasons'])} seasons, {len(game['catalogue'])} relegated club-seasons; "
          f"{sum(1 for k in ext)} external ratings; crests for {len(crests)} clubs")


if __name__ == "__main__":
    main()
