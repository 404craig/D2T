"""Join a season's Premier League feed rows to Tenaball's verified pl_players rows.

Usage: python3 tools/match_feed.py <tenaball_repo> <season> <feed.csv> <out.csv>

Apps and goals from Tenaball are the verified figures; the feed adds assists,
clean sheets, wins, draws, losses, minutes and so on. Rows where the two
disagree on apps or goals are kept and flagged.
"""
import csv
import sys
import unicodedata
from collections import defaultdict

repo, season, feed_path, out = sys.argv[1:5]
sys.path.insert(0, __import__('os').path.dirname(__file__))
from club_names import CLUB  # noqa: E402


ALIAS = {"chicharito": "javier hernandez", "alex evtushok": "oleksandr yevtushok", "zanka": "mathias jorgensen", "tahar elkhalej": "tahar el khalej"}  # feed name -> Tenaball name


# Extra aliases, one JSON file per contributor: {"clubs": {feed name: Tenaball name}, "players": {feed name: Tenaball name}}
import glob as _glob
import json as _json
import os as _os
for _f in sorted(_glob.glob(_os.path.join(_os.path.dirname(__file__), "..", "docs", "cards", "feed", "aliases", "*.json"))):
    _a = _json.load(open(_f, encoding="utf-8"))
    CLUB.update(_a.get("clubs", {}))
    ALIAS.update({k: v for k, v in _a.get("players", {}).items()})


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in s if ch.isalnum() or ch == " ").strip()


ten = [r for r in csv.DictReader(open(f"{repo}/docs/data/pl_players/pl_players.csv", encoding="utf-8")) if r["season"] == season]
ten_clubs = {r["club"] for r in ten}
by_club = defaultdict(list)
for r in ten:
    by_club[r["club"]].append(r)
feed = list(csv.DictReader(open(feed_path, encoding="utf-8")))
used, merged, unmatched_feed = set(), [], []
for f in feed:
    club = CLUB.get(f["club_feed"], f["club_feed"])
    if club not in ten_clubs:
        raise SystemExit(f"unknown club {f['club_feed']}")
    cands = by_club[club]
    n = norm(f["name"])
    n = norm(ALIAS.get(n, ALIAS.get(f["name"], n)))
    hit = [r for r in cands if norm(r["player"]) == n or norm(r["full_name"]) == n]
    if not hit:  # surname plus same apps
        sur = n.split()[-1] if n else ""
        hit = [r for r in cands if norm(r["surname"]) == sur and int(r["apps"]) == int(f["appearances"])]
    if not hit:  # names written the other way round (Riga Mustapha / Mustapha Riga)
        hit = [r for r in cands if sorted(norm(r["player"]).split()) == sorted(n.split())]
    if not hit:  # same surname, same goals, apps within one (Matt / Matthew Upson)
        sur = n.split()[-1] if n else ""
        hit = [r for r in cands if norm(r["surname"]) == sur and int(r["goals"]) == int(f["goals"])
               and abs(int(r["apps"]) - int(f["appearances"])) <= 1]
    if not hit:  # same apps and goals, unique at the club, first name initial
        hit = [r for r in cands if int(r["apps"]) == int(f["appearances"]) and int(r["goals"]) == int(f["goals"])
               and norm(r["player"])[:1] == n[:1] and (club, r["player_id"]) not in used]
        hit = hit if len(hit) == 1 else []
    hit = [r for r in hit if (club, r["player_id"]) not in used]
    if not hit:
        unmatched_feed.append(f)
        continue
    t = hit[0]
    used.add((club, t["player_id"]))
    flag = []
    if int(t["apps"]) != int(f["appearances"]):
        flag.append(f"apps tenaball {t['apps']} feed {f['appearances']}")
    if int(t["goals"]) != int(f["goals"]):
        flag.append(f"goals tenaball {t['goals']} feed {f['goals']}")
    merged.append({"season": season, "club": club, "player_id": t["player_id"], "player": t["player"], "position": t["position"],
                   "nationality": t["nationality"], "apps": t["apps"], "goals": t["goals"],
                   **{k: f[k] for k in ["feed_id", "goal_assist", "clean_sheet", "wins", "draws", "losses", "mins_played",
                                        "game_started", "goals_conceded", "saves", "yellow_card", "red_card", "own_goals"]},
                   "flag": "; ".join(flag)})
missing = [r for r in ten if (r["club"], r["player_id"]) not in used]
with open(out, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(merged[0].keys()))
    w.writeheader()
    w.writerows(merged)
print(f"{season}: tenaball {len(ten)}, feed {len(feed)}, matched {len(merged)}, flagged {sum(1 for m in merged if m['flag'])}")
for r in missing:
    print("  tenaball row not in feed:", r["club"], r["player"], r["apps"], r["goals"])
for f in unmatched_feed:
    print("  feed row not matched:", f["club_feed"], f["name"], f["appearances"], f["goals"])
for m in merged:
    if m["flag"]:
        print("  flag:", m["club"], m["player"], m["flag"])
