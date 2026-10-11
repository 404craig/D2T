# D2T prototype: how the pieces fit

A clickable phone prototype of the new DROP2TOP flow. Plain HTML, CSS and JS, no build step, no libraries. It is published as a claude.ai artifact (the page skeleton is added at publish time, so `index.html` has no doctype/html/head/body of its own) and is also kept in the repo under `design/prototype/`.

Brief: `design/BRIEF_2026-10-11.md` (Craig's words, verbatim). Read it before you start.

## Run and check it

```
cd design/prototype && python3 -m http.server 8765
```
Screenshot helper (Playwright is preinstalled globally):
```
NODE_PATH=/opt/node22/lib/node_modules node /tmp/claude-0/-home-user-D2T/ad6638f7-f130-5315-b6c0-41ab20389daf/scratchpad/shot.js <route> <out.png> <waitMs> "<optional JS to run first>"
```
It prints page errors. Check at 390 x 844. For animations, take several screenshots at different wait times, or write your own short Playwright script that captures frames.

## Shared core (do not rewrite; small additive fixes are fine, say what you changed)

- `core/base.css`: tokens, green and black themes, `.topbar`, `.btn`, `.icon-btn`, `.actionbar`, sheets, and every card style (`.d2c…`).
- `core/app.js`: `D2T.screen(name, {title, theme:'green'|'black', mount(root, params), unmount()})`, `D2T.go(name, params)`, `D2T.state` + `D2T.save()` (localStorage, try/catch), `D2T.run()` (current run data), `D2T.h(html)`, `D2T.wait(ms)`, `D2T.reduced()`, `D2T.logo(kind, opts)` (mask logos: emblem, emblemLine, short, long, shortText, longText; colour = CSS `color`, or set `background` for animated fills), `D2T.greenBackdrop()`, `D2T.topbar()` (white short logo left, account circle right), `D2T.sheet({title, body, onClose})` (slide-up, drag-to-close), `D2T.ICON`.
- `core/cards.js`: `D2T.cards.player(card, {w, mini, glow, delay, cls, shine})`, `D2T.cards.club(clubSeason, {w, foot, footLabel, glow, cls})`, `D2T.cards.placeholder({w, variant:'question'|'fuzzy', crest})`, `D2T.cards.scramble(n)`, `D2T.cards.openLarge(fromEl, html, {onClose})` (the spin agent replaces this in `core/flip.js`), `D2T.LV` (level paints), `D2T.ordinal(n)`.
- Card sizes: small 114px wide (3 across a 390 screen), mini on the pitch about 56 to 62px, large about 264 to 300px. Height is always width x 1.667. Everything inside scales with `--w`.
- `data/data.js` → `D2T.data`: `clubs` (accent, ink, text, crest per club), `relegatedPool` (103 real relegated club-seasons with pos, pts, W/D/L, GF/GA), `demoClubs`, `runs['Wolves 2011/12' | 'Norwich 2019/20' | 'Southampton 2024/25']` each with `club`, `season`, `table` (real final table, 20 rows), `squad` (rated cards), `transferPool` (top 160 other players that season, rated cards), `fixtures` (38, with real scores as `realFor/realAgainst`), `gwFixtures[1..3]` (every match of that gameweek), and `sampleLegend`.
- Levels: bronze, silver, gold, baller (purple, was "purple"), legend.

## Routes (bare hash tokens)

`intro` → `home` → `spin` (pick a club) → `table` (historic table reveal, reset to zero) → `squad` (pitch, formation sheet, subs carousel) → `fixtures` (gameweek fixtures) → `match` (kick off / skip to end, final score, then league table) → back to `squad` / `fixtures` each gameweek → `transfer` (logo spin intro, then the 3-card player spin) when a transfer roll is due. Side routes: `howto`, `account`, `league`, `stats`.

Run state lives in `D2T.state.run = { key, step, gw, formation, xi:[names], subs:[names], signed:[names] }`. Home shows Continue when `D2T.state.run` exists.

## Design rules (from Craig, keep them)

- No em dashes anywhere. British English. Exo 2, Black Italic for headlines and numbers.
- Home is the only green screen, with black buttons. Every other screen is pure black with the small white D2T logo top left and the account circle top right.
- Inside a run the club's colour is the accent (buttons, highlights). Lime `#D4FF00` is the D2T accent outside a run.
- Only verified data. Use `D2T.data`; never invent football facts. Example user numbers (achievements, friends) must be labelled as examples in a small note.
- Not casino-like: no coins, flashing lights, jackpot sounds or slot-machine chrome. The spin is a premium card reveal (think EA FC pack opening), fast and physical.
- Respect `prefers-reduced-motion` (skip or shorten animations, keep the result).
- Tap targets 44px or more. Every sheet closes by dragging its bar down or tapping it.
- 60fps: animate only `transform`, `opacity` and `filter`; avoid layout thrash.

## File ownership

- Spin agent: `core/flip.js`, `screens/spin.js`, `screens/transfer.js`, and `screens/spin.css`.
- Front agent: `screens/intro.js`, `screens/home.js`, `screens/howto.js`, `screens/account.js`, `screens/league.js` (also registers `stats`), and `screens/front.css`.
- Season agent: `screens/table.js`, `screens/squad.js`, `screens/fixtures.js`, `screens/match.js`, and `screens/season.css`.

Each owner has their own CSS file; prefix your classes (`sp-`, `fr-`, `se-`) so nothing collides. Do not touch other owners' files. If you need something from another owner, use the contract above (for example call `D2T.cards.openLarge`, `D2T.go('transfer')`).
