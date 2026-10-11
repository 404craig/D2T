#!/usr/bin/env python3
"""Build index.html: one self-contained page (HTML, CSS, JS, data, crests, logos, audio).

Run from the repo root:  python3 scripts/build.py
Sources: src/app (screens and shell), src/engine.js and src/sound.js, data/game/*.json (made by scripts/build-data.py).
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
APP = os.path.join(SRC, "app")
DATA = os.path.join(ROOT, "data", "game")

CSS = ["core/base.css", "screens/front.css", "screens/spin.css", "screens/season.css", "screens/goals.css"]
JS = ["../engine.js", "../sound.js", "core/app.js", "core/cards.js", "core/flip.js", "core/game.js", "core/season.js",
      "screens/intro.js", "screens/home.js", "screens/howto.js", "screens/account.js", "screens/league.js",
      "screens/spin.js", "screens/transfer.js", "screens/table.js", "screens/squad.js", "screens/fixtures.js",
      "screens/match.js", "screens/summary.js", "screens/goals.js", "core/boot.js"]


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
    js = "\n;\n".join(f"/* ---- {p} ---- */\n" + parts[p] for p in JS)
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
    icon_path = os.path.join(ROOT, "assets", "icon-180.png")
    icon = "data:image/png;base64," + b64(icon_path) if os.path.exists(icon_path) else ""

    j = lambda o: json.dumps(o, separators=(",", ":"))
    data = (f"window.D2T_GAME={game};\nwindow.D2T_CRESTS={j(crests)};\n"
            f"window.D2T_LOGOS={j(logos)};\nwindow.D2T_SOUNDS={j(sounds)};"
            + (f"\nwindow.D2T_CLUBX_BADGE={j(badge)};" if badge else ""))
    out = html.replace("/*@CSS@*/", css).replace("/*@DATA@*/", data).replace("/*@JS@*/", js)
    out = out.replace("@BUILD@", version).replace("@ICON@", icon)
    left = re.findall(r"/\*@[A-Z]+@\*/", out)
    if left:
        sys.exit("unfilled placeholders: " + ", ".join(left))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"index.html written: {len(out)/1e6:.2f} MB, build {version}, {len(sounds)} sounds, {len(crests)} crests, {len(logos)} logos")


if __name__ == "__main__":
    main()
