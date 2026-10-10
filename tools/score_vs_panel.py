"""Score a set of rated seasons against the blind panel's expected ratings.

Usage: python3 tools/score_vs_panel.py <version e.g. v5> [--misses]

Reports, over every panel player: rank agreement (Spearman), mean absolute
difference in rating points, average bias, and agreement on each club's order.
"""
import csv
import json
import sys
from collections import defaultdict


def ranks(v):
    o = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2
        i = j + 1
    return r


def spearman(a, b):
    ra, rb = ranks(a), ranks(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else 0


def main():
    ver = sys.argv[1]
    pairs = []
    for t, files in [("2008-09", ["2008-09a", "2008-09b"]), ("2019-20", ["2019-20"]), ("1996-97", ["1996-97"])]:
        rated = {(r["club"], r["player"]): r for r in json.load(open(f"{__import__("os").environ.get("RATED_DIR", "docs/cards/feed")}/rated_{ver}_{t}.json", encoding="utf-8"))["players"]}
        for f in files:
            for x in csv.DictReader(open(f"docs/cards/panel/expected_{f}.csv", encoding="utf-8")):
                r = rated.get((x["club"], x["player"]))
                if r:
                    pairs.append((t, x["club"], x["player"], r["pos"], int(x["expected"]), r["ovr"]))
    exp = [p[4] for p in pairs]
    got = [p[5] for p in pairs]
    mae = sum(abs(a - b) for a, b in zip(exp, got)) / len(pairs)
    bias = sum(b - a for a, b in zip(exp, got)) / len(pairs)
    by_club = defaultdict(list)
    for p in pairs:
        by_club[(p[0], p[1])].append(p)
    club_rho = sum(spearman([p[4] for p in v], [p[5] for p in v]) for v in by_club.values()) / len(by_club)
    season_rho = {t: round(spearman([p[4] for p in pairs if p[0] == t], [p[5] for p in pairs if p[0] == t]), 3) for t in ["2008-09", "2019-20", "1996-97"]}
    print(f"{ver}: n={len(pairs)} spearman={spearman(exp, got):.3f} by season={season_rho} club-order={club_rho:.3f} MAE={mae:.1f} bias={bias:+.1f}")
    if "--misses" in sys.argv:
        for p in sorted(pairs, key=lambda p: -abs(p[5] - p[4]))[:25]:
            print(f"   {p[0]} {p[1]:13} {p[2]:26} {p[3]:3} panel {p[4]}  model {p[5]}  ({p[5] - p[4]:+d})")


if __name__ == "__main__":
    main()
