# The game mechanics, rethought (Classic, Daily, Club X)

Craig, 18 Oct 2026: rethink the full game mechanics so the game plays like real football and rewards building a
good side. Nothing here is built or live. Dare2Dream is left out. Every number is measured on the real engine and
data unless it says estimate. This replaces the first draft of this file and the tactics, scouting and raids scope
where they differ.

## What is actually wrong, measured

I ran 320 full seasons per test player (16 relegated club-seasons, 20 seeds, legend cards included) and grouped the
runs by what they landed:

| Landed by the end | Average player: XI, points, titles | Greedy player: XI, points, titles |
|---|---|---|
| Nothing above gold | 81.0, 57 pts, 5% | 81.9, 64 pts, 6% |
| One legend, no purple | 81.9, 57 pts, 3% | 83.2, 65 pts, 2% |
| One purple | 81.7, 60 pts, 6% | 82.7, 63 pts, 6% |
| Two purples | 82.7, 65 pts, 18% | 83.3, 69 pts, 19% |
| Two purples and a legend | 82.8, 67 pts, 18% | 84.0, 69 pts, 15% |

That is the problem in one table. **Landing a legend is worth about nothing** (57 points with one, 57 without) and the
best run the game can give, nine golds, two purples and a legend, ends on 67 to 69 points and wins the title less than
one time in five. Craig is right: that run should be 85 points and the title more often than not.

Three causes, in order of size:

1. **Every rating point is worth the same.** A 91 legend replacing an 82 gold in one shirt adds 0.8 to the XI
   average, which the match model turns into about 2.5 points a season if he plays every game, and he usually arrives
   in January. A 93 is just "a bit more 82". Real football is not like that: the best player on the pitch decides
   matches out of proportion to his number.
2. **Building the team counts for nothing beyond the sum of ratings.** Shape, tactic and who plays where (beyond the
   fit colour) make no difference. History's giants field their real XI at full rating all season; the user's only
   edge is the cards he lands, and the cards cannot beat Man Utd's 87.5 average on their own.
3. **Defenders are worth half a forward** in the match model (a rating point on a centre back is worth 0.17 points a
   season, on a striker 0.40), and in several seasons the data rates the best defenders far below the best forwards
   (below).

There is also a measurement fault to own up to: `tests/calibrate.js`, `calibrate-all.js` and `policy.js` never attach
the legend cards (`core/game.js` builds them and hands them to the engine as `S.legends`; the tests do not), so
every balance figure quoted since 11 Oct, including the 3.3% and 8.2% titles in CLAUDE.md, was measured in a game
with no legends. With them the figures are average 6.9%, greedy 9.7% (the legends barely move points, which is
cause 1 again). Step 0 of the build is a shared `tests/legends.js` so every test plays the same game as the phone.

## The design

The season should read like this: your cards decide your ceiling, your building decides whether you reach it, and
history's clubs are exactly as good as they were, less what you took from them.

### 1. Stars play above their number

In matches a card counts for more than its rating the higher it is, and the better the card, the steeper (Craig, 18
Oct: purples should move the game more than golds, legends more again): **above 80 each rating point counts 1.5 on a
gold, 1.75 on a purple and 2 on a legend.** An 89 gold plays as 93.5, an 89 purple as 95.75, a 93 legend as 106;
nothing changes below 80. It applies to every player on the pitch, yours and theirs, so it is not a bonus for the
user: the great sides are made of purples and legends, and Man Utd 2007/08 go from 87.5 to 92.5, Chelsea from 85.2
to 88.1. The card shows his real rating; the big card gets one line, "Plays above his rating in matches", on gold and
up, "well above" on purple and legend.

The match model is refitted to the real results afterwards (`tests/fit-match.js`) so the league's scorelines stay
real. Measured on the harness (gold XI of 82s, 2007/08 clubs): a purple striker (89) goes from +3 to +5 points a
season, a legend striker (93) from +4 to +9, a legend centre back (91) from +1 to +3 (more again with the weights in
section 3), and two purples and a legend from +9 to **+17** (67 to 84 points) before any of the building below.

### 2. Building the team: your edge over history

This is the user-only part, and it is open, not hidden: every piece is on the screen and explained. Combined it is
worth about **+2.5 rating points across the XI when you get it right (about +7 points a season) and about -2 when
you get it wrong**. History's clubs get none of it (they are what they were), so this is how a built side of 84s
beats a real side of 87s, which is what Craig asked for.

**a. Tactic.** Five tactics, picked on a board with a line of plain text each (the sheet from the earlier scope).
A tactic decides which of your lines settles matches, measured against your own XI:

| Tactic | What it does to your lines | Suits | Costs |
|---|---|---|---|
| Mid block (default) | nothing | any side | nothing |
| Low block | defence counts 1.9x its edge over your average, attack 0.65x | a side built on its back line | a side that bought forwards |
| Possession | half your midfield's edge flows into defence and attack | a side with its best players in midfield | a weak midfield |
| Counter attack | attack built round your best forward (+ half his edge over the attack), defence +1 | one top-class forward | an even or weak attack |
| High press | attack counts 1.25x its edge, defence 0.75x | a side built on its forwards | a weak attack |

Measured in the earlier scope: the right tactic for a squad is worth +2 to +4 points a season, the wrong one -2 to
-4; re-picking at every window gains only about 1 point over picking once or twice, so nobody needs to fiddle 38
times. Pick it on the squad screen or the roll's pitch, free, any time.

**b. Shape.** Each tactic names the shapes it is built for (low block 5-3-2 and 4-5-1; possession 4-3-3, 4-2-3-1 and
3-5-2; counter 4-4-2, 3-5-2 and 5-3-2; high press 4-3-3, 3-4-3 and 4-2-3-1; mid block every shape). In one of them the
tactic's effect is at full strength; in any other shape it is at **half strength**, both the gain and the cost. So
the shape never pays on its own (no free +3 for reading the board), it decides how hard your tactic bites, and mid
block in any shape is today's game exactly.

**c. Stars in the right role.** A gold or better player in his main position, in the line his tactic leans on, is
"in his role": the amplifier is applied to him in full. Out of his main position (amber or red), or in a line the
tactic plays down, he is an ordinary player. This is what makes "a legend striker under a counter attack" feel
different from "a legend striker in a low block", and it is shown on his pitch card as a small filled star on the
tab.

**d. Settling in.** A new signing takes time, or doesn't, seeded per card so a refresh never changes it:

| Type | Chance | Effect |
|---|---|---|
| Hits the ground running | 30% (purples and legends always, Craig 18 Oct) | full rating from his first game |
| Settles in | 50% | two games halfway between the man he replaced and himself |
| Takes time | 20% (purples and legends never) | three games, climbing from a quarter of the way up to full (Craig, 18 Oct: three, not four) |

Floor: he never plays below the shirt's rating before the roll (an empty shirt counts 40), so a signing can only delay
a gain, never cost you. Players already in your XI who swap shirts or are re-seated by a shape change do not settle.
A Club X carried-in XI does not settle; poach replacements and free agents do. Shown as dots under his rating on the
pitch card, one per game left, and "Settling in: 2 games" on the big card. Costs a typical season about half a point
(estimate from the 3 points a season per XI rating point): felt on the pitch, invisible on the table.

**Guidance, without doing it for them.** The squad header shows your three lines as short bars (Defence, Midfield,
Attack, the engine's own numbers) with your best line in the accent colour. Each tactic board says in one line what it
leans on and which shapes it is built for. Once per run, after six games with the tactic never changed and the
evidence strong, one line on the fixtures screen: "Your defence is your best line. A low block would lean on it."
No "Suits your XI" label, no points preview: reading the bars and the boards is the game.

### 3. Defenders

Three changes, all needed:

- **Slot weights** (`SLOTW`): keeper 1.8 (from 2.2), centre back 1.6 (from 1.0), full back 0.9 (from 0.8), wing
  back 0.7 (from 0.6), striker 1.0 (from 1.25), wingers 0.85 (from 1.0). Measured per rating point a season: keeper
  0.26, centre back 0.24, full back 0.21, midfield 0.24 to 0.28, wingers 0.33 to 0.35, striker 0.36. A striker still
  matters most, by 1.5 times rather than 2.4, and a legend centre back becomes a signing worth having.
- **+2 on every defender card**, as Craig asked, so they look as valued as they are: done in `build-data.py` with the
  level cuts unchanged (more defenders turn gold and purple), and the match model refitted after, so scorelines stay
  real. This is presentation and the card economy, not the match model, and that is fine: it is what he asked for.
- **The data at the top end is wrong in some seasons, and that is for the player data session.** The best defender of
  1992/93 is rated 82 (Hendry, May); Paul McGrath, the PFA Player of the Year that season and in the PFA Team of the
  Year, is 80 and gold, not purple, though `honours.json` has him. 1997/98 (Arsenal's double) tops out at 83;
  1999/00, 2015/16 and 2016/17 at 85; other seasons reach 88 to 92. Pallister is 80 in 1992/93 and 88 the next season;
  Irwin 81 then 90. Forwards and midfielders top 90 to 99 every season. The rating model is compressing defenders
  where team results or clean sheets were poor, and the honours rule ("a verified honour that season rated 80+ is
  purple") has not caught McGrath. Ask: anchor each season's top defenders to the honours as the other positions
  are, with a source behind every change, and make McGrath 1992/93 purple and 86 or better. Not guessed in this
  session: the player data session has the sources.

### 4. Raids: history bent by what you took, hardest where it mattered

Scaled scorelines (earlier scope): each real match of a club you took players from is replaced by its real score
scaled by what its XI lost (its goals down by the attack and midfield lost, its goals conceded up by the defence and
midfield lost, through the match model's own sensitivity, seeded rounding). The type of player taken is in the rule
by construction: midfielders shrink both ends, forwards their goals, defenders and keepers the goals they let in.
Then, as Craig asked, **the bite depends on the opponent's real final position**: the sensitivity is `m = 2.5`
multiplied by `1.6 - 0.06 x position` (1.54 against the champions, 1.0 against 10th, 0.4 against the bottom club,
never under 0.3). Sized to Craig's own numbers (18 Oct: without one of Keane, Beckham and Scholes, Man Utd keep 29 of
their 32 points against the top half, without two 25, without three 20, compounding). Measured, Man Utd 2000/01,
real 32 from the top half and 48 from the bottom half:

| Taken | Against the top half | Against the bottom half | Season |
|---|---|---|---|
| Keane | 29 of 32 | 47 of 48 | 76 (real 80) |
| Keane, Beckham | 24 | 42 | 66 |
| Keane, Beckham, Scholes | 19 | 38 | 57 |
| Keane, Beckham, Scholes, Giggs | 14 | 32 | 46 |

A 1-0 over Arsenal is 0-0 or 0-1 more often than not; a 3-0 over Bradford is usually still a win. No cap, so a fourth
and fifth player keep hurting. Club X forecast seasons use the forecast's table. **No real form** anywhere: the only
thing that moves history is your signings (Craig, 18 Oct).

### 5. Scouting

On a transfer roll the respin button offers Respin (1) or Scout a position (2). Scout opens your pitch in a slide-up;
**a shirt with nobody better is shown red, with a key under the pitch: "Red: nobody better this season"** (Craig, 18
Oct); the rest are as they are. The pool is that season's cards green in the
shirt, rated above the man in it, never seen this run, never your own, **never a legend card** (purples can be
scouted; they are the season's top ten). Measured across every season and shirt: above a 76 holder there are always
three or more; above an 82, 54 of 238 season-shirts have fewer than three and 4 have none; above an 86, 171 and 48.

- Three or more: 2 respins, three cards reel in, an ordinary roll from there (sign, pass, respin again).
- One or two: the scout brings what there is and fills to three with the best below him, each tagged "better" or
  "next best". Still 2 respins.
- Red shirt: tapping it costs nothing. A line names the best man there this season ("Nobody better than Hendry at CB
  in 1992/93"); pick another shirt or close.

The sheet copy: "Scout a position. Uses 2 of your respins. Pick a shirt and your scouts bring back three players
who play there and are better than the man in it now. Never legends: they find you. A normal respin costs 1 and could
bring anyone; scouting costs 2, so you will have fewer left for a bad roll later." With one respin left the row is
greyed, "Needs 2 respins". Balance-neutral in the earlier scope's measurement (a scout's best card gains about 1.5
rating points against 1.2 for a respin, at twice the cost); it is how a low-block side finds defenders.

### 6. Modes

- **Classic and Daily:** everything above. The Daily is a Classic run, so a day's club plays by the same rules for
  everyone; the seed stays per go.
- **Club X:** the same engine. Carried-in players do not settle, poach replacements and free agents do; the tactic
  and shape carry over between seasons; poached players joining a rival get the star curve like anyone else; raids
  and poaches in forecast seasons use the forecast table. Stars matter more now, so poaching your legend hurts more
  and reads right.
- **Goal Rush and Unbeaten Run:** untouched.

## What a season should look like after this

Estimates from the measured parts (stars measured, building measured per part, combined to be measured in the build):

| Run | Today | After |
|---|---|---|
| Nine golds, two purples, a legend, built right | 67 to 69 pts, title 15 to 18% | about 88 pts, the title most of the time |
| Two purples, built right | 65 to 69 | about 78, top 4 nearly always |
| One purple, mid block in 4-4-2 | 60 to 63 | about 63 |
| Nothing above gold, built wrong | 57 to 64 | about 55 |
| Never signs anyone | 33 | 33 |
| Derby 2007/08, any of the above | 5 to 8 lower | 5 to 8 lower |

The spread between a lucky, well-built season and an unlucky, careless one grows from about 10 points to about 30,
which is the difference between a game of dice and a game of management. Weak squads stay harder (no evening out).

## The retune

Order matters because each step moves the fit:

0. `tests/legends.js`, used by every test, so balance is measured with legend cards. Re-baseline today's numbers.
1. Defender +2 and slot weights, then refit the match model to the real results (`tests/fit-match.js`: goals a game,
   draws and 5-goal margins back within 0.1 of real).
2. Star curve, refit again.
3. Tactics, shapes, roles; the test players in `tests/policy.js` gain a build step (pick the tactic and shape that
   fit the XI at each window, the greedy player always, the average player 70% of the time).
4. Settling, raids by opponent, scouting.
5. Measure `HIST=1 node tests/calibrate-all.js 12` and `node tests/calibrate.js 2007/08 Derby 400`. Targets
   (Craig, 15 Oct): average player about 5% titles, Derby about 2%, the table above within 3 points per row. The
   knobs, in order: the size of the build effect (the amplifiers), then the star slopes (1.5, 1.75, 2), then `levelOdds`
   only as a last resort (landing stars is the fun; do not make them rarer to balance the engine).
6. New engine tests: no raids means history untouched; a settling signing never plays below the shirt's floor; mid
   block in any shape equals the plain model; same seed and choices replay the same season.

## Build order and size

Step 0 and the defender and weight work half a day plus the refit; the star curve an hour plus a refit; tactics,
shapes, roles, bars and boards 4 days; settling 1 day; raids half a day; scouting 2 days; retune and How to play 1
day. About 10 days. The player data session's defender anchoring runs alongside and lands whenever its sources do.

## Built, 18 Oct 2026 (build 128)

Craig: "Think about that and build it all out." Everything above is in, with these decisions taken in the build:

- **Stars are user-only** (Craig, 18 Oct): history's clubs play as they did, less what you took. The slopes are gold 1,
  purple 1.5, legend 2 above 80: with gold at 1.2 to 1.5 the whole XI lifted and an average player won the title 8.5% to
  15.7% of the time (greedy 30% to 48%); with gold at 1 the levels do the work, which is what Craig asked for.
- **Purple 3%, legend 1%, and one legend guaranteed per season** (`legendRoll`: if none has come up by a seeded roll
  between the 3rd and the 3rd-last, that roll's first card is one). A player who plays three games meets three legends;
  whether he takes them and builds round them is the game. Purple at 4% made two purples and a legend the common case.
- **Tactics** measure each line's edge against the real clubs' average offsets (`RULES.lineOffset`; keepers rate high,
  so a defence reads a shade above its XI) and the counter attack costs 3 for up to +4 round the best forward (+6 made
  it everyone's pick). Settling's slow type is three games (Craig).
- **Raids** at m 2.5, opponent weight 1.6 minus 0.06 a place (Craig's 29 / 25 / 20 of 32, measured 29 / 24 / 19).
- **Scouting**: red shirts with a key (Craig); a red shirt names the best man there and costs nothing.
- **Measured** (`HIST=1 node tests/calibrate-all.js 12`, legend cards in for the first time): average player title 5.7%,
  top 4 36.9%, 62 points; greedy 25.5%, 76.6%, 73 points; Derby 2007/08 average 1.7%, greedy 23.3%. By what a season
  landed (`node tests/landed.js 8`, average player): nothing above gold 53 points, a legend 62, a purple and a legend 65,
  two purples and a legend 68 and the title 15% of the time; the greedy player's two purples and a legend 77 points and
  the title 43%. Tactics picked: the average player (once, pre-season) a low block 63% of the time (a relegated side's
  defence is usually its best line), the greedy player (re-picked every window, having bought forwards) a high press 80%.
