"""Embed the example players into the card styles page.

Usage: python3 tools/build_card_styles.py
"""
src = open("docs/cards/card_styles.src.html", encoding="utf-8").read()
players = open("docs/cards/style_players.json", encoding="utf-8").read().replace("</", "<\\/")
open("docs/cards/card_styles.html", "w", encoding="utf-8").write(src.replace("/*PLAYERS*/", players))
print("docs/cards/card_styles.html written")
