"""High-resolution crests for large displays (Unbeaten Run's shirts), from the Premier League's own badge library.

Usage: python3 tools/fetch_crests_hi.py

Each club's Opta team id comes from the Premier League feed (every season 1992/93 to now, matched to our club names
with tools/club_names.py). The SVG badge is used where the library has one (current and recent clubs); otherwise its
200px PNG. Files go to assets/crests/hi/<crest name>.svg or .png, named as in data/source/clubs.json.
The game's 72px and 128px crests are unchanged.
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from club_names import CLUB  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets", "crests", "hi")
H = {"Origin": "https://www.premierleague.com", "Referer": "https://www.premierleague.com/", "User-Agent": "Mozilla/5.0"}
B = "https://footballapi.pulselive.com/football"
BADGES = "https://resources.premierleague.com/premierleague/badges"


def get(url, headers=H):
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=40).read()


def main():
    clubs = json.load(open(os.path.join(ROOT, "data", "source", "clubs.json")))
    ids = {}
    for s in json.loads(get(f"{B}/competitions/1/compseasons?page=0&pageSize=100"))["content"]:
        for t in json.loads(get(f"{B}/teams?comps=1&compSeasons={int(s['id'])}&pageSize=40&altIds=true"))["content"]:
            ids.setdefault(CLUB.get(t["name"], t["name"]), set()).add((t.get("altIds") or {}).get("opta"))
    os.makedirs(OUT, exist_ok=True)
    svg = png = 0
    for name, c in sorted(clubs.items()):
        opta = ids.get(name, set())
        if len(opta) != 1:
            raise SystemExit(f"{name}: expected one Opta id, found {sorted(opta)}")
        opta, base = opta.pop(), c["crest"][:-4]
        try:
            data, ext = get(f"{BADGES}/rb/{opta}.svg", {}), "svg"
            svg += 1
        except urllib.error.HTTPError:
            data, ext = get(f"{BADGES}/100/{opta}@x2.png", {}), "png"
            png += 1
        for old in ("svg", "png"):
            p = os.path.join(OUT, f"{base}.{old}")
            if old != ext and os.path.exists(p):
                os.remove(p)
        open(os.path.join(OUT, f"{base}.{ext}"), "wb").write(data)
    print(f"{svg} SVG and {png} PNG crests in {OUT}")


if __name__ == "__main__":
    main()
