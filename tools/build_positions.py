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
from positions_rule import positions, labelled, SHARE, CAREER  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
TMDIR = os.path.join(ROOT, "docs", "cards", "feed", "tm")
BROAD = {"GK": "GK", "CB": "DEF", "RB": "DEF", "LB": "DEF", "RWB": "DEF", "LWB": "DEF", "CDM": "MID", "CM": "MID",
         "CAM": "MID", "RM": "MID", "LM": "MID", "RW": "FWD", "LW": "FWD", "ST": "FWD"}


CAREER_KNOWN = 20      # recorded games across a career needed to use them directly
MAX_POSITIONS = 5      # main and up to four others


def norm(s):
    s = unicodedata.normalize("NFKD", s.replace("'", "").replace("’", "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]+", " ", s).strip()


def career_positions(out, tids, tmplayer, stats):
    """Craig, 29 Oct: a player's positions are his career's, the same in every season he plays; only the main
    position stays the season's own. Career: every position Transfermarkt recorded for him in 10%+ of his
    recorded Premier League games, or in 15+ of them, most played first. Under 20 recorded games across his
    career, the positions his seasons were given are pooled instead. Keepers keep GK alone."""
    seasons_of = defaultdict(list)
    for season, sp in out.items():
        for plid in sp:
            seasons_of[plid].append(season)
    for plid, ss in seasons_of.items():
        pool = Counter()
        for t in {tids[(s, plid)] for s in ss}:
            for c in tmplayer(t)["seasons"].values():
                pool.update(labelled(c))
        total = sum(pool.values())
        if total >= CAREER_KNOWN:
            career = [lab for lab, v in pool.most_common() if v / total >= SHARE or v >= CAREER]
        else:
            votes = Counter()
            for s in ss:
                for k, lab in enumerate(out[s][plid]):
                    votes[lab] += 2 if k == 0 else 1
            career = [lab for lab, _ in votes.most_common()]
            stats["career_thin"] += 1
        for s in ss:
            main = out[s][plid][0]
            if main == "GK":
                out[s][plid] = ["GK"]
                continue
            rest = [lab for lab in career if lab not in (main, "GK")] + [lab for lab in out[s][plid][1:] if lab not in career]
            out[s][plid] = ([main] + rest)[:MAX_POSITIONS]


def wiki_positions(out, by_season, stats):
    """Craig, 29 Oct: players whose careers Transfermarkt barely recorded (under 20 games with a position) take
    the positions their Wikipedia page names, in the seasons at the clubs and years of his infobox, each with its quote, in data/source/positions_wiki.json
    (tools/fetch_wiki_positions.py, then read by hand). They join his career positions after the recorded ones.
    A player with no recorded positions at all leads with the first of them in his checked broad position."""
    wp = os.path.join(ROOT, "data", "source", "positions_wiki.json")
    if not os.path.exists(wp):
        return
    wiki = {k: v for k, v in json.load(open(wp)).items() if not k.startswith("_") and v.get("positions")}
    for season, rows in by_season.items():
        sp = out.setdefault(season, {})
        for r in rows:
            plid, w = r["player_id"], wiki.get(r["player"])   # keyed by the shown name; seasons keep namesakes apart
            if not w or f"{season}|{r['club']}" not in w["cards"] or r["position"] == "GK":
                continue
            extra = w["positions"]
            cur = sp.get(plid)
            if cur and cur[0] == "GK":
                continue
            if not cur:
                lead = [x for x in extra if BROAD[x] == r["position"]]
                if not lead:
                    continue
                cur = [lead[0]]
                stats["wiki_new"] += 1
            add = [x for x in extra if x not in cur]
            if add:
                stats["wiki_added"] += 1
            sp[plid] = (cur + add)[:MAX_POSITIONS]


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

    out, unmatched, report, audit = {}, [], [], []
    tids = {}
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
            tm_games = sum(rec["seasons"].get(str(year), {}).values())
            apps = sum(int(r["apps"]) for r in rs)
            audit.append([season, plid, tid, how, apps, tm_games])
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
            tids[(season, plid)] = str(tid)
            if how in ("surname", "fuzzy"):
                report.append(f"{season} {rs[0]['player']} ({', '.join(sorted(clubs))}) -> TM {tm[str(tid)]['slug']} [{how}]")
            if b == "GK" or m == "GK":
                stats["gk_ok" if (b == "GK") == (m == "GK") else "gk_clash"] += 1
                if (b == "GK") != (m == "GK"):
                    report.append(f"GK CLASH {season} {rs[0]['player']} Tenaball {b}, TM main {m}")
            else:
                stats["broad_same" if BROAD[m] == b else "broad_diff"] += 1
        out[season] = season_out
    career_positions(out, tids, tmplayer, stats)
    wiki_positions(out, by_season, stats)
    json.dump(out, open(os.path.join(ROOT, "data", "source", "positions.json"), "w"), separators=(",", ":"))
    json.dump(unmatched, open(os.path.join(TMDIR, "unmatched.json"), "w"), indent=1)
    with open(os.path.join(TMDIR, "matches.csv"), "w", newline="") as fh:  # every match, with both game counts
        w = csv.writer(fh)
        w.writerow(["season", "player_id", "tm_id", "how", "apps", "tm_games"])
        w.writerows(audit)
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
