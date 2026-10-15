# Icons: how purple and legend cards are chosen

Craig, 15 Oct 2026: purple per season should be the top 3 forwards by goals, the top 3 midfielders and top 3
defenders on reputation and the top 2 keepers; popular players need better research so that everyone on his list is a
legend in certain seasons (and purple there, even where that breaks the rule); seasons can carry more purple where the
evidence supports it; a few cards rated in the 80s may be lifted 2 to 5 points where the model under-rates a popular
player; strikers stay roughly where they were, the other positions get more.

Everything below is built by `tools/build_icons.py` (the icons) and `scripts/build-data.py` (`icon_levels`, the
cards). No judgement calls at build time: the inputs are the research lists, the honours and the ratings.

## Inputs

- **Ratings** `data/ratings/rated_fit_*.json`: the card rating per player-season (REP, reputation from verified
  records, is already half of it: league finish, awards, Champions League; `tools/rate_v5.py`).
- **Honours** `data/source/honours.json`: per season the PFA Premier League Team of the Year, the PFA Players' Player
  of the Year, the FWA Footballer of the Year, the Premier League Player of the Season and the Golden Glove, parsed
  from the Wikipedia pages named in the file on 15 Oct 2026. The Golden Boot is the game data's own top scorer(s),
  ties included.
- **Research** `data/source/research/icons_{fwd,mid,def,gk}.json`: all-time Premier League rankings per position
  compiled from published lists (90min, Planet Football, Football365, Squawka, Sports Illustrated, HITC, FourFourTwo,
  Goal, Bleacher Report, theScore, World Soccer Talk, GiveMeSport, Betway and others; every file names its sources
  with URLs). For each player: how many lists name him and his average rank. The peak seasons those files suggest are
  NOT used: the agents compiling them said they were from memory, so peaks come from the honours instead.
- **Craig's list** (`CRAIG` in `tools/build_icons.py`): 25 forwards, 20 midfielders, 20 defenders, 12 keepers. It
  counts as one more list for each of them.

## Icons

An icon is anyone on Craig's list, or anyone named by at least 3 published lists (`MIN_LISTS`). A player named in two
groups' lists (Salah, Ronaldo, Hazard, Bale) has his lists added up and takes the bigger group. 92 icons: 77 on
Craig's list and 15 from the research (Trent Alexander-Arnold, Les Ferdinand, Fernando Torres, Dimitar Berbatov,
Pepe Reina, David James, Mark Schwarzer, Nigel Martyn, Neville Southall, Jussi Jaaskelainen, Tim Howard, Thibaut
Courtois, Rodri, Michael Essien, Fernandinho).

**Consensus** (0 to 100) = 60% how many lists name him (6 or more = full marks) + 40% his average rank (1st = full
marks, 25th = none). Henry 100, Terry 99, Schmeichel 99, Modric and Ozil 30 (Craig's list only).

**Peak seasons**: his seasons with 10+ games and a verified honour that season (an award, Team of the Year, top
scorer, Golden Glove) or a title with at least half the games played. Ranked by rating + 2 x the honour's weight
(award 3, Team of the Year, top scorer or Golden Glove 2, title 1), the best K kept: K = 1 for 1 or 2 lists, 2 for 3
or 4, 3 for 5 or more. An icon with no such season (Fowler, Defoe, Ledley King, Lloris, Ozil, Modric, Schwarzer,
Southall, Jaaskelainen) gets his best-rated season with 20+ games instead, marked `peakSource: "rating"` and said so
in his evidence. Every peak carries its evidence and `honour: true` when that evidence is more than a title.

## Levels per season (`icon_levels` in build-data.py)

Only players with 10+ games count. Standing = rating + a ranking lift for icons of up to 4 points (4 x consensus /
100), used for ordering only.

1. **Baseline purple** (`PURPLE_QUOTA`): the top 3 forwards by goals (then standing), the top 3 midfielders, top 3
   defenders and top 2 keepers by standing. 11 a season.
2. **Craig's own ratings** (`data/source/rating_overrides.json`): a named player's peak-season cards (or listed
   seasons) take the rating he set, before any boost; the card keeps the model's rating in `ovd` and the change in
   `bst`. 15 Oct: Tony Adams 87 (his three Team of the Year peaks, rated 77 to 79 by the model). Add a player as a new
   entry with who decided it and when.
3. **Boost** (`BOOST`, 2 to 5; `BOOST_FLOOR`): an icon's card in a peak season whose evidence is a real honour (not a
   title alone, not the rating fallback), rated 75 to 89 for Craig's list (80 to 89 for the other icons) and below the
   baseline's last purple of his position, is lifted to that cut, at least 2 and at most 5 points. The boost is on the
   card as `bst`, the shown rating is the boosted one. 29 cards (table below), 26 of them Craig's.
4. **More purple where the evidence supports it**: a verified honour that season (Team of the Year, an award, top
   scorer, Golden Glove) rated at least `HONOUR_FLOOR` (80, forwards 90); an icon rated at least `PURPLE_BAND` (90,
   forwards 95); and every icon in a peak season whatever his rating ("even if it breaks our rule"). Forwards are
   tighter (Craig, 15 Oct: towards 125 to 135 purple forwards) because their baseline by goals and their icons' peaks
   already carry them.
5. **Legend** (`lg` on the card): the season's top 3 by rating (Craig's rule of 11 Oct, kept) and every icon's
   primary peak, always; his other peaks only while the season has room under the cap. Every legend is purple in his
   season too. `core/game.js` builds the LEGENDS list from the flag (ids `L:<name>:<season>`; an older save's
   `L:<name>` still resolves to his best legend card).
6. **Pool caps** (Craig, 15 Oct: 10 to 15 purple and 3 to 6 legends a season, a few more for all-time great teams):
   `PURPLE_CAP` 15 and `LEGEND_CAP` 6; in `GREAT_SEASONS` 18 and 8. The baseline, the legends and the primary peaks
   always count (so a crowded season can run over by a card or two); honoured, 90+ icon and other peak cards are added
   by rating while there is room. The great seasons: Arsenal's Invincibles 2003/04; Chelsea under Mourinho 2004/05 and
   2005/06; Man Utd's title sides with 89+ points or a double or treble in the record: 1993/94 (92 points, double),
   1998/99 (treble), 1999/00 (91), 2006/07 (89), 2007/08 (87, Champions League double), 2008/09 (90), 2012/13 (89).
7. **Primary peaks** (`primary` in icons.json): each icon's one peak that is always a legend card. `tools/build_icons.py`
   spreads them: icons with one peak are fixed, the others (most popular first) take the season with the fewest
   primaries so far, his best-rated peak on a tie, so no season is crowded with forced legends.
8. Everyone else: gold 80+, silver 70 to 79, bronze below.

The non-forward positions grow because reputation and honours now count directly; forwards are held near today's
level because their baseline is still goals and their extras need a 95 rating (icons) or a 90 with an honour.

## Counts

Before (purple = top 5 by rating, legend = top 3): purple 170 (FWD 95, MID 59, DEF 3, GK 13); legend 102 (FWD 63,
MID 32, DEF 2, GK 5). Of Craig's 20 defenders only Terry and Robertson were purple or legend anywhere.

After: purple 528 (FWD 134, MID 164, DEF 147, GK 83): 14 to 15 a season, 16 to 18 in the great seasons (min 14,
median 15, max 18); per position FWD 3 to 6 (median 4), MID 3 to 7 (5), DEF 3 to 7 (4), GK 2 to 4 (2). Legend 203
(FWD 82, MID 57, DEF 29, GK 35): 3 to 6 a season, 6 to 8 in the great seasons (min 3, median 6, max 8). All 77 of
Craig's players are a legend in at least one season and purple there. Per-season table below.

## Balance (src/engine.js, retuned 15 Oct)

Craig's rules: a Classic game shows about 66 cards (17 rolls and 5 respins of 3); purple and legend rare and random;
an average player wins the league about 1 in 20 overall, a good player clearly more, no signings about as today;
Derby 2007/08 reported. His pick after the trade-off below: **purple 3% and legend 1%** of draws (a purple about every
half season, a legend about every 1.5 seasons), gold 40%.

- `RULES.levelOdds` = [0.347, 0.213, 0.4, 0.03, 0.01]: bronze 34.7%, silver 21.3%, gold 40%, purple 3%, legend 1%
  (was [0.52, 0.32, 0.13, 0.025, 0.005]; bronze and silver keep their old ratio).
- `RULES.elite` = {from: 2, mid: 90, step: 3}: from gold up a card's chance within its level doubles every 3 rating
  points (a 93 twice a 90, an 87 half, a 99 eight times a 90). Bronze and silver stay uniform. The anti-repeat weights
  multiply in; one draw per pick, so determinism and the memory are untouched.
- `tests/policy.js`: none (pass every roll), average (a typical player: half the time the best card, 3 in 10 any card
  that gains at its best shirt, 2 in 10 a pass, a respin when the roll's best gain is under 0.75, decided by a stream
  of the run's own seed), greedy (the biggest gain, a respin under 1.5). Both calibration scripts take
  `ODDS='[b,s,g,p,l]'`, `ELITE='{"from":2,"mid":90,"step":3}'` and `POLICIES=average,greedy`.

| Policy | Before (13 Oct odds, old purple) | After |
|---|---|---|
| none | title 0.1%, top 4 0.2%, top half 5.7%, stay up 29.0%, 33 pts | the same |
| average | (no such policy) | title 3.3%, top 4 31.5%, top half 83.7%, stay up 98.5%, 59 pts |
| greedy | title 1.1%, top 4 11.9%, top half 63.1%, stay up 93.4%, 53 pts | title 8.2%, top 4 50.7%, top half 94.3%, stay up 99.9%, 64 pts |
| Derby 2007/08 average (400 runs) | | title 0%, top 4 8.5%, top half 71.5%, 53 pts |
| Derby 2007/08 greedy (400 runs) | title 0%, top 4 2.0% (200 runs) | title 1.8%, top 4 33.5%, top half 94.5%, 62 pts |

(`HIST=1 node tests/calibrate-all.js 12`, 1236 runs a policy; Derby `node tests/calibrate.js 2007/08 Derby 400`.)

**The trade-off.** Craig first asked for purple 1.5% and legend 0.6% (a purple a season, a legend every 2.5). With
them at 2.1% of draws the lift has to come from gold, a pool of about 55 cards a season, and every step that lifts the
title rate makes two goes share more of their cards (measured on 4 club-seasons, 8 seeds each, pass policy, different
phones):

| Odds | Average title (618 runs) | Cards two goes share |
|---|---|---|
| 13 Oct odds (purple 2.5%, legend 0.5%, uniform) | greedy 1.1% | 19% |
| purple 1.5%, legend 0.6%, gold 40%, uniform | 1.5% | 28% |
| purple 1.5%, legend 0.6%, gold 45%, step 4 | 1.9% | 34% |
| purple 1.5%, legend 0.6%, gold 50%, step 3 | 2.8% | 40% |
| purple 1.5%, legend 0.6%, gold 55%, step 4 | 2.6% | 44% |
| purple 1.5%, legend 0.6%, gold 60%, step 2 | 3.1% | 51% |
| purple 1.5%, legend 0.6%, gold 60%, step 1 | 4.0% | 54% |
| **purple 3%, legend 1%, gold 40%, step 3 (Craig's pick)** | **3.3% (1236 runs)** | **31%** |

The 5% target needs either purple and legend drawn more often still or a gold pool that repeats itself; Craig chose
the variety. On one phone the anti-repeat memory brings consecutive runs of a club-season from 32% shared to 14%.

## Changing it

- A new honour or a corrected one: edit `data/source/honours.json` (it keeps its sources), rerun
  `python3 tools/build_icons.py` then `python3 scripts/build-data.py`.
- Someone to add to Craig's list: `CRAIG` in `tools/build_icons.py`, then the same two commands.
- More or fewer purple: `PURPLE_QUOTA`, `HONOUR_FLOOR`, `PURPLE_BAND` (per position), the caps `PURPLE_CAP`,
  `LEGEND_CAP`, `GREAT_CAP` and `GREAT_SEASONS` in `scripts/build-data.py`; boosts `BOOST`, `BOOST_FLOOR`.
- A rating Craig wants set: `data/source/rating_overrides.json`.
- Balance: `RULES.levelOdds` and `RULES.elite` in `src/engine.js`, checked with the two calibration scripts above.
- A different name in the data from the one the lists use: `ALIASES` in `tools/build_icons.py` and `ICON_ALIASES`
  in `scripts/build-data.py` (the same map in both).

## Boosted and overridden cards

| Player | Season | Club | Model | Card | Why |
|---|---|---|---|---|---|
| Tony Adams | 1993/94 | Arsenal | 77 | 87 | Craig's call (rating_overrides.json) |
| Tony Adams | 1995/96 | Arsenal | 77 | 87 | Craig's call (rating_overrides.json) |
| David Seaman | 1996/97 | Arsenal | 82 | 85 | PFA Team of the Year |
| Gianfranco Zola | 1996/97 | Chelsea | 81 | 86 | FWA Footballer of the Year |
| Ian Wright | 1996/97 | Arsenal | 88 | 90 | PFA Team of the Year |
| Tony Adams | 1996/97 | Arsenal | 79 | 87 | Craig's call (rating_overrides.json) |
| Nigel Martyn | 1998/99 | Leeds | 84 | 86 | PFA Team of the Year (not on Craig's list, floor 80) |
| Patrick Vieira | 1998/99 | Arsenal | 85 | 87 | PFA Team of the Year |
| Sami Hyypia | 1999/00 | Liverpool | 83 | 85 | PFA Team of the Year |
| Jaap Stam | 2000/01 | Man Utd | 80 | 84 | PFA Team of the Year |
| Roy Keane | 2000/01 | Man Utd | 89 | 91 | PFA Team of the Year, title with Man Utd, 28 games |
| Roy Keane | 2001/02 | Man Utd | 86 | 91 | PFA Team of the Year |
| Shay Given | 2001/02 | Newcastle | 81 | 83 | PFA Team of the Year |
| Ashley Cole | 2002/03 | Arsenal | 86 | 88 | PFA Team of the Year |
| Brad Friedel | 2002/03 | Blackburn | 79 | 84 | PFA Team of the Year |
| Sol Campbell | 2002/03 | Arsenal | 87 | 89 | PFA Team of the Year |
| Patrick Vieira | 2003/04 | Arsenal | 86 | 91 | PFA Team of the Year, title with Arsenal, 29 games |
| Shay Given | 2005/06 | Newcastle | 79 | 84 | PFA Team of the Year |
| David James | 2007/08 | Portsmouth | 80 | 85 | PFA Team of the Year (not on Craig's list, floor 80) |
| Edwin van der Sar | 2010/11 | Man Utd | 87 | 89 | PFA Team of the Year, title with Man Utd, 33 games |
| Gareth Bale | 2010/11 | Spurs | 85 | 87 | PFA Team of the Year, PFA Players' Player of the Year |
| Vincent Kompany | 2010/11 | Man City | 83 | 86 | PFA Team of the Year |
| Gareth Bale | 2011/12 | Spurs | 85 | 89 | PFA Team of the Year |
| David de Gea | 2012/13 | Man Utd | 85 | 88 | PFA Team of the Year, title with Man Utd, 28 games |
| David de Gea | 2015/16 | Man Utd | 86 | 88 | PFA Team of the Year |
| N'Golo Kante | 2015/16 | Leicester | 84 | 89 | PFA Team of the Year, title with Leicester, 37 games |
| N'Golo Kante | 2016/17 | Chelsea | 88 | 92 | PFA Team of the Year, PFA Players' Player of the Year, FWA Footballer of the Year, Premier League Player of the Season, title with Chelsea, 35 games |
| David de Gea | 2017/18 | Man Utd | 88 | 90 | PFA Team of the Year, Golden Glove |
| Fernandinho | 2018/19 | Man City | 84 | 88 | PFA Team of the Year, title with Man City, 29 games (not on Craig's list, floor 80) |

## Per season

Great seasons (caps 18 and 8) are marked.

| Season | Purple | FWD | MID | DEF | GK | Legend | Boosted |
|---|---|---|---|---|---|---|---|
| 1992/93 | 15 | 6 | 4 | 3 | 2 | 6 | 0 |
| 1993/94 (great) | 17 | 4 | 4 | 5 | 4 | 8 | 1 |
| 1994/95 | 15 | 3 | 4 | 5 | 3 | 4 | 0 |
| 1995/96 | 15 | 4 | 5 | 4 | 2 | 6 | 1 |
| 1996/97 | 15 | 5 | 4 | 4 | 2 | 6 | 4 |
| 1997/98 | 15 | 6 | 3 | 4 | 2 | 6 | 0 |
| 1998/99 (great) | 16 | 4 | 5 | 4 | 3 | 8 | 2 |
| 1999/00 (great) | 18 | 5 | 7 | 4 | 2 | 8 | 1 |
| 2000/01 | 15 | 4 | 5 | 3 | 3 | 6 | 2 |
| 2001/02 | 15 | 4 | 6 | 3 | 2 | 6 | 2 |
| 2002/03 | 15 | 4 | 5 | 4 | 2 | 6 | 3 |
| 2003/04 (great) | 16 | 4 | 6 | 3 | 3 | 8 | 1 |
| 2004/05 (great) | 17 | 3 | 6 | 6 | 2 | 7 | 0 |
| 2005/06 (great) | 18 | 5 | 5 | 5 | 3 | 8 | 1 |
| 2006/07 (great) | 16 | 4 | 4 | 6 | 2 | 7 | 0 |
| 2007/08 (great) | 17 | 4 | 5 | 5 | 3 | 8 | 1 |
| 2008/09 (great) | 16 | 4 | 5 | 5 | 2 | 8 | 0 |
| 2009/10 | 15 | 4 | 5 | 4 | 2 | 6 | 0 |
| 2010/11 | 15 | 5 | 4 | 4 | 2 | 6 | 3 |
| 2011/12 | 15 | 3 | 6 | 4 | 2 | 6 | 1 |
| 2012/13 (great) | 18 | 3 | 4 | 7 | 4 | 6 | 1 |
| 2013/14 | 15 | 3 | 5 | 5 | 2 | 5 | 0 |
| 2014/15 | 15 | 4 | 5 | 3 | 3 | 6 | 0 |
| 2015/16 | 15 | 3 | 6 | 3 | 3 | 6 | 2 |
| 2016/17 | 15 | 3 | 5 | 4 | 3 | 5 | 1 |
| 2017/18 | 15 | 3 | 5 | 4 | 3 | 6 | 1 |
| 2018/19 | 15 | 4 | 6 | 3 | 2 | 6 | 1 |
| 2019/20 | 15 | 5 | 4 | 3 | 3 | 6 | 0 |
| 2020/21 | 15 | 3 | 4 | 6 | 2 | 4 | 0 |
| 2021/22 | 15 | 4 | 4 | 5 | 2 | 4 | 0 |
| 2022/23 | 15 | 4 | 4 | 5 | 2 | 4 | 0 |
| 2023/24 | 15 | 3 | 5 | 5 | 2 | 4 | 0 |
| 2024/25 | 14 | 3 | 5 | 4 | 2 | 4 | 0 |
| 2025/26 | 15 | 4 | 4 | 5 | 2 | 3 | 0 |

## The icons

An asterisk marks an icon from the published lists who is not on Craig's list. Ratings are the model's before any boost or override; the primary peak (always a legend card) is in bold.

| Icon | Group | Lists | Consensus | Peak seasons (rating, first evidence) |
|---|---|---|---|---|
| John Terry | DEF | 6 | 99 | 2003/04 (90, PFA Team of the Year); **2004/05** (92, PFA Team of the Year); 2005/06 (90, PFA Team of the Year) |
| Rio Ferdinand | DEF | 6 | 97 | 2004/05 (86, PFA Team of the Year); **2006/07** (89, PFA Team of the Year); 2007/08 (88, PFA Team of the Year) |
| Tony Adams | DEF | 6 | 94 | **1993/94** (77, PFA Team of the Year); 1995/96 (77, PFA Team of the Year); 1996/97 (79, PFA Team of the Year) |
| Nemanja Vidic | DEF | 6 | 92 | **2007/08** (87, PFA Team of the Year); 2008/09 (90, PFA Team of the Year); 2010/11 (90, PFA Team of the Year) |
| Virgil van Dijk | DEF | 5 | 87 | **2018/19** (91, PFA Team of the Year); 2019/20 (89, PFA Team of the Year); 2024/25 (88, PFA Team of the Year) |
| Gary Neville | DEF | 5 | 86 | 1996/97 (85, PFA Team of the Year); 1998/99 (88, PFA Team of the Year); **2000/01** (87, title with Man Utd, 32 games) |
| Sol Campbell | DEF | 5 | 81 | 2001/02 (80, title with Arsenal, 31 games); 2002/03 (87, PFA Team of the Year); **2003/04** (88, PFA Team of the Year) |
| Vincent Kompany | DEF | 5 | 81 | **2010/11** (83, PFA Team of the Year); 2011/12 (88, PFA Team of the Year); 2013/14 (84, PFA Team of the Year) |
| Jaap Stam | DEF | 5 | 74 | **1998/99** (86, PFA Team of the Year); 1999/00 (85, PFA Team of the Year); 2000/01 (80, PFA Team of the Year) |
| Ashley Cole | DEF | 4 | 78 | 2002/03 (86, PFA Team of the Year); **2003/04** (89, PFA Team of the Year) |
| Kyle Walker | DEF | 4 | 73 | **2016/17** (84, PFA Team of the Year); 2017/18 (88, PFA Team of the Year) |
| Lee Dixon | DEF | 4 | 67 | **1997/98** (78, title with Arsenal, 28 games) |
| Steve Bruce | DEF | 4 | 65 | **1993/94** (85, title with Man Utd, 41 games); 1995/96 (84, title with Man Utd, 30 games) |
| Ricardo Carvalho | DEF | 4 | 64 | **2004/05** (82, title with Chelsea, 25 games); 2005/06 (82, title with Chelsea, 24 games) |
| Jamie Carragher | DEF | 4 | 63 | **2005/06** (86, PFA Team of the Year) |
| Trent Alexander-Arnold * | DEF | 3 | 66 | 2018/19 (88, PFA Team of the Year); **2019/20** (90, PFA Team of the Year) |
| Andy Robertson | DEF | 3 | 59 | 2018/19 (88, PFA Team of the Year); **2019/20** (91, PFA Team of the Year) |
| Denis Irwin | DEF | 3 | 58 | **1993/94** (90, PFA Team of the Year); 1995/96 (88, title with Man Utd, 31 games) |
| Gary Pallister | DEF | 3 | 55 | 1993/94 (88, PFA Team of the Year); **1994/95** (88, PFA Team of the Year) |
| Ledley King | DEF | 3 | 47 | **2005/06** (78, his best-rated season (78), no honour in the data) |
| Sami Hyypia | DEF | 3 | 46 | 1999/00 (83, PFA Team of the Year); **2001/02** (89, PFA Team of the Year) |
| Thierry Henry | FWD | 9 | 100 | **2002/03** (98, PFA Team of the Year); 2003/04 (99, PFA Team of the Year); 2005/06 (97, PFA Team of the Year) |
| Alan Shearer | FWD | 9 | 97 | 1993/94 (94, PFA Team of the Year); **1994/95** (97, PFA Team of the Year); 1996/97 (95, PFA Team of the Year) |
| Wayne Rooney | FWD | 9 | 95 | 2006/07 (94, title with Man Utd, 35 games); **2009/10** (96, PFA Team of the Year); 2011/12 (93, PFA Team of the Year) |
| Eric Cantona | FWD | 9 | 90 | 1993/94 (91, PFA Team of the Year); **1995/96** (92, FWA Footballer of the Year); 1996/97 (91, title with Man Utd, 36 games) |
| Andy Cole | FWD | 9 | 84 | 1993/94 (93, top scorer (34 goals)); 1998/99 (91, title with Man Utd, 32 games); **1999/00** (91, PFA Team of the Year) |
| Sergio Aguero | FWD | 8 | 93 | **2014/15** (95, top scorer (26 goals)); 2017/18 (94, PFA Team of the Year); 2018/19 (93, PFA Team of the Year) |
| Dennis Bergkamp | FWD | 8 | 88 | 1997/98 (93, PFA Team of the Year); **2001/02** (82, title with Arsenal, 33 games); 2003/04 (83, title with Arsenal, 28 games) |
| Harry Kane | FWD | 7 | 90 | **2016/17** (96, PFA Team of the Year); 2017/18 (95, PFA Team of the Year); 2022/23 (94, PFA Team of the Year) |
| Didier Drogba | FWD | 7 | 84 | 2005/06 (91, title with Chelsea, 29 games); **2006/07** (94, PFA Team of the Year); 2009/10 (94, PFA Team of the Year) |
| Michael Owen | FWD | 7 | 84 | 1997/98 (90, PFA Team of the Year); **1998/99** (88, top scorer (18 goals)) |
| Ruud van Nistelrooy | FWD | 7 | 79 | 2001/02 (93, PFA Team of the Year); **2002/03** (96, Premier League Player of the Season); 2003/04 (93, PFA Team of the Year) |
| Robbie Fowler | FWD | 7 | 79 | **1995/96** (92, his best-rated season (92), no honour in the data) |
| Robin van Persie | FWD | 7 | 78 | **2011/12** (96, PFA Team of the Year); 2012/13 (95, PFA Team of the Year) |
| Ian Wright | FWD | 7 | 77 | 1992/93 (80, PFA Team of the Year); **1996/97** (88, PFA Team of the Year); 1997/98 (87, title with Arsenal, 24 games) |
| Mohamed Salah | FWD | 6 | 96 | 2017/18 (97, PFA Team of the Year); **2021/22** (97, PFA Team of the Year); 2024/25 (97, PFA Team of the Year) |
| Luis Suarez | FWD | 6 | 80 | 2012/13 (88, PFA Team of the Year); **2013/14** (95, PFA Team of the Year) |
| Teddy Sheringham | FWD | 6 | 77 | 1992/93 (87, top scorer (22 goals)); 1999/00 (81, title with Man Utd, 27 games); **2000/01** (90, PFA Team of the Year) |
| Gianfranco Zola | FWD | 6 | 73 | **1996/97** (81, FWA Footballer of the Year) |
| Cristiano Ronaldo | FWD | 5 | 86 | **2006/07** (96, PFA Team of the Year); 2007/08 (97, PFA Team of the Year); 2008/09 (96, PFA Team of the Year) |
| Erling Haaland | FWD | 5 | 69 | **2022/23** (98, PFA Team of the Year); 2023/24 (96, PFA Team of the Year); 2025/26 (97, PFA Team of the Year) |
| Les Ferdinand * | FWD | 5 | 56 | **1995/96** (92, PFA Team of the Year) |
| Eden Hazard | FWD | 4 | 69 | 2013/14 (93, PFA Team of the Year); **2014/15** (95, PFA Team of the Year) |
| Sadio Mane | FWD | 4 | 55 | **2018/19** (94, PFA Team of the Year); 2019/20 (91, PFA Team of the Year) |
| Jimmy Floyd Hasselbaink | FWD | 4 | 45 | **1998/99** (90, top scorer (18 goals)); 2000/01 (90, top scorer (23 goals)) |
| Jermain Defoe | FWD | 4 | 43 | **2009/10** (82, his best-rated season (82), no honour in the data) |
| Fernando Torres * | FWD | 3 | 42 | 2007/08 (91, PFA Team of the Year); **2008/09** (91, PFA Team of the Year) |
| Dwight Yorke | FWD | 3 | 40 | 1998/99 (95, PFA Team of the Year); **1999/00** (91, title with Man Utd, 32 games) |
| Jamie Vardy | FWD | 3 | 39 | **2015/16** (91, PFA Team of the Year); 2019/20 (87, PFA Team of the Year) |
| Dimitar Berbatov * | FWD | 3 | 35 | 2008/09 (89, title with Man Utd, 32 games); **2010/11** (91, PFA Team of the Year) |
| Peter Schmeichel | GK | 8 | 99 | **1992/93** (88, PFA Team of the Year); 1993/94 (90, title with Man Utd, 40 games); 1995/96 (91, Premier League Player of the Season) |
| Petr Cech | GK | 8 | 99 | 2004/05 (92, PFA Team of the Year); 2009/10 (90, Golden Glove); **2013/14** (90, PFA Team of the Year) |
| David Seaman | GK | 7 | 95 | **1996/97** (82, PFA Team of the Year); 1997/98 (81, title with Arsenal, 31 games) |
| Edwin van der Sar | GK | 7 | 94 | 2006/07 (87, PFA Team of the Year); 2008/09 (89, PFA Team of the Year); **2010/11** (87, PFA Team of the Year) |
| David de Gea | GK | 7 | 93 | 2012/13 (85, PFA Team of the Year); 2015/16 (86, PFA Team of the Year); **2017/18** (88, PFA Team of the Year) |
| Shay Given | GK | 7 | 87 | **2001/02** (81, PFA Team of the Year); 2005/06 (79, PFA Team of the Year) |
| Joe Hart | GK | 6 | 87 | 2011/12 (91, PFA Team of the Year); **2012/13** (91, Golden Glove); 2014/15 (90, Golden Glove) |
| Brad Friedel | GK | 6 | 85 | **2002/03** (79, PFA Team of the Year) |
| Alisson | GK | 5 | 85 | **2018/19** (89, Golden Glove); 2019/20 (86, title with Liverpool, 29 games); 2021/22 (87, PFA Team of the Year) |
| Ederson | GK | 5 | 82 | 2018/19 (89, PFA Team of the Year); 2019/20 (90, Golden Glove); **2020/21** (92, PFA Team of the Year) |
| Pepe Reina * | GK | 4 | 67 | 2006/07 (91, Golden Glove); **2007/08** (91, Golden Glove) |
| David James * | GK | 4 | 65 | **1995/96** (86, PFA Team of the Year); 2007/08 (80, PFA Team of the Year) |
| Jens Lehmann | GK | 4 | 63 | **2003/04** (89, title with Arsenal, 38 games) |
| Mark Schwarzer * | GK | 4 | 57 | **2012/13** (81, his best-rated season (81), no honour in the data) |
| Nigel Martyn * | GK | 4 | 57 | 1998/99 (84, PFA Team of the Year); **1999/00** (85, PFA Team of the Year) |
| Neville Southall * | GK | 4 | 55 | **1993/94** (80, his best-rated season (80), no honour in the data) |
| Hugo Lloris | GK | 3 | 48 | **2017/18** (88, his best-rated season (88), no honour in the data) |
| Jussi Jaaskelainen * | GK | 3 | 43 | **2005/06** (82, his best-rated season (82), no honour in the data) |
| Tim Howard * | GK | 3 | 42 | **2003/04** (77, PFA Team of the Year) |
| Thibaut Courtois * | GK | 3 | 42 | 2014/15 (82, title with Chelsea, 32 games); **2016/17** (85, Golden Glove) |
| Steven Gerrard | MID | 6 | 97 | 2005/06 (91, PFA Team of the Year); 2007/08 (92, PFA Team of the Year); **2008/09** (94, PFA Team of the Year) |
| Frank Lampard | MID | 6 | 97 | 2003/04 (93, PFA Team of the Year); **2004/05** (97, PFA Team of the Year); 2005/06 (96, PFA Team of the Year) |
| Paul Scholes | MID | 6 | 96 | **1998/99** (90, title with Man Utd, 31 games); 1999/00 (90, title with Man Utd, 31 games); 2002/03 (90, PFA Team of the Year) |
| David Silva | MID | 6 | 91 | 2011/12 (90, PFA Team of the Year); 2017/18 (89, PFA Team of the Year); **2019/20** (88, PFA Team of the Year) |
| David Beckham | MID | 6 | 89 | 1996/97 (92, PFA Team of the Year); **1997/98** (95, PFA Team of the Year); 1998/99 (93, PFA Team of the Year) |
| Yaya Toure | MID | 6 | 88 | 2011/12 (89, PFA Team of the Year); **2013/14** (93, PFA Team of the Year) |
| Cesc Fabregas | MID | 6 | 87 | **2007/08** (91, PFA Team of the Year); 2009/10 (91, PFA Team of the Year); 2014/15 (86, title with Chelsea, 34 games) |
| Kevin De Bruyne | MID | 5 | 89 | 2019/20 (96, PFA Team of the Year); **2020/21** (93, PFA Team of the Year); 2021/22 (94, PFA Team of the Year) |
| Ryan Giggs | MID | 5 | 85 | **1992/93** (92, PFA Team of the Year); 1997/98 (92, PFA Team of the Year); 2001/02 (90, PFA Team of the Year) |
| Roy Keane | MID | 5 | 84 | **1999/00** (91, PFA Team of the Year); 2000/01 (89, PFA Team of the Year); 2001/02 (86, PFA Team of the Year) |
| Patrick Vieira | MID | 5 | 84 | 1998/99 (85, PFA Team of the Year); **2000/01** (90, PFA Team of the Year); 2003/04 (86, PFA Team of the Year) |
| Gareth Bale | MID | 5 | 76 | 2010/11 (85, PFA Team of the Year); 2011/12 (85, PFA Team of the Year); **2012/13** (92, PFA Team of the Year) |
| Claude Makelele | MID | 5 | 73 | **2004/05** (89, title with Chelsea, 36 games); 2005/06 (86, title with Chelsea, 31 games) |
| N'Golo Kante | MID | 4 | 68 | **2015/16** (84, PFA Team of the Year); 2016/17 (88, PFA Team of the Year) |
| Michael Carrick | MID | 4 | 60 | 2007/08 (86, title with Man Utd, 31 games); **2008/09** (86, title with Man Utd, 28 games) |
| Rodri * | MID | 3 | 60 | 2022/23 (90, PFA Team of the Year); **2023/24** (91, PFA Team of the Year) |
| Robert Pires | MID | 3 | 53 | **2001/02** (92, PFA Team of the Year); 2003/04 (93, PFA Team of the Year) |
| Michael Essien * | MID | 3 | 48 | **2005/06** (85, title with Chelsea, 31 games) |
| Fernandinho * | MID | 3 | 47 | **2017/18** (86, title with Man City, 34 games); 2018/19 (84, PFA Team of the Year) |
| Gareth Barry | MID | 3 | 41 | **2011/12** (84, title with Man City, 34 games) |
| Mesut Ozil | MID | 1 | 30 | **2015/16** (90, his best-rated season (90), no honour in the data) |
| Luka Modric | MID | 1 | 30 | **2011/12** (81, his best-rated season (81), no honour in the data) |
