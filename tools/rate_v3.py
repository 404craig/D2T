"""Draft v3 card ratings from merged feed + Tenaball rows.

Usage: python3 tools/rate_v3.py <tenaball_repo> <season> <merged.csv> <out.json>

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
- APP (share of the 38 games) counts 10 to 15%;
- face stats and the overall use a soft ceiling instead of a hard cap.
Weights:
  FWD: GOL 50, AST 20, DIF 20, APP 10
  MID: AST 25, GOL 20, CLN 15, DIF 30, APP 10
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
WEIGHTS = {
    "FWD": {"GOL": 50, "AST": 20, "DIF": 20, "APP": 10},
    "MID": {"AST": 25, "GOL": 20, "CLN": 15, "DIF": 30, "APP": 10},
    "DEF": {"CLN": 45, "THR": 10, "DIF": 30, "APP": 15},
    "GK": {"CLN": 35, "CON": 35, "DIF": 15, "APP": 15},
}
MIN_APPS = 10  # players below this are rated but do not set the scale

rows = list(csv.DictReader(open(merged_path, encoding="utf-8")))
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
has_gc = any(r["goals_conceded"] for r in rows if r["position"] == "GK")

for r in rows:
    pos, a, c = r["position"], r["apps"], club[r["club"]]
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
    r["DIF"] = (with_ppg - lg_ppg) * played / (played + K) + 0.3 * lift
    r["APP"] = min(a, G) / G
    r["with_ppg"], r["without_ppg"], r["without_g"] = round(with_ppg, 2), round(without_ppg, 2), without_g

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
        r["score"] = sum(r["z"][k] * v for k, v in w.items()) / sum(w.values()) * r["apps"] / (r["apps"] + CONF)
    q = [r["score"] for r in rows if r["position"] == pos and r["apps"] >= MIN_APPS]
    m = sum(q) / len(q)
    sd = math.sqrt(sum((x - m) ** 2 for x in q) / len(q)) or 1
    for r in [r for r in rows if r["position"] == pos]:
        r["ovr"] = round(66 + 31 * math.tanh((r["score"] - m) / sd / 2.6))

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
                     "minutes": r["mins_played"], "goalsConceded": r["goals_conceded"], "flag": r["flag"]})
json.dump({"season": season, "conFromClub": not has_gc, "clubs": table, "players": out_rows}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(season, len(out_rows), "rated; GK conceded from", "feed" if has_gc else "club record (no per-player data)")
