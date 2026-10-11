"""Draft v4 card ratings: v3 plus a reputation part (REP).

Usage: python3 tools/rate_v4.py <tenaball_repo> <season> <merged.csv> <out.json>

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
  - this season: club finish (champions most, then top four, top seven),
    counted for the share of games he played;
  - this season: PFA Player of the Year, FWA Footballer of the Year,
    Premier League Player of the Season (1 each), PFA Young Player, Golden
    Glove, Golden Boot (0.6 each);
  - career to this season: Premier League titles won (10+ apps in a title
    season) and Premier League appearances.
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
REP_WEIGHT = 0.33  # share of the overall that comes from reputation
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
# titles: every season's champion from results, then 10+ apps for that club
season_pts = defaultdict(lambda: defaultdict(int))
for m in csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8")):
    hg, ag = int(m["home_goals"]), int(m["away_goals"])
    season_pts[m["season"]][m["home"]] += 3 if hg > ag else 1 if hg == ag else 0
    season_pts[m["season"]][m["away"]] += 3 if ag > hg else 1 if hg == ag else 0
champ = {}
for sn, t in season_pts.items():
    champ[sn] = max(t, key=t.get)
titles, career_apps = defaultdict(int), defaultdict(int)
for x in csv.DictReader(open(f"{repo}/docs/data/pl_players/pl_players.csv", encoding="utf-8")):
    if x["season"] <= season:
        career_apps[x["player_id"]] += int(x["apps"])
        if champ.get(x["season"]) == x["club"] and int(x["apps"]) >= 10:
            titles[x["player_id"]] += 1
finish_pts = {1: 1.0, 2: 0.6, 3: 0.6, 4: 0.6, 5: 0.3, 6: 0.3, 7: 0.3}
for r in rows:
    pos_in_table = table.index(r["club"]) + 1
    share = min(r["apps"], G) / G
    aw = awards.get((season, nm(r["player"])), 0) + (0.6 if r["goals"] == top_goals else 0)
    r["awards_pts"] = aw
    r["titles"] = titles[r["player_id"]]
    r["REP"] = (0.8 * finish_pts.get(pos_in_table, 0) * share + 1.5 * min(aw, 2)
                + 0.5 * math.log1p(titles[r["player_id"]]) + 0.25 * math.log1p(career_apps[r["player_id"]]) / math.log1p(400))

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
                     "minutes": r["mins_played"], "goalsConceded": r["goals_conceded"], "awardsPts": r["awards_pts"], "role": r.get("role", ""), "titles": r["titles"], "flag": r["flag"]})
json.dump({"season": season, "conFromClub": not has_gc, "clubs": table, "players": out_rows}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(season, len(out_rows), "rated; GK conceded from", "feed" if has_gc else "club record (no per-player data)")
