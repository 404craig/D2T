# Scope: tactics, scouting and raids

Craig, 18 Oct 2026: "scope my idea out to see if it would make sense". Nothing here is built or live. Every number
comes from a scratch harness run against the real engine and data (the same seasons, cards, policies and seeds the
balance tests use), so the sizes are what the game would actually do, not guesses. Balance figures are for the two
test players in `tests/policy.js`: *average* (a typical player) and *greedy* (always the biggest upgrade), 16 relegated
club-seasons from 1992/93 to 2023/24, 16 to 30 seeds each.

## The short version

1. **Raids.** Keep the idea, change the mechanism. Today a raided club's real win or draw is knocked down one step with
   a chance of 3 x the strength lost, capped at 60%. On average that already costs Man Utd 2000/01 about 28 points for
   losing Beckham, Keane and Scholes, so the *amount* of punishment is not the problem; the *shape* is. Each result is a
   coin flip, so the 6-1 against Arsenal either stands whole or becomes a draw, a win can never become a defeat, and a
   scoreline never shrinks. Recommendation: **scale every raided club's real scoreline by what its XI lost**
   (their goals down, goals conceded up, by the match model's own sensitivity, with seeded rounding). Nothing is a coin
   flip, every scoreline moves, it compounds smoothly with 1, 2, 3, 4 players, and with nobody taken history is
   untouched. The parked branch `claude/raid-sim` ("played out, never better than real") should be dropped: it costs
   Man Utd 17 points for Beckham alone, which is why it gave Derby 2007/08 a 6.8% title.
2. **Tactics.** Worth doing, with one honest correction to the brief. In this match model a weaker side does *not* do
   better by defending: a closed, low-scoring game costs every side the user ever has (even a 52-point Derby loses 2
   points a season from it), because 3-1-0 rewards scoring and the model's attack and defence terms are symmetric.
   What does work, and is what Craig actually wants, is tactics that decide **which of your lines settles matches**:
   a low block makes your defenders count for more and your forwards for less, a high press the reverse, possession
   routes your midfield into both, counter attack builds the attack round your best forward. Then the right tactic
   depends on the squad you build, a centre back can be the better signing under a low block, and the "fit" of each
   tactic can be shown as points a season. Sized right, the right pick is worth about +3 to +5 points a season and the
   wrong one about -3, and a player who re-picks at every window gains only about 1 point over one who picks once or
   twice, so there is no need to tweak 38 times.
3. **Scouting.** Works as a choice, not a power-up. Spend 2 of the 5 respins to name a shirt and see 3 cards that are
   all green there and all at least a level above the man in it. A scouted roll's best card gains about 1.5 to 1.75
   rating points against about 1.2 for a plain respin, at twice the cost, so season outcomes are unchanged (titles,
   top 4 and points within noise of today) while the player gets to decide *where* they improve. It is also how a
   low-block side stays a low-block side: the card supply is attack-heavy (below), so defenders have to be scouted.
4. **The attack lean.** Two findings underneath all of this. (a) Every test player's side ends the season attack-heavy
   (defence 80 to 84, attack 86 to 88) whatever it started as, because the best-gain signing is nearly always a
   forward. (b) The card supply leans the same way: 11% of defender cards are gold or better against 18% of forwards,
   and only 53 defender cards rate 88+ against 164 forwards and 160 midfielders. Tactics have to be tuned against this
   (the defensive tactic needs a bigger multiplier than the attacking one to break even), and the ratings work should
   look at whether top defenders are under-rated.
5. **Teaching.** Each new thing gets one first-time tip in the existing handwritten style, one line of plain text in
   its own sheet, and one "why" line on the results screen ("Leeds, weakened by your signings, drew"). The How to play
   page gets a short Tactics and a Scouting entry.

Suggested order: raids first (small, fixes something live players notice), then tactics (engine, squad and transfer
screens, balance retune), then scouting (transfer screen, balance check), then the tips. Rough effort: raids half a
day, tactics 3 to 4 days including the retune, scouting 1 to 2 days, teaching half a day.

## 1. Raids: how clubs weaken when you sign their players

### What happens now

`otherResults` in `src/engine.js`: for each real match of a club you have taken players from, the strength lost `L`
is `(full XI rating - XI rating without them) / (full - 60)`, and with chance `min(0.6, 3L)` a real win becomes a
draw or a real draw a defeat (one step, never two; a defeat never changes; the scoreline only changes by the one goal
that makes the step). Expected points, from the real fixtures:

| Players taken (best first) | Man Utd 2000/01, real 80 | Leeds 2000/01, real 68 | Arsenal 2003/04, real 90 |
|---|---|---|---|
| 1 | 76 | 61 | 75 |
| 2 | 63 | 51 | 69 |
| 3 | 52 | 47 | 64 |
| 4 | 48 | 40 | 52 |
| 5 | 46 | 39 | 52 (capped) |

So it compounds and it is strong *on average*. The two complaints (Leeds beating Man City 4-0 with three gone; Man Utd
6-1 Arsenal with four gone) are the shape: with four Man Utd players gone each of their 25 wins stood whole with a 44%
chance, and when a win stands the goals stand too. Also the cap: taking a fifth player changes nothing.

### Options measured

| Rule | Man Utd 00/01, 1 / 3 / 5 taken | Verdict |
|---|---|---|
| Live rule (downgrade one step, chance 3L, cap .6) | 76 / 52 / 46 | compounds, but coin flips and scorelines never shrink |
| Play the match out with the weakened XI (`claude/raid-sim` first cut) | 84 / 74 / 67 | a small raid can make them *better* than history (the model over-rates big clubs: Man Utd's full XI plays out to 86, City 2018/19 to 83 against a real 98) |
| Play out, keep only if no better than real (`claude/raid-sim` as parked) | 63 / 56 / 51 | biased: min(real, replay) loses 17 points on one player; Derby title 6.8% |
| Replay from the real score, gated by chance 3L | 79 / 72 / 67 | gentler than today in expectation; still coin flips |
| **Scaled scoreline** (recommended), sensitivity m = 1.5 | 77 / 63 / 53 | every match moves, smooth, compounds, zero change with nobody taken |
| Scaled scoreline, m = 1 | 78 / 68 / 62 | lighter |
| Scaled scoreline, m = 2 | 76 / 57 / 45 | heavier than today |

### Recommended rule: scaled scoreline

For a club you have taken players from, each of its real matches is replaced by its real score scaled by what the XI
lost, using the match model's own sensitivity (`RULES.match.att` = 0.0381 per rating point):

    goals for      = (real for + 0.25) * exp(m * (att * dAtt + mid * dMid)) - 0.25
    goals against  = (real against + 0.25) * exp(-m * (att * dDef + mid * dMid)) - 0.25

where `dAtt`, `dDef`, `dMid` are the weakened XI's attack, defence and midfield minus the full XI's (negative), the
0.25 lets a clean sheet be broken, and each value is rounded up or down by one seeded draw (`stream(seed, "raid", m.i)`),
so 5.16 is 5 four times in five and 6 once. `m` sets the bite; 1.5 reproduces today's average punishment at three
players and keeps compounding past it (no cap). A poached player joining a club (Club X) works the same way with the
signs reversed, which is what `joinersOf` does today.

Why this one: the 6-1 becomes about 5-1 or 4-2 with Beckham, Keane and Scholes gone, a 1-0 win survives most of the
time but can become 0-0, Leeds' 4-0 at City with three gone becomes about 3-1 and sometimes 2-2, and it reads as
history bent by your signings rather than history rewritten. The results screen already dots raided rows; the
scoreline shown is the scaled one (the real one is never shown, as now). Dare2Dream drafts raid before the season,
so the same rule covers them.

Balance: expected punishment at three players is about the same as today, so the title rates should move little;
run `HIST=1 node tests/calibrate-all.js 12` after and expect average within 0.5% of 3.3%. Add an engine test: with
nobody taken every other result equals history; with Man Utd's top three taken their points fall by 12 to 22.

Tell the user: on the results screen the note already says "Clubs you sign players from are weaker and can drop
points." Add, once per run as a first-time tip on the first dotted row: "Their score shrinks by what you took."

## 2. Tactics

### What the match model allows

`expectedGoals` is `base * exp(0.0381 * (our attack - their defence) + 0.0079 * (our midfield - their midfield) +
home/away)`, Poisson goals, 3-1-0 points. Measured on the real fixtures:

- One rating point of net strength (attack and defence together) is worth about 1.3 points a season; +2 on both is
  about +5, -2 about -5.
- A more open game (both sides' goals x1.15) is worth +0.2 to +2.7 a season, more for stronger sides; a closed game
  (x0.87) costs 0.4 to 2.6 for every side tested, including a 52-point Derby. Trading 3 points of attack for 3 of
  defence costs about 1 point a season for everyone. **There is no "weak teams should defend" niche in this model.**
  Making one up would mean a hidden bonus for weak sides, which Craig has said he does not want (no evening out).
- Attack is worth more than defence per rating point (about 15% at parity, more for favourites), and the card supply
  is attack-heavy, so anything symmetric ends up favouring attacking tactics.

### The model proposed: a tactic decides which of your lines settles matches

Each tactic maps your XI's (defence D, midfield M, attack A, overall O; `xiStrength`) to the values the match uses.
Everything is measured against your own XI, so a tactic pays when the line it leans on is your strength and costs
when it is your weakness. No tempo terms (they only lean towards favourites). Draft numbers:

| Tactic | Defence used | Attack used | Pays when | Costs when |
|---|---|---|---|---|
| Mid block (default, today's game) | D | A | always neutral | |
| Low block | O + 1.9 (D - O) + 0.5 | O + 0.65 (A - O) | your defence is your best line | you have bought forwards |
| Possession | D + 0.5 (M - D) + 0.5 | A + 0.5 (M - A) + 0.5 | your midfield is above your defence and attack | your midfield is the weak line |
| Counter attack | D + 1 | A - 3 + 0.5 (best forward - A) | one forward well above the rest | attack is even, or weak |
| High press | O + 0.75 (D - O) | O + 1.25 (A - O) | your attack is your best line | your attack is your weak line |

The asymmetry (1.9 for the low block against 1.25 for the press) is deliberate: it offsets the attack lean above so
that no tactic wins on average. The numbers are a starting point for the retune, not final.

### Measured (test players who sign for their tactic, 16 clubs, 16 seeds)

Mean change in points a season against the default, with the range across clubs:

| Tactic | Average player | Greedy player | Best fixed tactic for N of 16 clubs (average / greedy) |
|---|---|---|---|
| Low block | -1.7 (-4.1 to +1.1) | -2.2 (-4.6 to +1.1) | 0 / 0 |
| Possession | -0.1 (-2.6 to +2.4) | +1.2 (-2.9 to +6.1) | 2 / 3 |
| Counter attack | +2.3 (-0.1 to +4.6) | +1.5 (-0.3 to +5.8) | 11 / 4 |
| High press | +1.6 (+0.4 to +3.5) | +2.5 (-0.4 to +4.6) | 3 / 9 |
| Re-picked every window (the ceiling) | +3.7 | +2.7 | about 2 switches a season |

With a frozen XI (no signings) the tactics do exactly what the table above says: Bolton, Leeds and Ipswich (defence
their best line) gain 1.3 to 1.5 from a low block and lose from a press; Forest and Leicester the reverse. The low
block's negative mean over a *season* comes from the attack lean: even a player signing for a low block ends up with a
better attack than defence because that is what the rolls offer. Three ways to close that, in order of preference:
scouting (section 3) so a low-block side can find defenders; lifting the low block's defence multiplier until its
season mean matches the press (about 2.1 on these numbers); asking the ratings work whether top defenders are
under-rated (53 cards at 88+ against 164 forwards).

Tuning target for the build: each tactic's mean within 1 point of the others, best-tactic spread across clubs, right
pick +3 to +5, wrong pick about -3, re-picking every window worth no more than about 1 point over a settled choice.
Re-run `calibrate-all` with the tactic-aware policies afterwards and retune `levelOdds` if the average title rate
drifts past about 4%.

### What the player sees

- **A tactics chip bottom right of the pitch**, the twin of the shape chip bottom left: the tactic's name and a
  chevron, no word "Tactics" once picked (default "Mid block"). On the squad screen and the roll's pitch; not in the
  draft before the first pick.
- **The tactics sheet**: five boards 3 across like the formation sheet, each a small pitch in your current shape.
  Low block: the outfield players sit deep and narrow. Possession: your shape as it is, a ball passing round a
  triangle on a loop. Counter: the back line deep, then everyone surging up the pitch on a loop that fades at the top
  and restarts at the bottom. High press: everyone high and narrow, a slow pulse forward. Mid block: your shape, still.
  Reduced motion: still pictures. Under each board one line of plain text and **its fit for your XI as points a
  season against an average side** ("+4 pts", "-2 pts"; `fitPts` in the harness: expected points from the match model
  at home and away against the season's average XI, times 19). The best one is marked "Suits your XI"; the player can
  still pick any. Done applies it; the chip updates.
- **Team rating**: keep the number as it is (squad quality, nothing hidden), and show the tactic's fit beside it on
  the squad header ("70 team rating · Low block +3").
- **Signing**: `signPreview` and the tray's best-shirt pulse use the tactic-adjusted strength, so under a low block a
  gold centre back shows a bigger gain than a gold striker. Worked example, 4-4-2: a striker 10 better than the man he
  replaces adds 2.8 to the attack and a centre back 10 better adds 1.9 to the defence (the striker is the better
  signing, as today); under the low block above the centre back is worth 1.9 x 1.9 = 3.6 and the striker 2.8 x 0.65 =
  1.8, so the defender is the better signing. That is the decision Craig wants, and it is visible on the tray.
- **Changing it**: free, any time the squad or roll pitch is up. No drilled-in bonus or switching penalty in v1; the
  opponent-independent design already means one or two changes a season is the right amount (the data says the
  ceiling from re-picking every window is about 1 point). If players flip constantly in practice, add a settling
  bonus later (+0.5 after three matches in the same tactic), not a penalty.
- **Share card and summary**: one word on the Classic and Daily share card ("Low block all season" when unchanged,
  otherwise nothing); the summary gets a line "You played a low block for 31 games."

### Engine changes

`st.tactic` on the run (default "mid"; saved runs without it are mid block), `RULES.tactics` with the table above,
`tacticStrength(st, us, bestFwd)` applied in `simMatch` before `expectedGoals` and in `signPreview`/`userStrength`
consumers that show gains, `setTactic(st, name)` logged like a formation change, `fitPts(st, S, name)` for the sheet.
Deterministic: same seed, same choices, same season. Club X careers and Dare2Dream get it too; Goal Rush and
Unbeaten do not. Opponents keep playing as they are (no AI tactics; history is history).

## 3. Scouting

### The mechanic

On a transfer roll the respin button opens a two-row sheet instead of respinning at once: **Respin** (1 respin, as
now: three fresh cards, any position) and **Scout a position** (2 respins). Scout opens a slide-up with your pitch;
tap a shirt; three cards reel in, every one green in that shirt (the draft's fit rule) and every one **at least a
level above the man in that shirt** (bronze there: silver or better; silver: gold or better; gold: gold with purple
and legend odds up, about 16% and 6%). Spend the whole 2 or nothing; with 1 respin left the Scout row is greyed with
"needs 2 respins". The scouted roll is otherwise an ordinary roll: sign one or pass, respin again if you still can.
Not in the draft (it is already one shirt at a time) and not on the club spin.

### Measured (16 clubs, 16 seeds; the test player scouts their weakest shirt when a roll is poor)

| Variant | Average player: pts / title / top 4 | Greedy: pts / title / top 4 | Best card's gain: scout v respin |
|---|---|---|---|
| No scouting (today) | 60.8 / 7.0% / 30.1% | 66.8 / 14.8% / 63.3% | - / 0.82 and 1.22 |
| 3 cards, no bronze | 60.7 / 6.6% / 33.2% | 66.8 / 12.5% / 60.2% | 1.45 / 0.65 and 1.64 / 1.27 |
| 3 cards, one tier up | 61.1 / 6.6% / 34.4% | 67.1 / 15.2% / 61.3% | 1.59 and 1.75 |
| **3 cards, above the holder** | 60.8 / 5.9% / 34.0% | 66.5 / 12.5% / 57.8% | 1.45 and 1.57 |
| 2 cards, above the holder | 60.3 / 5.9% / 32.8% | 65.7 / 10.9% / 56.6% | 1.31 and 1.42 |
| 1 card, gold or better | 60.8 / 7.4% / 35.5% | 66.2 / 11.3% / 57.0% | 1.41 and 1.57 |
| 4 cards, no bronze | 61.1 / 7.0% / 35.5% | 66.7 / 13.3% / 60.9% | 1.54 and 1.73 |

Every variant is balance-neutral within noise: a scout's best card is worth about 1.3 to 1.75 rating points against
about 1.2 for a respin, but it costs two, and spending them early leaves none for a dead roll later. That is the
right place for it: a real choice with a real trade, no change to how hard the title is. Three cards is recommended
over one or two (the reel and tray are built for three, and a single card feels like a vending machine) and over four
(the tray does not fit four without shrinking the cards). "Above the holder" is recommended over "one tier up" because
it is the promise a player can understand and check on the pitch.

Why it matters more than the numbers say: it is the lever that lets a player build a profile on purpose (two scouted
centre backs make a low block pay), and it turns a dead roll into a decision rather than a shrug.

### Engine and screens

`scout(st, S, slot)`: `respins -= 2`, the current roll's cards go to `seen`, a draw from `stream(seed, "scout",
rollIx, rollStep, spin)` of 3 cards with `drawCard(..., fit = green at slot)` and the level floor; `st.roll` marked
`scouted: slot` so the header can say "Scouted: CB". Screens: the respin button's sheet (two rows with counts), the
shirt-pick slide-up (the squad pitch, empty tray cards greyed, the picked shirt pulsing), the roll header kicker
"Scouting a CB", and the tray's green positions already show the fit.

## 4. Teaching the player

Reuse `D2T.tip` (handwritten note, once ever per key) and the sheets' own note lines. Proposed, each one line:

| Where | Tip (once) | Always there |
|---|---|---|
| First dotted row on the results | "Their score shrinks by what you took" | the key under the list, as now |
| Squad screen, first visit | "Your shape here, your tactic there" (the two chips) | the chip names |
| Tactics sheet | | one line under each board, the fit in points, "Suits your XI" on one |
| First roll after a tactic is set | "Gains now count your tactic" (on the tray's gain number) | the pulsing best shirt |
| Respin button, first roll | "Respin, or scout one shirt for 2" | the counts on the two rows |
| Scout pick | "Tap the shirt you want to fill" | greyed tray cards |
| Scouted roll | | kicker "Scouting a CB · 3 cards green there" |
| Summary | | "You played a low block for 31 games" |

How to play: a Tactics entry ("Pick how your team plays. Each tactic leans on one of your lines; the sheet shows
what each is worth for your XI in points a season.") and a Scouting entry ("Two respins buy a scout: name a shirt, see
three players who fit it, all better than the man in it."). The Game Rules doc gets the three rule changes.

## 5. Order, effort and the open questions

1. Raids: scaled scoreline, m = 1.5, engine test, results tip. Drop `claude/raid-sim`. Half a day. Ship on its own
   (players are hitting this now).
2. Tactics: engine, the two chips, the sheet with its boards, tactic-aware gains, fit numbers, summary and share
   lines, the retune with tactic-aware policies in `tests/policy.js`. 3 to 4 days.
3. Scouting: engine, the respin sheet, the shirt pick, header, balance check. 1 to 2 days.
4. Tips and How to play. Half a day.

Questions for Craig:

- Raids: m = 1.5 (about today's average bite at three players, compounding past it) or m = 2 (harder)?
- Tactics: is "no help for being weak, only for how you are built" acceptable? It is what the model supports without a
  hidden handicap. The visible promise becomes "build a team that suits a tactic and it pays".
- Tactics: do you want the "Suits your XI" marker, or should the player read the five fit numbers and decide?
- Scouting: 2 respins of 5 (at most two scouts a season), or 1 scout plus 3 respins as separate budgets?
- Should the ratings work look at top defenders (53 cards at 88+ against 164 forwards)?

Harness: `/tmp/.../scratchpad/scope/harness*.js` in this session, a copy of the engine with two hooks (a tactic
function on `simMatch`, an odds override on `drawCard`). If any of this is built, the hooks become the real
`RULES.tactics` and `scout` and the harness runs become `tests/policy.js` policies.
