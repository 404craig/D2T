#!/usr/bin/env python3
"""Build index.html: one self-contained page (HTML, CSS, JS, data, crests, audio).

Run from the repo root:  python3 scripts/build.py
Sources live in src/ and data/ (data/game/*.json is made by scripts/build-data.py).
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "data", "game")


def read(path, mode="r"):
    with open(path, mode, encoding=None if "b" in mode else "utf-8") as f:
        return f.read()


def b64(path):
    return base64.b64encode(read(path, "rb")).decode("ascii")


def main():
    html = read(os.path.join(SRC, "index.html"))
    css = read(os.path.join(SRC, "style.css"))
    engine = read(os.path.join(SRC, "engine.js"))
    ui = read(os.path.join(SRC, "ui.js"))
    sound = read(os.path.join(SRC, "sound.js"))
    brand_dir = os.path.join(ROOT, "assets", "brand")
    brand = {os.path.splitext(n)[0]: "data:image/png;base64," + b64(os.path.join(brand_dir, n))
             for n in sorted(os.listdir(brand_dir)) if n.endswith(".png")}
    version = read(os.path.join(ROOT, "version.txt")).strip()

    # Season data, crests and sounds, each as its own <script> so a parse error points somewhere sensible.
    game = read(os.path.join(DATA, "game.json"))
    crests = json.loads(read(os.path.join(DATA, "crests.json")))
    sounds = {}
    sound_dir = os.path.join(ROOT, "audio", "game")
    if os.path.isdir(sound_dir):
        for name in sorted(os.listdir(sound_dir)):
            if name.endswith((".mp3", ".m4a")):
                kind = "mpeg" if name.endswith(".mp3") else "mp4"
                sounds[os.path.splitext(name)[0]] = f"data:audio/{kind};base64," + b64(os.path.join(sound_dir, name))
    icon = b64(os.path.join(ROOT, "assets", "icon-180.png")) if os.path.exists(os.path.join(ROOT, "assets", "icon-180.png")) else ""

    for bad in ("—",):
        for label, text in (("index.html", html), ("style.css", css), ("ui.js", ui), ("sound.js", sound)):
            if bad in text:
                sys.exit(f"{label} contains an em dash; the house style forbids them")

    out = html
    out = out.replace("/*@CSS@*/", css)
    out = out.replace("/*@ENGINE@*/", engine)
    out = out.replace("/*@UI@*/", ui)
    out = out.replace("/*@SOUND@*/", sound)
    out = out.replace("/*@BRAND@*/", "window.D2T_BRAND=" + json.dumps(brand, separators=(",", ":")) + ";")
    out = out.replace("/*@GAME@*/", "window.D2T_GAME=" + game + ";")
    out = out.replace("/*@CRESTS@*/", "window.D2T_CRESTS=" + json.dumps(crests, separators=(",", ":")) + ";")
    out = out.replace("/*@SOUNDS@*/", "window.D2T_SOUNDS=" + json.dumps(sounds, separators=(",", ":")) + ";")
    out = out.replace("@BUILD@", version)
    out = out.replace("@ICON@", "data:image/png;base64," + icon if icon else "")
    left = re.findall(r"/\*@[A-Z]+@\*/", out)
    if left:
        sys.exit("unfilled placeholders: " + ", ".join(left))
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"index.html written: {len(out)/1e6:.2f} MB, build {version}, {len(sounds)} sounds, {len(crests)} crests")


if __name__ == "__main__":
    main()
