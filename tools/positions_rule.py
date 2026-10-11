"""Main and other positions for a player-season from Transfermarkt match positions.

Rule (draft for Craig, 11 Oct 2026):
- Codes map to game labels; sweeper -> CB; second striker and centre-forward -> ST.
- Main: the position he played most that season (games with a recorded position).
- Other positions, up to 3: any played in 15%+ of that season's games (and 2+ games),
  then any with 20+ PL games across his other seasons, most played first.
- A season with fewer than 10 recorded games borrows from the seasons either side
  (one season away counts in full, two away at half) before the main is chosen.
"""
from collections import Counter

LABEL = {1: "GK", 2: "CB", 3: "CB", 4: "LB", 5: "RB", 6: "CDM", 7: "CM", 8: "RM", 9: "LM",
         10: "CAM", 11: "LW", 12: "RW", 13: "ST", 14: "ST"}
MIN_KNOWN, SHARE, MIN_SEASON, CAREER = 10, 0.15, 2, 20


def labelled(counts):
    c = Counter()
    for k, v in counts.items():
        lab = LABEL.get(int(k))
        if lab:
            c[lab] += v
    return c


def positions(seasons, year):
    """seasons: {year: {tm code: games}} for the whole PL career. Returns (main, others, note)."""
    seasons = {int(k): v for k, v in seasons.items()}
    this = labelled(seasons.get(year, {}))
    note = ""
    pool = Counter(this)
    if sum(this.values()) < MIN_KNOWN:
        for d, w in ((1, 1.0), (2, 0.5)):
            for y in (year - d, year + d):
                for lab, v in labelled(seasons.get(y, {})).items():
                    pool[lab] += v * w
        note = f"only {sum(this.values())} games recorded, seasons either side used"
    if not pool:
        return None, [], "no positions recorded"
    main = pool.most_common(1)[0][0]
    total = sum(pool.values())
    others = [lab for lab, v in pool.most_common() if lab != main and v / total >= SHARE and v >= MIN_SEASON]
    career = Counter()
    for y, c in seasons.items():
        if y != year:
            career.update(labelled(c))
    for lab, v in career.most_common():
        if lab != main and lab not in others and v >= CAREER:
            others.append(lab)
    return main, others[:3], note
