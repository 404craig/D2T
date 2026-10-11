"""Compile preferred positions for every player-season in the game.

Usage: python3 tools/build_positions.py [--report]

Inputs:
- docs/cards/feed/tm/season_<year>.json and players/<id>.json (tools/fetch_tm_positions.py):
  the position Transfermarkt lists for every Premier League game a player played.
- data/source/pl_players.csv (Tenaball): the game's player-seasons, keyed by player_id.
- docs/cards/feed/tm/aliases.json: hand-checked matches, {"<season>|<player_id>": "<tm id>"} or null
  to mark a player Transfermarkt does not have.
- docs/cards/feed/slots/slots_*.csv (tools/fetch_slots.py): formation slots from the Premier League
  feed, used only as the cross-check from 2015/16.

Output: data/source/positions.json {season: {player_id: [main, other, ...]}} using the rule in
tools/positions_rule.py, plus docs/cards/feed/tm/positions_report.md with the checks.
"""
import csv
import difflib
import glob
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from positions_rule import positions, labelled  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
TMDIR = os.path.join(ROOT, "docs", "cards", "feed", "tm")
BROAD = {"GK": "GK", "CB": "DEF", "RB": "DEF", "LB": "DEF", "RWB": "DEF", "LWB": "DEF", "CDM": "MID", "CM": "MID",
         "CAM": "MID", "RM": "MID", "LM": "MID", "RW": "FWD", "LW": "FWD", "ST": "FWD"}


def norm(s):
    s = unicodedata.normalize("NFKD", s.replace("'", "").replace("’", "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]+", " ", s).strip()


def main():
    rows = list(csv.DictReader(open(os.path.join(ROOT, "data", "source", "pl_players.csv"))))
    aliases = {}
    ap = os.path.join(TMDIR, "aliases.json")
    if os.path.exists(ap):
        aliases = json.load(open(ap))
    by_season = defaultdict(list)
    for r in rows:
        by_season[r["season"]].append(r)
    cache = {}

    def tmplayer(pid):
        if pid not in cache:
            cache[pid] = json.load(open(os.path.join(TMDIR, "players", f"{pid}.json")))
        return cache[pid]

    out, unmatched, report = {}, [], []
    stats = Counter()
    for season in sorted(by_season):
        year = int(season[:4])
        sp = os.path.join(TMDIR, f"season_{year}.json")
        if not os.path.exists(sp):
            stats["seasons_missing"] += 1
            continue
        tm = json.load(open(sp))
        names = {pid: norm(v["slug"].replace("-", " ")) for pid, v in tm.items()}
        # Tenaball club for each Transfermarkt club slug: the one most exact name matches agree on.
        votes = defaultdict(Counter)
        exact = defaultdict(list)
        for pid, n in names.items():
            exact[n].append(pid)
        people = {}
        for r in by_season[season]:
            people.setdefault(r["player_id"], []).append(r)
        for plid, rs in people.items():
            hits = exact.get(norm(rs[0]["player"])) or exact.get(norm(rs[0]["full_name"])) or []
            if len(hits) == 1:
                for r in rs:
                    votes[tm[hits[0]]["club"]][r["club"]] += 1
        club_of = {slug: c.most_common(1)[0][0] for slug, c in votes.items()}
        taken = set()
        season_out = {}
        for plid, rs in sorted(people.items()):
            key = f"{season}|{plid}"
            clubs = {r["club"] for r in rs}
            tid, how = None, ""
            if key in aliases:
                tid, how = aliases[key], "alias"
                if tid is None:
                    stats["alias_none"] += 1
                    continue
            if not tid:
                for cand in (norm(rs[0]["player"]), norm(rs[0]["full_name"])):
                    hits = [p for p in exact.get(cand, []) if p not in taken]
                    if len(hits) > 1:
                        hits = [p for p in hits if club_of.get(tm[p]["club"]) in clubs] or hits
                    if len(hits) == 1:
                        tid, how = hits[0], "name"
                        break
            if not tid:  # same club, same surname, close enough first name
                sur = norm(rs[0]["surname"] or rs[0]["player"].split()[-1])
                cands = [p for p, n in names.items() if p not in taken and club_of.get(tm[p]["club"]) in clubs
                         and (n.split()[-1] == sur or sur in n.split())]
                if len(cands) == 1:
                    tid, how = cands[0], "surname"
                else:
                    pool = [p for p in names if p not in taken and club_of.get(tm[p]["club"]) in clubs]
                    best = sorted(((difflib.SequenceMatcher(None, norm(rs[0]["player"]), names[p]).ratio(), p) for p in pool), reverse=True)
                    if best and best[0][0] >= 0.82 and (len(best) == 1 or best[0][0] - best[1][0] > 0.08):
                        tid, how = best[0][1], "fuzzy"
            if not tid:
                apps = sum(int(r["apps"]) for r in rs)
                unmatched.append({"key": key, "player": rs[0]["player"], "clubs": sorted(clubs), "apps": apps,
                                  "position": rs[0]["position"]})
                stats["unmatched"] += 1
                stats["unmatched_apps"] += apps
                continue
            taken.add(tid)
            stats["matched_" + how] += 1
            rec = tmplayer(str(tid))
            m, o, note = positions(rec["seasons"], year)
            if not m:
                stats["no_positions"] += 1
                continue
            b = rs[0]["position"]
            if note and BROAD[m] != b and not (b == "MID" and m in ("RW", "LW")):
                # thin evidence (borrowed seasons) against Tenaball's checked broad position: lead with
                # one of his positions in that broad, or keep the broad position alone
                fit = [x for x in o if BROAD[x] == b]
                if not fit:
                    stats["thin_conflict_dropped"] += 1
                    continue
                o = [x for x in [m] + o if x != fit[0]]
                m = fit[0]
                stats["thin_conflict_reordered"] += 1
            season_out[plid] = [m] + o
            if how in ("surname", "fuzzy"):
                report.append(f"{season} {rs[0]['player']} ({', '.join(sorted(clubs))}) -> TM {tm[str(tid)]['slug']} [{how}]")
            if b == "GK" or m == "GK":
                stats["gk_ok" if (b == "GK") == (m == "GK") else "gk_clash"] += 1
                if (b == "GK") != (m == "GK"):
                    report.append(f"GK CLASH {season} {rs[0]['player']} Tenaball {b}, TM main {m}")
            else:
                stats["broad_same" if BROAD[m] == b else "broad_diff"] += 1
        out[season] = season_out
    json.dump(out, open(os.path.join(ROOT, "data", "source", "positions.json"), "w"), separators=(",", ":"))
    json.dump(unmatched, open(os.path.join(TMDIR, "unmatched.json"), "w"), indent=1)
    return out, unmatched, report, stats


if __name__ == "__main__":
    out, unmatched, report, stats = main()
    total = sum(len(v) for v in out.values())
    print(f"player-seasons with positions: {total}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")
    multi = Counter(min(len(v), 4) for s in out.values() for v in s.values())
    print("  positions per player-season:", dict(sorted(multi.items())))
    if "--report" in sys.argv:
        for line in report[:200]:
            print(line)
