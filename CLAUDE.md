# DROP2TOP: notes for Claude Code

A mobile web football game. The page is built: edit `src/` and `data/`, then run `python3 scripts/build-data.py` (if data changed) and `python3 scripts/build.py`. Never edit `index.html` by hand. Bump `version.txt` for every change people will notice; Home Screen copies compare `version.txt` with `D2T_BUILD` and reload themselves (only on screens where nothing is lost).

## Rules set by Craig (keep these)

- Never use em dashes in any text in the game or docs. British English.
- Only use data that has been checked against a source. If it can't be verified, stop rather than guess.
- Classic is the main mode and stays front and centre with fixed rules and few settings. Dare2Dream sits under it on home: any club from any season, start with no players, pick a shape, draft 11 (one spin per shirt, keeper first, three players of that position, no respins), then the season with no pre-season rolls and 5 respins; beat their real finish or win the league again if they won it. Drafted players leave their real clubs like signings (raids dated before the season). Daily challenge (Craig, 11 Oct): one club a day for everyone, from the bottom 10 of any season (hash of the UK date, seed `daily-YYYY-MM-DD`); a real bottom-3 side plays Classic, anyone above the drop plays Dare2Dream; no respins; one go a day; numbered from Daily #1 on 11 Oct 2026. It has its own save slot (`state.dailyRun`, and a run in progress is parked in `state.parked`), results in `record.daily`, and doesn't count towards Classic or Dare2Dream records. Sharing is text for now; a friends leaderboard needs the server. Club X (Craig, 11 Oct): spin three seasons and pick one; Club X (`CLX`, green, Craig's badge `assets/brand/club_x.png`, cut from `club_x_original.png` and embedded as `window.D2T_CLUBX_BADGE`) takes that season's bottom club's place, drafts 11 the Dare2Dream way and must win the league; records in `record.xClubs` and `GAME.xRecord`, not Classic's. Other ideas are "coming soon".
- 433 Goals (Craig, 11 Oct; `screens/goals.js`, prototype `design/prototype/goals433.html`): fill a 4-3-3 keeper first; each spin shows three real players of that position (from its 220 top Premier League scorers with 60+ games, `g433` in the data) as shirts with the name, a ? where the number goes and the crest printed below; pick one and his career Premier League goals burst onto his pitch shirt (crest on a white disc, no circle ever round a ?). Get the XI's total to exactly 433; 3 respins a game. Orange `#FF7A1A` is its colour, night stadium pitch, straight names. Own save (`state.g433`) and record (`record.g433`), apart from Classic and Dare2Dream. Kit patterns and second colours are design choices.
- Design: pure black background, the club's colour as the only accent inside a run and the D2T green `#12F06C` everywhere else (no lime), a large faded crest in real colours that fades out lower down, Exo 2 (Black Italic for headlines and numbers). Long logo on home, short D2T logo in games. Not casino-like. Audience 15 to 20 year olds.
- The outline emblem (`emblem_line.png`) is Craig's line drawing (11 Oct): full ring, both arrows, no half moon. On home, the emblem turns once and a green glint runs across the long logo every 12 seconds (not with reduced motion).
- The opening animation plays on every fresh load: green, the logo opens out, then it glides to the top as the green gives way to black and the logo turns white, landing on the black home.
- Backgrounds must blend into the browser and phone chrome at the top and bottom (Dynamic Island and status bar, Safari's and Chrome's toolbars) on iOS and Android, always. Every screen declares its top and bottom colours (from its theme, or `chrome: [top, bottom]` on the screen) and `D2T.chrome` keeps `theme-color`, the fixed top and bottom strips and the page background in step. Check it whenever a screen or colour changes.
- Secondary pages (how to play, league, stats, account) have a back arrow (`D2T.topbar({ back: true })`).
- No human voices in the audio: whistles, crowd and game sounds only.
- Every slide-up panel (sheet) must be dismissable by dragging it down by its top bar or title row, or by tapping the bar (`dragToClose` in `openSheet`). Never build a sheet that only closes with its X.
- The game rules live in the DROP2TOP Game Rules doc (claude.ai/code/artifact/ce64d453-8b55-490a-96e9-f5cb3f0d2cc7).

## How the game works (src/engine.js)

- Pure and deterministic: every random draw comes from `stream(seed, purpose, step)`, so the same seed and choices replay identically. No clock, DOM or storage in the engine.
- A run: club roll (3 relegated club-seasons, respins cost one of 5) → formation and XI from the real squad (the rest is forgotten) → 17 rolls: 3 pre-season, 1 every 3 games, 3 before the club's first January match, then 1 every 3 games (`schedule`).
- Each roll is three cards from the same season (10+ league games, never your own squad, never a player seen before in the run). Levels (Craig, 11 Oct): bronze under 70, silver 70 to 79, gold 80+, purple = the season's top 5 players league-wide, legend = the top 3 players of every season (102 cards, rarer than purple; ids `L:<name>:<season>`, older saved runs' `L:<name>` resolve to his best legend card). Odds in `RULES.levelOdds`, balanced with `node tests/calibrate-all.js`.
- January movers: one card with both clubs, in the order he played for them; `m2` is his first game for the second club (from the match line-ups, `data/source/moves.json`). The card shows your club if he is in your squad, otherwise the club he was at on the current match date (`E.clubAt`), and signing him raids that club.
- Positions: the data has GK, DEF, MID and FWD only, so fit is judged on the broad position (green same, amber neighbour at 90%, red at 70%). Slots keep detailed labels for when detailed positions arrive.
- Matches: Poisson goals from attack v defence and midfield gaps, fitted to every real result (`tests/fit-match.js`, `RULES.match`). Opponents use their real squad's best XI minus anyone you've signed.
- Raids: signing a player lowers his club's strength from that date; each of its later real wins or draws can be downgraded with chance 3 x the strength lost (`otherResults`). Everyone else's results stay as history.
- Table: other clubs' matches count on their real dates; your 38 are simulated.

## Interface (src/app)

- Built from the design prototype (`design/prototype`, spec in `design/UI_SPEC.md`). `core/app.js` is the shell: `D2T.screen(name, def)`, hash routes, `D2T.state` saved as `d2t-v2`, `D2T.sheet`, `D2T.topbar`, logos as masks. `core/game.js` (`D2T.game`) is the only bridge to the engine and data: screens never call `D2TE` directly. `core/season.js` holds the in-run helpers, `core/boot.js` starts sound and the router.
- Screens: intro (green, then to black), home (black), then the small white D2T logo and the account circle: howto, account, league, stats, spin (club roll), table (historic reveal), squad (pitch, formations, drag to swap), transfer (the roll, then the pitch above a tray of the three cards), fixtures, match, summary.
- In-run screens only open when the run has reached them (`GAME.allowed`, `GAME.stepFor`); spins and the table reveal never replay (`run.spun`, `run.tableSeen`). Matches are decided in the engine before the animation, so a refresh can't change a result.
- Squad: the whole real squad is on the bench before the season and a formation change picks a new best XI; once the season starts only the XI is left. In Dare2Dream the squad screen first shows empty shirts (pick the shape, then Start the draft); the draft runs on the transfer screen (`GAME.inDraft`, `GAME.draftInfo`, `GAME.draftPick`; engine `draftPick`, `draftSlot`, `draftFormation`).
- Transfer: when the three cards land they drop into a tray and the pitch appears above; drag a card onto a shirt (or tap it, then the shirt) to sign him there (`GAME.signAt`). The best shirt for the selected card pulses. Tap the selected card again for the big card with his Premier League career (games, goals, seasons, clubs from `careers` in the data). Respin lifts the cards back to the middle first; the main button is Pass.
- Team rating is the average of the 11 effective ratings (each cut to 90% or 70% when out of position).
- Long surnames shrink to fit the card (`fitName` in `core/cards.js`), never an ellipsis unless at 55%.
- Accounts: optional sign-in with the same email and 4-digit PIN accounts as Tenaball, on Tenaball's server (`tenaball.crw84.workers.dev`, which allows 404craig.github.io). Runs and records stay on the phone for now.
- Achievements are cumulative (a title also counts as top 3, top half and beating the drop) and count Classic runs only. Dare2Dream runs are recorded apart (`mode` on each run, `record.dreamClubs`, `GAME.dreamRecord`). The real result is never shown after a match.
- Phone rules from Tenaball: tap targets 44px or more; safe-area padding; solid status bar strip (`.screen::before`); sound starts on the first tap; reduced motion respected; share image built ahead so Share opens at once; sheets drag closed.
- Build order of CSS and JS is the list at the top of `scripts/build.py`; add new screens there.

## Data

- `data/source/pl_results.csv` and `pl_players.csv` come from Tenaball (two sources each, see the READMEs there).
- Ratings: `data/ratings/rated_fit_*.json` from the D2T player data work, every season 1992/93 to 2025/26 (method in `docs/cards/RATINGS_TEST.md`, built by `tools/rate_v5.py` and `tools/fit_panel.py` on the player data branch). The fallback model in `build-data.py` only applies if a season's file is missing (`src: "f"`, shown as provisional).
- Club accents in `data/source/clubs.json` (`accent`, `ink`, `text`); every `text` passes 4.5:1 on black.
- Crests are trademarks: fine for the family version, replace before any public release.

## Tests

`node tests/engine.test.js`, `node tests/ui.test.js` (needs Playwright's Chromium), `node tests/calibrate.js <season> <club> <runs>` for one club, `node tests/calibrate-all.js [runs per club]` for balance across every relegated club-season.
