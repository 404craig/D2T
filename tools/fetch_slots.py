"""Detailed positions from the formation slot each player started in, per match.

Usage: python3 tools/fetch_slots.py <season label e.g. 2019/20> <out.csv>

The feed gives each team's formation from 2015/16 (patchy 2012/13 to 2014/15)
as lines of player ids, back to front, each line right to left. Every slot is
named with the game's labels (RB, CB, CDM, CM, CAM, RM, RW, ST and so on) and
counted per player and club. Only starts count; substitutes have no slot.
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


def wide(n, back3, edge_back, edge_mid):
    """Labels for a line of n midfielders, right to left."""
    edge = edge_back if back3 else edge_mid
    return ["R" + edge] + ["CM"] * (n - 2) + ["L" + edge]


def name_slots(lines):
    """Formation lines (back to front, right to left) -> labels in the same shape."""
    back, front, mids = lines[1], lines[-1], lines[2:-1]
    back3 = len(back) <= 3
    out = [["GK"] * len(lines[0])]
    out.append({2: ["CB", "CB"], 3: ["CB"] * 3, 4: ["RB", "CB", "CB", "LB"],
                5: ["RWB", "CB", "CB", "CB", "LWB"]}.get(len(back), ["CB"] * len(back)))
    for k, line in enumerate(mids):
        n, deepest, last = len(line), k == 0, k == len(mids) - 1
        if len(mids) == 1:                       # one midfield line: 4-4-2, 4-3-3, 3-5-2, 4-5-1
            if n == 3:
                lab = ["CM", "CDM", "CM"] if len(back) == 4 and len(front) == 3 else ["CM"] * 3
            elif n == 5 and not back3:
                lab = ["RM", "CM", "CDM", "CM", "LM"]
            elif n >= 4:
                lab = wide(n, back3, "WB", "M")
            else:
                lab = ["CM"] * n
        elif deepest:                            # 4-2-3-1, 4-1-4-1, 4-1-2-1-2, 4-3-1-2
            lab = {1: ["CDM"], 2: ["CDM", "CDM"]}.get(n) or (wide(n, back3, "WB", "M") if n >= 4 else ["CM"] * n)
        elif last:                               # the line behind the strikers
            lab = {1: ["CAM"], 2: ["CAM", "CAM"], 3: ["RW", "CAM", "LW"]}.get(n) or wide(n, back3, "WB", "M")
        else:
            lab = ["CM"] * n if n < 4 else wide(n, back3, "WB", "M")
        out.append(lab)
    if len(lines) > 2:
        out.append({1: ["ST"], 2: ["ST", "ST"], 3: ["RW", "ST", "LW"]}.get(len(front), ["ST"] * len(front)))
    return out


def main():
    label, out = sys.argv[1], sys.argv[2]
    cs = next(int(s["id"]) for s in get(f"{B}/competitions/1/compseasons?page=0&pageSize=100")["content"] if s["label"] == label)
    ids, page = [], 0
    while True:
        f = get(f"{B}/fixtures?comps=1&compSeasons={cs}&page={page}&pageSize=40&sort=asc&statuses=C")
        ids += [int(x["id"]) for x in f["content"]]
        if page + 1 >= f["pageInfo"]["numPages"]:
            break
        page += 1

    def fetch(i):
        try:
            return get(f"{B}/fixtures/{i}?altIds=true")
        except RuntimeError:
            return {"id": i, "failed": True}

    with ThreadPoolExecutor(6) as ex:
        fixtures = list(ex.map(fetch, ids))
    failed = [f["id"] for f in fixtures if f.get("failed")]
    P = defaultdict(Counter)
    info, with_form, teams_seen = {}, 0, 0
    for fx in fixtures:
        if fx.get("failed"):
            continue
        clubs = {int(t["team"]["id"]): t["team"]["name"] for t in fx["teams"]}
        for tl in fx.get("teamLists") or []:
            teams_seen += 1
            form = tl.get("formation")
            if not form or not form.get("players"):
                continue
            lines = [[int(i) for i in line] for line in form["players"]]
            if sum(map(len, lines)) != 11:
                continue
            with_form += 1
            club = clubs.get(int(tl["teamId"]), str(tl["teamId"]))
            for p in tl["lineup"]:
                info[int(p["id"])] = (p["name"]["display"], (p.get("info") or {}).get("positionInfo", ""))
            for line, labs in zip(lines, name_slots(lines)):
                for pid, lab in zip(line, labs):
                    P[(club, pid)][lab] += 1
    with open(out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["season", "club_feed", "feed_id", "name", "profile_position", "starts_with_slot", "slots"])
        for (club, pid), c in sorted(P.items(), key=lambda kv: (kv[0][0], -sum(kv[1].values()))):
            name, pinfo = info.get(pid, ("", ""))
            w.writerow([label, club, pid, name, pinfo, sum(c.values()), " ".join(f"{k}:{v}" for k, v in c.most_common())])
    print(f"{label}: {len(fixtures)} matches, formations for {with_form}/{teams_seen} team line-ups, {len(P)} rows -> {out}; failed {failed}")


if __name__ == "__main__":
    main()
