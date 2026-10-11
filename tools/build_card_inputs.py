"""Build the raw inputs for the D2T card-rating prototype from Tenaball's data.

Usage: python3 tools/build_card_inputs.py <tenaball_repo> <season> <out.json>
Example: python3 tools/build_card_inputs.py ../tenaball 2007/08 docs/cards/cards_2007-08.json

Everything written is a fact from pl_players.csv or pl_results.csv (or a count
of those facts). The ratings themselves are computed from these in the page,
so the formula can be changed without rebuilding the data.
"""
import csv
import json
import sys
from collections import defaultdict

repo, season, out = sys.argv[1], sys.argv[2], sys.argv[3]
players = list(csv.DictReader(open(f"{repo}/docs/data/pl_players/pl_players.csv", encoding="utf-8")))
results = list(csv.DictReader(open(f"{repo}/docs/data/pl_results/pl_results.csv", encoding="utf-8")))
seasons = sorted({r["season"] for r in players})
prev_season = seasons[seasons.index(season) - 1] if seasons.index(season) else None

# Club record for the season, built match by match.
clubs = defaultdict(lambda: {"p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "cs": 0, "pts": 0})
for m in results:
    if m["season"] != season:
        continue
    hg, ag = int(m["home_goals"]), int(m["away_goals"])
    for club, f, a in ((m["home"], hg, ag), (m["away"], ag, hg)):
        c = clubs[club]
        c["p"] += 1
        c["gf"] += f
        c["ga"] += a
        c["cs"] += a == 0
        if f > a:
            c["w"] += 1
            c["pts"] += 3
        elif f == a:
            c["d"] += 1
            c["pts"] += 1
        else:
            c["l"] += 1
table = sorted(clubs, key=lambda k: (-clubs[k]["pts"], -(clubs[k]["gf"] - clubs[k]["ga"]), -clubs[k]["gf"]))
for i, k in enumerate(table, 1):
    clubs[k]["pos"] = i
    clubs[k]["name"] = k

# Career to date: Premier League apps and goals before this season, and last season.
before = defaultdict(lambda: {"apps": 0, "goals": 0, "seasons": set(), "clubs": set()})
last = defaultdict(lambda: {"apps": 0, "goals": 0, "clubs": []})
for r in players:
    if r["season"] < season:
        b = before[r["player_id"]]
        b["apps"] += int(r["apps"])
        b["goals"] += int(r["goals"])
        b["seasons"].add(r["season"])
        b["clubs"].add(r["club"])
    if r["season"] == prev_season:
        l = last[r["player_id"]]
        l["apps"] += int(r["apps"])
        l["goals"] += int(r["goals"])
        l["clubs"].append(r["club"])

rows = [r for r in players if r["season"] == season]
moved = defaultdict(int)
for r in rows:
    moved[r["player_id"]] += 1

out_rows = []
for r in rows:
    pid = r["player_id"]
    b, l = before[pid], last.get(pid)
    out_rows.append({
        "id": pid,
        "name": r["player"],
        "full": r["full_name"],
        "club": r["club"],
        "pos": r["position"],
        "nat": r["nationality"],
        "apps": int(r["apps"]),
        "goals": int(r["goals"]),
        "moved": moved[pid] > 1,
        "prevApps": b["apps"],
        "prevGoals": b["goals"],
        "prevSeasons": len(b["seasons"]),
        "prevClubs": len(b["clubs"]),
        "last": {"apps": l["apps"], "goals": l["goals"], "clubs": l["clubs"]} if l else None,
    })

json.dump({
    "season": season,
    "source": "Tenaball docs/data/pl_players/pl_players.csv and docs/data/pl_results/pl_results.csv",
    "clubs": [clubs[k] for k in table],
    "players": out_rows,
}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{season}: {len(out_rows)} player rows, {len(table)} clubs -> {out}")
