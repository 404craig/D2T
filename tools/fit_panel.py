"""Learn rating weights from the blind panel, using only verified-data features.

Usage: python3 tools/fit_panel.py [--write]

Features per player (all from rate_v5.py output): his stat z-scores for his
position, league position points this season and the two before, awards,
Champions League minutes, career appearances, share of games started and
played, and position. A ridge regression predicts the panel's rating. Each
season is scored by a model trained only on the other two, so the reported
agreement is for seasons the model has not seen.
With --write, the model trained on all three seasons rates every player and
writes docs/cards/feed/rated_fit_<season>.json.
"""
import csv
import json
import sys

import numpy as np

sys.path.insert(0, "tools")
from score_vs_panel import spearman  # noqa: E402

import glob
import re
SEASONS = {}
for f in sorted(glob.glob("docs/cards/panel/expected_*.csv")):
    k = re.search(r"expected_(.+)\.csv", f).group(1)
    SEASONS.setdefault(k[:7], []).append(k)
STATS = ["GOL", "AST", "CLN", "CON", "THR", "DIF", "APP"]
POS = ["GK", "DEF", "MID", "FWD"]


# Other Premier League seasons of the same player (Craig: consistently high finishes,
# goals, assists or clean sheets should count). Filled in by load_other().
OTHER = {}
ALL_SEASONS = sorted(re.search(r"rated_v5_(.+)\.json", f).group(1) for f in glob.glob("docs/cards/feed/rated_v5_*.json"))


def load_other():
    by = {}
    for t in ALL_SEASONS:
        for r in json.load(open(f"docs/cards/feed/rated_v5_{t}.json", encoding="utf-8"))["players"]:
            f = r.get("feat") or {}
            if "perf" in f:
                g = by.setdefault((r.get("id", r["player"]), t), [0.0, 0.0, 0.0])
                w = f["games"]
                g[0] += f["perf"] * w; g[1] += f["lp0"] * w; g[2] += w
    for (pid, t), (pw, lw, w) in by.items():
        OTHER[(pid, t)] = (pw / w, lw / w, w) if w else None


def other_seasons(r, season):
    i = ALL_SEASONS.index(season)
    acc = [0.0, 0.0, 0.0]
    n = 0
    for d, wt in ((-1, 1.0), (1, 1.0), (-2, 0.5), (2, 0.5)):
        j = i + d
        if 0 <= j < len(ALL_SEASONS):
            o = OTHER.get((r.get("id", r["player"]), ALL_SEASONS[j]))
            if o and o[2] >= 5:  # at least five full games that season
                w = wt * min(o[2], 38) / 38
                acc[0] += o[0] * w; acc[1] += o[1] * w; acc[2] += w; n += 1
    f = r["feat"]
    if acc[2] == 0:
        return f["perf"], f["lp0"], 0.0
    return acc[0] / acc[2], acc[1] / acc[2], min(n, 4) / 4


def features(r, season=None):
    f = r["feat"]
    G = f.get("seasonGames", 38)
    start_share = min(f["starts"], G) / G
    x = []
    for p in POS:  # each position gets its own weights for its own stats
        on = 1.0 if r["pos"] == p else 0.0
        x += [on] + [on * f.get(k, 0.0) for k in STATS]
    op, ol, on = other_seasons(r, season) if season else (f["perf"], f["lp0"], 0.0)
    x += [f["lp0"], f["lp1"], f["lp2"], f["awards"], f["ucl"], f["career"], start_share,
          f["lp0"] * start_share, min(f["games"], G) / G, op, ol, on]
    return x


NAMES = [f"{p}:{k}" for p in POS for k in ["base"] + STATS] + ["lp_this", "lp_last", "lp_2ago", "awards", "ucl", "career", "start_share", "lp_x_starts", "minutes_share", "perf_other_seasons", "finish_other_seasons", "other_seasons_count"]


def load():
    data = {}
    for t, files in SEASONS.items():
        rated = json.load(open(f"docs/cards/feed/rated_v5_{t}.json", encoding="utf-8"))["players"]
        idx = {(r["club"], r["player"]): r for r in rated}
        pan = []
        for f in files:
            for x in csv.DictReader(open(f"docs/cards/panel/expected_{f}.csv", encoding="utf-8")):
                if (x["club"], x["player"]) in idx:
                    pan.append((idx[(x["club"], x["player"])], int(x["expected"])))
        data[t] = (rated, pan)
    return data


def fit(X, y, lam):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = (X - mu) / sd
    A = np.c_[np.ones(len(Z)), Z]
    I = np.eye(A.shape[1]); I[0, 0] = 0
    w = np.linalg.solve(A.T @ A + lam * I, A.T @ y)
    return lambda Xn: np.c_[np.ones(len(Xn)), (Xn - mu) / sd] @ w, w, mu, sd


load_other()
data = load()
best = None
for lam in [1, 3, 10, 30, 100]:
    preds, trues, maes = [], [], []
    per = {}
    for t in SEASONS:
        tr = [(features(r, s), e) for s, (_, pan) in data.items() if s != t for r, e in pan]
        te = [(features(r, t), e) for r, e in data[t][1]]
        f, *_ = fit(np.array([a for a, _ in tr]), np.array([b for _, b in tr], float), lam)
        p = f(np.array([a for a, _ in te]))
        per[t] = round(spearman(list(p), [b for _, b in te]), 3)
        preds += list(p); trues += [b for _, b in te]
    rho = spearman(preds, trues)
    per = dict(sorted(per.items()))
    mae = float(np.mean(np.abs(np.array(preds) - np.array(trues))))
    print(f"lambda {lam:>3}: unseen-season agreement {rho:.3f} {per} avg gap {mae:.1f}")
    if not best or rho > best[1]:
        best = (lam, rho)
lam = best[0]
allp = [(features(r, s), e) for s, (_, pan) in data.items() for r, e in pan]
f, w, mu, sd = fit(np.array([a for a, _ in allp]), np.array([b for _, b in allp], float), lam)
print(f"\nchosen lambda {lam}. Biggest weights (rating points per standard deviation):")
for n, v in sorted(zip(NAMES, w[1:]), key=lambda z: -abs(z[1]))[:14]:
    print(f"   {n:14} {v:+.2f}")
# The fit pulls everyone toward the middle; stretch it back to the panel's spread.
tp = f(np.array([a for a, _ in allp])); ty = np.array([b for _, b in allp], float)
stretch = ty.std() / tp.std()
print(f"stretch x{stretch:.2f} around {ty.mean():.1f}")
def final(Xn):
    v = ty.mean() + (f(Xn) - tp.mean()) * stretch
    return v
st = final(np.array([a for a, _ in allp]))
print(f"all panel seasons after stretch: agreement {spearman(list(st), list(ty)):.3f}, avg gap {np.mean(np.abs(st - ty)):.1f}")
# Game scale (a design choice, not learned): in each season the TOP_N best players
# sit at 90 to TOP_MAX, the order is unchanged, and players ranked below ANCHOR
# keep the fitted value. Between the anchor and the TOP_N-th player it is stretched linearly.
TOP_N, TOP_MAX, ANCHOR = 10, 97, 60  # not used: Craig, 10 Oct 2026, wants no top-only bending


def game_scale(v):
    o = np.sort(v)[::-1]
    v1, vn, va = o[0], o[TOP_N - 1], o[min(ANCHOR, len(o)) - 1]
    out = v.copy()
    hi = v >= vn
    out[hi] = 90 + (v[hi] - vn) / max(v1 - vn, 1e-9) * (TOP_MAX - 90)
    mid = (v < vn) & (v > va)
    out[mid] = va + (v[mid] - va) / max(vn - va, 1e-9) * (89.4 - va)
    return out


OFFSET = 0  # +2 was tested (Craig, 10 Oct 2026); 0 matches the panel's rating bands within 2 points, +2 puts too many in the 80s and 90s


def band(v):
    return "90s" if v >= 90 else "80s" if v >= 80 else "70s" if v >= 70 else "60s" if v >= 60 else "50s and below"


if "--write" in sys.argv:
    # Band shares: the panel's own ratings against ours for the same players (with the offset)
    pan_b, our_b = {}, {}
    for t, (rated, pan) in data.items():
        ours = final(np.array([features(r, t) for r, _ in pan])) + OFFSET
        for (r, e), v in zip(pan, ours):
            pan_b[band(e)] = pan_b.get(band(e), 0) + 1
            our_b[band(round(v))] = our_b.get(band(round(v)), 0) + 1
    n = sum(pan_b.values())
    print("bands on panel players (panel % / ours %):",
          ", ".join(f"{b} {100 * pan_b.get(b, 0) / n:.0f}/{100 * our_b.get(b, 0) / n:.0f}" for b in ["90s", "80s", "70s", "60s", "50s and below"]))
    for t in ALL_SEASONS:
        rated = json.load(open(f"docs/cards/feed/rated_v5_{t}.json", encoding="utf-8"))["players"]
        if not all("perf" in (r.get("feat") or {}) for r in rated):
            continue
        p = final(np.array([features(r, t) for r in rated])) + OFFSET  # one even stretch and shift for everyone
        out = []
        for r, v in zip(rated, p):
            q = dict(r); q["ovr"] = int(round(min(99, max(40, v))))
            out.append(q)
        best_by = {}
        for q in out:
            b = best_by.get(q["club"])
            if not b or q["ovr"] > b["ovr"]:
                best_by[q["club"]] = q
        for q in out:
            q["tier"] = "best" if best_by[q["club"]] is q else "gold" if q["ovr"] >= 80 else "silver" if q["ovr"] >= 70 else "bronze"
        json.dump({"season": t, "players": out}, open(f"docs/cards/feed/rated_fit_{t}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("wrote rated_fit_*.json")
