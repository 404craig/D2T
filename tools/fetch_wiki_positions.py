"""Fetch the Wikipedia page of every player whose career positions are thin (Craig, 29 Oct 2026).

Usage: python3 tools/fetch_wiki_positions.py <need.json> <out dir>

need.json: {player name: {"seasons": [...], ...}} for players with under 20 recorded Transfermarkt games.
For each player it tries "<name> (footballer, born <year>)" when the name carries a birth year, then
"<name> (footballer)", then "<name>", and keeps the first page that is a football biography naming one of
his Premier League clubs. It saves the infobox position, the lead and the playing style or career text.
One request a second, as Wikimedia asks.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "D2TResearch/1.0 (https://404craig.github.io/D2T/)"}
ROOT = os.path.join(os.path.dirname(__file__), "..")


def raw(title):
    url = "https://en.wikipedia.org/w/index.php?action=raw&title=" + urllib.parse.quote(title.replace(" ", "_"))
    for k in range(4):
        try:
            time.sleep(1.0)
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5 * (k + 1))
        except Exception:
            time.sleep(5 * (k + 1))
    return None


def follow(text, depth=0):
    m = re.match(r"\s*#REDIRECT\s*\[\[([^\]|#]+)", text or "", re.I)
    if m and depth < 2:
        return follow(raw(m.group(1)), depth + 1)
    return text


def clean(s):
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'''?|<[^>]+>", "", s)
    return re.sub(r"[ \t]+", " ", s)


def main():
    need = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    game = json.load(open(os.path.join(ROOT, "data", "game", "game.json")))
    clubs = {}
    for s, d in game["seasons"].items():
        names = {c["id"]: c["name"] for c in d["clubs"]}
        for p in d["players"]:
            if p["n"] in need:
                clubs.setdefault(p["n"], set()).add(game["clubs"].get(names[p["c"]], {}).get("full", names[p["c"]]))
    for name in sorted(need):
        path = os.path.join(out, re.sub(r"[^A-Za-z0-9]+", "_", name) + ".json")
        if os.path.exists(path):
            continue
        base = re.sub(r"\s*\(b\.(\d{4})\)", "", name)
        born = re.search(r"\(b\.(\d{4})\)", name)
        tries = ([f"{base} (footballer, born {born.group(1)})"] if born else []) + [f"{base} (footballer)", base]
        found = None
        for t in tries:
            text = follow(raw(t))
            if not text or "football biography" not in text.lower():
                continue
            words = {w for c in clubs.get(name, ()) for w in c.replace("&", " ").split() if len(w) > 3}
            if not any(w in text for w in words):
                continue
            found = (t, text)
            break
        rec = {"name": name, "clubs": sorted(clubs.get(name, ())), "seasons": need[name]["seasons"]}
        if found:
            t, text = found
            pos = re.search(r"\|\s*position\s*=\s*(.*)", text)
            lead = text.split("\n==", 1)[0]
            lead = lead[lead.rfind("}}") + 2:] if "}}" in lead else lead
            body = ""
            for sec in re.split(r"\n==+\s*", text)[1:]:
                head = sec.split("\n", 1)[0].lower()
                if any(k in head for k in ("style", "playing", "career", "club")):
                    body += "\n== " + sec[:6000]
            rec.update({"title": t, "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(t.replace(" ", "_")),
                        "infobox_position": clean(pos.group(1)).strip() if pos else "",
                        "lead": clean(lead).strip()[:2500], "body": clean(body)[:9000]})
        json.dump(rec, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
