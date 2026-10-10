# Draft: spins and card odds (10 October 2026)

The repo has no written rules for spins yet, so this is a proposal with simulated numbers, for Craig and Aiden to agree or change. Simulator: `tools/sim_game.py`; raw results: `docs/cards/sim_results.json`.

## What was simulated

- You take over a real relegated side (bottom three, any season 1992/93 to 2025/26) with its real squad. Typical starting best XI: about 71.
- Each spin gives one card from any season (cards with 10+ apps). You keep it if it beats the weakest player in your best XI (1-4-4-2) at that position.
- Spins come before the season ("pre-season") and before each matchday ("per game").
- Matches: each side's goals are Poisson, with the rate set by the two best-XI ratings and home advantage. Fitted on all 13,166 real Premier League results: rate = exp(0.104 + 0.276 at home + 0.0475 x rating gap). Check: from the real squads, the real champion wins the simulated season about half the time, which is realistic.
- The other 19 clubs are that season's real sides. About 2,400 simulated seasons per setting (title chances are accurate to roughly half a point).

## Card categories (checked in this order)

| Category | Rule | Share of all cards (10+ apps) |
|---|---|---|
| Legend | rated 93+ | 0.5% (72 cards) |
| Club's best (purple) | top rated player at his club that season | 4.7% |
| Gold | 80+ | 12.1% |
| Silver | 70 to 79 | 57.3% |
| Bronze | under 70 | 25.4% |

## Results

Title = finish 1st. Per season = cards of each category you would see in that many spins.

| Odds | Pre-season spins | Spins per game | Title | Top 4 | Stay up | Legends seen | Purples | Golds |
|---|---|---|---|---|---|---|---|---|
| Natural (as above) | 0 | 1 | 0.0% | 7% | 96% | 0.2 | 1.7 | 4.6 |
| Natural | 10 | 1 | 1.0% | 21% | 99% | 0.3 | 2.2 | 5.8 |
| Natural | 0 | 2 | 1.5% | 28% | 100% | 0.4 | 3.6 | 9.2 |
| Natural | 10 | 2 | 3.0% | 40% | 100% | 0.5 | 4.1 | 10.5 |
| Generous (1 / 6 / 20 / 45 / 28%) | 5 | 1 | 2.0% | 28% | 99% | 0.4 | 2.6 | 8.7 |
| Generous | 10 | 1 | 2.7% | 41% | 100% | 0.5 | 2.9 | 9.7 |
| Generous | 0 | 2 | 3.8% | 47% | 100% | 0.8 | 4.6 | 15.5 |

## Proposal for about a 2% title chance

**5 pre-season spins, then 1 spin before every matchday (43 spins a season), with these odds per spin:**

| Card | Chance per spin | In a season (43 spins) |
|---|---|---|
| Legend | 1 in 100 | about 0.4 (one every 2 to 3 seasons) |
| Club's best (purple) | 6 in 100 | about 2.6 |
| Gold | 20 in 100 | about 8.7 |
| Silver | 45 in 100 | about 19 |
| Bronze | 28 in 100 | about 12 |

Simulated outcome: title 2.0%, top four 28%, average finish 6.7th, stay up 99%.
Equivalent: natural odds with 2 spins per game and no pre-season spins gives 1.5%.

## What this shows, and open questions

- Spins are strong. With any setting that gives a 2% title chance, almost everyone stays up (99%+). If the game should also make survival hard, spins need a cost: limited squad slots, a transfer budget, a cap on how many spins you can keep, injuries, or a card that replaces your worst player whether it is better or not.
- The title is mostly decided by luck on legends and purples: one legend card lifts a best XI by about 2 points.
- Not modelled yet: fitness, injuries, suspensions, form, opponents strengthening, cup games, or a multi-season "Drop2Top" climb. Each would change the numbers; the simulator is set up to test them.
- "Legend" here means a 93+ season card. If legends become a hand-picked or rule-based set (see card styles), the odds should be re-run.
