"""Write data/source/moves.json: for every player who played for two clubs in one season,
the first and last league match date for each club, from the Premier League feed's match line-ups.

Usage: python3 tools/export_moves.py
Format: {"1994/95": {"<Tenaball player_id>": {"Ipswich": ["1994-08-20", "1995-01-14"], "Arsenal": [...]}}}
"""
import csv
import glob
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from club_names import CLUB  # noqa: E402

out = defaultdict(dict)
for mp in sorted(glob.glob("docs/cards/feed/merged_*.csv")):
    t = mp.split("merged_")[1][:7]
    season = t[:4] + "/" + t[5:]
    lp = f"docs/cards/feed/lineups_{t}.csv"
    if not os.path.exists(lp):
        continue
    dates = {}
    for x in csv.DictReader(open(lp, encoding="utf-8")):
        if x.get("first_match"):
            dates[(x["feed_id"], CLUB.get(x["club_feed"], x["club_feed"]))] = [x["first_match"], x["last_match"]]
    rows = defaultdict(list)
    for x in csv.DictReader(open(mp, encoding="utf-8")):
        rows[x["player_id"]].append(x)
    for pid, rs in rows.items():
        if len(rs) < 2:
            continue
        d = {r["club"]: dates.get((r["feed_id"], r["club"])) for r in rs}
        if all(d.values()):
            out[season][pid] = d
json.dump(out, open("data/source/moves.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
print(f"moves.json: {sum(len(v) for v in out.values())} mid-season movers dated across {len(out)} seasons")
