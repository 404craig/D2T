"""Draft v2 card ratings from merged feed + Tenaball rows.

Usage: python3 tools/rate_v2.py <tenaball_repo> <season> <merged.csv> <out.json>

Four stats per position, every one per game played (appearances are shown on
the card but do not count towards the overall):
  ATT: GOL goals, AST assists, DIF difference maker
  MID: AST assists, GOL goals, DIF difference maker
  DEF: CLN clean sheets, THR goals plus assists, DIF difference maker
  GK:  CLN clean sheets, CON goals conceded (fewer is better), DIF difference maker
DIF = half his own points per game, half the club's points per game with him
minus without him (shrunk when either sample is small). Short seasons are filled with the player's own earlier
Premier League goal rate (position average if he has none).
Each stat and the overall are scaled within the season and position, so the
best players of any season land in the 90s.
"""
import csv
import json
import math
import sys
from collections import defaultdict

repo, season, merged_path, out = sys.argv[1:5]
K = 10  # phantom games used to fill short seasons
CONF = 6  # a season of n games keeps n / (n + CONF) of its distance from average
WEIGHTS = {
    "FWD": {"GOL": 55, "AST": 25, "DIF": 20},
    "MID": {"AST": 40, "GOL": 40, "DIF": 20},
    "DEF": {"CLN": 55, "THR": 20, "DIF": 25},
    "GK": {"CLN": 45, "CON": 40, "DIF": 15},
}
MIN_APPS = 10  # players below this are rated but do not set the scale

rows = list(csv.DictReader(open(merged_path, encoding="utf-8")))
for r in rows:
    for k in ["apps", "goals", "goal_assist", "clean_sheet", "wins", "draws", "losses", "goals_conceded", "mins_played"]:
        r[k] = int(r[k] or 0)

# club records from results
G = 0
club = defaultdict(lambda: {"pts": 0, "ga": 0, "gf": 0, "p": 0})
for m in csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
    if m["season"] != season:
        continue
    hg, ag = int(m["home_goals"]), int(m["away_goals"])
    for c, f, a in ((m["home"], hg, ag), (m["away"], ag, hg)):
        club[c]["p"] += 1
        club[c]["gf"] += f
        club[c]["ga"] += a
        club[c]["pts"] += 3 if f > a else 1 if f == a else 0
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
    r["CLN"] = (r["clean_sheet"] + K * pr["cs"]) / (a + K)
    if has_gc:
        con = r["goals_conceded"]
    else:  # no per-player goals conceded in this era: club rate for his games (flagged)
        con = c["ga"] / G * a
    r["CON"] = -((con + K * lg_ga) / (a + K))
    played = r["wins"] + r["draws"] + r["losses"]
    with_ppg = (3 * r["wins"] + r["draws"]) / played if played else c["pts"] / G
    without_g = G - played
    without_ppg = (c["pts"] - 3 * r["wins"] - r["draws"]) / without_g if without_g > 0 else c["pts"] / G
    shrink = (played / (played + 6)) * (without_g / (without_g + 6))
    lg_ppg = sum(x["pts"] for x in club.values()) / (len(club) * G)
    # half his own points per game, half how much better the club did with him
    r["DIF"] = 0.5 * (with_ppg - lg_ppg) * played / (played + K) + 0.5 * (with_ppg - without_ppg) * shrink
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
        r["face"] = {k: max(20, min(99, round(60 + 13 * r["z"][k]))) for k in w}
        r["score"] = sum(r["z"][k] * v for k, v in w.items()) / sum(w.values()) * r["apps"] / (r["apps"] + CONF)
    q = [r["score"] for r in rows if r["position"] == pos and r["apps"] >= MIN_APPS]
    m = sum(q) / len(q)
    sd = math.sqrt(sum((x - m) ** 2 for x in q) / len(q)) or 1
    for r in [r for r in rows if r["position"] == pos]:
        r["ovr"] = max(40, min(97, round(66 + 9.5 * (r["score"] - m) / sd)))

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
