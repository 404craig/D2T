# DROP2TOP interface spec (design round, 11 Oct 2026)

This is the agreed direction from the design sessions with Craig, written so the build session (D2T main) can pick it up. The clickable prototype lives in `design/prototype/` (run `python3 -m http.server` in that folder and open `index.html`) and is published, private to Craig, at https://claude.ai/artifact/PbYBJCFJvAifegsfawct1H. Craig's full brief for this round is in `design/BRIEF_2026-10-11.md`.

Where this spec and the current build differ, this spec is the newer decision. Where it says "proposal", Craig has not signed it off yet.

## 1. Look

- **Only the opening is green; home and every other screen are black (changed 11 Oct, see section 10).** They use an FC-style green: a soft vertical gradient (`#12F06C` → `#5CF79F` → `#9DF4D8`), one broad light beam from top left, a thin line across, and a dark streak bottom right (reference: `design/reference/fc27_green.png`). Buttons on home are black with white text. Every other screen is pure black.
- **Logos:** long DROP2TOP on home (black on green). Inside the game, the short D2T logo, small and white, top left (tap = home). An account circle (person icon) top right on every screen except home.
- **Accent:** inside a run, the club's colour is the only accent (buttons, highlights, the player's row in tables). Lime `#D4FF00` is the D2T accent outside a run (for example the Spin button before a club is picked).
- **Type:** Exo 2 throughout, Black Italic for headlines and numbers.
- **No em dashes. British English. Not casino-like.** Audience 15 to 20.
- **Club theming in a run (agreed earlier):** black background, club accent, and a large faded club crest in real colours that fades out lower down.

## 2. Cards (v1, signed off)

- Shield shape: chamfered top corners, shallow point at the bottom, a bright metal rim. **Corners softened (Variant A, chosen 11 Oct):** every corner of the outline is rounded slightly, radius 2.5 on the four chamfer corners, 3 on the bottom shoulders and 4 on the bottom point, in a 114 x 190 card box (scale with the card). The prototype draws the outline as an SVG mask (`.d2c-rim` and `.d2c-face` in `design/prototype/core/base.css`); the comparison page is `design/prototype/rounded-cards.html`. Shiny gradient face per level with a faint diagonal texture, a top-left highlight and a light sweep every few seconds (off with reduced motion).
- Levels: **Bronze** (under 65), **Silver** (65 to 74), **Gold** (75 and up), **Baller** (purple; a club's best player; renamed from "Purple"), **Legend** (rare all-time great seasons; pink, orange and yellow with a holo sheen). Baller and Legend glow.
- Small card (114px wide, 3 across a phone): rating, position and level down the left, club crest top right, first name, surname in capitals, and six stats in a 3 x 2 grid with **each label under its number** (GOL IMP FIT / WIN DEF EXP). Goalkeepers show WAL, CLN, FIT, WIN, EXP.
- **Pitch cards (option C, chosen 11 Oct; pitch only):** the position is a coloured tab on top of the card (keeper amber `#FFB020`, defence blue `#3BA4FF`, midfield green `#12F06C`, attack red `#FF4D5A`), a big rating beside the crest, and the full name on two lines (first name, then surname in capitals), shrunk to fit. 1.3 tall with the softened corners. The small and big cards elsewhere keep their own layout. Comparison page: `design/prototype/pitch-cards.html`.
- Club card: same shape, face runs from the club colour at the top to near-black at the bottom; crest, club name, season chip, "Real finish 20th · 25 pts".
- Big card: the same card at about 280px with details under it.
- **Open animation:** tapping a selected card spins it horizontally (around the vertical axis) as it grows from its slot to the big card front and centre; tapping again reverses it into the slot.
- Card CSS and renderers: `design/prototype/core/base.css` (`.d2c…`) and `core/cards.js`. Everything scales from one `--w` variable.

## 3. Screens and flow

| Route | Screen | Key points |
|---|---|---|
| `intro` | Opening | Green. Short D2T logo in black, large and centred. Emblem spins 360° as D2T opens into DROP2TOP (like the supplied logo animation) at about 75% width. Optional slogan beat (below). Logo moves up and shrinks into the home layout. Tap to skip. |
| `home` | Home | Green, black buttons. "Pick a new club" / "Dare to dream. Win the title!". If a run is saved: Continue (shows the club, season and where you are). Quick stats: beat the drop, top half, top 3, titles (framed with the outline of the card shape). Coming soon modes (not bubbles). Bottom bar from Tenaball: League, Stats, How to play, Account. |
| (transition) | Into the game | Leaving home: green gives way to black and the logo turns white while the green glistens and ripples through it, landing as the small white logo top left. |
| `spin` | Pick a club | Three empty slots side by side in the centre (card outline, a question mark and scrambled text, or a blurred badge). Bottom: coloured Spin button with the emblem; left circle = respin (line-drawn emblem, 5 respins), right circle = home. Spin = fast vertical reels with motion blur cycling through real relegated club cards, settling left, then middle, then right. Tap a card to select (it grows 5%, the others shrink a touch); the main button becomes Play. Tap the selected card again for the big card (spin open); tap again to close. |
| `table` | Your club and the history | The real final table, revealed in reverse of Tenaball's reveal: from 1st down to where your club finished, slowing near the end. Then every club's points and stats reset to zero. Continue. |
| `squad` | Squad and tactics | Pitch with mini cards in a suggested XI and the team rating. "Change formation" opens a slide-up with formations 3 across as small pitch cards with dot icons. Subs in a horizontal carousel above the bottom bar. Tap to select, tap again for the big card; tap a pitch player to swap; drag a sub onto the pitch to replace. The bottom bar shows the next fixture and Play. |
| `fixtures` | Gameweek | Every fixture of the gameweek, yours highlighted. Play match. |
| `match` | Match | Kick off; the button becomes Skip to end at once. Final score, then the league table. Continue goes to the next gameweek, or to a transfer roll when one is due. |
| `transfer` | Transfer roll | The emblem spins 360° and bursts outward to reveal three empty slots, then the same reel spin with player cards. Select, open, Sign or Pass. |
| `howto` | How to play | A one or two line objective, the rules in a few steps, the five card levels with real examples, and what each stat means. |
| `account` | Account | Sign in with email and a 4-digit PIN (as Tenaball). Signed in: name, email, runs, achievements, sign out, delete data. |
| `league` | Friends league | Friends in one table with the four achievement counts and a percentage rating to rank them (proposal below). Add friend by code or link. |
| `stats` | My stats | Achievements, runs, best finish, clubs played. |

**Slogan idea (Craig):** "DO YOU HAVE WHAT IT TAKES TO TAKE A TEAM FROM THE DROP TO THE TOP?" in black, with DROP and TOP reversed out on a black block, typed on left to right. The prototype puts it on the green intro, between the logo and home. Placement still open.

## 4. One URL or separate URLs

**Recommendation: separate routes, one app.** Keep a single-page app (one HTML file, no reloads between screens) but give every screen its own address:

- The phone's back gesture and button work as expected.
- Refreshing or reopening the Home Screen app lands on the same screen, so a run resumes where you left it.
- Links can point straight at a screen: a friends league invite, the account page, How to play, a shared result.
- Analytics and bug reports can say which screen something happened on.

How:

- Use hash routes (`#/home`, `#/play/spin`, `#/play/squad`, `#/league/ABC123`) so GitHub Pages never returns a 404 and the Home Screen app needs no server rewrites.
- The run itself stays in local storage (`d2t-run-v1`). The URL only says which screen to show.
- Guard the in-run routes: if the address asks for a step the saved run has not reached (or there is no run), redirect to the run's current step (or home). This stops people skipping ahead with the back button or a typed URL.
- One-time moments (spins, the table reveal) should not replay on back or refresh: record in the run that they have played, and show the settled state instead.

The prototype uses bare tokens (`#home`, `#spin`) because claude.ai artifact links only pass simple anchors; the real build can use the `#/path` form.

## 5. Proposals waiting for Craig

- **League rating:** each run scores its best finish (beat the drop 1, top half 2, top 3 3, title 5); the rating is the average out of 5 as a percentage. Counts are cumulative (a title also counts as top 3, top half and beat the drop), so rating = (drop + half + top3 + 2 x titles) / (runs x 5) x 100.
- **Coming soon modes listed:** Daily challenge, Head to head (online, up to 3), Draft, Legends. Names only; no rules promised.

## 6. Multiplayer (later, captured from Craig)

- Up to 3 players in Classic (maybe more in other modes). An admin hosts the room.
- Either each player is given a team from the same season, or everyone spins and claims a team: all three see the same three clubs at the same moment, first come first served.
- The game waits for every player to continue at each screen ("Waiting for Sam…").
- User teams are highlighted in fixtures and the table.
- Transfer rolls must never offer two users the same player, or a player from another user's squad. Option: draw 9 cards from the eligible pool per roll and deal 3 to each player (each sees a different three), rotating who gets first pick of the strongest set.
- Tenaball already runs accounts (email + PIN), leagues and online rooms on a Cloudflare Worker with Durable Objects (`Accounts`, `Room`). D2T can reuse that server pattern.

## 7. Game mechanics: making bronze and silver worth signing (proposal)

Today a bronze or silver card is rarely wanted. Options, best first:

1. **Squad budget.** Each card costs points by level (bronze 1, silver 2, gold 4, baller 6, legend 8) under a squad cap. A strong XI needs cheap cards somewhere, so bronze fills become decisions, not dead rolls.
2. **Fatigue and rotation.** FIT drives how often a player can start in a row. Stars need rest, so depth matters across 38 games.
3. **Respin refund.** Signing a bronze (or passing) gives back a respin; signing a silver gives half. Bronze becomes a way to bank luck for later.
4. **Position fit beats raw rating.** Already in the build (amber 90%, red 70%): show it clearly on the card so a bronze in the right slot can beat a gold out of position.
5. **Club and nation links.** Small team boosts for players from the same club or country, which bronzes often complete.
6. **Mode-specific value.** A "Budget" or "Underdog" mode where only bronze and silver can be signed, and the Daily challenge with a level cap.

## 8. Files

- `design/prototype/`: the clickable prototype (router, shared card system, screens). See `design/prototype/CONTRACT.md`.
- `design/BRIEF_2026-10-11.md`: Craig's brief for this round, verbatim.
- `design/reference/`: the FC27 green reference image (EA key art, reference only), the logo animation video and its frames.
- Design canvases (claude.ai, private to Craig): Cards https://claude.ai/artifact/CSgEHPpQSqtkG5PxwfPkvz, Club Themes https://claude.ai/artifact/DjFu7XBFz65kq5S7Aivdmy.

## 8b. Home (build 14, chosen 11 Oct)

- Order: logo, Classic (Pick a new club), Continue, Your record, Other modes (Dare2Dream card, then the coming soon row).
- Continue is the club sweep: light club colour at the left, the true colour across the middle, a deeper shade at the right, with a metal rim, faint diagonal texture and the light sweep. Text and the arrow turn dark on light club colours. Options page: `design/prototype/continue-options.html` (idea 1).
- Bottom bar icons are solid and slanted like the Black Italic type, all white, with one-line uppercase italic labels. Options page: `design/prototype/home-options.html`.

## 8b2. Classic button (build 16, chosen 11 Oct)

- "Shuffle": three real relegated club cards (random from the pool each visit) fanned on the right, running off the edge; the title, line and a green "Spin for a club" pill on the left.
- Every 10 to 15 seconds (random) the back card slides round to the front; the card that ends up at the back is swapped for another club while it is behind, so new clubs keep appearing. The swap is a 0.9s cross-fade, never a snap (build 18). The three cards always show clearly different club colours (accents at least 110 apart in RGB). Paused when the page is hidden; off with reduced motion. Options page: `design/prototype/fan-options.html` (alt 1).
- Still open: how the other mode blocks open (`design/prototype/home-full.html`, options X, Y, Z).

## 8c. Squad screen (build 15, chosen 11 Oct)

- Compact layout: header, pitch, subs and the bottom bar fit one screen with no scrolling, down to about 640px tall (Safari with its toolbars on a current iPhone is about 700).
- One-line header (crest, club, season, team rating). The pitch flexes to the space left (300 to 470px tall). Formation is a chip on the bottom-left corner of the pitch.
- Subs are a swipeable strip of pitch-style cards (60px). Pitch cards are 50px.
- No glows on squad or pitch cards. Selected: the card lifts, its position tab turns white and a white marker sits under it. Targets scale up with an outline. Options page: `design/prototype/squad-fit.html` (option A).

## 8d. 433 Goals shirts (prototype, chosen 11 Oct)

- Mode colour orange `#FF7A1A`. Tally is the progress bar: orange fills to the white 433 line; past 433 it bursts on the line, re-scales so 433 fits and the extra runs on in grey stripes. Endings: so close (within 25), exactly 433 (gold bar, shirt wave, confetti, giant 433), blown past (grey "+N" stamp), a long way short (calm "N short").
- Big spinning shirts: surname across the shoulders, a ? where the number goes, the club crest printed full colour under it (line-drawn crests on a light patch), slight sheen and a light sweep as each lands. The ? bursts into his goals when he lands on the pitch.
- Pitch shirts (56px): crest on a light disc at the collar, goals always at the three-figure size. Keeper wears the short-sleeved club shirt.
- Kits: club stripes, hoops, halves and sleeves, darker outlines instead of white on most (patterns and second colours are design choices, not from a checked source).
- Options page: `design/prototype/goals433.html`. Still open: pitch style, reveal style, curved or straight names, and the rules.

## 9. How the prototype behaves (built 11 Oct)

- **Intro:** short black D2T, emblem spins as it opens into DROP2TOP at 75% width, then the slogan types in (DROP and TOP reversed out), then the logo glides up into the green home. About 5 seconds, tap to skip, first launch only.
- **Into the game:** `D2T.toBlack()` (in `screens/home.js`): black spreads from the tapped button, the logo turns white with a green shimmer and lands as the small top-left logo of the next screen.
- **Spin engine (`screens/spin.js`, `D2T.roll`):** three masked reels, 5 recycled nodes each, cards addressed by index so the strip never loops. Speed up to 24 cards a second, vertical blur by SVG `feGaussianBlur` scaled to speed, decel curve landing exactly on the target, then a damped spring (one soft bounce). Lands at about 2.4s, 3.0s and 3.7s (the right reel teases longest). Each landing: scale pulse, light sweep, glow in the club colour. Measured 60fps in Chromium.
- **Card open (`core/flip.js`):** one full turn around the vertical axis with a D2T card back, 800ms open, 640ms close, horizontal blur during the fastest part of the turn.
- **Transfer roll:** the emblem spins and bursts into about 600 fragments to reveal the slots. Prototype odds: bronze 14, silver 34, gold 38, baller 11, legend about 4.
- **Table reveal:** a club-colour highlight runs down from 1st, slowing into your row, then a "New season" banner and every number counts down to 0.
- **Matches:** seeded Poisson from XI rating against opponent strength (from their real finish), 90 minutes in about 24 seconds, Skip to end gives the same result. Other clubs use their real results for gameweeks 1 to 3. A transfer roll comes after gameweek 3, 6, 9...
- **Prototype limits:** spins always land on the three clubs with full data (Wolves 2011/12, Norwich 2019/20, Southampton 2024/25); achievement numbers and friends are examples.

## 10. Decisions and open questions

Decided by Craig (11 Oct):
- Record counts are cumulative: a title also counts as top 3, top half and beat the drop.
- No minimum number of runs before a player is ranked in a friends league.
- Do not show the real result after a match.
- Changing formation suggests a new best XI, and can bring in squad players at the start of the game if needed.
- Spin sounds (reel tick, landing thud): yes, but game sounds are a later pass.
- The squad is only available at the start of the season: the whole real squad sits in the carousel before GW1, then only your XI is left and new faces come through transfer rolls (each takes a shirt from the XI).

Decided by Craig (11 Oct, after build 3):
- The opening animation plays on every fresh load. It ends by turning black as the logo glides to the top and turns white; home is black. Only the intro is green.
- The new green `#12F06C` replaces lime as the game's colour everywhere outside a run.
- Backgrounds blend into the phone and browser chrome at the top and bottom on iOS and Android, always.
- Secondary pages get a back arrow. Account sign-in is live with the Tenaball email and PIN; stats are not on the account page.
- Transfer: the picked card grows and the others darken; tapping it again enlarges it to the centre with his Premier League career rather than repeating the card's stats. After the spin the cards drop and the pitch appears; drag a card onto a shirt to sign. Respin lifts the cards back to the middle first.
- Pitch cards are shorter and the +/- rating chips are gone. Long names shrink to fit. The respin button is a refresh icon.

Still open:
1. Slogan on every launch or first launch only (now first only)?
2. Create an account inside the same email then PIN flow, or a separate tab like Tenaball?
3. Should out-of-position players lower the team rating, and how hard should matches be?
4. Table reveal timing (about 4s down to your row, 4s for the reset)?
5. Haptics and an occasional "one card past and back" tease on the last reel?
