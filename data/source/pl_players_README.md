# pl_players: every Premier League player, 1992/93 to 2025/26

Built from docs/PLAYER_DATABASE_BRIEF.md. The brief asked for 2000/01 onwards; Craig then asked for every season back to the start of the Premier League, so this covers all 34 completed seasons. 2026/27 (in progress) is not included.

## Coverage and totals
- Seasons: 1992/93 to 2025/26, all complete (20 clubs per season, 22 in 1992/93 to 1994/95).
- Rows (player, club, season): 18,652.
- Different people: 5,113 (5,082 distinct display names; see "Same name, different people").
- Every club-season reconciles: player goals + own goals scored by opponents = club league goals (686 of 686 club-seasons, difference 0). See club_season_checks.csv.
- Rows where two sources did not fully agree: 42 (flags.csv). Every other row is confirmed by at least two independent sources.

Career totals reproduce the official records, for example Shearer 260 goals in 441 apps, Kane 213/320, Rooney 208/491, Milner 658 apps over 24 seasons, Barry 653, Giggs 632.

## Files
- pl_players.csv: every row, sorted by season, club, player. Columns: season, club, player, full_name, surname, position, nationality, apps, goals, source, player_id.
- players.csv: one row per person: player_id, player, full_name, surname, position (most common), nationality, first_season, last_season, seasons, clubs, total_apps, total_goals.
- by_club/: one CSV per club (all its seasons).
- club_season_checks.csv: club goals, own goals for, player goals and difference for every club-season.
- flags.csv: the 42 rows where sources still disagree, with the note explaining which figure was used.
- checks/<season>/: the per-club check notes written while gathering (sources read, disagreements, resolutions).

## Columns
- apps = Premier League starts plus substitute appearances for that club that season. goals = Premier League goals (own goals excluded).
- player: the name fans use, without accents. full_name: with accents.
- player_id: equals player, except where two different people share a name (see below). Use player_id, not player, to group a person's career.
- position: GK, DEF, MID or FWD as footballsquads.co.uk listed him that season (its "M" includes wingers, so a winger can be MID one season and FWD another). players.csv gives the most common.
- nationality: the country he played for (birth country if never capped), made consistent across seasons using the most recent season's value.
- A player who moved during a season has one row per club.

## Sources
1. StatMuse FC (statmuse.com/fc): club squad apps and goals. Its answers stop at 25 rows, so three queries per club were merged (player stats, most appearances, fewest appearances). Also used for own goals for each club.
2. 11v11.com club pages filtered to the Premier League (/teams/<club>/tab/players/season/<end-year>/comp/1/): the second, independent source for every player's apps and goals. 11v11 player and match pages were the tie-breaker.
3. Wikipedia "<season> <club> season" pages: third source and own-goal confirmation. Read through a summariser, so used only as a tie-breaker.
4. footballsquads.co.uk: position, nationality (from 2008/09; earlier pages have no nationality column, so 11v11 was used) and roster checks. footballsquads has no 1992/93 season, so 1992/93 positions come from the same player's later seasons or 11v11.
5. Club goal totals: Wikipedia Premier League tables, or 11v11 final tables when Wikipedia would not load.
FBref, worldfootball.net, Transfermarkt and ESPN could not be read from the build environment.

## How disagreements were settled
- Typical StatMuse errors found and corrected: counting an unused substitute who was booked as an appearance; crediting a goal that the Premier League's goal accreditation panel (Dubious Goals Committee) later ruled an own goal, or the reverse. 11v11 records the official decisions, and these were checked on match pages.
- When StatMuse and 11v11 disagreed, a third source (Wikipedia, 11v11 player or match page) decided it, and the club goals total had to reconcile.
- The 42 flagged rows are cases with no decisive third source, mostly one-appearance differences in the 1990s. 1996/97 has the most (11).

## Same name, different people
These share a display name with someone else; player_id separates them: Aaron Ramsey (b.2003), Alan Smith (b.1962), Andy Gray (b.1964), Andy Johnson (Wales), Ashley Westwood (b.1976), Chris Armstrong (b.1982), Danilo (Forest), Danny Ward (striker), Danny Wilson (b.1960), Darren Ward (defender), David Hughes (Aston Villa), David Lee (Chelsea), Emerson (Middlesbrough), Josh King (b.2007), Julio Cesar (defender), Lee Martin (b.1968), Mark Hudson (b.1980), Mark Hughes (defender), Martin Taylor (goalkeeper), Michael Johnson (defender), Paul Robinson (defender), Paul Robinson (striker), Paul Williams (Northern Ireland), Paul Williams (striker), Rodrigo (Everton), Scott Taylor (Leicester), Simon Davies (b.1974), Tommy Smith (defender), Tommy Wright (goalkeeper), Tommy Wright (b.1984), Wayne Brown (Fulham). Jordao (West Brom 2002/03) is a different player from Bruno Jordao (Wolves).
This split was done by hand from career patterns (position, club, nationality, gaps). Other same-name pairs may remain undetected; a mistaken merge would show as an implausible career in players.csv.

## Not fully checked
- Own goals for: in some club-seasons StatMuse returned no data; there the figure rests on the Wikipedia season page plus the exact goals reconciliation (noted in checks/).
- Positions and nationalities rest on one source (footballsquads or 11v11). Newcastle and Brighton footballsquads pages often would not load, so theirs came from Wikipedia squad lists or other seasons.
- full_name for some lesser-known players is the display name with accents where no source gave a full name.
