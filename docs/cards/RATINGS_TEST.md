# Ratings test: 1996/97, 2008/09, 2019/20 (10 October 2026)

Every player in three full seasons was rated with real Premier League feed data (assists, clean sheets, his own wins/draws/losses, minutes, goals conceded) matched to Tenaball's verified apps and goals. Five subagents reviewed the results: three on ten 2008/09 clubs (Man Utd, Liverpool, Chelsea, Arsenal, Everton, Aston Villa, Spurs, Stoke, Newcastle, West Brom), one on Liverpool 2019/20 and one on Man Utd 1996/97.

Files: `tools/fetch_pl_feed.py`, `tools/match_feed.py`, `tools/rate_v2.py`, `tools/rate_v3.py`; data and outputs in `docs/cards/feed/`.

## What the reviewers found in v2

1. Short stints topped the tables: Arshavin 96 (12 games), Waddle 97 (7), Molenaar 93 (12), 1 to 3 game players on silver cards.
2. Holding midfielders were sunk because only goals and assists counted: Mascherano 61, Fabinho 69, Mikel 63, Fletcher 67, Keane 70.
3. The with/without part of the difference maker was noise: it penalised players when the team still won without them (Alisson, Ashley Cole, Ferdinand) and rewarded the Ramos-to-Redknapp change at Spurs.
4. Clean sheets and goals conceded punished keepers and defenders in weak sides (Given, Carson, Friedel).
5. A hard 99 cap squashed the top (four midfielders tied on 97 in 2019/20).

## v3 changes

- Every per-game stat filled with 12 average games (goals use his own earlier rate).
- Midfielders get clean sheets and a bigger difference-maker weight.
- Keeper and defender clean sheets and goals conceded are half judged against their own club's rate.
- Difference maker = his own points per game, plus a small bonus only when the club did better with him and both samples have 8+ games.
- Appearances count 10% (15% for defenders and keepers).
- Soft ceiling on stats and overall instead of a hard cap.

## v3 results (selected)

| | v2 | v3 |
|---|---|---|
| Arshavin 08/09 (12 games) | 96 | 89 |
| Mascherano / Alonso / Fletcher / Mikel 08/09 | 61 / 75 / 67 / 63 | 72 / 82 / 80 / 79 |
| Fabinho / Wijnaldum / Henderson 19/20 | 69 / 68 / 82 | 79 / 81 / 90 |
| Van Dijk / Alexander-Arnold 19/20 | 90 / 95 | 91 / 90 |
| Cantona / Schmeichel / Keane 96/97 | 83 / 76 / 70 | 86 / 81 / 76 |
| Juninho 96/97 | 97 | 84 |

Top of each season in v3: 2008/09 Lampard 94, Gerrard 94, Vidic 93, Torres 92, Ronaldo 91. 2019/20 De Bruyne 96, Salah 92, Mahrez 92, Bruno Fernandes 92, Van Dijk 91. 1996/97 Shearer 93, Giggs 92, Beckham 91.

## Still wrong, and why

- **Outfield clean sheets from the feed are unreliable.** Evra 11 in 28 games (United kept 24), Pallister 5 in 27 against May's 13 in 29. The feed seems to credit them only under a playing-time rule. This keeps Ferdinand (70) and Evra (65) far too low and Pallister at 60. Needs a better source before defenders can be trusted: team goals conceded while he was on the pitch (Opta era) or match line-ups.
- **Sub appearances count as full games.** Milner 2019/20: 22 apps but 926 minutes, so his 21-1-0 record lifts him to 82. Minutes exist from 2006/07; earlier seasons need starts from another source.
- **Mid-season movers are split by club** (Given 65 at Newcastle and 57 at Man City). Should be merged into one season card or judged per club with the combined sample.
- **1996/97 is flatter at the top** (3 players at 90+, against 5 to 8 in the modern seasons) because there is no per-player goals conceded or minutes.
- **Data gap:** the feed is missing one 2008/09 Stoke v West Ham match (every player at both clubs is one app short of Tenaball).

## v4: reputation, line-ups, holding midfielders (10 October 2026, later)

**New data: match line-ups from the Premier League feed** (`tools/fetch_lineups.py`, `docs/cards/feed/lineups_*.csv`). Every match in all three seasons, back to 1996/97: starting XIs, substitutes, the minute of every substitution, goal and red card, the position each player was listed at, and dates of birth. All 1,140 matches rebuild their final scores exactly. From these we get, for every season: starts, minutes, goals conceded and clean sheets while each player was on the pitch (60+ minutes, nothing conceded). 11v11 blocks automated requests from here, and this source is the league's own, so it replaces the 11v11 plan.

What the line-ups showed:
- The feed's season clean sheets undercount some players: Evra 14 (feed 11), O'Shea 15 (12), Ferdinand 13 (12).
- Pallister's 5 clean sheets in 1996/97 are real: 35 goals conceded in his 27 starts.
- The missing 2008/09 Stoke v West Ham match is present in the line-ups.

**v4 changes** (`tools/rate_v4.py`):
- Reputation (REP), 33% of the overall, all from verified records: club finish this season (for his share of games), PFA Player of the Year, FWA, Player of the Season, PFA Young Player, Golden Glove, Golden Boot, career Premier League titles (10+ apps) and career appearances.
- Rates per 90 minutes where minutes exist (now every season), so sub cameos are not full games.
- Clean sheets and goals conceded while on the pitch, from the line-ups.
- Midfielders are also rated as holding players (mostly difference maker and clean sheets); the better score counts.

| | v3 | v4 |
|---|---|---|
| Henderson / Wijnaldum / Fabinho 19/20 | 90 / 81 / 79 | 95 / 89 / 82 |
| Mascherano / Fletcher / Mikel 08/09 | 74 / 80 / 79 | 79 / 91 / 82 |
| Ferdinand / Evra 08/09 | 70 / 65 | 79 / 81 |
| Cantona / Schmeichel / Keane / Irwin 96/97 | 86 / 81 / 76 / 81 | 89 / 90 / 84 / 91 |
| Modric 08/09 (Spurs, 8th) | 75 | 68 |

Trade-off: reputation lifts title-winning squads (Poborsky 88, May 91, O'Shea 91, nine Man Utd players in the 1996/97 top 15) and pulls down good players at mid-table clubs (Modric 68, Fuller 64, Given 65 and 56). A reputation signal that does not depend on the club, such as international caps by season, would balance it; Tenaball only has caps for some nations.
