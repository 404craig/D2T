# DROP2TOP audio

Sound for the game, first pass. Open `soundboard.html` (needs a local server, for example `python3 -m http.server` in this folder) to hear and tweak everything.

- `sfx/`: whistles (single, half time, full time), crowd (bed, roar, cheer, ooh, groan, moan, boos, applause, chant), cards (shuffle, deal three, slide, pack rip) and season-end sounds, made with ElevenLabs sound generation and loudness normalised (-16 LUFS; the crowd bed -22 LUFS and crossfaded so it loops without a seam). No voices or commentary.
- Synth sounds (roll 3 cards, pick a player, player on, player off, lock in, button tap, card flip, rating reveal, transfer fee, whistle, ball strike, promotion, champions, season over, relegation, table climb, buzzer, heartbeat) are generated in the browser with Web Audio; their code and default settings are in `soundboard.html`.

The prompts used for each recording are listed at the foot of the soundboard. Nothing here is wired into the game yet.
