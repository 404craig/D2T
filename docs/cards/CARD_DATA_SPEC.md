# Player card data spec (draft for Craig)

Written 10 October 2026. Purpose: agree what goes on a D2T player card (simple view and advanced view), what Tenaball already gives us, and what still has to be gathered, before any research agents are sent. Nothing here is decided until Craig signs off the questions in section 6.

## 1. Summary

- Tenaball gives us a verified row for every Premier League player, club and season from 1992/93 to 2025/26: position, nationality, appearances and goals. Plus every result, so every club's table. That is all the cards could use so far.
- The Premier League's own stats feed (the data behind premierleague.com) can be read from here. A probe on 10 October 2026 found two eras:
  - **1992/93 to 2005/06 (basic era):** appearances, goals, assists, clean sheets, yellow and red cards, and the player's own wins, draws and losses. No minutes, saves, tackles or passing.
  - **2006/07 onwards (Opta era):** about 170 stats per player and season, including minutes, starts, shots, chances created, passes, tackles, interceptions, clearances, aerial duels, saves and goals conceded.
- The feed also has a profile per player with date of birth, height and a detailed position.
- Recommendation: the front of the card and the overall rating use only stats that exist in all 34 seasons, so a 1994/95 card and a 2024/25 card mean the same thing. The Opta-era detail lives in the advanced view, shown as "not recorded before 2006/07" for older seasons.

## 2. What Tenaball already has

### For every player-season (usable on every card)

| Field | File | Notes |
|---|---|---|
| season, club, player, full name, player_id | `pl_players/pl_players.csv` | 18,652 rows; player_id splits same-name people |
| position (GK/DEF/MID/FWD) | same | As squad lists gave it; wingers move between MID and FWD; Gareth Barry is DEF |
| nationality | same | Country he played for |
| apps, goals | same | Two sources per row; goals reconciled for all 686 club-seasons |
| club table: points, finish, goals for and against, clean sheets | derived from `pl_results/pl_results.csv` | Every season's table reproduces the official points |
| career to date: PL apps, goals, seasons, clubs, last season | derived from `pl_players.csv` | |
| hat-tricks (every one, with date and opponent) | `pl_hattricks.csv` | 405 rows |

### Partial (only famous players, or only some seasons)

| What | File | Use on cards |
|---|---|---|
| Assists | `PL_ASSISTS_2026-10-03.md` | Top-10 boards only. Not per player-season |
| Clean sheets, cards, own goals, penalty saves | `PL_KEEPERS_DISCIPLINE_2026-10-03.md` | All-time top 10s only |
| PFA, FWA, Player of the Season, Player of the Month, Golden Glove | `PL_AWARDS_CUPS_2026-10-03.md` | Complete winner lists by season. Good for badges |
| FA Cup and League Cup finals | same | Club winners only, not who played |
| Title medals, two-club champions, title captains | `PL_MANAGERS_2026-10-03.md` | Badges |
| Minutes, penalties, headers, free kicks, streaks | `PL_SCORING_2026-10-03.md` | Top 10s only |
| Real transfer fees | `PL_SIGNINGS`, `PL_SALES`, `PL_TRANSFERS_GROUNDS` | Big moves only, mostly recent |
| Champions League apps, goals, assists, minutes by season | `cups/ucl/cl_player_seasons_uefa.csv` | Every UCL player-season. Needs name matching to PL players |
| International caps, some dates of birth | `intl/intl/N1_*`, `N3_*`, `N4_*` | Selected nations only |
| World Cup and Euro winners who played in the PL | `PL_SQUADS_DERBIES_2026-10-03.md` | Badges |
| La Liga, Serie A, Bundesliga, Ligue 1, SPFL apps, goals, assists (2000/01 on) | `europe/*/players.csv`, `spfl/spfl_players.csv` | Careers before or after the PL (for example Torres at Atletico) |

### Missing for every player-season

Assists, clean sheets, minutes, starts and sub appearances, yellow and red cards, the player's own wins, draws and losses, goals conceded (keepers), date of birth, height, detailed position, and all Opta detail.

## 3. What the Premier League feed offers (probed 10 October 2026)

Players with a value, by season (a sample):

| Stat | 1992/93 | 1999/00 | 2005/06 | 2006/07 | 2007/08 | 2015/16 |
|---|---|---|---|---|---|---|
| appearances | 544 | 543 | 536 | 534 | 532 | 550 |
| assists | 295 | 264 | 245 | 242 | 258 | 256 |
| clean sheets | 544 | 542 | 536 | 385 | 365 | 351 |
| red cards | 31 | 63 | 72 | 48 | 56 | 52 |
| minutes | 48 | 0 | 0 | 534 | 532 | 550 |
| tackles | 0 | 0 | 0 | 485 | 474 | 478 |
| saves | 0 | 0 | 0 | 50 | 47 | 45 |
| big chances created | 0 | 0 | 0 | 0 | 0 | 289 |

What the probe showed:
- Clean sheets are credited to every player who played, not just keepers: Ferdinand 17, Ronaldo 16, van der Sar 14 in 2007/08. That gives defenders a real personal number in place of the club's goals conceded. The rule seems to change in 2006/07 (fewer players credited), so the definition needs checking.
- Assists for 2007/08 put Fabregas top with 17, which fixes the draft's biggest blind spot.
- Some Opta stats start later than 2006/07 (big chances created is missing in 2007/08 but present in 2015/16). Each stat's first season needs listing.
- The feed counts a player once per season. A player who moved mid-season needs a per-club split (the feed takes a team filter).
- Profiles: Sheringham "2 April 1966, 183 cm, Centre Second Striker"; Ronaldo "5 February 1985, 187 cm, Forward". The detailed position is his latest, not per season.

## 4. The card

### Simple view (the front)

Everything here exists for all 34 seasons once the gathering is done.

| Element | Content | Source |
|---|---|---|
| Overall | One number, 40 to 95 | Formula over the six face stats |
| Position | GK, DEF, MID or FWD | Have |
| Name, club, season | | Have |
| Age that season | Age on 1 September | Gather: date of birth |
| Nationality | Text, not an emoji flag (Tenaball lesson 4) | Have |
| Fee | Game money from the rating | Formula |
| Tier | Bronze, silver, gold, hero | Formula |
| Headline line | The real season: "31 goals, 6 assists, 34 apps" or "14 clean sheets, 29 apps" | Have goals and apps; gather assists and clean sheets |
| One badge | The best story: Golden Boot, PFA Player of the Year, Champion, Ever-present, Debut season and so on | Mostly have |
| Six face stats | Below | |

Face stats, outfield:

| Stat | Built from | Replaces in the draft |
|---|---|---|
| GOL Goals | goals per appearance | same |
| AST Creating | assists per appearance | new (was IMP, share of club goals, which moves to advanced) |
| DEF Defending | his own clean sheets per appearance | club goals conceded scaled by games |
| WIN Winning | his own win rate (wins, draws, losses in games he played) | club points per game scaled by games |
| FIT Fitness | appearances, or minutes if gathered for every season | same |
| EXP Experience | PL appearances to date | same |

Face stats, keepers: CLN (clean sheets per appearance), CON (goals conceded per game while playing), WIN, FIT, EXP. Saves are Opta era only, so they go in the advanced view.

### Advanced view (tap the card)

1. **The season, every era:** apps (starts and sub apps if gathered), minutes (if gathered), goals, assists, goals plus assists, penalties, clean sheets, wins-draws-losses, yellow and red cards, own goals, hat-tricks, share of club goals, club finish and points.
2. **Opta detail, 2006/07 onwards,** grouped by what matters for the position:
   - Attack: shots, on target, conversion, chances created, big chances created (later seasons), headed goals, goals from outside the box.
   - Midfield: passes and accuracy, through balls, crosses, chances created, tackles, interceptions, recoveries.
   - Defence: tackles won, interceptions, clearances, blocks, aerial duels won, errors leading to a goal.
   - Keeper: saves, save percentage, goals conceded, high claims, punches, penalties faced and saved, errors.
   - Older seasons show "Not recorded before 2006/07" rather than blanks.
3. **Honours that season:** league title (10 or more apps, the real medal rule), PFA, FWA, Player of the Season, Golden Boot, Golden Glove, Player of the Month count, club cup wins.
4. **Career to date:** PL apps, goals, assists, clean sheets, seasons, clubs; last season's line; Champions League and other-league careers where matched; caps where known.
5. **How this card was made:** each face stat with the real numbers behind it (as the lab does now).

## 5. What to gather

One row per player, club and season, 1992/93 to 2025/26, keyed to Tenaball's player_id:

- **Every era (required for the front):** assists, clean sheets, wins, draws, losses, yellow cards, red cards, own goals, penalties scored and missed. Keepers: goals conceded.
- **Every era (wanted):** starts, sub appearances, minutes. The feed has these from 2006/07 only; Transfermarkt or 11v11 would be needed for earlier seasons.
- **Opta era:** keep the whole raw stat list per player-season (about 170 values). It costs nothing extra to store, and the display can be chosen later.
- **Once per person:** date of birth, height, detailed position, Premier League feed id.

Checks, following the Tenaball rules:
- Apps and goals must match `pl_players.csv`, which is already verified from two sources. Any difference is a flag, not an overwrite.
- Assists, clean sheets and cards: the feed is the official figure; a second source (Transfermarkt or StatMuse) for cross-checks, with differences listed in a flags file as Tenaball did.
- Club totals must add up: player assists no more than club goals, keeper goals conceded equal to the club's goals against, and so on.
- Opta detail has only one source. It is the league's official data, so mark it "official, single source" rather than leaving it out.

## 6. Decisions for Craig

1. **Rating built only from stats in all 34 seasons?** Recommended. The alternative (use Opta detail to sharpen 2006/07 onwards) makes old and new cards hard to compare.
2. **Face stats:** GOL, AST, DEF, WIN, FIT, EXP for outfield, and CLN, CON, WIN, FIT, EXP for keepers. Agree, or swap any?
3. **Assists source:** the Premier League's official (Opta) figure, with Transfermarkt as the cross-check. Recommended, matching the Tenaball assists boards.
4. **Minutes before 2006/07:** worth a second gathering job (Transfermarkt or 11v11), or accept appearances only for the early era?
5. **Opta detail as a single source:** acceptable since it is the league's own data?
6. **Scope:** a pilot on 2007/08 (the lab season), checked end to end and shown in the lab, then the other 33 seasons. Recommended.
7. **Fees:** keep game money from the rating, or show real fees where Tenaball has them?

## 7. Open questions for the research itself

- The clean sheet rule in each era (whole match, or 60 minutes or more) and why fewer players are credited from 2006/07.
- The first season of each Opta stat (big chances created is missing in 2007/08 but present by 2015/16).
- How to split a mid-season mover per club (feed team filter) and match feed names to player_id.
- Whether basic-era assists in the feed were added later and differ from what was reported at the time.
