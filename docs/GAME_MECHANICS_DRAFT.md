# Card odds and calibration against "DROP2TOP Game Rules v0.2" (10 October 2026)

The rules are the D2T main session's "DROP2TOP Game Rules v0.2" doc. An earlier draft in this file invented its own spin rules; it is replaced by this one. Simulator: `tools/sim_rules_v02.py`; results: `docs/cards/sim_rules_v02.json`.

## Rules simulated (from v0.2)

- Pick one of three relegated club-seasons (103 since 1992/93). Your team is exactly 11.
- 17 rolls a season: 3 before GW1; 1 before GW4, 7, 10, 13, 16, 19; 3 in January (before GW21); 1 before GW24, 27, 30, 33, 36.
- Each roll shows 3 cards; sign one (replacing a player) or pass. 5 respins a season.
- Cards come from your club's season (players with 10+ games, not your club, never the same player twice); legends come from any season (here: each player's best season, 24 players whose best season is 93+).
- Card levels are season-relative within position. Purple here is the best ~3.5% in each broad position, standing in for "best in each detailed position" until detailed positions exist.
- Raiding: the selling club loses strength and its remaining real wins and draws can drop (chance 3x the strength lost).
- Your 38 matches are simulated; the other 342 results are history, changed only by raiding.

Recruiting styles: none; casual (signs a random card that improves the XI, never respins); strong (signs the best card, respins when no card adds 2+ to a shirt, picks the strongest of the three clubs).

## How many of each card you see (per season)

Each roll shows 3 cards, so 17 rolls show 51 cards, plus 3 more per respin used.

| Card | v0.2 share | Seen per season (casual, 51 cards) | Signed |
|---|---|---|---|
| Legend | 0.5% | about 0.26 (one run in four) | when seen |
| Purple | 2.5% | about 1.4 | usually |
| Gold | 17% | about 8.8 | most |
| Silver | 35% | about 18 | some |
| Bronze | 45% | about 22 | rarely |

## Calibration against the v0.2 targets

| Setting | Derby 07/08, no signings | No signings: stay up | Casual: stay up | Strong: top half | Strong: title |
|---|---|---|---|---|---|
| Target (v0.2) | 20th, 10 to 20 pts | (should mostly go down) | about 50% | top half realistic | about 2% |
| v0.2 shares, engine fitted on history, every signing a natural fit | 19.8th, 24 pts | 42% | 96% | 93% | 5.4% |
| Steeper engine (0.08), v0.2 shares, natural fit | 20th, 13 pts | 18% | 95% | 98% | 16% |
| Steeper engine, v0.2 shares, fit costs (50% green, 35% amber, 15% red) | 20th, 13 pts | 18% | 87% | 89% | 3.6% |
| **Steeper engine, middle shares, fit costs** | **20th, 13 pts** | **19%** | **78%** | **82%** | **2.3%** |
| Steeper engine, tough shares, fit costs | 20th, 13 pts | 18% | 69% | 71% | 1.2% |

Middle shares: bronze 53%, silver 32%, gold 12.5%, purple 2%, legend 0.5%. Tough: 60 / 30 / 8.5 / 1.2 / 0.3.

## What it means

1. **The match engine needs to be steeper than history.** Fitted on all real results, it lets unchanged relegated squads stay up 42% of the time and gives Derby 24 points. A rating-gap weight of 0.08 (history's is 0.0475) gives Derby 13 points and relegated squads 18% survival.
2. **Position fit matters a lot.** If every signing slots in as a natural fit, 17 rolls rebuild the whole XI and strong runs win the title 16% of the time. The rules' amber (90%) and red (70%) costs bring that down; how often a card fits naturally depends on the detailed positions data, so it needs re-running once we have it.
3. **With the middle shares, strong runs win the title 2.3% of the time** and reach the top half 82% of the time, which matches the targets.
4. **Casual survival is still too high (78% against about 50%).** Options: a slightly steeper engine still, fewer gold cards, or accepting that anyone who signs sensible players usually stays up.

## Differences with the card work in this repo

- v0.2 levels are season-relative by position (bronze lower third, gold top fifth, purple the best in each position). The card styles work used absolute ratings (gold 80+) and purple for each club's best player. These need one agreed definition; the simulation uses v0.2's.
- Legends: v0.2 says "an all-time great, best season". The simulation uses players whose best season rates 93+ (24 players); the real list is still to be agreed.
