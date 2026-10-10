# Card ratings draft (2007/08)

A first try at FIFA-style cards for D2T, built only from Tenaball's verified data: Premier League apps, goals and match results. Nothing here is a decision yet.

- `card_lab.html`: the self-contained lab page (open it in a browser). Pick a club, open a card to see how each number was made, and change the formula weights.
- `engine.js`: the rating engine. Pure function `rate(data, cfg)`, so the same inputs always give the same cards (it runs in Node too).
- `cards_2007-08.json`: the season inputs (one row per player, club and season, plus each club's record).
- `card_lab.src.html`: the page template.
- `card_styles.html`: layout and colour options for the cards (badge position; bronze, silver, gold, club's best, legend). Built from `card_styles.src.html` and `style_players.json` by `tools/build_card_styles.py`.

Rebuild:

```
python3 tools/build_card_inputs.py <path to tenaball repo> 2007/08 docs/cards/cards_2007-08.json
python3 tools/build_card_lab.py docs/cards/cards_2007-08.json docs/cards/card_lab.html
```

## The draft formula

Face stats (20 to 99): GOL (goals per app, adjusted for small samples), IMP (share of club goals), FIT (apps out of 38), DEF (club goals conceded, scaled by games played), WIN (club points per game, scaled by games played), EXP (Premier League apps to date). Keepers get WAL and CLN in place of GOL, IMP and DEF.

Overall: a weighted mix of the face stats for the position, then standard deviations above that position's average (64 plus 9 per standard deviation, capped 40 to 95). Card types: bronze under 65, silver 65 to 74, gold 75 and up, and a club's best card for the highest rated player in each squad. Legends are still to be defined. No fees or transfer values (decided 10 October 2026).

Sanity check: the average best XI of each club (1-4-4-2) tracks the real 2007/08 points with a correlation of 0.97 (Man Utd 83.5 top, Derby 59.0 bottom). Part of that is built in, because WIN and DEF use club results.

## Known gaps

Defenders and keepers are really team ratings (no per-player clean sheets, tackles or saves). No per-season assists, so creators are undervalued. Experience counts the Premier League only. No ages or minutes.
