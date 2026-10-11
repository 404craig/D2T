"""Embed the card engine and a season's inputs into one self-contained page.

Usage: python3 tools/build_card_lab.py docs/cards/cards_2007-08.json docs/cards/card_lab.html
"""
import sys

data_path, out = sys.argv[1], sys.argv[2]
src = open("docs/cards/card_lab.src.html", encoding="utf-8").read()
engine = open("docs/cards/engine.js", encoding="utf-8").read()
data = open(data_path, encoding="utf-8").read().replace("</", "<\\/")
page = src.replace("/*ENGINE*/", engine).replace("/*DATA*/", data)
open(out, "w", encoding="utf-8").write(page)
print(f"{out}: {len(page) // 1024} KB")
