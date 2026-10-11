"""Positions played in every Premier League match, per player, from Transfermarkt.

Usage: python3 tools/fetch_tm_positions.py <season start year e.g. 2008> [more years]

For each season: the 20 clubs from the league page, every player on each club's
squad page, then each player's match record (ceapi/performance-game), which
gives the position he was listed at in every game of his career. Only Premier
League games (GB1) he played are kept, counted per season and Transfermarkt
position code. Cached per player in docs/cards/feed/tm/players/<id>.json, so a
player is fetched once whatever seasons he appears in.

Position codes (checked against Van Dijk, Alexander-Arnold, Robertson and
Schmeichel): 1 GK, 2 sweeper, 3 CB, 4 LB, 5 RB, 6 CDM, 7 CM, 8 RM, 9 LM,
10 CAM, 11 LW, 12 RW, 13 second striker, 14 centre-forward, 0 not recorded.
"""
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
TM = "https://www.transfermarkt.com"
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cards", "feed", "tm")


def get(url, tries=5):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf8", "ignore")
        except Exception:
            time.sleep(3 * 2 ** i)
    raise RuntimeError(url)


def player(pid):
    path = os.path.join(OUT, "players", f"{pid}.json")
    if os.path.exists(path):
        return json.load(open(path))
    d = json.loads(get(f"{TM}/ceapi/performance-game/{pid}"))["data"]
    per = defaultdict(Counter)
    clubs = defaultdict(set)
    for g in d["performance"]:
        gi, st = g["gameInformation"], g["statistics"]["generalStatistics"]
        if gi["competitionId"] != "GB1" or st["participationState"] != "played":
            continue
        per[gi["seasonId"]][str(st.get("positionId") or 0)] += 1
        clubs[gi["seasonId"]].add(str(g["clubsInformation"]["club"]["clubId"]))
    rec = {"id": pid, "seasons": {str(s): dict(c) for s, c in sorted(per.items())},
           "clubs": {str(s): sorted(c) for s, c in sorted(clubs.items())}}
    json.dump(rec, open(path, "w"))
    time.sleep(0.8)
    return rec


def season(year):
    lg = get(f"{TM}/premier-league/startseite/wettbewerb/GB1/saison_id/{year}")
    clubs = sorted(set(re.findall(rf'href="/([a-z0-9-]+)/startseite/verein/(\d+)/saison_id/{year}"', lg)))
    squad = {}
    for slug, cid in clubs:
        k = get(f"{TM}/{slug}/kader/verein/{cid}/saison_id/{year}")
        for pslug, pid in re.findall(r'href="/([a-z0-9-]+)/profil/spieler/(\d+)"', k):
            squad.setdefault(pid, {"slug": pslug, "club": slug})
        time.sleep(0.8)
    rows = {}
    for pid, meta in squad.items():
        rec = player(pid)
        if str(year) in rec["seasons"]:
            rows[pid] = {**meta, "positions": rec["seasons"][str(year)]}
    json.dump(rows, open(os.path.join(OUT, f"season_{year}.json"), "w"), indent=0)
    print(f"{year}: {len(clubs)} clubs, {len(squad)} squad players, {len(rows)} played", flush=True)


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "players"), exist_ok=True)
    for y in sys.argv[1:]:
        season(int(y))
