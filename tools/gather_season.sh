#!/bin/bash
# Gather one season's data and match it to Tenaball.
# Usage: tools/gather_season.sh <season e.g. 2003/04> [full|feed]
#   full: feed season stats + match line-ups + match to Tenaball
#   feed: feed season stats + match to Tenaball (no line-ups)
# Run from the repo root. Tenaball must be cloned at /home/user/404craig/tenaball.
set -e
s=$1; mode=${2:-full}; t=${s/\//-}
python3 -I tools/fetch_pl_feed.py "$s" "docs/cards/feed/pl_feed_$t.csv" | tail -1
if [ "$mode" = full ]; then
  python3 -I tools/fetch_lineups.py "$s" "docs/cards/feed/lineups_$t.csv"
fi
python3 -I tools/match_feed.py /home/user/404craig/tenaball "$s" "docs/cards/feed/pl_feed_$t.csv" "docs/cards/feed/merged_$t.csv"
