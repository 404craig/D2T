#!/usr/bin/env python3
"""Build index.html: one self-contained page (HTML, CSS, JS, data, crests, logos, audio).

The page streams in parts so a phone sees the intro within a second: logos, then the shell and the intro (which start
at once), then the data (game data as a JSON.parse string, much quicker for a phone to read than a 5 MB object literal),
then the rest of the game, which calls D2T.ready() so the intro can hand over to home, then the sound clips last
(as plain JSON, read once home is up).

Run from the repo root:  python3 scripts/build.py
Sources: src/app (screens and shell), src/engine.js and src/sound.js, data/game/*.json (made by scripts/build-data.py).
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
APP = os.path.join(SRC, "app")
DATA = os.path.join(ROOT, "data", "game")

CSS = ["core/base.css", "screens/front.css", "screens/spin.css", "screens/season.css", "screens/goals.css", "screens/unbeaten.css"]
JS = ["../engine.js", "../sound.js", "core/app.js", "core/cards.js", "core/flip.js", "core/game.js", "core/season.js", "core/share.js",
      "screens/intro.js", "screens/home.js", "screens/howto.js", "screens/account.js", "screens/league.js",
      "screens/spin.js", "screens/transfer.js", "screens/table.js", "screens/squad.js", "screens/fixtures.js",
      "screens/match.js", "screens/summary.js", "screens/goals.js", "screens/unbeaten.js", "core/boot.js"]
SHELL = ["core/app.js", "screens/intro.js"]          # run first, while the rest of the page is still arriving


def read(path, mode="r"):
    with open(path, mode, encoding=None if "b" in mode else "utf-8") as f:
        return f.read()


def b64(path):
    return base64.b64encode(read(path, "rb")).decode("ascii")


def png_dir(d):
    return {os.path.splitext(n)[0]: "data:image/png;base64," + b64(os.path.join(d, n))
            for n in sorted(os.listdir(d)) if n.endswith(".png")}


def main():
    html = read(os.path.join(APP, "index.html"))
    parts = {p: read(os.path.join(APP, p)) for p in CSS + JS}
    for label, text in list(parts.items()) + [("index.html", html)]:
        if "—" in text:
            sys.exit(f"{label} contains an em dash; the house style forbids them")
        if label.endswith(".js") and "</script" in text.lower():
            sys.exit(f"{label} contains </script>, which would end the inline script early")
    css = "\n".join(parts[p] for p in CSS)
    js = "\n;\n".join(f"/* ---- {p} ---- */\n" + parts[p] for p in JS if p not in SHELL)
    shell = "\n;\n".join(f"/* ---- {p} ---- */\n" + parts[p] for p in SHELL) + "\n;\nD2T.start(); D2T.started = true;"
    version = read(os.path.join(ROOT, "version.txt")).strip()

    game = read(os.path.join(DATA, "game.json"))
    crests = json.loads(read(os.path.join(DATA, "crests.json")))
    logos = png_dir(os.path.join(ROOT, "assets", "logo"))
    sounds = {}
    sound_dir = os.path.join(ROOT, "audio", "game")
    if os.path.isdir(sound_dir):
        for name in sorted(os.listdir(sound_dir)):
            if name.endswith((".mp3", ".m4a")):
                kind = "mpeg" if name.endswith(".mp3") else "mp4"
                sounds[os.path.splitext(name)[0]] = f"data:audio/{kind};base64," + b64(os.path.join(sound_dir, name))
    badge_path = os.path.join(ROOT, "assets", "brand", "club_x.png")  # Craig's Club X badge (11 Oct)
    badge = "data:image/png;base64," + b64(badge_path) if os.path.exists(badge_path) else ""
    flags = png_dir(os.path.join(ROOT, "assets", "flags"))   # nationality flags, small pictures (never emoji)
    nations = json.loads(read(os.path.join(ROOT, "assets", "flags", "nations.json")))
    tena_path = os.path.join(ROOT, "assets", "brand", "tenaball.png")  # Tenaball's ball for its card on home (12 Oct)
    tena = "data:image/png;base64," + b64(tena_path) if os.path.exists(tena_path) else ""
    rush_path = os.path.join(ROOT, "assets", "brand", "goal_rush.png")  # Craig's ball for the Goal Rush card on home (12 Oct)
    rush = "data:image/png;base64," + b64(rush_path) if os.path.exists(rush_path) else ""
    icon_path = os.path.join(ROOT, "assets", "icon-180.png")
    icon = "data:image/png;base64," + b64(icon_path) if os.path.exists(icon_path) else ""

    j = lambda o: json.dumps(o, separators=(",", ":"))
    # a JSON string inside JS: "</" escaped so no </script> can end the tag early
    jstr = lambda text: json.dumps(text, ensure_ascii=False).replace("</", "<\\/")
    data = (f"window.D2T_GAME=JSON.parse({jstr(json.dumps(json.loads(game), separators=(',', ':'), ensure_ascii=False))});\nwindow.D2T_CRESTS={j(crests)};"
            + (f"\nwindow.D2T_CLUBX_BADGE={j(badge)};" if badge else "")
            + (f"\nwindow.D2T_TENABALL_LOGO={j(tena)};" if tena else "")
            + (f"\nwindow.D2T_GOALRUSH_LOGO={j(rush)};" if rush else "")
            + f"\nwindow.D2T_FLAGS={j(flags)};\nwindow.D2T_NATIONS={j(nations)};")
    logos_js = f"window.D2T_LOGOS={j(logos)};"
    # the clips as plain JSON (not a script, so the phone does not stop to run it while the intro waits); read after the intro
    sounds_js = j(sounds).replace("</", "<\\/")
    out = (html.replace("/*@CSS@*/", css).replace("/*@LOGOS@*/", logos_js).replace("/*@SHELL@*/", shell)
           .replace("/*@DATA@*/", data).replace("/*@JS@*/", js).replace("/*@SOUNDS@*/", sounds_js))
    out = out.replace("@BUILD@", version).replace("@ICON@", icon)
    left = re.findall(r"/\*@[A-Z]+@\*/", out)
    if left:
        sys.exit("unfilled placeholders: " + ", ".join(left))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"index.html written: {len(out)/1e6:.2f} MB, build {version}, {len(sounds)} sounds, {len(crests)} crests, {len(logos)} logos")


if __name__ == "__main__":
    main()
