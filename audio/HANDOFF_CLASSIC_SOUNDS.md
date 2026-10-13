# Classic sounds: hand-over to the main session (13 Oct 2026)

Craig chose every Classic sound on the sound kit (claude.ai/artifact/5K8i5k3cEhWwVX1pDNbr4P), commented, and approved going live. The full list of picks and what changed is in `audio/CLASSIC_SOUND_PICKS.md`.

## Craig's rules for game sound (worth adding to CLAUDE.md)

- Soft, subtle and quiet. No glass or tin: no bells, chimes, pings or metal clinks. Ticks are muffled taps.
- Small actions (back, tabs, sheets, tips, picking a card, shirt hover, a card floating back) are muted: their own low-passed channel, capped below the volume setting.
- Still no human voices.

## What this branch changes (sources only; index.html is left at main's build 73, so rebuild and bump)

- `src/sound.js`: rewritten. Same API (`play`, `crowd`, `setMuted`, `isMuted`, `unlock`, `clipsLoaded`) plus `play(id, arg, at)`, `tick(reel, speed)` and `tease(landsIn)`. Old cue names still work (`roll3`, `lockin`, `pick`, `reveal`, `subIn`, `subOut`, `buzzer`, `climb`).
- `audio/game/`: the 20 clips the picks use, all softened (top end cut, transients rounded, levels down 6 to 9 dB). Seven unused clips removed. About 0.9 MB, smaller than before.
- Wiring (one guarded line each, `window.D2TSound && ...`):
  - `core/boot.js`: soft felt press on big buttons (`.sp-main`, `.se-btn`, `.btn`, home game cards), muted tap on small ones (top bar, tab bar, round buttons, sheet buttons, ghost buttons).
  - `core/app.js`: sheet open and close, first-time tip.
  - `core/flip.js`: big card open and close.
  - `screens/intro.js`: logo open-up (only heard if sound is already awake).
  - `screens/spin.js` (the shared roll engine): a muffled tap per card passing each reel (`SND.tick`), reel landing (`cfg.landSound` or `reelLand`), card pick, respin, and a soft build-up before a Baller or Legend (`cfg.bigIndex` + `SND.tease`). Club X's card settling uses `cardDrop` instead of a second `lockin`.
  - `screens/transfer.js`: window opens (emblem burst), landing by card level (`rarity` 0 bronze to 4 legend), build-up for Baller/Legend, tray drop, shirt fit while dragging, sign (by level), the replaced player leaving, drop back, pass.
  - `screens/squad.js`: cards dealing onto the pitch, shirt fit while dragging, drop and swap, drop back, formation change.
  - `screens/table.js`: a tap per row on the scan, the landing on your club, the reset to zero.
  - `screens/fixtures.js`, `screens/match.js`: fixtures, skip to end, final score (win, draw, loss), table moving (up, down, same). Kick off, goals, half time and full time already called the right cues.
  - `screens/summary.js`: season verdict now `champions`, `top3`, `tophalf`, `survived` or `relegated`; Share plays a soft send.

## Checked

`node tests/engine.test.js` (15 checks) and `node tests/ui.test.js` (every mode) pass with this branch built. In the built page all 20 clips decode and every cue plays with no console errors.

## What to look for

- Sound is quieter overall and nothing rings or clinks. Reels tick softly; a Legend landing gets a soft swell before it and a warm chord with quiet applause.
- Cues ready for later, not wired yet (no matching animation in the game): `finishCount`, `riseCount`, `achievement` (tiers 0 to 3), `denied`.

## Second pass: the other games (13 Oct, Craig: same soft sounds everywhere, nothing loud, some things silent)

- New shared cues in `src/sound.js`: `land`, `numberTick`, `correct`, `close`, `over`, `perfect`, `newBest`, all in the same soft family.
- Goal Rush (`screens/goals.js`): reel landing and the total landing are a soft felt `land`; placing a player is `cardDrop` (was a cheer); the number roll and the formation reveal tick quietly every third step (was the button press every second); exactly on target is `perfect` (was the full champions fanfare, flares and horns); so close is two soft falling tones (was groan and boos); blown past is a soft thud (`over`).
- Unbeaten Run (`screens/unbeaten.js`): a refresh is `respin`; the stat landing is `land`; a right answer is `correct` (was a cheer every time); wrong is `over`; a new best is `newBest` (was the champions fanfare); the next card spins in silently.
- `CLAUDE.md`: three new rules under Craig's rules (soft sound, don't overload, reuse the cues for new modes).
- Checked again: engine.test (15) and ui.test (every mode, Goal Rush and Unbeaten Run included) pass; the new cues play with no console errors.
