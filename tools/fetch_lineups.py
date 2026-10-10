"""Per-player season figures built from every match line-up in the Premier League feed.

Usage: python3 tools/fetch_lineups.py <season label e.g. 1996/97> <out.csv>

For each player and club: starts, sub appearances, minutes, team goals for and
against while he was on the pitch, clean sheets while on the pitch (60+ minutes
and nothing conceded while he was on), points in games he played, the positions
he was listed at, and date of birth. Built from the feed's line-ups and timed
events (substitutions, goals, red cards).
"""
import csv
import json
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

H = {"Origin": "https://www.premierleague.com", "Referer": "https://www.premierleague.com/", "User-Agent": "Mozilla/5.0"}
B = "https://footballapi.pulselive.com/football"


def get(url):
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=40))
        except Exception:
            time.sleep(2 ** i)
    raise RuntimeError(url)


label, out = sys.argv[1], sys.argv[2]
cs = next(int(s["id"]) for s in get(f"{B}/competitions/1/compseasons?page=0&pageSize=100")["content"] if s["label"] == label)
ids, page = [], 0
while True:
    f = get(f"{B}/fixtures?comps=1&compSeasons={cs}&page={page}&pageSize=40&sort=asc&statuses=C")
    ids += [int(x["id"]) for x in f["content"]]
    if page + 1 >= f["pageInfo"]["numPages"]:
        break
    page += 1
with ThreadPoolExecutor(8) as ex:
    fixtures = list(ex.map(lambda i: get(f"{B}/fixtures/{i}?altIds=true"), ids))

P = defaultdict(lambda: {"starts": 0, "subs": 0, "mins": 0, "gf_on": 0, "ga_on": 0, "cs_on": 0, "w": 0, "d": 0, "l": 0, "pos": Counter()})
info = {}
problems = []
for fx in fixtures:
    teams = {int(t["team"]["id"]): t for t in fx["teams"]}
    tname = {k: v["team"]["name"] for k, v in teams.items()}
    home_id = int(fx["teams"][0]["team"]["id"])
    ev = fx.get("events") or []
    end = max([e["clock"]["secs"] for e in ev if e.get("type") == "PE"] or [5400]) / 60
    end = max(end, 90)
    goals = []  # (minute, team that scored)
    prev = (0, 0)
    for e in sorted(ev, key=lambda e: e["clock"]["secs"]):
        sc = e.get("score")
        if sc:
            now = (int(sc["homeScore"]), int(sc["awayScore"]))
            if now != prev:
                scorer = home_id if now[0] > prev[0] else [k for k in teams if k != home_id][0]
                goals.append((e["clock"]["secs"] / 60, scorer))
                prev = now
    final = (int(fx["teams"][0]["score"]), int(fx["teams"][1]["score"]))
    if prev != final:
        problems.append(f"{fx['id']} events {prev} final {final}")
    on, off = {}, {}
    for e in ev:
        if e.get("type") == "S" and e.get("personId") is not None:
            (on if e.get("description") == "ON" else off)[int(e["personId"])] = e["clock"]["secs"] / 60
        if e.get("type") == "B" and e.get("description") in ("R", "YR") and e.get("personId") is not None:
            off[int(e["personId"])] = min(off.get(int(e["personId"]), 999), e["clock"]["secs"] / 60)
    for tl in fx.get("teamLists") or []:
        tid = int(tl["teamId"])
        opp = [k for k in teams if k != tid][0]
        tf = int(teams[tid]["score"]); ta = int(teams[opp]["score"])
        for grp, started in ((tl.get("lineup", []), True), (tl.get("substitutes", []), False)):
            for p in grp:
                pid = int(p["id"])
                if started:
                    t0 = 0
                elif pid in on:
                    t0 = on[pid]
                else:
                    continue  # unused substitute
                t1 = min(off.get(pid, end), end)
                if t1 < t0:
                    t1 = end
                k = (pid, tname[tid])
                r = P[k]
                r["starts" if started else "subs"] += 1
                r["mins"] += round(t1 - t0)
                ga = sum(1 for m, s in goals if s == opp and t0 < m <= t1 + 0.01)
                gf = sum(1 for m, s in goals if s == tid and t0 < m <= t1 + 0.01)
                r["ga_on"] += ga
                r["gf_on"] += gf
                if t1 - t0 >= 60 and ga == 0:
                    r["cs_on"] += 1
                r["w" if tf > ta else "d" if tf == ta else "l"] += 1
                r["pos"][p.get("matchPosition", "")] += 1
                info[pid] = {"name": p["name"]["display"], "birth": (p.get("birth") or {}).get("date", {}).get("label", "")}
with open(out, "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["season", "club_feed", "feed_id", "name", "birth", "starts", "subs", "apps", "mins", "gf_on", "ga_on", "cs_on", "w", "d", "l", "positions"])
    for (pid, club), r in sorted(P.items(), key=lambda kv: (kv[0][1], -kv[1]["mins"])):
        w.writerow([label, club, pid, info[pid]["name"], info[pid]["birth"], r["starts"], r["subs"], r["starts"] + r["subs"], r["mins"],
                    r["gf_on"], r["ga_on"], r["cs_on"], r["w"], r["d"], r["l"], " ".join(f"{k}:{v}" for k, v in r["pos"].most_common())])
print(f"{label}: {len(fixtures)} matches, {len(P)} player-club rows -> {out}; score mismatches: {len(problems)}")
for p in problems[:10]:
    print("  ", p)
