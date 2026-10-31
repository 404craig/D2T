# Preferred positions

Built 11 and 12 October 2026 for Craig: every card knows the positions the player really played that season, so the pitch can show green (preferred), amber (next to one) and red (out of position) while a card is selected or dragged.

## Sources

1. **Transfermarkt match records** (`ceapi/performance-game/<id>`): the position each player was listed at in every game of his career. Codes, checked against players whose position is certain (Van Dijk, Alexander-Arnold, Robertson, Schmeichel): 1 GK, 2 sweeper, 3 CB, 4 LB, 5 RB, 6 CDM, 7 CM, 8 RM, 9 LM, 10 CAM, 11 LW, 12 RW, 13 second striker, 14 centre-forward, 0 not recorded. Fetched for every Premier League squad, 1992/93 to 2025/26 (7,200 players), by `tools/fetch_tm_positions.py`.
2. **Premier League feed formations** (`tools/fetch_slots.py`): each team's shape and which player stood in which slot, from 2015/16 (patchy 2012/13 to 2014/15). Used as the second source to check the first.

The feed's own per-match position (G/D/M/F) only varies from 2012/13; before that it repeats the squad position, so it could not be used for older seasons.

## How much is recorded

Share of player-games with a Transfermarkt position: 8 to 30% for 1992/93 to 2002/03, 92 to 100% for 2003/04 and 2004/05, 30 to 45% for 2005/06 to 2007/08, 86 to 99% from 2008/09.

## The rule (`tools/positions_rule.py`)

- Codes map to the game's labels; sweeper is CB; second striker and centre-forward are ST, and a second striker (10%+ of his season) also gets CAM.
- Main position: the one he played most that season.
- Other positions, up to three: any played in 10%+ of that season's games (2+ games), then any with 15+ Premier League games across his other seasons.
- Fewer than 10 recorded games: the seasons either side are added (one away in full, two away at half); if still empty, his whole Premier League career.
- When that thin evidence contradicts Tenaball's checked broad position (a winger listed as MID is fine), one of his positions in the broad leads, or he keeps the broad position alone (`tools/build_positions.py`).

## Matching to the game's players

18,121 player-seasons matched: 17,689 on name, 336 on surname at the same club, 50 on a close spelling, 46 by hand (Chicharito, Gabriel, Zanka, Jo and so on, in `docs/cards/feed/tm/aliases.json`, each checked on club, season and game count). 4 fringe players from the 1990s could not be verified and keep the broad position. Every match is in `docs/cards/feed/tm/matches.csv` with both game counts: all agree within 3 games apart from three pairs of team-mates whose games Transfermarkt swapped (Bruce and Pallister 1994/95 and 1995/96, Nilsen and Nielsen 1998/99); their positions are unaffected.

## Results

- 16,993 player-seasons have detailed positions: 96 to 100% of all appearances from 1995/96 on, 87 to 94% in 1992/93 to 1994/95. Players without them (mostly 1992/93, where almost nothing is recorded) keep GK, DEF, MID or FWD and are judged on that.
- Outfield players with 20+ games: 53% have two or more positions. The rest are genuine specialists (centre-backs, out-and-out strikers, specialist full-backs); they still play the neighbouring positions in amber.
- Against the Premier League feed, 2015/16 to 2025/26, 3,513 players with 10+ starts: main position identical to the feed's most used slot 81.8%, the same role under another label (RWB and RB, CM and CAM in a 4-3-3) 14.0%, the feed's slot among our positions 3.5%, different 0.7%.
- Samples: Rooney 2007/08 ST, also CAM, LW, RW (2017/18 CAM, ST, CM, RW); Mascherano 2009/10 CDM, also RB (his centre-back years were at Barcelona); Milner 2016/17 LB, also CM, RM, LM; Gerrard 2004/05 CM, also CAM, CDM, RM; Fabinho 2020/21 CB, also CDM; Barry 2004/05 LM, 2008/09 CDM.

## In the game

- `p` on each player-season (main first), `b` keeps the broad position.
- Fit: main 100% (green), other preferred 95% (green), next to one of them 90% (amber, the engine's `NEAR` map), elsewhere 70% (red).
- Balance (`node tests/calibrate-all.js 20`, 2,060 runs): greedy title 1.9% (3.5% with the same engine and broad positions), top 4 12.6%, stay up 93.9%; no change to the spin odds needed.

## Career positions (Craig, 29 Oct 2026)

"Who cares about season specific positions": a player's positions are his career's and the same on every card of his; only the main position stays the season's own.

- Career: every position Transfermarkt recorded for him in 10%+ of his recorded Premier League games, or in 15+ of them, most played first, up to five positions in all. Keepers stay GK only.
- Under 20 recorded games across his career (873 outfield players with a 10+ game card, mostly 1992/93 to 2002/03): his Wikipedia page. `tools/fetch_wiki_positions.py` fetched each page (one request a second), Sonnet agents read the position sentences and the infobox and mapped them to the game's labels with a quote for each (plain "defender" or "midfielder" adds nothing; a full-back or winger with no side takes the side he already has), and every result was checked: 614 quotes appear word for word on the page, the other 22 have each position's wording on the page. Each player's positions apply only to his cards at the clubs and years of his infobox, so a namesake's cards are untouched (the two David Lees of 1992/93, the two Alan Smiths, the two Chris Armstrongs). 633 players in `data/source/positions_wiki.json`; not verified and left as they were: Scott Taylor, Emerson, Michael Williams, Paul Robinson, Paul Williams, Tony Dobson, Trevor Challis.
- Result: outfield players (10+ games) with two or more positions, 1992/93 61 of 355 before to 147 of 355 now (average 1.23 to 1.55), 1995/96 126 to 165, 2000/01 171 to 217; every season gains.
