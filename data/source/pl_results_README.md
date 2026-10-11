# Every Premier League result, 1992/93 to 2025/26

`pl_results.csv`: one row per match (13,166), with season, date, home club, away club and the score. Club names are the game's own (Man Utd, Spurs, Sheffield Wed and so on).

Built by `scripts/build-pl-results.py` from two sources:

- football-data.co.uk, one file per season from 1993/94 to 2025/26.
- engsoccerdata (github.com/jalapic/engsoccerdata, every English league result), for 1992/93, which football-data doesn't have, and as a second source for every other season it covers (it lacks 2022/23 and 2025/26).

Checks, run every time the file is built (the build stops if one fails):

- every season has 462 matches (22 clubs, to 1994/95) or 380;
- the two sources agree on every match in the 31 seasons they share;
- the league table worked out from the results gives every club exactly the points in the game's own tables (`PL_PTS`, sourced separately in `docs/PL_POINTS_SOURCES.md`), allowing only for the four points deductions (Middlesbrough 1996/97, Portsmouth 2009/10, Everton and Nottingham Forest 2023/24), and the same finishing order as `PL`.

The headline records worked out from it (Arsenal's 49 unbeaten, Chelsea's 86 unbeaten at home, the 18-game winning runs, Derby's 32 without a win, Chelsea's 15 conceded and 25 clean sheets, Sheffield United's 104 conceded, Southampton's 30 defeats, the +79 and -69 goal differences) match Wikipedia's "Premier League records and statistics" page as of 24 May 2026.

Used by `scripts/build-pl-records.py` for the club records boards (`pl-rec-*`: goals for and against, runs, biggest wins, wins over the big six).
