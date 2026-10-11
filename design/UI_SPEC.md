# DROP2TOP interface spec (design round, 11 Oct 2026)

This is the agreed direction from the design sessions with Craig, written so the build session (D2T main) can pick it up. The clickable prototype lives in `design/prototype/` (run `python3 -m http.server` in that folder and open `index.html`) and is published, private to Craig, at https://claude.ai/artifact/PbYBJCFJvAifegsfawct1H. Craig's full brief for this round is in `design/BRIEF_2026-10-11.md`.

Where this spec and the current build differ, this spec is the newer decision. Where it says "proposal", Craig has not signed it off yet.

## 1. Look

- **Only the opening and the home screen are green; every other screen is black.** They use an FC-style green: a soft vertical gradient (`#12F06C` → `#5CF79F` → `#9DF4D8`), one broad light beam from top left, a thin line across, and a dark streak bottom right (reference: `design/reference/fc27_green.png`). Buttons on home are black with white text. Every other screen is pure black.
- **Logos:** long DROP2TOP on home (black on green). Inside the game, the short D2T logo, small and white, top left (tap = home). An account circle (person icon) top right on every screen except home.
- **Accent:** inside a run, the club's colour is the only accent (buttons, highlights, the player's row in tables). Lime `#D4FF00` is the D2T accent outside a run (for example the Spin button before a club is picked).
- **Type:** Exo 2 throughout, Black Italic for headlines and numbers.
- **No em dashes. British English. Not casino-like.** Audience 15 to 20.
- **Club theming in a run (agreed earlier):** black background, club accent, and a large faded club crest in real colours that fades out lower down.

## 2. Cards (v1, signed off)

- Shield shape: chamfered top corners, shallow point at the bottom, a bright metal rim. Shiny gradient face per level with a faint diagonal texture, a top-left highlight and a light sweep every few seconds (off with reduced motion).
- Levels: **Bronze** (under 65), **Silver** (65 to 74), **Gold** (75 and up), **Baller** (purple; a club's best player; renamed from "Purple"), **Legend** (rare all-time great seasons; pink, orange and yellow with a holo sheen). Baller and Legend glow.
- Small card (114px wide, 3 across a phone): rating, position and level down the left, club crest top right, first name, surname in capitals, and six stats in a 3 x 2 grid with **each label under its number** (GOL IMP FIT / WIN DEF EXP). Goalkeepers show WAL, CLN, FIT, WIN, EXP.
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

## 9. How the prototype behaves (built 11 Oct)

- **Intro:** short black D2T, emblem spins as it opens into DROP2TOP at 75% width, then the slogan types in (DROP and TOP reversed out), then the logo glides up into the green home. About 5 seconds, tap to skip, first launch only.
- **Into the game:** `D2T.toBlack()` (in `screens/home.js`): black spreads from the tapped button, the logo turns white with a green shimmer and lands as the small top-left logo of the next screen.
- **Spin engine (`screens/spin.js`, `D2T.roll`):** three masked reels, 5 recycled nodes each, cards addressed by index so the strip never loops. Speed up to 24 cards a second, vertical blur by SVG `feGaussianBlur` scaled to speed, decel curve landing exactly on the target, then a damped spring (one soft bounce). Lands at about 2.4s, 3.0s and 3.7s (the right reel teases longest). Each landing: scale pulse, light sweep, glow in the club colour. Measured 60fps in Chromium.
- **Card open (`core/flip.js`):** one full turn around the vertical axis with a D2T card back, 800ms open, 640ms close, horizontal blur during the fastest part of the turn.
- **Transfer roll:** the emblem spins and bursts into about 600 fragments to reveal the slots. Prototype odds: bronze 14, silver 34, gold 38, baller 11, legend about 4.
- **Table reveal:** a club-colour highlight runs down from 1st, slowing into your row, then a "New season" banner and every number counts down to 0.
- **Matches:** seeded Poisson from XI rating against opponent strength (from their real finish), 90 minutes in about 24 seconds, Skip to end gives the same result. Other clubs use their real results for gameweeks 1 to 3. A transfer roll comes after gameweek 3, 6, 9...
- **Prototype limits:** spins always land on the three clubs with full data (Wolves 2011/12, Norwich 2019/20, Southampton 2024/25); achievement numbers and friends are examples.

## 10. Open questions for Craig

1. Record counts cumulative (a title also counts as top 3, top half and beat the drop)?
2. Minimum runs (say 3) before a player is ranked in a friends league?
3. Slogan on every launch or first launch only (now first only)?
4. Create an account inside the same email then PIN flow, or a separate tab like Tenaball?
5. Show the real result after each match for comparison ("Wolves really won 2-1")?
6. Changing formation: suggest a new best XI (now) or keep your XI and move them, playing some out of position?
7. Should out-of-position players lower the team rating, and how hard should matches be?
8. Subs: whole squad in the carousel (now) or a bench of 7 plus reserves?
9. Table reveal timing (about 4s down to your row, 4s for the reset)?
10. Spin extras: reel tick and landing thud sounds, haptics, and an occasional "one card past and back" tease on the last reel?
