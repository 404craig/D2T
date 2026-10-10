# DROP2TOP audio

Sound for the game, first pass. Open `soundboard.html` (needs a local server, for example `python3 -m http.server` in this folder) to hear and tweak everything.

- `sfx/`: stadium sound effects made with ElevenLabs sound generation, loudness normalised (-16 LUFS; the crowd bed -22 LUFS and crossfaded so it loops without a seam).
- `voice/`: ten commentary lines in three British ElevenLabs voices (Daniel, George, Lily), eleven_v3 model, -15 LUFS mono.
- Synth sounds (button tap, card flip, rating reveal, transfer fee, whistle, ball strike, promotion, relegation, table climb, buzzer, heartbeat, contract stamp) are generated in the browser with Web Audio; their code and default settings are in `soundboard.html`.

The prompts used for each recording are listed at the foot of the soundboard. Nothing here is wired into the game yet.
