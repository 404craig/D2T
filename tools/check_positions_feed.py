"""Cross-check: compiled main positions against the Premier League feed's formation slots.

Usage: python3 tools/check_positions_feed.py

For every season with feed slots (2015/16 on, docs/cards/feed/slots), each player's most used
slot is compared with his main position in data/source/positions.json (matched on season and
name). "Same" is an exact match; "same zone" also accepts labels for one role in different
shapes (RWB with RB or RM, LWB with LB or LM, CDM, CM and CAM with each other, RW with RM,
LW with LM).
"""
import csv
import glob
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from build_positions import norm  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
ZONE = {"RWB": "R", "RB": "R", "RM": "R", "RW": "RA", "LWB": "L", "LB": "L", "LM": "L", "LW": "LA",
        "CDM": "C", "CM": "C", "CAM": "C", "CB": "CB", "ST": "ST", "GK": "GK"}


def zone_ok(a, b):
    if a == b or ZONE[a] == ZONE[b]:
        return True
    pair = {a, b}
    return pair in ({"RW", "RM"}, {"LW", "LM"})


def main():
    P = json.load(open(os.path.join(ROOT, "data", "source", "positions.json")))
    ids = {}
    for r in csv.DictReader(open(os.path.join(ROOT, "data", "source", "pl_players.csv"))):
        ids.setdefault((r["season"], norm(r["player"])), r["player_id"])
    tot, lines = Counter(), []
    for f in sorted(glob.glob(os.path.join(ROOT, "docs", "cards", "feed", "slots", "slots_*.csv"))):
        season = os.path.basename(f)[6:13].replace("-", "/")
        if season < "2015/16" or season not in P:
            continue
        per = Counter()
        for r in csv.DictReader(open(f)):
            if int(r["starts_with_slot"]) < 10:
                continue
            pid = ids.get((season, norm(r["name"])))
            mine = P[season].get(pid) if pid else None
            if not mine:
                per["unmatched"] += 1
                continue
            top = r["slots"].split()[0].split(":")[0]
            per["n"] += 1
            if top == mine[0]:
                per["same"] += 1
            elif zone_ok(top, mine[0]):
                per["zone"] += 1
            elif top in mine:
                per["listed"] += 1
            else:
                per["diff"] += 1
                lines.append(f"{season} {r['name']}: feed {r['slots']} | ours {mine}")
        tot.update(per)
        n = per["n"] or 1
        print(f"{season}: {per['n']} players (10+ starts): same {100*per['same']/n:.0f}%, same zone {100*per['zone']/n:.0f}%, "
              f"feed's slot among ours {100*per['listed']/n:.0f}%, different {100*per['diff']/n:.0f}%")
    n = tot["n"] or 1
    print(f"ALL: {tot['n']}: same {100*tot['same']/n:.1f}%, same zone {100*tot['zone']/n:.1f}%, among ours {100*tot['listed']/n:.1f}%, different {100*tot['diff']/n:.1f}%")
    return lines


if __name__ == "__main__":
    for line in main()[:60]:
        print("  ", line)
