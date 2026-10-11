"""Fetch per-player, per-club season stats from the Premier League stats feed.

Usage: python3 tools/fetch_pl_feed.py <season label e.g. 2008/09> <out.csv>

One row per player and club. Stats a player has none of are written as 0.
The feed is the data behind premierleague.com/stats (footballapi.pulselive.com).
"""
import csv
import json
import sys
import time
import urllib.request

H = {"Origin": "https://www.premierleague.com", "Referer": "https://www.premierleague.com/", "User-Agent": "Mozilla/5.0"}
B = "https://footballapi.pulselive.com/football"
STATS = ["appearances", "goals", "goal_assist", "clean_sheet", "wins", "draws", "losses",
         "mins_played", "game_started", "goals_conceded", "saves", "yellow_card", "red_card", "own_goals"]


def get(url):
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=40))
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError(url)


label, out = sys.argv[1], sys.argv[2]
seasons = get(f"{B}/competitions/1/compseasons?page=0&pageSize=100")["content"]
cs = next(int(s["id"]) for s in seasons if s["label"] == label)
teams = get(f"{B}/compseasons/{cs}/teams")
rows = {}
for t in teams:
    tid, tname = int(t["id"]), t["name"]
    for stat in STATS:
        page = 0
        while True:
            r = get(f"{B}/stats/ranked/players/{stat}?page={page}&pageSize=100&compSeasons={cs}&comps=1&teams={tid}")["stats"]
            for e in r["content"]:
                o = e["owner"]
                key = (int(o["id"]), tname)
                row = rows.setdefault(key, {"season": label, "club_feed": tname, "feed_id": int(o["id"]),
                                            "name": o["name"]["display"], "feed_pos": o.get("info", {}).get("position", ""),
                                            **{s: 0 for s in STATS}})
                row[stat] = int(e["value"])
            if page + 1 >= r["pageInfo"]["numPages"]:
                break
            page += 1
    print(label, tname, sum(1 for k in rows if k[1] == tname), "players", flush=True)
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["season", "club_feed", "feed_id", "name", "feed_pos"] + STATS)
    w.writeheader()
    for r in sorted(rows.values(), key=lambda r: (r["club_feed"], -r["appearances"])):
        w.writerow(r)
print(f"{label}: {len(rows)} rows -> {out}")
