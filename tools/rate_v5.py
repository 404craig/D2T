"""Draft v5 card ratings: v4 with reputation rebuilt on league-position points.

Usage: python3 tools/rate_v5.py <tenaball_repo> <season> <merged.csv> <out.json>

Changes from v2 after five subagent reviews:
- every per-game stat is filled with 12 average games (goals use his own
  earlier rate), so short stints stop topping the table;
- midfielders get CLN (clean sheets per game) and a bigger DIF weight, for the
  holding players whose value is not goals or assists;
- keeper and defender CLN and CON are half judged against their own club's
  rate, so a good keeper in a poor side is not sunk by the team;
- DIF = his own points per game, plus a bonus only when the club did better
  with him and both samples have 8 or more games (no penalty when the team
  won without him);
- APP (share of the 38 games, in full 90s from 2006/07) counts 10 to 15%;
- v4: rates are per 90 minutes where minutes exist, so sub cameos are not full games;
- face stats and the overall use a soft ceiling instead of a hard cap.
REP (reputation, all from verified records, no opinions):
  - league position points: 20 for finishing 1st down to 1 for 20th (22-club
    seasons scaled to the same 20), times his share of the club's games.
    This season counts in full, last season at LP_PREV, the season before at
    LP_PREV2 (seasons he was not in the Premier League are left out, not zero);
  - Champions League: his minutes in that season's competition (Tenaball's
    UEFA file, any club), plus a bonus if his club won it;
  - awards this season: PFA Player of the Year, FWA, Player of the Season
    (1 each), PFA Young Player, Golden Glove, Golden Boot (0.6 each);
  - Premier League appearances to date (small).
  REP is blended into the overall at REP_WEIGHT.
Weights:
  FWD: GOL 50, AST 20, DIF 20, APP 10
  MID: AST 22, GOL 18, CLN 15, DIF 35, APP 10
       or as a holding player AST 8, GOL 5, CLN 32, DIF 45, APP 10 (the better counts)
  DEF: CLN 45, THR 10, DIF 30, APP 15
  GK:  CLN 35, CON 35, DIF 15, APP 15
"""
import csv
import json
import math
import sys
from collections import defaultdict

repo, season, merged_path, out = sys.argv[1:5]
K = 12  # phantom games used to fill short seasons
CONF = 4  # a season of n games keeps n / (n + CONF) of its distance from average
MIN_SPLIT = 8  # games needed on both sides before with/without counts
import os
P = {k: float(os.environ.get(k, v)) for k, v in {
    "REP_WEIGHT": 0.5, "LP_PREV": 1.0, "LP_PREV2": 0.5, "W_LP": 2.0, "W_UCL": 0.0, "W_AW": 1.0, "W_CAR": 0.25, "OVR_MID": 71}.items()}
REP_WEIGHT = P["REP_WEIGHT"]  # share of the overall that comes from reputation
WEIGHTS = {
    "FWD": {"GOL": 50, "AST": 20, "DIF": 20, "APP": 10},
    "MID": {"AST": 22, "GOL": 18, "CLN": 15, "DIF": 35, "APP": 10},
    "DEF": {"CLN": 45, "THR": 10, "DIF": 30, "APP": 15},
    "GK": {"CLN": 35, "CON": 35, "DIF": 15, "APP": 15},
}
# Midfielders are also rated as holding players and keep the better of the two.
HOLDING = {"AST": 8, "GOL": 5, "CLN": 32, "DIF": 45, "APP": 10}
MIN_APPS = 10  # players below this are rated but do not set the scale

rows = list(csv.DictReader(open(merged_path, encoding="utf-8")))
# Line-up figures (tools/fetch_lineups.py): minutes, starts, clean sheets and goals
# conceded while he was on the pitch, for every season. Used in place of the
# feed's season totals, which undercount some clean sheets and lack minutes before 2006/07.
sys.path.insert(0, "tools")
from club_names import CLUB  # noqa: E402
lineup_path = merged_path.replace("merged_", "lineups_")
LU = {}
for x in csv.DictReader(open(lineup_path, encoding="utf-8")):
    LU[(x["feed_id"], CLUB.get(x["club_feed"], x["club_feed"]))] = x
for r in rows:
    x = LU.get((r["feed_id"], r["club"]))
    r["lu"] = x
    if x:
        r["clean_sheet"] = x["cs_on"]
        r["goals_conceded"] = x["ga_on"]
        if not int(r["mins_played"] or 0):
            r["mins_played"] = x["mins"]
for r in rows:
    for k in ["apps", "goals", "goal_assist", "clean_sheet", "wins", "draws", "losses", "goals_conceded", "mins_played"]:
        r[k] = int(r[k] or 0)

# club records from results
G = 0
club = defaultdict(lambda: {"pts": 0, "ga": 0, "gf": 0, "p": 0, "cs": 0})
for m in csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
    if m["season"] != season:
        continue
    hg, ag = int(m["home_goals"]), int(m["away_goals"])
    for c, f, a in ((m["home"], hg, ag), (m["away"], ag, hg)):
        club[c]["p"] += 1
        club[c]["gf"] += f
        club[c]["ga"] += a
        club[c]["pts"] += 3 if f > a else 1 if f == a else 0
        club[c]["cs"] += a == 0
G = max(c["p"] for c in club.values())
table = sorted(club, key=lambda k: (-club[k]["pts"], -(club[k]["gf"] - club[k]["ga"])))

# earlier career goal rate (Tenaball, seasons before this one)
career = defaultdict(lambda: [0, 0])
for r in csv.DictReader(open(f"{repo}/docs/data/pl_players/pl_players.csv", encoding="utf-8")):
    if r["season"] < season:
        career[r["player_id"]][0] += int(r["apps"])
        career[r["player_id"]][1] += int(r["goals"])

pos_rate = {}
for pos in WEIGHTS:
    grp = [r for r in rows if r["position"] == pos]
    apps = sum(r["apps"] for r in grp) or 1
    pos_rate[pos] = {"g": sum(r["goals"] for r in grp) / apps, "a": sum(r["goal_assist"] for r in grp) / apps,
                     "cs": sum(r["clean_sheet"] for r in grp) / apps}
lg_ga = sum(c["ga"] for c in club.values()) / (len(club) * G)
has_gc = any(r["goals_conceded"] for r in rows if r["position"] == "GK")  # true for every season once line-ups are in

for r in rows:
    pos, c = r["position"], club[r["club"]]
    # games played in full 90s where the feed has minutes (2006/07 on), otherwise appearances
    a = r["mins_played"] / 90 if r["mins_played"] else r["apps"]
    r["games"] = a
    pr = pos_rate[pos]
    capps, cgoals = career[r["player_id"]]
    gprior = cgoals / capps if capps >= 20 else pr["g"]  # his own rate if he has 20+ earlier games
    r["GOL"] = (r["goals"] + K * gprior) / (a + K)
    r["AST"] = (r["goal_assist"] + K * pr["a"]) / (a + K)
    r["THR"] = (r["goals"] + r["goal_assist"] + K * (pr["g"] + pr["a"])) / (a + K)
    cs = (r["clean_sheet"] + K * pr["cs"]) / (a + K)
    club_cs = club[r["club"]]["cs"] / G
    r["CLN"] = cs - 0.5 * club_cs if pos in ("GK", "DEF") else cs
    if has_gc:
        con = r["goals_conceded"]
    else:  # no per-player goals conceded in this era: club rate for his games (flagged)
        con = c["ga"] / G * a
    r["CON"] = -((con + K * lg_ga) / (a + K) - 0.5 * c["ga"] / G)
    played = r["wins"] + r["draws"] + r["losses"]
    with_ppg = (3 * r["wins"] + r["draws"]) / played if played else c["pts"] / G
    without_g = G - played
    without_ppg = (c["pts"] - 3 * r["wins"] - r["draws"]) / without_g if without_g > 0 else c["pts"] / G
    lg_ppg = sum(x["pts"] for x in club.values()) / (len(club) * G)
    lift = max(0.0, with_ppg - without_ppg) if played >= MIN_SPLIT and without_g >= MIN_SPLIT else 0.0
    # his own points per game (filled for short seasons), plus a bonus if the club did better with him
    r["DIF"] = (with_ppg - lg_ppg) * min(played, a) / (min(played, a) + K) + 0.3 * lift  # sub cameos count as part-games
    r["APP"] = min(a, G) / G
    r["with_ppg"], r["without_ppg"], r["without_g"] = round(with_ppg, 2), round(without_ppg, 2), without_g

# ---- reputation ----
import re
def nm(x):
    import unicodedata
    x = unicodedata.normalize("NFKD", x).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in x if ch.isalnum())
awards = defaultdict(float)  # (season, normalised name) -> points
md = open(f"{repo}/docs/data/PL_AWARDS_CUPS_2026-10-03.md", encoding="utf-8").read()
for title, pts in [("## 1. PFA Players", 1.0), ("## 2. PFA Young", 0.6), ("## 3. FWA", 1.0),
                   ("## 4. Premier League Player of the Season", 1.0), ("### 6a.", 0.6)]:
    sec = md.split(title, 1)[1].split("\n## ", 1)[0].split("\n### 6b", 1)[0]
    for line in sec.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 2 and re.fullmatch(r"\d{4}/\d{2}", cells[0]):
            for who in re.split(r" and |, ", cells[1]):
                awards[(cells[0], nm(who))] += pts
top_goals = max(r["goals"] for r in rows)
seasons_all = sorted({x["season"] for x in csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8"))})
season_pts = defaultdict(lambda: defaultdict(int))
season_games = defaultdict(int)
for m in csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
    hg, ag = int(m["home_goals"]), int(m["away_goals"])
    season_pts[m["season"]][m["home"]] += 3 if hg > ag else 1 if hg == ag else 0
    season_pts[m["season"]][m["away"]] += 3 if ag > hg else 1 if hg == ag else 0
finish = {}
for sn, t in season_pts.items():
    order = sorted(t, key=lambda k: -t[k])
    n = len(order)
    for i, c in enumerate(order):
        finish[(sn, c)] = (n - i) * 20 / n  # 20 points for 1st down to about 1 for last
    season_games[sn] = 2 * (n - 1)
lp = defaultdict(float)  # (player_id, season) -> league position points for his share of games
career_apps = defaultdict(int)
for x in csv.DictReader(open(f"{repo}/docs/data/pl_players/pl_players.csv", encoding="utf-8")):
    lp[(x["player_id"], x["season"])] += finish[(x["season"], x["club"])] * min(int(x["apps"]), season_games[x["season"]]) / season_games[x["season"]]
    if x["season"] <= season:
        career_apps[x["player_id"]] += int(x["apps"])
si = seasons_all.index(season)
prev = seasons_all[si - 1] if si >= 1 else None
prev2 = seasons_all[si - 2] if si >= 2 else None
ucl_min = defaultdict(int)
for x in csv.DictReader(open(f"{repo}/docs/data/cups/ucl/cl_player_seasons_uefa.csv", encoding="utf-8")):
    if x["season"] == season:
        ucl_min[nm(x["player"])] += int(x["minutes"] or 0)
final_year = str(int(season[:4]) + 1)
ucl_winner = ""
for x in csv.DictReader(open(f"{repo}/docs/data/cups/ucl/cl_finals_1993_2026.csv", encoding="utf-8")):
    if x["final"] == final_year:
        ucl_winner = x["winner"]
for r in rows:
    pid = r["player_id"]
    share = min(r["games"], G) / G
    parts = [(1.0, finish[(season, r["club"])] * share)]
    for sn, w in ((prev, P["LP_PREV"]), (prev2, P["LP_PREV2"])):
        if sn and (pid, sn) in lp:
            parts.append((w, lp[(pid, sn)]))
    lp_score = sum(w * v for w, v in parts) / sum(w for w, _ in parts) / 20  # 0 to 1
    aw = awards.get((season, nm(r["player"])), 0) + (0.6 if r["goals"] == top_goals else 0)
    ucl = min(ucl_min.get(nm(r["player"]), 0) / 900, 1.2) + (0.5 if ucl_winner and nm(ucl_winner) in nm(r["club"] + ("united" if r["club"] == "Man Utd" else "")) and r["apps"] >= 10 else 0)
    r["awards_pts"], r["titles"], r["lp"], r["ucl"] = aw, 0, round(lp_score * 20, 1), round(ucl, 2)
    r["REP"] = (P["W_LP"] * lp_score + P["W_AW"] * min(aw, 2) + P["W_UCL"] * ucl
                + P["W_CAR"] * math.log1p(career_apps[pid]) / math.log1p(400))

def zscale(pos, key):
    q = [r[key] for r in rows if r["position"] == pos and r["apps"] >= MIN_APPS]
    m = sum(q) / len(q)
    sd = math.sqrt(sum((x - m) ** 2 for x in q) / len(q)) or 1
    return m, sd

face = {}
for pos, w in WEIGHTS.items():
    scales = {k: zscale(pos, k) for k in w}
    for r in [r for r in rows if r["position"] == pos]:
        r["z"] = {k: (r[k] - scales[k][0]) / scales[k][1] for k in w}
        r["face"] = {k: round(60 + 39 * math.tanh(r["z"][k] / 2.2)) for k in w}
        perf = sum(r["z"][k] * v for k, v in w.items()) / sum(w.values())
        r["role"] = ""
        if pos == "MID":
            hold = sum(r["z"][k] * v for k, v in HOLDING.items()) / sum(HOLDING.values())
            if hold > perf:
                perf, r["role"] = hold, "holding"
        perf *= r["games"] / (r["games"] + CONF)
        r["perf"] = perf
    grp = [r for r in rows if r["position"] == pos]
    pm, ps = zscale(pos, "perf")
    rm, rs = zscale(pos, "REP")
    for r in grp:
        r["repz"] = (r["REP"] - rm) / rs
        r["face"]["REP"] = round(60 + 39 * math.tanh(r["repz"] / 2.2))
        r["score"] = (1 - REP_WEIGHT) * (r["perf"] - pm) / ps + REP_WEIGHT * r["repz"]
    q = [r["score"] for r in grp if r["apps"] >= MIN_APPS]
    m = sum(q) / len(q)
    sd = math.sqrt(sum((x - m) ** 2 for x in q) / len(q)) or 1
    for r in [r for r in rows if r["position"] == pos]:
        r["ovr"] = round(P["OVR_MID"] + (99 - P["OVR_MID"]) * math.tanh((r["score"] - m) / sd / 2.6))

best = {}
for r in rows:
    b = best.get(r["club"])
    if not b or r["ovr"] > b["ovr"] or (r["ovr"] == b["ovr"] and r["score"] > b["score"]):
        best[r["club"]] = r
out_rows = []
for r in rows:
    tier = "best" if best[r["club"]] is r else "gold" if r["ovr"] >= 75 else "silver" if r["ovr"] >= 65 else "bronze"
    out_rows.append({"club": r["club"], "clubPos": table.index(r["club"]) + 1, "player": r["player"], "pos": r["position"],
                     "ovr": r["ovr"], "tier": tier, "stats": r["face"], "apps": r["apps"], "goals": r["goals"],
                     "assists": r["goal_assist"], "cleanSheets": r["clean_sheet"], "wdl": [r["wins"], r["draws"], r["losses"]],
                     "withPPG": r["with_ppg"], "withoutPPG": r["without_ppg"], "withoutGames": r["without_g"],
                     "minutes": r["mins_played"], "goalsConceded": r["goals_conceded"], "awardsPts": r["awards_pts"], "role": r.get("role", ""), "lpPoints": r["lp"], "ucl": r["ucl"], "titles": r["titles"], "flag": r["flag"]})
json.dump({"season": season, "conFromClub": not has_gc, "clubs": table, "players": out_rows}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(season, len(out_rows), "rated; GK conceded from", "feed" if has_gc else "club record (no per-player data)")
