"""Export game-ready cards for every season.

Usage: python3 tools/export_game_cards.py
Writes docs/cards/game/cards_<YYYY-YY>.json (one per season) and docs/cards/game/legends.json.

Card levels (Craig, 11 October 2026):
- legend: the top 3 players of every season (102 cards); drawn from any season, rarer than purple
- purple: the top 5 players of the season you are playing (league-wide, any club)
- gold 80+, silver 70 to 79, bronze under 70 (the card rating)
A player who moved clubs during a season is one card per season with each club listed in
the order he played for them, with first and last match dates from the match line-ups, so the
game can show the club he was at on a given date and the club whose squad you are viewing.
"""
import csv
import glob
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from club_names import CLUB  # noqa: E402

OUT = "docs/cards/game"
os.makedirs(OUT, exist_ok=True)
legends = []
summary = []
for f in sorted(glob.glob("docs/cards/feed/rated_fit_*.json")):
    t = f.split("rated_fit_")[1][:7]
    season = t[:4] + "/" + t[5:]
    rated = json.load(open(f, encoding="utf-8"))["players"]
    lu = {}
    lp = f"docs/cards/feed/lineups_{t}.csv"
    if os.path.exists(lp):
        for x in csv.DictReader(open(lp, encoding="utf-8")):
            lu[(x["feed_id"], CLUB.get(x["club_feed"], x["club_feed"]))] = x
    merged = {}
    mp = f"docs/cards/feed/merged_{t}.csv"
    for x in csv.DictReader(open(mp, encoding="utf-8")):
        merged[(x["club"], x["player_id"])] = x
    people = {}
    for r in rated:
        pid = r.get("id") or r["player"]
        m = merged.get((r["club"], pid), {})
        l = lu.get((m.get("feed_id"), r["club"]), {})
        entry = {"club": r["club"], "apps": r["apps"], "goals": r["goals"], "assists": r.get("assists"),
                 "cleanSheets": r.get("cleanSheets"), "minutes": r.get("minutes"),
                 "first": l.get("first_match") or None, "last": l.get("last_match") or None, "ovr": r["ovr"]}
        p = people.setdefault(pid, {"id": pid, "name": r["player"], "pos": r["pos"], "nat": None, "clubs": [], "ovr": 0})
        p["clubs"].append(entry)
        p["ovr"] = max(p["ovr"], r["ovr"])
        if m.get("nationality"):
            p["nat"] = m["nationality"]
    for p in people.values():
        # order clubs by when he played for them; without dates, the club with more games first
        p["clubs"].sort(key=lambda c: (c["first"] or "9999", -c["apps"]))
        p["apps"] = sum(c["apps"] for c in p["clubs"])
        p["goals"] = sum(c["goals"] for c in p["clubs"])
    ranked = sorted(people.values(), key=lambda p: (-p["ovr"], -p["apps"], p["name"]))
    top5 = {p["id"] for p in ranked[:5]}
    for p in people.values():
        p["level"] = "purple" if p["id"] in top5 else "gold" if p["ovr"] >= 80 else "silver" if p["ovr"] >= 70 else "bronze"
    for p in ranked[:3]:
        legends.append({"season": season, "id": p["id"], "name": p["name"], "pos": p["pos"], "ovr": p["ovr"],
                        "club": max(p["clubs"], key=lambda c: c["apps"])["club"], "apps": p["apps"], "goals": p["goals"]})
    json.dump({"season": season, "players": ranked}, open(f"{OUT}/cards_{t}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    movers = sum(1 for p in people.values() if len(p["clubs"]) > 1)
    dated = sum(1 for p in people.values() if len(p["clubs"]) > 1 and all(c["first"] for c in p["clubs"]))
    summary.append((season, len(people), movers, dated, [(p["name"], p["ovr"]) for p in ranked[:5]]))
json.dump({"rule": "top 3 players of every season", "cards": legends}, open(f"{OUT}/legends.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for s, n, mv, dt, top in summary:
    print(f"{s}: {n} players, {mv} moved mid-season ({dt} dated) | purple: " + ", ".join(f"{a} {b}" for a, b in top))
print(f"legends: {len(legends)} cards")
