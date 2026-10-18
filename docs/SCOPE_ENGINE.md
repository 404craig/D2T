# Scope: a more authentic match engine (Classic, Daily, Club X)

Craig, 18 Oct 2026, after the tactics, scouting and raids scope (`docs/SCOPE_TACTICS_SCOUTING_RAIDS.md`): look at the
whole engine and make it play out more like real football. Nothing here is built or live. Dare2Dream is left out (it
may be dropped or reinvented). Every number below comes from the scratch harness run against the real engine and
data; where a number is an estimate rather than a measurement it says so.

## The short version

The engine is sound at its core (the goals model is fitted to every real result: 2.70 goals a game against 2.69 real,
draws 23.7% against 25.6%). What makes it feel less than real is in the layers around it. Seven changes, in the order
I would build them:

1. **Defenders count for too little.** The real cause is not their ratings, it is the weights. One rating point on a
   centre back is worth 0.17 points a season; on a striker 0.40, a keeper 0.36. A legend centre back adds 1.5 points
   a season, a legend striker 4.5. A flat +2 for every defender would not change this (the men already in your
   shirts go up too, so a defender card is no better a signing than before). Fix the weights instead (section 1).
2. **Raids: scaled scorelines, hitting harder against good sides.** The scaled-scoreline rule from the last scope,
   plus a weight by the opponent's real final position: losing Keane, Beckham and Scholes costs Man Utd about a
   quarter of their points against the top half and an eighth against the bottom half. The type of player taken is
   already in it (each line's loss moves goals for or against). Section 2.
3. **Stars feel like stars.** Ratings above 85 count a little extra in matches, for everyone, so a legend striker is
   worth about 6 points a season instead of 4.5, and the great sides of history are a touch harder to beat. Section 3.
4. **Tactics with shapes.** A tactic that suits your shape gives a small lift to every line; a tactic that leans on
   your best line gives more. Get both right and an 80-rated XI plays like an 82; get both wrong and it plays like a
   78 or 79. Guidance by plain text and your three line bars, no "Suits your XI" label. Section 4.
5. **New signings settle in.** Each signing gets a seeded settling time: some hit the ground running with a debut
   lift, most take two games, a few take four. It never makes him worse than the man he replaced. Section 5.
6. **Scouting.** 2 respins, 3 cards all green in one shirt and all better than the man in it, the trade-off spelt
   out on the sheet. Section 6.
7. **Opponents' real form.** A club on a real winning run at the time you meet it is a little stronger, one in a
   slump a little weaker, so a match against 2003/04 Leeds in March feels different from August. Section 7.

Then one retune of the whole thing against Craig's targets: a relegated side wins the league about 5% of the time,
Derby 2007/08 about 2% (section 8).

## Where the engine stands

- An XI becomes three numbers, defence, midfield and attack, from the slot weights (`SLOTW`): each shirt feeds the
  lines in fixed shares. Goals are Poisson from `exp(0.0381 x (our attack - their defence) + 0.0079 x (midfield gap)
  + home)`. Opponents field their real squad's best XI minus anyone you have taken. Other clubs' results are history,
  bent by raids.
- What an XI is worth over a season (expected points against the real clubs, 4-4-2, every man green):

| Your XI | 2007/08 | 2000/01 | 2018/19 |
|---|---|---|---|
| All 72 (bronze and silver) | 40 | 41 | 41 |
| All 76 (silver) | 52 | 53 | 53 |
| All 80 (low gold) | 64 | 65 | 65 |
| All 82 (gold) | 70 | 71 | 71 |
| All 84 | 76 | 78 | 77 |
| Gold with a purple striker (89) | 73 | 75 | 74 |
| Gold with two purples (striker, midfielder) | 75 | 76 | 76 |
| Gold with a legend striker (93) | 75 | 76 | 76 |
| Gold with a legend centre back (91) | 72 | 73 | 73 |
| Gold with two purples and a legend | 80 | 81 | 81 |

  The top real XIs those seasons are 87.5 (Man Utd 2007/08 and 2000/01, Liverpool 2018/19). So one rating point
  across the XI is worth about 3 points a season, an all-gold side finishes about fourth, and a gold side that also
  lands two purples and a legend is a title contender. That is the right shape for Craig's "a team of mostly gold, or
  with a couple of purples or a legend, should perform well". What is wrong is where the value sits (section 1) and how
  little a single star moves it (section 3).

## 1. Defenders and the slot weights

### What is wrong

Points a season for +1 rating point in one shirt, everyone else 80 (2007/08):

| Shape | GK | Full backs | CB | CM/CDM | Wide mid | Wingers/CAM | ST |
|---|---|---|---|---|---|---|---|
| 4-4-2 now | 0.36 | 0.21 | 0.18 | 0.24 | 0.26 | | 0.40 |
| 4-3-3 now | 0.35 | 0.21 | 0.17 | 0.22 to 0.24 | | 0.36 | 0.41 |
| 5-3-2 now | 0.33 | 0.23 | 0.16 | 0.25 | | | 0.45 |

The keeper carries 2.2 of the defence's weight and each centre back 1, so a centre back is a sixth of the defence
while a striker is over a quarter of the attack. That is why every test player ends up buying forwards and why the
low block lost on average in the last scope.

The card supply leans the same way (players with 10+ games, all seasons):

| | p50 | p90 | p97 | p99 | best |
|---|---|---|---|---|---|
| GK | 76 | 84 | 89 | 91 | 92 |
| DEF | 73 | 80 | 84 | 88 | 92 |
| MID | 73 | 82 | 88 | 91 | 97 |
| FWD | 72 | 83 | 90 | 95 | 99 |

The middle is level; the top end of defenders is squashed by 4 to 7 points.

### Craig's +2 idea, and what I would do instead

A flat +2 for all defenders mostly changes how cards look (more defenders turn gold): the men in your shirts and in
every opponent's XI go up by the same 2, so signing a defender gains you exactly what it did before. It would also
lower every scoreline unless the goals model is refitted.

Instead:

- **New slot weights** (draft: keeper 1.8 from 2.2, centre back 1.6 from 1.0, full backs 0.9 from 0.8, wing backs 0.7,
  striker 1.0 from 1.25, wingers 0.85 from 1.0). Measured, per rating point: keeper 0.26, centre back 0.24, full back
  0.21, midfield 0.24 to 0.28, wingers 0.33 to 0.35, striker 0.36 (5-3-2: 0.42). A striker still matters most, which is
  real (they cost the most for a reason), but by 1.5 times rather than 2.4. A legend centre back becomes a signing
  worth celebrating. Refit the goals model after (`tests/fit-match.js`), since opponents' strengths move too.
- **Ask the player data session** whether the top 3% of defenders should be stretched to match the other outfield
  positions (a 92 centre back's season is as rare as a 97 midfielder's). Only with a source behind each rating, as
  always; if it cannot be verified, leave the ratings alone and let the weights do the work.

## 2. Raids by player type and opponent

### Measured

The scaled-scoreline rule (last scope, m = 1.5) on Man Utd 2000/01 (real: 32 points from the top half, 48 from the
bottom half) and Leeds 2000/01:

| Taken | Line lost (att / def / mid) | Plain scaling: v top half, v bottom half, total | Weighted by opponent |
|---|---|---|---|
| Keane, Beckham, Scholes | -4.5 / -1.2 / -10.1 | 25, 38, 63 | 24, 42, 66 |
| Stam, Barthez, G. Neville | -0.2 / -7.3 / -0.4 | 26, 42, 68 | 26, 45, 70 |
| Sheringham, Cole, Yorke | -8.5 / 0 / -0.7 | 25, 38, 63 | 24, 43, 67 |
| Leeds: Viduka, Ferdinand, Bowyer (real 35 + 33) | -3.7 / -0.3 / -3.3 | 27, 26, 53 | 26, 28, 54 |

The type of player is already in the rule: midfielders shrink both ends of the scoreline (the midfield term moves
goals for and against), forwards shrink their goals, defenders and keepers raise the goals they let in. Plain scaling
costs the same share of points in every match (about 22%). Weighting by opponent makes it what Craig describes.

### The rule

Scaled scorelines as in the last scope, with the bite multiplied by the opponent's real final position:
`1.45 - 0.05 x position` (1.4 against the champions, 1.0 against 9th, 0.45 against the bottom side). Against the top
half Man Utd lose about 24% of their points without the midfield three, against the bottom half about 12%. A 1-0 win
over Arsenal becomes 0-0 or 0-1 most of the time; a 3-0 over Bradford is usually 2-0 or 2-1. In a Club X forecast
season the forecast's final table gives the positions. The defenders row moves up once section 1's weights are in
(a raided back line will matter more), so measure again after.

## 3. Stars

Today a rating point is a rating point. In matches, ratings above 85 would count half again
(`r + 0.5 x (r - 85)`: an 89 plays as 91, a 93 as 97), for every player, yours and opponents'. Measured (gold XI,
2007/08):

| | Now | With the star curve |
|---|---|---|
| Purple striker (89) | +2.9 pts a season | +3.6 |
| Legend striker (93) | +4.5 | +6.1 |
| Legend centre back (91) | +1.5 | +2.0 (more with section 1) |
| Two purples and a legend | +9.0 | +11.9 |
| Best real XI (Man Utd) | 87.5 | 88.9 |

It is honest (the best players do decide matches) and not a hidden bonus for the user: the great sides become a touch
harder to beat too. Missing out on purples and legends costs you exactly what Craig expects: a few points, not the
season. The card shows his real rating; nothing on screen changes.

## 4. Tactics and shapes

Craig asked for the right formation and tactic together to lift a squad so that an 80 can beat an 82, but not as a
flat percentage. A flat boost would be automatic (everyone finds it once and the feature is solved). My version has
two parts, both visible, neither automatic:

### Part 1: the shape suits the tactic (small, shown up front)

Each tactic lists the shapes it is built for; using one of them lifts all three lines by 1.

| Tactic | Built for |
|---|---|
| Low block | 5-3-2, 4-5-1 |
| Mid block (default) | 4-4-2, 4-5-1, 4-2-3-1 |
| Possession | 4-3-3, 4-2-3-1, 3-5-2 |
| Counter attack | 4-4-2, 3-5-2, 5-3-2 |
| High press | 4-3-3, 3-4-3, 4-2-3-1 |

+1 on every line is worth about 3 points a season. It is shown openly on each board ("Built for 5-3-2 and 4-5-1"),
so it teaches real football rather than hiding a trick.

### Part 2: the tactic suits your squad (bigger, read from your XI)

The line amplifiers from the last scope: the low block makes your defence count for more and your attack for less, the
high press the reverse, possession feeds your midfield into both ends, counter attack builds round your best forward.
With section 1's weights the low block stops being a loser on average, because defenders are now worth buying for it.
Tuned so that, for a squad whose best line matches the tactic, part 2 is worth +2 to +4 points a season, and against
its weak line -2 to -4.

### Together

Right shape and right tactic: about +5 to +7 points a season, which is two rating points across the XI: an 80 plays
like an 82, and wins that head-to-head about as often as it loses it. Wrong on both: about -4. Neutral (mid block in
4-4-2): today's game exactly, so a player who never touches it loses nothing. These are the targets for the build's
tuning, from the measured sizes of each part; the combined figure is an estimate until it is measured.

### Guiding the player (no "Suits your XI")

- **Your three lines.** The squad screen's header shows Defence, Midfield and Attack as three short bars from your XI
  (the numbers the engine already works out), with your best line in the accent colour. Nothing else is judged for you.
- **Each board says what it needs, in one line,** naming the line, the shapes and the cost:
  - Low block: "Sit deep and let your back line win it. Strong defence, 5-3-2 or 4-5-1. Fewer goals at both ends."
  - Mid block: "Balanced. Plays your XI as it is."
  - Possession: "Keep the ball. Needs your best players in midfield. 4-3-3, 4-2-3-1 or 3-5-2."
  - Counter attack: "Defend, then break. Built round one quick, top-class forward. 4-4-2, 3-5-2 or 5-3-2."
  - High press: "Win it high and attack. Needs your strongest players up front. 4-3-3, 3-4-3 or 4-2-3-1."
- **After a run of games**, one line on the fixtures screen, only when the evidence is strong: "Your defence is your
  best line. A low block would lean on it." Once per run, and only if the player has never changed tactic. That is the
  nudge; reading the bars and picking is still the player's job.
- Changing tactic is free whenever the squad or roll pitch is up. No per-match switching (opponent-independent, so
  one or two changes a season is right).

## 5. New signings settle in

Each signing gets a settling type from his own seeded draw (`stream(seed, "settle", card id)`), so a refresh never
changes it:

| Type | Chance | What happens |
|---|---|---|
| Hits the ground running | 30% (purples 50%, legends 70%) | Full rating at once, plus 2 for his first two games (the debut lift) |
| Settles in | 50% | Two games at the halfway point between the man he replaced and his own rating |
| Takes time | 20% (purples 10%, legends 0%) | Four games, from a quarter of the way up to full |

Rules:

- **Never worse than not signing:** while settling he plays at least at the rating of the man he replaced in that shirt
  (or the empty shirt's free agent). A settling signing can only delay a gain, never cost you.
- Shown on his pitch card: a small ring of dots under the rating, one per game left, and on the big card "Settling in:
  2 games". A hit-the-ground-running signing flashes "Up and running" on his first fixture. One first-time tip.
- Club X: your carried-in XI does not settle (they are your players already). Poached replacements and free agents do.
- Size (estimate from the 3 points a season per XI rating point above): a typical season's settling costs about 0.3 to 0.6
  points and the debut lifts give about 0.2 back. Small on the table, large in feel: the right amount.

## 6. Scouting

As Craig set it: costs 2 respins and guarantees a better player. Pick a shirt; three cards reel in, every one green
in that shirt and every one rated higher than the man in it, at least a level up where he is bronze or silver:

| Man in the shirt | Scouted cards |
|---|---|
| Empty, bronze | Silver or better (55% silver, 36% gold, 7% purple, 2% legend) |
| Silver | Gold or better (84% gold, 12% purple, 4% legend) |
| Gold | Gold rated higher than him, or better (75% gold, 19% purple, 6% legend) |
| Purple or legend | Not scoutable ("Already elite here") |

Measured in the last scope: balance-neutral (a scout's best card gains about 1.5 rating points against 1.2 for a plain
respin, at twice the cost). Gold to guaranteed purple was not chosen: two scouts a season would mean six purple cards
seen against the 3% odds, and landing a purple would stop being special.

The slide-up (British English, no dashes):

> **Scout a position**
> Uses 2 of your respins.
> Pick a shirt. Your scouts bring back three players who play there and are better than the man in it now. A bronze or
> silver shirt gets at least the next level up.
> The catch: a normal respin costs 1 and could bring anyone. Scouting costs 2, so you will have fewer respins for a
> bad roll later.

With one respin left the Scout row is greyed: "Needs 2 respins".

## 7. Opponents' real form

Today an opponent is its whole-season squad on every date. Real seasons have runs: 2003/04 Leeds were a different side
in spring. The rule: an opponent's strength on a match date moves by up to 1.5 rating points with its real points per
game over its previous six real matches against its season average (no form before game four). Only history, never
your results. Small (it never turns a bottom side into a top one), but the fixture screen can say it in one line
("Leeds: won 4 of their last 6"), which makes the calendar feel alive. Optional: build last, and only if the retune
holds.

## 8. What stays, and the retune

Kept as is: the Poisson goals model and its fit, home advantage, fit percentages (green, amber, red), the roll schedule
and odds, other clubs' results being history, the real result never shown, Club X's forecast seasons and poaching
(they pick up sections 1 to 3 through the same model).

Not proposed, on purpose: injuries and suspensions (frustrating with a fixed XI and no squad), fatigue, a hidden
bonus for weak sides (Craig ruled that out), per-match tactic changes.

The retune, once sections 1 to 5 are in (each moves balance):

- Expected direction: weights roughly neutral; raids by opponent slightly harder for the user (the raided giants keep
  more points against the bottom half); stars slightly harder (great sides stronger) but bigger rewards for landing
  them; tactics +2 to +5 points for a player who reads their squad; settling about neutral.
- Measure with tactic-aware test players (`tests/policy.js` gains a tactic step: pick the tactic and shape that fit
  the XI at each window) on `HIST=1 node tests/calibrate-all.js 12` and `node tests/calibrate.js 2007/08 Derby 400`.
- Targets (Craig, 15 Oct): average player about 5% titles, Derby 2007/08 about 2%, higher finishes generally more
  reachable, weaker squads still harder. Tune with the goals model's attack term and the level odds, not with any
  per-club handicap.
- New engine tests: no raids means history untouched; a settling signing never plays below the man he replaced;
  mid block in 4-4-2 equals today's numbers before the refit; same seed and choices replay the same season.

## Build order and size

1. Slot weights and refit (half a day, then the retune).
2. Raids, scaled and weighted by opponent (half a day).
3. Star curve (an hour, measured with 1).
4. Tactics with shapes, the boards, bars and copy (3 to 4 days).
5. Settling in (1 day with the card dots).
6. Scouting (1 to 2 days).
7. Opponents' form (half a day, optional).
8. Retune and the How to play page (1 day).
