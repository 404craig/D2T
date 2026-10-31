#!/usr/bin/env python3
"""Build data/game/game.json and data/game/crests.json from the source data.

Run from the repo root:  python3 scripts/build-data.py

Inputs
- data/source/pl_results.csv   every Premier League result 1992/93 to 2025/26 (from Tenaball, two sources)
- data/source/pl_players.csv   every player-season: club, broad position, apps, goals (from Tenaball, two sources)
- data/ratings/*.csv           card ratings and detailed positions, when present (from the player data work)
- data/source/clubs.json       club display names and accent colours
- assets/crests/72, /128       crest PNGs

Ratings: where data/ratings has a row for a player-season it wins. Otherwise a fallback model rates
each player against everyone in his broad position that season (goals for forwards, team defence for
defenders and keepers, a mix for midfielders), weighted by games played. The fallback is marked so the
game can say which ratings are provisional.
"""
import base64, csv, glob, json, math, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
OUT = os.path.join(ROOT, "data", "game")

DEDUCTIONS = {("1996/97", "Middlesbrough"): 3, ("2009/10", "Portsmouth"): 9,
              ("2023/24", "Everton"): 8, ("2023/24", "Nottingham Forest"): 4}


def season_tables(results):
    by = defaultdict(list)
    for r in results:
        by[r["season"]].append(r)
    tables = {}
    for s, ms in by.items():
        T = defaultdict(lambda: {"p": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0})
        for m in ms:
            h, a, hg, ag = m["home"], m["away"], int(m["home_goals"]), int(m["away_goals"])
            for c, f, g in ((h, hg, ag), (a, ag, hg)):
                t = T[c]; t["p"] += 1; t["gf"] += f; t["ga"] += g
                if f > g: t["w"] += 1; t["pts"] += 3
                elif f == g: t["d"] += 1; t["pts"] += 1
                else: t["l"] += 1
        for m in ms:
            h, a, hg, ag = m["home"], m["away"], int(m["home_goals"]), int(m["away_goals"])
            T[h].setdefault("cs", 0); T[a].setdefault("cs", 0)
            if ag == 0: T[h]["cs"] += 1
            if hg == 0: T[a]["cs"] += 1
        for (ds, dc), d in DEDUCTIONS.items():
            if ds == s and dc in T: T[dc]["pts"] -= d
        order = sorted(T.items(), key=lambda kv: (-kv[1]["pts"], -(kv[1]["gf"] - kv[1]["ga"]), -kv[1]["gf"], kv[0]))
        tables[s] = order
    return by, tables


def zscores(vals):
    if not vals: return []
    m = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals)) or 1
    return [(v - m) / sd for v in vals]


def fallback_ratings(season, rows, table):
    """Season-relative rating per player-row, 0-99 scale, plus level 0-3."""
    team = {c: t for c, t in table}
    n = len(table)
    games = 2 * (n - 1)
    out = {}
    by_pos = defaultdict(list)
    for r in rows:
        by_pos[r["position"]].append(r)
    for pos, rs in by_pos.items():
        raw = []
        for r in rs:
            a, g = int(r["apps"]), int(r["goals"])
            t = team[r["club"]]
            ppg, gapg = t["pts"] / t["p"], t["ga"] / t["p"]
            gpg = g / max(a, 1)
            if pos == "FWD": s = 3.0 * gpg + 0.25 * ppg
            elif pos == "MID": s = 1.6 * gpg + 0.6 * ppg - 0.15 * gapg
            elif pos == "DEF": s = 0.7 * ppg - 0.55 * gapg + 0.8 * gpg
            else: s = 0.5 * ppg - 0.75 * gapg
            share = min(a, games * 0.8) / (games * 0.8)
            raw.append(s * (0.55 + 0.45 * share) + 0.25 * share)
        z = zscores(raw)
        # Regulars (10+ apps) are ranked among themselves, to line up with the externally rated spread.
        regular = [i for i in range(len(rs)) if int(rs[i]["apps"]) >= 10]
        rank_of = {i: k for k, i in enumerate(sorted(regular, key=lambda i: z[i]))}
        for i in range(len(rs)):
            r = rs[i]
            a = int(r["apps"])
            if i in rank_of: pct = (rank_of[i] + 0.5) / len(regular)
            else: pct = sum(1 for j in regular if z[j] < z[i]) / max(1, len(regular))
            out[(r["club"], r["player_id"])] = (pct, a)
    return out


def levels_for(players):
    """The player data work's tiers: best = the top-rated player at each club, gold 80+, silver 70 to 79, bronze below.
    External ratings bring their own tier; this fills the fallback seasons the same way."""
    best = {}
    for p in players:
        if p["src"] == "f" and (p["c"] not in best or p["r"] > best[p["c"]]["r"]): best[p["c"]] = p
    for p in players:
        if "lv" in p: continue
        p["lv"] = 3 if best.get(p["c"]) is p else 2 if p["r"] >= 80 else 1 if p["r"] >= 70 else 0


def load_external_ratings():
    """data/ratings/rated_fit_<YYYY-YY>.json from the player data work (ovr, tier, stats, assists, clean sheets).
    Keyed by (season, club, player_id), and by (season, club, player name) for files that predate the id field."""
    ext = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "ratings", "rated_fit_*.json"))):
        d = json.load(open(path, encoding="utf-8"))
        season = d["season"].replace("-", "/")
        for r in d["players"]:
            ext[(season, r["club"], r.get("id") or r["player"])] = r
            ext.setdefault((season, r["club"], "name:" + r["player"]), r)
    return ext


def quantile_map(ext):
    """Per broad position, the sorted ratings of every externally rated player-season with 10+ apps."""
    q = defaultdict(list)
    for (season, club, key), r in ext.items():
        if key.startswith("name:") or (r.get("apps") or 0) < 10: continue
        q[r["pos"]].append(r["ovr"])
    return {k: sorted(v) for k, v in q.items()}


def from_quantile(qs, pct):
    if not qs: return round(58 + 34 * pct ** 1.7)
    i = min(len(qs) - 1, max(0, int(pct * len(qs))))
    return qs[i]


TIER_LEVEL = {"bronze": 0, "silver": 1, "gold": 2, "best": 3}
_mp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "moves.json")
MOVES = json.load(open(_mp, encoding="utf-8")) if os.path.exists(_mp) else {}
# Preferred positions per player-season, main first (tools/build_positions.py, from the position
# Transfermarkt lists for every Premier League game). Players without them keep the broad position.
_pp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "positions.json")
POSITIONS = json.load(open(_pp, encoding="utf-8")) if os.path.exists(_pp) else {}
# Craig's own calls (15 Oct: Zola's main position is CAM, whatever the data says), every season of the player
_po = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "positions_overrides.json")
# A list replaces his positions; {"add": [...]} keeps each season's own and adds these as preferred (green) positions
# straight after his main one (Craig, 22 Oct: Gareth Bale on the left wing)
for _name, _pos in (json.load(open(_po, encoding="utf-8")) if os.path.exists(_po) else {}).items():
    if _name.startswith("_"): continue
    for _season in POSITIONS.values():
        if _name not in _season: continue
        if isinstance(_pos, dict):
            cur = list(_season[_name])
            for k, extra in enumerate(_pos.get("add", [])):
                if extra not in cur: cur.insert(min(1 + k, len(cur)), extra)
            _season[_name] = cur
        else:
            _season[_name] = list(_pos)

# Wide players (Craig, 31 Oct, build 183: "I don't think anyone should be on LM or RM, they should also be wingers, and
# similarly wingers should be able to play LM or RM"): a left or right midfielder is also a winger on that side and a
# winger also a wide midfielder there, the partner added as a preferred position straight after the one he has
# (Andrei Kanchelskis: RM, then RW).
for _season in POSITIONS.values():
    for _name, _ps in _season.items():
        cur = list(_ps)
        for a, b in (("LM", "LW"), ("RM", "RW")):
            if a in cur and b not in cur: cur.insert(cur.index(a) + 1, b)
            elif b in cur and a not in cur: cur.insert(cur.index(b) + 1, a)
        _season[_name] = cur

# Icons and honours (Craig, 15 Oct 2026; docs/cards/ICONS.md): the popular all-time players from published lists plus
# Craig's own, with their verified peak seasons (tools/build_icons.py), and every season's honours (PFA Team of the
# Year, PFA and FWA Player of the Year, PL Player of the Season, Golden Glove) parsed from Wikipedia.
_ic = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "icons.json")
_hn = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "honours.json")
ICON_ALIASES = {"andrew cole": "andy cole", "alisson becker": "alisson", "gabriel": "gabriel magalhaes", "juninho paulista": "juninho",
                "andrew johnson": "andy johnson"}   # the same map as tools/build_icons.py


def icon_name(s):
    import unicodedata, re
    s = s.replace("Ø", "O").replace("ø", "o").replace("ł", "l").replace("Ł", "L").replace("ð", "d").replace("Đ", "D").replace("đ", "d")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace("'", "")
    s = re.sub(r"[^a-z ]", "", s).strip()
    return ICON_ALIASES.get(s, s)


ICONS = {}
if os.path.exists(_ic):
    for _p in json.load(open(_ic, encoding="utf-8"))["players"]:
        ICONS[icon_name(_p["name"])] = {"consensus": _p["consensus"], "craig": _p["craig"],
                                        "peak": {x["season"]: x["honour"] for x in _p["peak"]},
                                        "primary": {x["season"] for x in _p["peak"] if x.get("primary")}}
HONOURS = defaultdict(set)   # season -> names with a verified honour that season
if os.path.exists(_hn):
    for _s, _d in json.load(open(_hn, encoding="utf-8"))["seasons"].items():
        for _pos, _n in _d["toty"]: HONOURS[_s].add(icon_name(_n))
        for _k in ("pfa", "fwa", "pots", "glove"):
            for _n in _d[_k]: HONOURS[_s].add(icon_name(_n))
# Purple and legend (Craig, 15 Oct 2026; docs/cards/ICONS.md). Baseline purple per season: the top 3 forwards by goals,
# the top 3 midfielders, top 3 defenders and top 2 keepers by standing (rating, icons lifted by up to 4 for the
# ranking only), 10+ games. Added where the evidence supports it: a verified honour that season rated 80+, an icon
# rated 90+, and every icon in a verified peak season (legend too). Legends: the season's top 3 by rating and the
# icons at their peaks; every legend is purple in his season. Boost: a card of one of Craig's icons in a peak season
# with a real honour (an award, Team of the Year, top scorer or Golden Glove; not a title alone), rated 75 to 89 (other
# icons 80 to 89) and below the baseline's last purple of his position, is lifted to it, 2 to 5 points, on the card as `bst`.
PURPLE_QUOTA = {"FWD": 3, "MID": 3, "DEF": 3, "GK": 2}
# an icon rated this or more is purple in that season too (forwards tighter, Craig 15 Oct: their baseline by goals
# and their icons' peaks already carry them, so their extras are held back)
PURPLE_BAND = {"FWD": 95, "MID": 90, "DEF": 90, "GK": 90}
# an honour that season makes a card purple when it is rated this or more
HONOUR_FLOOR = {"FWD": 90, "MID": 80, "DEF": 80, "GK": 80}
ICON_LIFT = 4           # ranking lift for the most popular icon (consensus 100), none for a non-icon
# Pool sizes per season (Craig, 15 Oct): 10 to 15 purple and 3 to 6 legends, a few more for all-time great teams.
PURPLE_CAP, LEGEND_CAP = 15, 6
GREAT_CAP = (18, 8)
# The all-time great teams' seasons (Craig, 15 Oct: Arsenal's Invincibles, Man Utd's title sides, Chelsea under
# Mourinho). Man Utd's are the titles with 89+ points or a double or treble in the record: 1993/94 (92, double),
# 1998/99 (treble), 1999/00 (91), 2006/07 (89), 2007/08 (87, Champions League double), 2008/09 (90), 2012/13 (89).
GREAT_SEASONS = {"2003/04", "2004/05", "2005/06", "1993/94", "1998/99", "1999/00", "2006/07", "2007/08", "2008/09", "2012/13"}
BOOST = (2, 5)          # min and max boost on an icon's peak card below the cut
BOOST_FLOOR = {"craig": 75, "other": 80}   # a peak card rated from here up to 89 can be boosted (Craig's list from 75)
DEF_LIFT = 2
MIN_APPS = 10
# Craig's own ratings for named players' peak-season cards (data/source/rating_overrides.json), applied before the
# boosts; the card keeps the change in `bst` and `ovd` (15 Oct: Tony Adams 87).
_ro = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "source", "rating_overrides.json")
RATING_OVERRIDES = {icon_name(k): v for k, v in (json.load(open(_ro, encoding="utf-8")) if os.path.exists(_ro) else {}).items()
                    if not k.startswith("_")}


def icon_levels(season, people):
    """Set lv (0 bronze, 1 silver, 2 gold, 3 purple), lg (legend) and bst (boost) on every card of a season."""
    hon = HONOURS.get(season, set())
    top_goals = max((q["g"] for q in people if q["a"] >= MIN_APPS), default=0)
    elig = [q for q in people if q["a"] >= MIN_APPS]
    for q in people:
        n = icon_name(q["n"]); ic = ICONS.get(n)
        q["_icon"] = ic
        q["_peak"] = bool(ic and season in ic["peak"])
        q["_lift"] = bool(ic and ic["peak"].get(season))
        ov = RATING_OVERRIDES.get(n)
        if ov and (ov["seasons"] == "peak" and q["_peak"] or season in ov["seasons"]) and q["r"] != ov["rating"]:
            q["ovd"] = q["r"]; q["r"] = ov["rating"]
        q["_hon"] = n in hon or (q["g"] == top_goals and top_goals > 0 and q["a"] >= MIN_APPS)
    # the baseline cut per position before any boost: where an icon's peak card is lifted to
    def standing(q): return q["r"] + (round(ICON_LIFT * q["_icon"]["consensus"] / 100) if q["_icon"] else 0)
    def key(q): return (-q["g"], -standing(q), -q["a"], q["n"]) if q["b"] == "FWD" else (-standing(q), -q["a"], q["n"])
    floor = {}
    for b, k in PURPLE_QUOTA.items():
        top = sorted([q for q in elig if q["b"] == b], key=key)[:k]
        floor[b] = top[-1]["r"] if top else 0
    for q in people:
        q["bst"] = q["r"] - q["ovd"] if "ovd" in q else 0
        if q["_lift"] and not q["bst"] and BOOST_FLOOR["craig" if q["_icon"]["craig"] else "other"] <= q["r"] <= 89 and q["r"] < floor[q["b"]]:
            q["bst"] = max(BOOST[0], min(BOOST[1], floor[q["b"]] - q["r"]))
            q["r"] += q["bst"]
    pcap, lcap = GREAT_CAP if season in GREAT_SEASONS else (PURPLE_CAP, LEGEND_CAP)
    by_rating = sorted(elig, key=lambda q: (-q["r"], -q["a"], q["n"]))
    # legends: the season's top 3 by rating and every icon's primary peak always; his other peaks while there is room
    legend = {id(q) for q in by_rating[:3]} | {id(q) for q in elig if q["_icon"] and season in q["_icon"]["primary"]}
    for q in by_rating:
        if len(legend) >= lcap: break
        if q["_peak"]: legend.add(id(q))
    # purple: the baseline and the legends always; honoured, 90+ icon and other peak cards by rating while there is room
    purple = set(legend)
    for b, k in PURPLE_QUOTA.items():
        purple.update(id(q) for q in sorted([q for q in elig if q["b"] == b], key=key)[:k])
    for q in by_rating:
        if len(purple) >= pcap: break
        if q["_peak"] or (q["_icon"] and q["r"] >= PURPLE_BAND[q["b"]]) or (q["_hon"] and q["r"] >= HONOUR_FLOOR[q["b"]]): purple.add(id(q))
    for q in people:
        q["lv"] = 3 if id(q) in purple else 2 if q["r"] >= 80 else 1 if q["r"] >= 70 else 0
        if id(q) in legend: q["lg"] = 1
        if not q["bst"]: del q["bst"]
        for k in ("_icon", "_peak", "_hon", "_lift"): del q[k]


def card_stats(q, team, games, career_apps):
    """The six card numbers (20 to 99), all worked out from verified season numbers:
    GOL scoring rate, IMP share of the club's goals, FIT games played, WIN club points per game,
    DEF club goals conceded per game, EXP Premier League appearances so far.
    Goalkeepers: WAL (club goals conceded, fewer is higher), CLN clean sheets, FIT, WIN, EXP."""
    sc = lambda x: int(round(20 + 79 * max(0.0, min(1.0, x))))
    a, g = q["a"], q["g"]
    ppg, gapg = team["pts"] / team["p"], team["ga"] / team["p"]
    fit = sc(a / games)
    win = sc((ppg - 0.6) / 1.9)
    defn = sc(1 - (gapg - 0.6) / 1.7)
    exp = sc(math.log(1 + career_apps) / math.log(1 + 450))
    if q["b"] == "GK":
        cs = q.get("cs")
        if cs is None: cs = team.get("cs", 0) * a / games
        return [defn, sc(cs / 18), fit, win, exp]
    gpg = g / max(a, 1)
    gol = sc(math.sqrt(min(gpg / 0.75, 1)))
    imp = sc(min(g / max(team["gf"], 1) / 0.3, 1) ** 0.75)
    return [gol, imp, fit, win, defn, exp]


def main():
    results = list(csv.DictReader(open(os.path.join(SRC, "pl_results.csv"), encoding="utf-8")))
    players = list(csv.DictReader(open(os.path.join(SRC, "pl_players.csv"), encoding="utf-8")))
    clubs_meta = json.load(open(os.path.join(SRC, "clubs.json"), encoding="utf-8"))
    ext = load_external_ratings()
    qmap = quantile_map(ext)
    by_season, tables = season_tables(results)
    prow = defaultdict(list)
    for p in players:
        prow[p["season"]].append(p)

    game = {"v": 1, "seasons": {}, "catalogue": [], "clubSeasons": [], "clubs": clubs_meta}
    # Whole Premier League careers (every season in the data) for the big card: games, goals, seasons, clubs in order.
    careers, cidx = [], {}
    for r in sorted(players, key=lambda r: (r["player_id"], r["season"], r["club"])):
        pid = r["player_id"]
        if pid not in cidx:
            cidx[pid] = len(careers)
            careers.append({"a": 0, "g": 0, "s": [], "c": []})
        k = careers[cidx[pid]]
        k["a"] += int(r["apps"]); k["g"] += int(r["goals"])
        if r["season"] not in k["s"]: k["s"].append(r["season"])
        if r["club"] not in k["c"]: k["c"].append(r["club"])
    game["careers"] = [{"a": k["a"], "g": k["g"], "n": len(k["s"]), "f": k["s"][0], "l": k["s"][-1], "c": k["c"]} for k in careers]
    # 433 Goals: every Premier League player with 60+ games, by broad position (the one he played most games in),
    # as [name, surname, club, career goals], most goals first. Club = where he scored most (most games if none).
    g4 = defaultdict(lambda: {"a": 0, "g": 0, "pos": defaultdict(int), "cg": defaultdict(int), "ca": defaultdict(int), "n": "", "s": ""})
    for r in players:
        k = g4[r["player_id"]]; a, g = int(r["apps"]), int(r["goals"])
        k["a"] += a; k["g"] += g; k["pos"][r["position"]] += a; k["cg"][r["club"]] += g; k["ca"][r["club"]] += a
        k["n"], k["s"] = r["player"], r["surname"]
    g433 = {"GK": [], "DEF": [], "MID": [], "FWD": []}
    for pid, k in sorted(g4.items()):
        if k["a"] < 60: continue
        pos = max(k["pos"].items(), key=lambda x: (x[1], x[0]))[0]
        club = max((k["cg"] if k["g"] > 0 else k["ca"]).items(), key=lambda x: (x[1], k["ca"][x[0]], x[0]))[0]
        g433[pos].append([k["n"], k["s"], club, k["g"]])
    for pos in g433: g433[pos].sort(key=lambda x: (-x[3], x[0]))
    game["g433"] = g433
    career = defaultdict(int)   # Premier League appearances before the current season, per person
    for season in sorted(by_season):
        table = tables[season]
        names = sorted(c for c, _ in table)
        cix = {c: i for i, c in enumerate(names)}
        fb = fallback_ratings(season, prow[season], table)
        # One card per person per season: a January mover keeps both clubs (c, c2) and combined numbers.
        people = {}
        # A January mover's clubs in the order he played for them (dates from the match line-ups,
        # data/source/moves.json); without dates, the club with more games first.
        mv = MOVES.get(season, {})
        def club_order(r):
            d = mv.get(r["player_id"], {}).get(r["club"])
            return (r["player_id"], d[0] if d else "9999", -int(r["apps"]), r["club"])
        order = sorted(prow[season], key=club_order)
        for r in order:
            pid = r["player_id"]
            e = ext.get((season, r["club"], pid)) or ext.get((season, r["club"], "name:" + r["player"]))
            if e:
                rating = int(e["ovr"])
            else:
                pct, a = fb[(r["club"], pid)]
                rating = from_quantile(qmap.get(r["position"]), pct)
                if a < 10: rating = round(55 + (rating - 55) * (0.55 + 0.045 * a))
            pos = POSITIONS.get(season, {}).get(pid) or [r["position"]]
            if pid in people:
                q = people[pid]
                q["c2"] = cix[r["club"]]; q["a2"] = int(r["apps"]); q["g2"] = int(r["goals"])
                d2 = mv.get(pid, {}).get(r["club"])
                if d2: q["m2"] = d2[0]  # first game for his second club: the card shows that club from this date
                q["a"] += int(r["apps"]); q["g"] += int(r["goals"])
                q["r"] = max(q["r"], rating)
                continue
            people[pid] = {"k": cidx[pid], "n": r["player"], "c": cix[r["club"]], "b": r["position"], "p": pos,
                           "r": rating, "a": int(r["apps"]), "g": int(r["goals"]), "nat": r["nationality"],
                           "a1": int(r["apps"]), "g1": int(r["goals"]), "src": "x" if e else "f"}
            if e:
                people[pid]["lv"] = TIER_LEVEL.get(e.get("tier"), 0)
                for k_in, k_out in (("assists", "as"), ("cleanSheets", "cs"), ("minutes", "mi"), ("stats", "st")):
                    if e.get(k_in) is not None: people[pid][k_out] = e[k_in]
        # Craig, 18 Oct 2026: +2 on every defender card so defenders look as valued as they are in the game (the match
        # model is refitted to the real results with it, tests/fit-match.js, so the league's scorelines stay real)
        for q in people.values():
            if q["b"] == "DEF": q["r"] = min(99, q["r"] + DEF_LIFT)
        icon_levels(season, people.values())
        plist = []
        tmap = {c: t for c, t in table}
        games = 2 * (len(table) - 1)
        for i, (pid, q) in enumerate(sorted(people.items())):
            q["id"] = i
            main_club = names[q["c2"]] if q.get("c2") is not None and q.get("a2", 0) > q["a1"] else names[q["c"]]
            q["s6"] = card_stats(q, tmap[main_club], games, career[pid] + q["a"])
            plist.append(q)
        for pid, q in people.items():
            career[pid] += q["a"]
        levels_for(plist)
        # Order matches by date; club indexes refer to names.
        ms = sorted(by_season[season], key=lambda m: (m["date"], m["home"]))
        matches = [[m["date"], cix[m["home"]], cix[m["away"]], int(m["home_goals"]), int(m["away_goals"])] for m in ms]
        n = len(table)
        rel_n = 4 if season == "1994/95" else 3
        relegated = []
        for pos, (c, t) in enumerate(table, start=1):
            if pos > n - rel_n:
                relegated.append({"c": cix[c], "pos": pos, "pts": t["pts"], "w": t["w"], "d": t["d"], "l": t["l"],
                                  "gf": t["gf"], "ga": t["ga"], "f": "4-4-2", "xi": []})
        deductions = {str(cix[dc]): d for (ds, dc), d in DEDUCTIONS.items() if ds == season and dc in cix}
        game["seasons"][season] = {"season": season, "clubs": [{"id": i, "name": c} for i, c in enumerate(names)],
                                   "matches": matches, "players": plist, "relegated": relegated,
                                   "deductions": deductions, "relegationPlaces": rel_n}
        # every club-season with its real finish (Dare2Dream spins any of these)
        for pos, (c, t) in enumerate(table, start=1):
            game["clubSeasons"].append({"key": f"{season}:{c}", "season": season, "club": c, "pos": pos, "pts": t["pts"],
                                        "w": t["w"], "d": t["d"], "l": t["l"], "gf": t["gf"], "ga": t["ga"]})
        for r in relegated:
            game["catalogue"].append({"key": f"{season}:{names[r['c']]}", "season": season, "club": names[r["c"]],
                                      "pos": r["pos"], "pts": r["pts"]})

    # Legends: one card per player (Craig, 20 Oct: Salah had eight legend cards): his best-rated legend season keeps `lg`,
    # his other legend seasons stay purple.
    best = {}
    for sk, S in game["seasons"].items():
        for q in S["players"]:
            if q.get("lg") and (q["k"] not in best or (q["r"], q["a"]) > (best[q["k"]]["r"], best[q["k"]]["a"])): best[q["k"]] = q
    for S in game["seasons"].values():
        for q in S["players"]:
            if q.get("lg") and best[q["k"]] is not q: del q["lg"]
    # Career assists and clean sheets for the big card: summed over his seasons' rated numbers (as, cs).
    for S in game["seasons"].values():
        for q in S["players"]:
            k = game["careers"][q["k"]]
            k["as"] = k.get("as", 0) + int(q.get("as") or 0)
            k["cs"] = k.get("cs", 0) + int(q.get("cs") or 0)
    # Goal Rush stars: a purple or legend card in his Goal Rush position in any season (Craig, 31 Oct, build 208: every
    # pool takes the stars as well as the top scorers, so Gary Neville, Carragher, Makelele and Cech can come up); a 1 on his row
    g4star = {(q["n"], q["b"]) for S in game["seasons"].values() for q in S["players"] if q.get("lv", 0) >= 3}
    for pos, rows in game["g433"].items():
        for row in rows:
            if (row[0], pos) in g4star: row.append(1)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "game.json"), "w", encoding="utf-8") as f:
        json.dump(game, f, separators=(",", ":"), ensure_ascii=False)
    crests = {}
    for c, meta in clubs_meta.items():
        f = meta["crest"]
        for size in ("72", "128"):
            path = os.path.join(ROOT, "assets", "crests", size, f)
            if os.path.exists(path):
                crests.setdefault(c, {})[size] = "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
            # a white version for dark backgrounds, where a club's own crest is too dark to see (Derby, Spurs)
            # a white version for the club's own coloured card, where a one-colour crest in that colour vanishes
            # (Nottingham Forest, Liverpool, Sheffield Wed on red, red and blue; Craig, 12 Oct)
            if meta.get("crestCard"):
                path = os.path.join(ROOT, "assets", "crests", size, meta["crestCard"])
                if os.path.exists(path):
                    crests.setdefault(c, {})[size + "c"] = "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
            if meta.get("crestDark"):
                path = os.path.join(ROOT, "assets", "crests", size, meta["crestDark"])
                if os.path.exists(path):
                    crests.setdefault(c, {})[size + "w"] = "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
    with open(os.path.join(OUT, "crests.json"), "w", encoding="utf-8") as f:
        json.dump(crests, f, separators=(",", ":"))
    size = os.path.getsize(os.path.join(OUT, "game.json")) / 1e6
    print(f"game.json {size:.2f} MB, {len(game['seasons'])} seasons, {len(game['catalogue'])} relegated club-seasons; "
          f"{sum(1 for k in ext)} external ratings; crests for {len(crests)} clubs")


if __name__ == "__main__":
    main()
