# DROP2TOP: notes for Claude Code

A mobile web football game. The page is built: edit `src/` and `data/`, then run `python3 scripts/build-data.py` (if data changed) and `python3 scripts/build.py`. Never edit `index.html` by hand. Bump `version.txt` for every change people will notice; Home Screen copies compare `version.txt` with `D2T_BUILD` and reload themselves (only on screens where nothing is lost).

## Rules set by Craig (keep these)

- Never use em dashes in any text in the game or docs. British English.
- Only use data that has been checked against a source. If it can't be verified, stop rather than guess.
- Classic is the main mode and stays front and centre with fixed rules and few settings. Other ideas are "coming soon".
- Design: pure black background, the club's colour as the only accent inside a run (lime `#D4FF00` on home), a large faded crest in real colours that fades out lower down, Exo 2 (Black Italic for headlines and numbers). Long logo on home, short D2T logo in games. Not casino-like. Audience 15 to 20 year olds.
- No human voices in the audio: whistles, crowd and game sounds only.
- Every slide-up panel (sheet) must be dismissable by dragging it down by its top bar or title row, or by tapping the bar (`dragToClose` in `openSheet`). Never build a sheet that only closes with its X.
- The game rules live in the DROP2TOP Game Rules doc (claude.ai/code/artifact/ce64d453-8b55-490a-96e9-f5cb3f0d2cc7).

## How the game works (src/engine.js)

- Pure and deterministic: every random draw comes from `stream(seed, purpose, step)`, so the same seed and choices replay identically. No clock, DOM or storage in the engine.
- A run: club roll (3 relegated club-seasons, respins cost one of 5) → formation and XI from the real squad (the rest is forgotten) → 17 rolls: 3 pre-season, 1 every 3 games, 3 before the club's first January match, then 1 every 3 games (`schedule`).
- Each roll is three cards from the same season (10+ league games, never your own squad, never a player seen before in the run). Levels: bronze, silver, gold, best (one per club, purple), legend (the rated data's best seasons, rare). Odds in `RULES.levelOdds`.
- Positions: the data has GK, DEF, MID and FWD only, so fit is judged on the broad position (green same, amber neighbour at 90%, red at 70%). Slots keep detailed labels for when detailed positions arrive.
- Matches: Poisson goals from attack v defence and midfield gaps, fitted to every real result (`tests/fit-match.js`, `RULES.match`). Opponents use their real squad's best XI minus anyone you've signed.
- Raids: signing a player lowers his club's strength from that date; each of its later real wins or draws can be downgraded with chance 3 x the strength lost (`otherResults`). Everyone else's results stay as history.
- Table: other clubs' matches count on their real dates; your 38 are simulated.

## Interface (src/app)

- Built from the design prototype (`design/prototype`, spec in `design/UI_SPEC.md`). `core/app.js` is the shell: `D2T.screen(name, def)`, hash routes, `D2T.state` saved as `d2t-v2`, `D2T.sheet`, `D2T.topbar`, logos as masks. `core/game.js` (`D2T.game`) is the only bridge to the engine and data: screens never call `D2TE` directly. `core/season.js` holds the in-run helpers, `core/boot.js` starts sound and the router.
- Screens: intro and home (green), then black with the small white D2T logo and the account circle: howto, account, league, stats, spin (club roll), table (historic reveal), squad (pitch, formations, drag to swap, placing a signing), transfer (the roll), fixtures, match, summary.
- In-run screens only open when the run has reached them (`GAME.allowed`, `GAME.stepFor`); spins and the table reveal never replay (`run.spun`, `run.tableSeen`). Matches are decided in the engine before the animation, so a refresh can't change a result.
- Squad: the whole real squad is on the bench before the season and a formation change picks a new best XI; once the season starts only the XI is left. A signing is held (`run.pending`) until you tap the shirt it takes; the best spot pulses.
- Achievements are cumulative (a title also counts as top 3, top half and beating the drop). The real result is never shown after a match.
- Phone rules from Tenaball: tap targets 44px or more; safe-area padding; solid status bar strip (`.screen::before`); sound starts on the first tap; reduced motion respected; share image built ahead so Share opens at once; sheets drag closed.
- Build order of CSS and JS is the list at the top of `scripts/build.py`; add new screens there.

## Data

- `data/source/pl_results.csv` and `pl_players.csv` come from Tenaball (two sources each, see the READMEs there).
- Ratings: `data/ratings/rated_fit_*.json` from the D2T player data work (provisional copies for 9 seasons). Seasons without one use a fallback model scaled to the same spread, marked `src: "f"` and shown as provisional on the card.
- Club accents in `data/source/clubs.json` (`accent`, `ink`, `text`); every `text` passes 4.5:1 on black.
- Crests are trademarks: fine for the family version, replace before any public release.

## Tests

`node tests/engine.test.js`, `node tests/ui.test.js` (needs Playwright's Chromium), `node tests/calibrate.js <season> <club> <runs>` for balance.
