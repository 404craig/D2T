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

## v5: league position points, and a blind panel to measure against

**Blind panel** (`docs/cards/panel/`). Four subagents rated every player with 10+ apps at 20 club-seasons from their own football knowledge, without seeing any of our numbers (383 players):
- 2008/09: Man Utd, Liverpool, Chelsea, Arsenal, Everton, Aston Villa, Spurs, Stoke, Newcastle, West Brom
- 2019/20: Liverpool, Man City, Leicester, Burnley, Norwich
- 1996/97: Man Utd, Newcastle, Arsenal, Middlesbrough, Wimbledon

`tools/score_vs_panel.py` scores any version against it: rank agreement (Spearman, 1.0 = same order), agreement on each club's order, and the average gap in rating points. The panel is opinion (and remembers fame), so it is a sense check, not the truth. EA ratings would be a second check once we have the files.

**v5 reputation** (`tools/rate_v5.py`): league position points, 20 for 1st down to 1 for 20th (22-club seasons scaled), times his share of the club's games. Last season and the season before also count (seasons outside the Premier League are left out rather than scored zero). Plus awards and career appearances. Titles won are dropped. Champions League minutes were tested and add nothing beyond league position, so their weight is 0 by default.

| Version | Rank agreement | 08/09 | 19/20 | 96/97 | Club order | Avg gap |
|---|---|---|---|---|---|---|
| v2 | 0.739 | 0.718 | 0.786 | 0.722 | 0.538 | 7.4 |
| v3 | 0.777 | 0.756 | 0.827 | 0.751 | 0.612 | 7.5 |
| v4 | 0.782 | 0.757 | 0.847 | 0.744 | 0.520 | 7.2 |
| v5 first try | 0.808 | 0.782 | 0.865 | 0.790 | 0.559 | 7.3 |
| v5 tuned (reputation 50%) | 0.842 | 0.825 | 0.896 | 0.814 | 0.634 | 4.9 |
| v5 reputation 70% | 0.858 | 0.847 | 0.910 | 0.822 | 0.681 | 5.7 |
| reputation only, no match stats | 0.845 | 0.840 | 0.904 | 0.805 | 0.691 | 7.5 |

A 324-run sweep found: last season counting as much as this one (and the season before at half) agrees best; Champions League adds nothing; agreement peaks with reputation at 70 to 80% of the overall. Reputation alone already scores 0.845, which shows the panel mostly rates on fame and club success. v5 defaults to 50% so match performance still matters; it costs 0.016 of agreement.

Named players, v5 tuned (panel in brackets): Henderson 97 (89), Fabinho 86 (87), Wijnaldum 92 (86), Van Dijk 94 (92), Salah 94 (91), Gerrard 97 (92), Ronaldo 94 (94), Mascherano 85 (85), Modric 79 (86), Cantona 90 (89), Schmeichel 91 (90), Keane 85 (85), Juninho 87 (88).

Biggest remaining disagreements:
- Starters at bottom clubs rated far too low: Shay Given 61 (86), Norwich 2019/20 regulars 55 to 61 (69 to 77), Newcastle 2008/09 defenders 58 to 61 (72 to 73), Ravanelli 71 (86).
- Squad and utility players at title-winning clubs too high: O'Shea 90 (76), Phil Neville 89 (75), Beresford 90 (76), Giggs 2008/09 95 (83).
- Too many 90+ cards (13 to 15 a season) and golds (about 110): tier thresholds or the curve need tightening.

## Fit to the panel (`tools/fit_panel.py`)

Craig preferred the panel's ratings (Van Dijk and Salah above Henderson). So instead of hand-tuning, a ridge regression learns the weights that best reproduce the panel, using only verified-data inputs: each position's stat z-scores, league position points (this season, last, two ago), awards, Champions League minutes, career appearances, share of games started and minutes played. The output is then stretched back to the panel's spread (the fit squeezes ratings toward the middle).

Validation: each season scored by a model trained only on the other two seasons.

| | Agreement (unseen season) | 08/09 | 19/20 | 96/97 | Avg gap |
|---|---|---|---|---|---|
| v5 hand-tuned | 0.842 | 0.825 | 0.896 | 0.814 | 4.9 |
| Learned weights | 0.882 | 0.880 | 0.939 | 0.851 | 2.8 |

Strongest learned signals (rating points per standard deviation): league position last season +1.4, forward goals +1.0, league position this season +0.8, share of starts +0.8, defenders' difference maker +0.8, minutes +0.7, Champions League minutes +0.7, league position two seasons ago +0.7, midfielders' difference maker, goals and assists +0.5 to +0.7, awards +0.4.

Results (panel in brackets): 2019/20 De Bruyne 97 (94), Salah 93 (91), Van Dijk 90 (92), Alexander-Arnold 90, Henderson 89 (89), Wijnaldum 88 (86), Vardy 88 (88), Fabinho 81 (87). 2008/09 Gerrard 95 (92), Ronaldo 94 (94), Lampard 93, Ferdinand 84 (87), Modric 80 (86), Mascherano 79 (85). 1996/97 Shearer 96 (93), Beckham, Cantona and Schmeichel 90 (89 to 90), Keane 81 (85), Juninho 81 (88). 90+ cards per season: 4 to 7.

Still off: holding midfielders (Fabinho, Mascherano) and stars at weak clubs (Given 73 against 86, Modric, Juninho, Ravanelli) a few points low; utility players at strong clubs (O'Shea, Phil Neville) about 8 high. With a 75.7 average, the gold cut-off at 75 makes over half the cards gold, so tier thresholds need moving (for example gold 82+, silver 72 to 81).
Caution: three seasons and 383 panel players is a small training set, and the panel is opinion. More blind-panel seasons would make the weights sturdier.

## Eight seasons (10 October 2026, later still)

Added 1994/95, 2001/02, 2004/05, 2013/14 and 2023/24: feed stats and match line-ups for every player (all 2,282 matches rebuild their final scores), and blind panels for ten clubs per season picked by final position (1st, 2nd, 3rd, 4th, 6th, 8th, 11th, 14th, 17th, bottom). The panel now covers 1,360 player-seasons across 60 club-seasons.

Defenders also get goals conceded while on the pitch as a learning input. The fitted ratings are stretched back to the panel's spread, with a soft ceiling above 90 (each point above 90 counts 0.6), so the top stays scarce.

**Leave-one-season-out** (each season predicted by a model trained on the other seven): agreement 0.867, average gap 2.6 points. By season: 1994/95 0.885, 1996/97 0.871, 2001/02 0.786, 2004/05 0.865, 2008/09 0.885, 2013/14 0.912, 2019/20 0.951, 2023/24 0.895. The weights carry across eras, so they can be trusted on the 26 seasons without a panel.

| On all 1,360 panel players | Agreement | Club order | Avg gap |
|---|---|---|---|
| v5 hand-tuned | 0.821 | 0.641 | 5.1 |
| Learned weights | 0.884 | 0.821 | 2.5 |

**Top of each season:** 1994/95 Shearer 95; 1996/97 Shearer 93, Beckham 90; 2001/02 Henry 93, Pires 91; 2004/05 Henry 97, Lampard 96, Cech 91, Terry 90; 2008/09 Gerrard and Ronaldo 93, Anelka, Lampard, Torres, Rooney 91; 2013/14 Suarez 94, Yaya Toure and Aguero 91; 2019/20 De Bruyne 94, Salah 92, Mane 90; 2023/24 Haaland 95, Foden 93, Saka 91, Rodri 90.

**Spread per season:** 90+ 1 to 6 players, 85+ 14 to 24, 80+ 49 to 69. Card tiers now gold 80+, silver 70 to 79, bronze under 70 (plus the club's best card).

**Biggest remaining misses (8 or 9 points):** quality players with injury-hit seasons rated low (Laporte 77 against 85, Carvalho, Essien, Konate, Lisandro Martinez, Palhinha) and ever-present workhorses rated high (Kuyt 89 against 80, O'Shea 85 against 76, Giroud 89 against 81). Van Dijk 88 sits one point under Henderson 89 in 2019/20 (panel 92 against 89).

## Game scale: about 10 players in the 90s each season

Craig wants roughly 10 players per season in the 90s (the panel was stricter, giving 2 to 5 per half-league). This is a design setting in `tools/fit_panel.py`, applied after the learned ratings and the stretch: in each season the 10 best players sit at 90 to 97, the order is unchanged, players ranked below 60th keep their fitted value, and the band between is stretched to meet 90. The soft ceiling from the previous step is removed. Agreement with the panel is unchanged (0.883); the average gap moves from 2.5 to 2.7 because the top is now higher than the panel's.

The 90+ players per season: 1994/95 Shearer 97, Kanchelskis 91, Fowler, Pallister, Irwin, Ince, Schmeichel, Giggs, Les Ferdinand, Klinsmann 90. 2019/20 De Bruyne 97, Salah 95, Mane 92, Alexander-Arnold, Robertson, Henderson, Mahrez, Sterling, Aguero 91, Van Dijk 90. 2023/24 Haaland 97, Foden 95, Saka 93, Havertz, Salah, Rodri 91, Ben White, Odegaard, Bernardo Silva, Ederson 90.

Names in the top ten that look generous: Riise and Dudek (2001/02, Liverpool finished 2nd), Kuyt (2008/09), Giroud (2013/14), Ben White and Havertz (2023/24). They are ever-present starters at clubs that finished high, the same workhorse pattern noted above.

Update, same day: the top-only stretch above is switched off (Craig: it lifts the top without moving everyone else). Ratings are the learned scale with one even stretch for all players and no ceiling. 2008/09 then has 6 players at 90+, 20 at 85+, 69 at 80+. A uniform shift of +2 for every player would give 10 in the 90s while keeping all gaps the same.
