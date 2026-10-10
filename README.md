# DROP2TOP

They went down. How high can you take them?

Take a Premier League club that was relegated, replay that exact season from GW1 with its real squad, and rebuild the XI through 17 transfer rolls of players from the same season. Every other result stays as history played it, unless you raid a club's players.

Created by Aiden and Craig.

## Files

- `index.html`: the whole game in one page (built; don't edit by hand)
- `src/`: the sources the page is built from: `engine.js` (rules, rolls, match simulation, table), `ui.js` (screens), `sound.js` (audio), `style.css`, `index.html` (shell)
- `data/source/`: every Premier League result and player-season 1992/93 to 2025/26 (from Tenaball), and club names, crests and accent colours (`clubs.json`)
- `data/ratings/`: card ratings from the player data work (`rated_fit_<season>.json`)
- `data/game/`: the built season data the page embeds
- `assets/`: crests, logo layers, app icons; `audio/game/`: the game's sounds
- `scripts/build-data.py`, `scripts/build.py`: build the data, then the page
- `tests/`: engine checks, a full-season browser test on a phone-sized screen, calibration
- `docs/`: Tenaball lessons

## Building

```
python3 scripts/build-data.py   # data/game/*.json from data/source and data/ratings
python3 scripts/build.py        # index.html
node tests/engine.test.js       # engine checks
node tests/ui.test.js           # plays a season in Chromium at 390 x 844, screenshots in tests/output/
```

Open `index.html` in a browser to play.
