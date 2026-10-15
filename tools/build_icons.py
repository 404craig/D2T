#!/usr/bin/env python3
"""Build data/source/icons.json: the Premier League icons (popular all-time players) with their consensus standing
and their verified peak seasons (docs/cards/ICONS.md).

Run from the repo root:  python3 tools/build_icons.py

Inputs
- data/source/research/icons_{fwd,mid,def,gk}.json   consensus all-time rankings per position compiled from published
  lists (each file names its sources); Craig's own list counts as one list
- data/source/honours.json      per season: PFA Team of the Year, PFA and FWA Player of the Year, PL Player of the
                                Season, Golden Glove (parsed from Wikipedia, URLs inside)
- data/source/pl_players.csv    apps and goals per player-season (top scorers stand for the Golden Boot)
- data/source/pl_results.csv    the champions per season
- data/ratings/rated_fit_*.json card ratings per player-season

Peak seasons: an icon's seasons with a verified honour (an award, Team of the Year, Golden Boot or Glove) or a title
with half the games played, the best K by rating + honour weight, K from how many lists name him (1 or 2 lists: 1;
3 or 4: 2; 5 or more: 3). An icon with no such season gets his best-rated season instead (peakSource "rating").
The research files' own peak guesses are not used: they were from memory.
"""
import csv, glob, json, os, re, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
GROUPS = ("fwd", "mid", "def", "gk")
# Craig's list (15 Oct 2026): every one must be a legend in at least one season, and purple there.
CRAIG = {
    "FWD": ["Thierry Henry", "Alan Shearer", "Wayne Rooney", "Mohamed Salah", "Harry Kane", "Sergio Aguero", "Cristiano Ronaldo",
            "Eric Cantona", "Dennis Bergkamp", "Didier Drogba", "Andrew Cole", "Robbie Fowler", "Michael Owen", "Ian Wright",
            "Luis Suarez", "Teddy Sheringham", "Ruud van Nistelrooy", "Robin van Persie", "Erling Haaland", "Jamie Vardy",
            "Jimmy Floyd Hasselbaink", "Sadio Mane", "Jermain Defoe", "Dwight Yorke", "Gianfranco Zola"],
    "MID": ["Kevin De Bruyne", "Ryan Giggs", "Frank Lampard", "Roy Keane", "Paul Scholes", "Steven Gerrard", "Patrick Vieira",
            "David Silva", "Eden Hazard", "David Beckham", "Yaya Toure", "Cesc Fabregas", "Claude Makelele", "Robert Pires",
            "N'Golo Kante", "Mesut Ozil", "Gareth Bale", "Luka Modric", "Michael Carrick", "Gareth Barry"],
    "DEF": ["John Terry", "Virgil van Dijk", "Rio Ferdinand", "Ashley Cole", "Vincent Kompany", "Tony Adams", "Nemanja Vidic",
            "Gary Neville", "Sol Campbell", "Jamie Carragher", "Gary Pallister", "Kyle Walker", "Steve Bruce", "Ledley King",
            "Sami Hyypia", "Ricardo Carvalho", "Andy Robertson", "Jaap Stam", "Denis Irwin", "Lee Dixon"],
    "GK": ["Petr Cech", "Peter Schmeichel", "Edwin van der Sar", "David Seaman", "Alisson Becker", "Ederson", "David de Gea",
           "Jens Lehmann", "Brad Friedel", "Shay Given", "Hugo Lloris", "Joe Hart"],
}
# Names as the lists or Wikipedia spell them -> the game data's name
ALIASES = {"andrew cole": "andy cole", "alisson becker": "alisson", "gabriel": "gabriel magalhaes", "juninho paulista": "juninho",
           "andrew johnson": "andy johnson"}
MIN_LISTS = 3   # a player off Craig's list is an icon when at least this many published lists name him
HONOUR_W = {"pfa": 3, "fwa": 3, "pots": 3, "boot": 2, "glove": 2, "toty": 2, "title": 1}


def norm(s):
    s = s.replace("Ø", "O").replace("ø", "o").replace("ł", "l").replace("Ł", "L").replace("ð", "d").replace("Đ", "D").replace("đ", "d")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace("'", "")
    s = re.sub(r"[^a-z ]", "", s).strip()
    return ALIASES.get(s, s)


def main():
    # ratings per (season, name): best ovr across clubs, apps, position, club position of the main club
    rated = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "ratings", "rated_fit_*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        season = d["season"].replace("-", "/")
        for r in d["players"]:
            k = (season, norm(r["player"]))
            cur = rated.get(k)
            if cur is None or (r.get("apps") or 0) > cur["apps"]:
                rated[k] = {"ovr": max(r["ovr"], cur["ovr"] if cur else 0), "apps": r.get("apps") or 0, "pos": r["pos"],
                            "clubPos": r.get("clubPos"), "club": r["club"], "name": r["player"]}
            else:
                cur["ovr"] = max(cur["ovr"], r["ovr"])
    apps = defaultdict(int); goals = defaultdict(int); games = {}
    for r in csv.DictReader(open(os.path.join(SRC, "pl_players.csv"), encoding="utf-8")):
        k = (r["season"], norm(r["player"])); apps[k] += int(r["apps"]); goals[k] += int(r["goals"])
    clubs = defaultdict(set)
    for m in csv.DictReader(open(os.path.join(SRC, "pl_results.csv"), encoding="utf-8")):
        clubs[m["season"]].add(m["home"])
    for s, cs in clubs.items(): games[s] = 2 * (len(cs) - 1)
    top_scorers = defaultdict(set)
    best = {}
    for (s, n), g in goals.items():
        if g > best.get(s, 0): best[s] = g
    for (s, n), g in goals.items():
        if g == best[s]: top_scorers[s].add(n)

    honours = json.load(open(os.path.join(SRC, "honours.json"), encoding="utf-8"))
    hon = defaultdict(lambda: defaultdict(list))   # (season, name) -> kind -> evidence
    for s, d in honours["seasons"].items():
        for pos, name in d["toty"]: hon[(s, norm(name))]["toty"].append("PFA Team of the Year")
        for kind, label in (("pfa", "PFA Players' Player of the Year"), ("fwa", "FWA Footballer of the Year"),
                            ("pots", "Premier League Player of the Season"), ("glove", "Golden Glove")):
            for name in d[kind]: hon[(s, norm(name))][kind].append(label)
    for s, ns in top_scorers.items():
        for n in ns: hon[(s, n)]["boot"].append(f"top scorer ({best[s]} goals)")

    # the icons: research lists + Craig's list
    icons = {}
    sources = {}
    for grp in GROUPS:
        d = json.load(open(os.path.join(SRC, "research", f"icons_{grp}.json"), encoding="utf-8"))
        sources[grp.upper()] = [s for s in d["sources"] if s.get("url")]
        for p in d["players"]:
            n = norm(p["name"])
            if n in icons:   # named in two groups' lists (Salah, Hazard, Bale, Ronaldo): the lists add up, the bigger group stands
                o = icons[n]; tot = o["lists"] + p["lists"]
                ranks = [(o["avg_rank"], o["lists"]), (p["avg_rank"], p["lists"])]
                o["avg_rank"] = round(sum(r * w for r, w in ranks if r) / max(1, sum(w for r, w in ranks if r)), 1)
                if p["lists"] > o["lists"]: o["group"] = grp.upper()
                o["lists"] = tot
                continue
            icons[n] = {"name": p["name"], "group": grp.upper(), "lists": p["lists"], "avg_rank": p["avg_rank"], "craig": False}
    for grp, names in CRAIG.items():
        for name in names:
            n = norm(name)
            if n not in icons: icons[n] = {"name": name, "group": grp, "lists": 1, "avg_rank": None, "craig": True}
            else: icons[n]["craig"] = True
    out = []
    unmatched = []
    for n, ic in sorted(icons.items(), key=lambda kv: (kv[1]["group"], -kv[1]["lists"], kv[1]["avg_rank"] or 99)):
        if not ic["craig"] and ic["lists"] < MIN_LISTS: continue
        seasons = [s for (s, m) in rated if m == n]
        if not seasons:
            unmatched.append(ic["name"]); continue
        ic["name"] = rated[(seasons[0], n)]["name"]
        # consensus 0 to 100: how many lists name him (to 6) and where (rank 1 = 100, rank 25 = 0)
        lists = min(ic["lists"], 6) / 6
        rank = 1 - (min(max((ic["avg_rank"] or 13) - 1, 0), 24) / 24)
        ic["consensus"] = round(100 * (0.6 * lists + 0.4 * rank))
        K = 1 if ic["lists"] <= 2 else 2 if ic["lists"] <= 4 else 3
        cands = []
        for s in seasons:
            m = rated[(s, n)]
            if apps[(s, n)] < 10: continue
            ev = dict(hon.get((s, n), {}))
            if m["clubPos"] == 1 and apps[(s, n)] * 2 >= games[s]: ev["title"] = [f"title with {m['club']}, {apps[(s, n)]} games"]
            if not ev: continue
            w = max(HONOUR_W[k] for k in ev)
            cands.append((m["ovr"] + 2 * w, s, m, ev))
        cands.sort(key=lambda c: (-c[0], c[1]))
        if cands:
            ic["peakSource"] = "honours"
            ic["peak"] = [{"season": s, "rating": m["ovr"], "club": m["club"], "honour": any(k != "title" for k in ev),
                           "primary": i == 0, "evidence": sum(ev.values(), [])} for i, (_, s, m, ev) in enumerate(cands[:K])]
        else:
            pool = [s for s in seasons if apps[(s, n)] >= 20] or [s for s in seasons if apps[(s, n)] >= 10] or seasons
            s = max(pool, key=lambda s: (rated[(s, n)]["ovr"], s))
            m = rated[(s, n)]
            ic["peakSource"] = "rating"
            ic["peak"] = [{"season": s, "rating": m["ovr"], "club": m["club"], "honour": False, "primary": True,
                           "evidence": [f"his best-rated season ({m['ovr']}), no honour in the data"]}]
        ic["peak"].sort(key=lambda p: p["season"])
        ic["seasons"] = len(seasons)
        out.append(ic)
    # Primary peaks (always a legend card): spread across seasons so no season is crowded with forced legends (Craig,
    # 15 Oct: 3 to 6 legends a season). Icons with one peak are fixed; the others take the season with the fewest
    # primaries so far, his best-rated peak on a tie.
    load = defaultdict(int)
    for ic in out:
        for x in ic["peak"]: x["primary"] = False
        if len(ic["peak"]) == 1: ic["peak"][0]["primary"] = True; load[ic["peak"][0]["season"]] += 1
    for ic in sorted((ic for ic in out if len(ic["peak"]) > 1), key=lambda ic: -ic["consensus"]):
        best = min(ic["peak"], key=lambda x: (load[x["season"]], -x["rating"], x["season"]))
        best["primary"] = True; load[best["season"]] += 1
    doc = {"_about": "Premier League icons: the popular all-time players, from published all-time lists per position "
                     "(data/source/research, sources below) plus Craig's own list (craig: true). consensus is 0 to 100 from "
                     "how many lists name him and his average rank. peak is his verified peak seasons (evidence from "
                     "data/source/honours.json and the game data: awards, Team of the Year, top scorer, Golden Glove, a title "
                     "with half the games); peakSource rating means no honour was found and his best-rated season stands. "
                     "honour is false where the only evidence is a title or the rating; primary marks his best peak, always a legend "
                     "card, the others only where the season has room (docs/cards/ICONS.md). Built by tools/build_icons.py; "
                     "scripts/build-data.py makes every peak card purple and a legend "
                     "(docs/cards/ICONS.md).",
           "sources": sources, "players": out}
    with open(os.path.join(SRC, "icons.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    print(f"{len(out)} icons ({sum(1 for p in out if p['craig'])} on Craig's list), "
          f"{sum(len(p['peak']) for p in out)} peak seasons, {sum(1 for p in out if p['peakSource'] == 'rating')} by rating only")
    if unmatched: print("unmatched names:", unmatched)


if __name__ == "__main__":
    main()
