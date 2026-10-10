# What Tenaball taught us (for DROP2TOP)

Read from the Tenaball repo (github.com/404craig/Tenaball) on 10 October 2026: 247 commits and 93 live updates between 28 September and 9 October 2026, plus its CLAUDE.md, in-game changelog, docs and tests. Nothing here is a D2T decision yet; it is the starting knowledge.

## How Tenaball was built

- One self-contained `index.html` (HTML, CSS, JS, artwork, sounds and data embedded), hosted on GitHub Pages, no build step. Data lives in `docs/data/` and Python scripts embed it into the page.
- A small Cloudflare Worker (`server/`) added later for email + 4-digit PIN accounts, stats, online rooms and leagues. The game works offline when it is switched off.
- Designs agreed first in throwaway demo artifacts, then built. One PR per change, each with a plain-English line in an in-game "Latest updates" list.
- Craig's rules recorded in CLAUDE.md as they came up (verified data only, stop rather than guess; no em dashes anywhere; dated period on every question).
- Playwright tests on a 390 x 844 phone screen for the game loop, online play, accounts and the trophy sequence (timeline, tap to skip, reduced motion, nothing left running).

## Phone problems found and fixed (iOS Safari and Android Chrome)

1. Status bar colour. iOS Safari takes it from a fixed strip at the top (must be over 10px, not behind the page, not see-through); Android uses `theme-color`, kept in step by script. Safari 26 also tints its bottom toolbar from what is fixed at the bottom.
2. Keyboard. The keyboard and Safari's toolbar shrink the visible viewport but not the layout one: track `visualViewport` and lift the dock and overlays above it; `interactive-widget=resizes-content` for Android. Blur the input during reveals so the keyboard drops and the action is visible.
3. No native `confirm()`, `prompt()` or `alert()`: the grey iOS boxes feel broken. Use the game's own pop-up.
4. Emoji flags do not show on Windows and many Android phones show England and Scotland wrongly: draw icons as SVG or images.
5. Home Screen web apps on iPhone keep an old copy in memory: `version.txt` check on open and on return to the front, reload only on the home screen, never mid-game.
6. Sign-in email box: `autocomplete="email"` (not `username`) so iPhone offers the address; remember the last one.
7. A frozen answer box on Craig's iPhone never reproduced in tests. Fix was defensive: errors caught around every animation chain, time caps, and a once-a-second watchdog that unsticks a stalled state.
8. Safari clipped SVG artwork to its old box; content popping in after first paint looked broken. Both fixed explicitly.
9. Sharing: build the share text and the 1080 x 1350 results image ahead of time so tapping Share opens the sheet instantly (share needs a fresh tap). Link previews need a real `og-image.jpg` file.
10. Sizes tuned for a 390px-wide phone (logo 64vw on home); watermark faded 11% to 7% to 5% over three updates. Expect several small visual passes.

## What made it feel good

- Anticipation: answers climb the board with a slowing scan; shuffle for who goes first; trophy sequence; pixel-art penalty shootout. Every long animation can be skipped with a tap and respects reduced motion.
- Feedback layers: synthesised sound effects with recorded crowd under them (cheer, groan, boos, roar, applause), levels normalised, one mute. Whistles reserved for meaning (triple whistle only at full time).
- Personality: sarcastic, rude end-of-game banter that reacts to the result, seeded so everyone sees the same line, and not repeated recently.
- Edge cases treated kindly or cheekily: a solo game on 0 gets no trophy and a jibe; a draw goes to penalties.
- Friction removed over time: sensible defaults on (All levels), one question change per round, exact full name always locks in, settings saved on the phone with migrations when defaults change.
- Plain names won: "First touch" became "Fastest answer wins"; "Repeated answers" became "Duplicate answers" with a line saying what each option does; an i on every section; How to play and Latest updates one tap away.
- Determinism: every random draw that matters comes from a seed and every state change goes through pure apply functions, so phones in an online game never drift apart. Directly relevant to D2T's seeded challenges.
- Variety and balance: least-recently-played question type first; difficulty levels rebalanced so each has enough depth.

## Tenaball assets D2T can reuse

- `docs/data/pl_players/pl_players.csv`: every Premier League player 1992/93 to 2025/26, one row per player, club and season (position, nationality, apps, goals), two sources per row, goals reconciled for all 686 club-seasons. Gives every relegated club's real squad and the same-season recruitment pool.
- `docs/data/pl_results/pl_results.csv`: every Premier League result 1992/93 to 2025/26 with dates (13,166 matches), two sources, tables reproduce official points. Replaces the football-data.co.uk prototype file and covers every season, not just 2007/08.
- Crowd sounds, trophy sequence, share card code, banter engine, server (accounts, stats, leagues).
- Club crests: fine for a private family game, but trademarks. Not usable for a public App Store or Play Store release without licences.

## Gaps for D2T to decide

- Tenaball is a mobile web page, not a store app. Shipping D2T to the App Store and Google Play needs a wrapper (for example Capacitor) or native build, plus store rules on icons, privacy and data use.
- The player dataset has apps and goals but no ratings or attributes. Card ratings still need an agreed, position-aware method.
- Use of real club names, crests and player names in a public release needs checking.
