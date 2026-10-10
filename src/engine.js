/* DROP2TOP game engine.
   Pure and deterministic: every random draw comes from a seeded stream, and
   nothing here reads the clock, the DOM or storage. The UI calls these
   functions and renders the state they return. Runs in the browser (global
   D2T) and in Node (module.exports) so the tests and calibration share it. */
(function (root) {
"use strict";

/* ---------- seeded random ---------- */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return h >>> 0;
}
function rng(seed) {                       // mulberry32
  let a = (typeof seed === "number" ? seed : hash32(String(seed))) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// One independent stream per purpose and step, so a cosmetic or unrelated
// draw can never shift another sequence.
function stream(seed, ...parts) { return rng(hash32(seed + "|" + parts.join("|"))); }
function unit(seed, ...parts) { return stream(seed, ...parts)(); }
function pickWeighted(r, items, weight) {
  let total = 0; for (const it of items) total += weight(it);
  let x = r() * total;
  for (const it of items) { x -= weight(it); if (x <= 0) return it; }
  return items[items.length - 1];
}
function poisson(r, lambda) {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L && k < 12);
  return k - 1;
}

/* ---------- rules (starting values to tune) ---------- */
const RULES = {
  respins: 5,
  preseasonRolls: 3,
  januaryRolls: 3,
  rollEvery: 3,
  minApps: 10,
  levelOdds: [0.40, 0.35, 0.19, 0.05, 0.01],   // bronze silver gold best (purple) legend; tuned so strong runs win the title about 2% of the time across seasons
  fit: { green: 1, amber: 0.9, red: 0.7 },
  raidFactor: 3,           // chance a raided club's win/draw is downgraded = factor x strength lost
  raidCap: 0.6,
  raidBaseline: 60,        // strength lost is measured as a share of strength above this
  match: { base: 1.449, att: 0.0402, mid: 0.007, home: 0.213, away: -0.092, cap: 6 }   // fitted to every PL result (tests/fit-match.js)
};
const LEVELS = ["bronze", "silver", "gold", "purple", "legend"];

/* ---------- positions and formations ---------- */
const POS = ["GK","RB","CB","LB","RWB","LWB","CDM","CM","CAM","RM","LM","RW","LW","ST"];
const NEAR = {
  GK: [], CB: ["RB","LB","CDM"], RB: ["RWB","CB","RM"], LB: ["LWB","CB","LM"],
  RWB: ["RB","RM","RW"], LWB: ["LB","LM","LW"], CDM: ["CM","CB"], CM: ["CDM","CAM","RM","LM"],
  CAM: ["CM","ST","RW","LW"], RM: ["RW","CM","RWB","RB"], LM: ["LW","CM","LWB","LB"],
  RW: ["RM","ST","CAM"], LW: ["LM","ST","CAM"], ST: ["CAM","RW","LW"]
};
// Slot weights into Defence, Midfield, Attack.
const SLOTW = {
  GK: [2.2, 0, 0], CB: [1, 0.1, 0], RB: [0.8, 0.3, 0.15], LB: [0.8, 0.3, 0.15],
  RWB: [0.6, 0.5, 0.25], LWB: [0.6, 0.5, 0.25], CDM: [0.5, 1, 0.1], CM: [0.2, 1, 0.3],
  CAM: [0, 0.6, 0.8], RM: [0.1, 0.8, 0.5], LM: [0.1, 0.8, 0.5],
  RW: [0, 0.3, 1], LW: [0, 0.3, 1], ST: [0, 0.1, 1.25]
};
// x across (0 left, 100 right) and y up the pitch (0 own goal, 100 opponent goal).
const FORMATIONS = {
  "4-4-2":   [["GK",50,2],["RB",88,22],["CB",63,22],["CB",37,22],["LB",12,22],["RM",88,52],["CM",63,52],["CM",37,52],["LM",12,52],["ST",63,84],["ST",37,84]],
  "4-3-3":   [["GK",50,2],["RB",88,22],["CB",63,22],["CB",37,22],["LB",12,22],["CM",75,56],["CDM",50,44],["CM",25,56],["RW",85,80],["ST",50,86],["LW",15,80]],
  "4-2-3-1": [["GK",50,2],["RB",88,22],["CB",63,22],["CB",37,22],["LB",12,22],["CDM",64,44],["CDM",36,44],["RW",86,66],["CAM",50,66],["LW",14,66],["ST",50,88]],
  "4-5-1":   [["GK",50,2],["RB",88,22],["CB",63,22],["CB",37,22],["LB",12,22],["RM",90,54],["CM",70,52],["CDM",50,46],["CM",30,52],["LM",10,54],["ST",50,84]],
  "3-5-2":   [["GK",50,2],["CB",75,22],["CB",50,22],["CB",25,22],["RWB",90,48],["CM",70,56],["CDM",50,44],["CM",30,56],["LWB",10,48],["ST",63,84],["ST",37,84]],
  "5-3-2":   [["GK",50,2],["RWB",90,30],["CB",70,22],["CB",50,22],["CB",30,22],["LWB",10,30],["CM",75,54],["CM",50,54],["CM",25,54],["ST",63,84],["ST",37,84]],
  "3-4-3":   [["GK",50,2],["CB",75,22],["CB",50,22],["CB",25,22],["RM",88,52],["CM",63,52],["CM",37,52],["LM",12,52],["RW",82,80],["ST",50,86],["LW",18,80]]
};
const FORMATION_NAMES = Object.keys(FORMATIONS);

// Slots carry a detailed label (RB, CDM) but the data only knows four broad positions,
// so fit is judged on the broad position until detailed positions arrive.
const SLOT_BROAD = { GK: "GK", RB: "DEF", CB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", RM: "MID", LM: "MID", RW: "FWD", LW: "FWD", ST: "FWD" };
const NEAR_BROAD = { GK: [], DEF: ["MID"], MID: ["DEF", "FWD"], FWD: ["MID"] };
function broadOf(player) { return player.b || SLOT_BROAD[(player.p || [])[0]] || "MID"; }
function fitOf(player, slotPos) {
  if (!player) return "red";
  const ps = player.p || [];
  if (ps.some(p => SLOT_BROAD[p]) ) {                 // detailed positions known
    if (ps.includes(slotPos)) return "green";
    if (ps.some(p => (NEAR[slotPos] || []).includes(p))) return "amber";
    return "red";
  }
  const pb = broadOf(player), sb = SLOT_BROAD[slotPos];
  if (pb === sb) return "green";
  if ((NEAR_BROAD[sb] || []).includes(pb)) return "amber";
  return "red";
}
function effRating(player, slotPos) { return player ? player.r * RULES.fit[fitOf(player, slotPos)] : 40; }

/* ---------- season index ---------- */
// A season bundle (built by scripts/build-data.py) looks like:
// { season, clubs:[{id,name}], matches:[[date,h,a,hg,ag]], players:[{id,n,c,c2,p,r,lv,a,g,...}], relegated:[{c,pos,pts,f,xi}] }
function indexSeason(S) {
  if (S._ix) return S._ix;
  const byId = new Map(), byClub = new Map();
  for (const p of S.players) {
    byId.set(p.id, p);
    for (const c of [p.c, p.c2]) if (c != null) { if (!byClub.has(c)) byClub.set(c, []); byClub.get(c).push(p); }
  }
  const nClubs = S.clubs.length;
  const matches = S.matches.map((m, i) => ({ i, date: m[0], h: m[1], a: m[2], hg: m[3], ag: m[4] }));
  S._ix = { byId, byClub, matches, nClubs };
  return S._ix;
}
function playerOf(S, id, legends) {
  legends = legends || S.legends;
  const ix = indexSeason(S);
  if (ix.byId.has(id)) return ix.byId.get(id);
  if (legends && String(id).startsWith("L:")) return legends.find(l => l.id === id) || null;
  return null;
}

/* ---------- strengths ---------- */
function xiStrength(players, slots) {
  const sum = [0, 0, 0], w = [0, 0, 0]; let all = 0;
  slots.forEach((pos, i) => {
    const r = effRating(players[i], pos), sw = SLOTW[pos];
    for (let k = 0; k < 3; k++) { sum[k] += r * sw[k]; w[k] += sw[k]; }
    all += r;
  });
  return { def: sum[0] / w[0], mid: sum[1] / w[1], att: sum[2] / w[2], ovr: all / slots.length };
}
function userStrength(S, st, legends) {
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  return xiStrength(st.xi.map(id => playerOf(S, id, legends)), slots);
}
// A historical club's best XI from its real squad, minus anyone the user has signed.
// Broad shape: 1 GK, 4 DEF, 4 MID, 2 FWD by rating, weighting regular starters.
function clubXI(S, club, gone) {
  const ix = indexSeason(S);
  const pool = (ix.byClub.get(club) || []).filter(p => !gone.has(p.id));
  const broad = p => broadOf(p);
  const score = p => p.r + Math.min(p.a || 0, 30) * 0.15;
  const take = (cond, n) => pool.filter(cond).sort((x, y) => score(y) - score(x)).slice(0, n);
  const gk = take(p => broad(p) === "GK", 1);
  const df = take(p => broad(p) === "DEF", 4);
  const md = take(p => broad(p) === "MID", 4);
  const fw = take(p => broad(p) === "FWD", 2);
  let xi = [...gk, ...df, ...md, ...fw];
  if (xi.length < 11) {                      // thin data: fill with whoever is left
    const rest = pool.filter(p => !xi.includes(p)).sort((x, y) => score(y) - score(x));
    xi = xi.concat(rest.slice(0, 11 - xi.length));
  }
  return xi;
}
function clubStrength(S, club, gone) {
  const xi = clubXI(S, club, gone);
  const slots = ["GK","RB","CB","CB","LB","RM","CM","CM","LM","ST","ST"];
  // Club squads are judged on their own broad roles, so every player plays at full rating.
  const flat = xi.map((p, i) => p ? Object.assign({}, p, { p: [slots[i]] }) : null);
  return xiStrength(flat, slots);
}

/* ---------- transfer schedule ---------- */
// Rolls happen BEFORE a gameweek: pre-season before GW1, then every 3 games,
// the January window before the club's first January fixture, then every 3 again.
function schedule(fixtures) {
  const rolls = [{ gw: 1, n: RULES.preseasonRolls, kind: "pre" }];
  let jan = fixtures.findIndex(f => f.date.slice(5, 7) === "01") + 1;
  if (jan < 2) jan = 21;
  for (let g = 1 + RULES.rollEvery; g < jan; g += RULES.rollEvery) rolls.push({ gw: g, n: 1, kind: "reg" });
  rolls.push({ gw: jan, n: RULES.januaryRolls, kind: "jan" });
  for (let g = jan + RULES.rollEvery; g <= fixtures.length - 2; g += RULES.rollEvery) rolls.push({ gw: g, n: 1, kind: "reg" });
  return rolls;
}
function fixturesOf(S, club) {
  return indexSeason(S).matches.filter(m => m.h === club || m.a === club)
    .map(m => ({ i: m.i, date: m.date, home: m.h === club, opp: m.h === club ? m.a : m.h, real: m.h === club ? [m.hg, m.ag] : [m.ag, m.hg] }));
}

/* ---------- starting a run ---------- */
function newRun(opts) {
  // opts: { seed, catalogue:[{key, season, club, ...}], daily? }
  const st = {
    v: 1, seed: String(opts.seed), mode: opts.mode || "classic",
    phase: "clubroll", respins: RULES.respins, clubSpin: 0,
    clubOffer: [], seasonKey: null, club: null,
    formation: null, xi: [], gw: 0, rolls: [], rollIx: 0, rollStep: 0,
    roll: null, seen: [], signed: [], gone: [], raids: [], played: [], log: []
  };
  if (opts.fixedClub) { st.clubOffer = [opts.fixedClub]; }
  else st.clubOffer = offerClubs(st, opts.catalogue);
  return st;
}
function offerClubs(st, catalogue) {
  const r = stream(st.seed, "club", st.clubSpin);
  const pool = catalogue.slice(), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].key);
  return out;
}
function respinClubs(st, catalogue) {
  if (st.phase !== "clubroll" || st.respins < 1) return false;
  st.respins--; st.clubSpin++; st.clubOffer = offerClubs(st, catalogue);
  st.log.push(["clubspin"]);
  return true;
}
function chooseClub(st, S, rel) {
  // rel = { c, f, xi } for the chosen relegated club-season
  st.seasonKey = S.season; st.club = rel.c;
  st.formation = FORMATIONS[rel.f] ? rel.f : "4-4-2";
  st.xi = autoXI(S, rel.c, st.formation, rel.xi);
  st.phase = "setup";
  st.log.push(["club", S.season, rel.c]);
}
// Fill a formation from the club's real squad: the given XI first where it fits,
// then the best-fitting regular for each empty slot.
function autoXI(S, club, formation, preferred) {
  const ix = indexSeason(S);
  const squad = (ix.byClub.get(club) || []).slice();
  const slots = FORMATIONS[formation].map(s => s[0]);
  const xi = new Array(slots.length).fill(null), used = new Set();
  const val = (p, pos) => effRating(p, pos) + Math.min(p.a || 0, 38) * 0.6;
  const place = cands => {
    // Fill slots with the best remaining candidate, greens before ambers before reds.
    for (const tier of ["green", "amber", "red"]) {
      slots.forEach((pos, i) => {
        if (xi[i]) return;
        const best = cands.filter(p => !used.has(p.id) && fitOf(p, pos) === tier).sort((x, y) => val(y, pos) - val(x, pos))[0];
        if (best) { xi[i] = best.id; used.add(best.id); }
      });
    }
  };
  if (preferred && preferred.length) place(preferred.map(id => ix.byId.get(id)).filter(Boolean));
  place(squad);
  return xi;
}
function setFormation(st, S, f) {
  if (st.phase !== "setup" && !(st.phase === "window")) return false;
  if (!FORMATIONS[f]) return false;
  // Keep the same players, re-seated to the slots they fit best.
  const players = st.xi.filter(Boolean).map(id => playerOf(S, id, S.legends));
  const slots = FORMATIONS[f].map(s => s[0]);
  const xi = new Array(slots.length).fill(null), used = new Set();
  for (const tier of ["green", "amber", "red"]) {
    slots.forEach((pos, i) => {
      if (xi[i]) return;
      const best = players.filter(p => !used.has(p.id) && fitOf(p, pos) === tier).sort((x, y) => y.r - x.r)[0];
      if (best) { xi[i] = best.id; used.add(best.id); }
    });
  }
  st.formation = f; st.xi = xi;
  st.log.push(["formation", f]);
  return true;
}
function swapSetup(st, slot, playerId) {
  if (st.phase !== "setup") return false;
  const other = st.xi.indexOf(playerId);
  if (other >= 0) st.xi[other] = st.xi[slot];
  st.xi[slot] = playerId;
  return true;
}
function squadOf(S, club) { return (indexSeason(S).byClub.get(club) || []).slice().sort((a, b) => b.r - a.r); }

function startSeason(st, S) {
  if (st.phase !== "setup") return false;
  st.fixtures = fixturesOf(S, st.club);
  st.rolls = schedule(st.fixtures);
  st.rollIx = 0; st.rollStep = 0; st.gw = 1;
  st.seen = st.xi.slice();
  // Your own club's real squad never turns up as a card.
  for (const p of squadOf(S, st.club)) if (!st.seen.includes(p.id)) st.seen.push(p.id);
  st.history = historyPositions(S, st.club);
  st.phase = "window";
  newRoll(st, S);
  st.log.push(["start"]);
  return true;
}

/* ---------- the roll ---------- */
function currentWindow(st) { return st.rolls[st.rollIx] || null; }
function inWindow(st) { const w = currentWindow(st); return !!(w && w.gw === st.gw && st.rollStep < w.n); }
function cardPool(S, st) {
  const seen = new Set(st.seen);
  return S.players.filter(p => (p.a || 0) >= RULES.minApps && !seen.has(p.id));
}
function drawCard(r, S, st, legends, taken) {
  const lv = (() => { let x = r(); for (let i = 0; i < 5; i++) { x -= RULES.levelOdds[i]; if (x <= 0) return i; } return 0; })();
  const pool = cardPool(S, st).filter(p => !taken.has(p.id));
  if (lv === 4 && legends && legends.length) {
    const lp = legends.filter(l => !st.seen.includes(l.id) && !taken.has(l.id));
    if (lp.length) return lp[Math.floor(r() * lp.length)].id;
  }
  // Best level at or below the one drawn that still has players; then above.
  for (let want = Math.min(lv, 3); want >= 0; want--) {
    const at = pool.filter(p => p.lv === want);
    if (at.length) return at[Math.floor(r() * at.length)].id;
  }
  return pool.length ? pool[Math.floor(r() * pool.length)].id : null;
}
function newRoll(st, S) {
  const w = currentWindow(st);
  const spin = (st.roll && st.roll.key === `${st.rollIx}.${st.rollStep}`) ? st.roll.spin + 1 : 0;
  const r = stream(st.seed, "roll", st.rollIx, st.rollStep, spin);
  const taken = new Set(), cards = [];
  for (let k = 0; k < 3; k++) { const id = drawCard(r, S, st, S.legends, taken); if (id != null) { cards.push(id); taken.add(id); } }
  st.roll = { key: `${st.rollIx}.${st.rollStep}`, spin, cards, window: w ? w.kind : "reg", step: st.rollStep + 1, of: w ? w.n : 1 };
}
function respinCards(st, S) {
  if (st.phase !== "window" || st.respins < 1 || !st.roll) return false;
  st.respins--;
  for (const id of st.roll.cards) if (!st.seen.includes(id)) st.seen.push(id);   // never again this run
  newRoll(st, S);
  st.log.push(["respin"]);
  return true;
}
function signPreview(st, S, cardId, legends) {
  // Rating change for each shirt if this card took it.
  const p = playerOf(S, cardId, legends);
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  const base = userStrength(S, st, legends);
  return slots.map((pos, i) => {
    const xi = st.xi.slice(); xi[i] = cardId;
    const s = userStrength(S, Object.assign({}, st, { xi }), legends);
    return { slot: i, pos, fit: fitOf(p, pos), delta: s.ovr - base.ovr, def: s.def - base.def, mid: s.mid - base.mid, att: s.att - base.att };
  });
}
function sign(st, S, cardId, slot) {
  if (st.phase !== "window" || !st.roll || !st.roll.cards.includes(cardId)) return false;
  const out = st.xi[slot];
  st.xi[slot] = cardId;
  const p = playerOf(S, cardId, S.legends);
  st.signed.push({ id: cardId, gw: st.gw, slot, out, from: p ? p.c : null, date: st.fixtures[st.gw - 1].date });
  if (p && p.c != null && !String(cardId).startsWith("L:")) {
    st.gone.push(cardId);
    st.raids.push({ club: p.c, date: st.fixtures[st.gw - 1].date, gw: st.gw });
  }
  finishRoll(st, S);
  st.log.push(["sign", cardId, slot]);
  return true;
}
function pass(st, S) {
  if (st.phase !== "window" || !st.roll) return false;
  finishRoll(st, S);
  st.log.push(["pass"]);
  return true;
}
function finishRoll(st, S) {
  for (const id of st.roll.cards) if (!st.seen.includes(id)) st.seen.push(id);
  const w = currentWindow(st);
  st.rollStep++;
  if (w && st.rollStep < w.n) { newRoll(st, S); return; }
  st.rollIx++; st.rollStep = 0; st.roll = null;
  st.phase = "prematch";
}

/* ---------- raids: weakening other clubs ---------- */
function goneBefore(st, date) {
  const s = new Set();
  st.signed.forEach(x => { if (x.date <= date && !String(x.id).startsWith("L:")) s.add(x.id); });
  return s;
}
function strengthLoss(S, club, gone, cache) {
  const key = club + ":" + [...gone].filter(id => { const p = indexSeason(S).byId.get(id); return p && (p.c === club || p.c2 === club); }).sort().join(",");
  if (cache && cache.has(key)) return cache.get(key);
  const full = clubStrength(S, club, new Set()).ovr, now = clubStrength(S, club, gone).ovr;
  const L = Math.max(0, (full - now) / Math.max(5, full - RULES.raidBaseline));
  if (cache) cache.set(key, L);
  return L;
}
// The other clubs' results, with raided clubs' wins and draws downgraded by chance.
function otherResults(S, st) {
  const ix = indexSeason(S), cache = new Map(), out = [];
  for (const m of ix.matches) {
    if (m.h === st.club || m.a === st.club) continue;
    let hg = m.hg, ag = m.ag, changed = false;
    if (st.signed.length) {
      const gone = goneBefore(st, m.date);
      for (const side of ["h", "a"]) {
        const club = side === "h" ? m.h : m.a;
        const L = strengthLoss(S, club, gone, cache);
        if (L <= 0) continue;
        const chance = Math.min(RULES.raidCap, RULES.raidFactor * L);
        const u = unit(st.seed, "raid", m.i, side);
        if (u >= chance) continue;
        const mine = side === "h" ? hg : ag, theirs = side === "h" ? ag : hg;
        if (mine > theirs) { if (side === "h") hg = ag; else ag = hg; changed = true; }          // win becomes a draw
        else if (mine === theirs) { if (side === "h") ag++; else hg++; changed = true; }         // draw becomes a defeat
      }
    }
    out.push({ i: m.i, date: m.date, h: m.h, a: m.a, hg, ag, changed });
  }
  return out;
}

/* ---------- match simulation ---------- */
function expectedGoals(us, them, home) {
  const M = RULES.match;
  const x = M.att * (us.att - them.def) + M.mid * (us.mid - them.mid) + (home ? M.home : M.away);
  return Math.min(M.cap, M.base * Math.exp(x));
}
function scorerWeights(players, slots) {
  return players.map((p, i) => {
    const pos = slots ? slots[i] : null;
    const role = pos ? SLOTW[pos][2] : ({ GK: 0, DEF: 0.15, MID: 0.5, FWD: 1.25 })[p.b] ?? 0.5;
    const goals = (p.g || 0) / Math.max(1, p.a || 1);
    return { p, w: Math.max(0.02, role * 0.6 + goals * 4) };
  });
}
function simMatch(S, st, gw) {
  const fx = st.fixtures[gw - 1];
  const legends = S.legends;
  const us = userStrength(S, st, legends);
  const gone = goneBefore(st, fx.date);
  const them = clubStrength(S, fx.opp, gone);
  const r = stream(st.seed, "match", gw);
  const lu = expectedGoals(us, them, fx.home), lt = expectedGoals(them, us, !fx.home);
  const gu = poisson(r, lu), gt = poisson(r, lt);
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  const ours = scorerWeights(st.xi.map(id => playerOf(S, id, legends)), slots);
  const theirsXI = clubXI(S, fx.opp, gone);
  const theirs = scorerWeights(theirsXI.map(p => Object.assign({}, p, { b: p.b || "MID" })), null);
  const events = [];
  for (let k = 0; k < gu; k++) events.push({ us: true, min: 1 + Math.floor(r() * 90), who: pickWeighted(r, ours, o => o.w).p });
  for (let k = 0; k < gt; k++) events.push({ us: false, min: 1 + Math.floor(r() * 90), who: pickWeighted(r, theirs, o => o.w).p });
  events.sort((a, b) => a.min - b.min);
  return {
    gw, date: fx.date, opp: fx.opp, home: fx.home, real: fx.real, us: gu, them: gt,
    xg: [lu, lt],
    events: events.map(e => ({ us: e.us, min: e.min, id: e.who.id, name: e.who.n }))
  };
}
function playMatch(st, S) {
  if (st.phase !== "prematch") return null;
  const res = simMatch(S, st, st.gw);
  st.played.push(res);
  st.log.push(["match", st.gw]);
  st.lastResult = res;
  if (st.gw >= st.fixtures.length) { st.phase = "summary"; st.final = seasonSummary(S, st); return res; }
  st.gw++;
  if (inWindow(st)) { st.phase = "window"; newRoll(st, S); }
  else st.phase = "prematch";
  return res;
}

/* ---------- table ---------- */
function blankRow(c) { return { c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; }
function addResult(T, h, a, hg, ag) {
  const H = T[h], A = T[a];
  H.p++; A.p++; H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += 3; } else if (hg < ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}
function sortTable(rows) {
  return rows.slice().sort((x, y) => (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (x.c - y.c));
}
// Table up to and including the user's gameweek gw (other clubs by date).
function table(S, st, uptoGw, deductions) {
  const ix = indexSeason(S);
  const T = {}; for (let c = 0; c < ix.nClubs; c++) T[c] = blankRow(c);
  const n = uptoGw == null ? st.played.length : Math.min(uptoGw, st.played.length);
  const until = n >= st.fixtures.length ? "9999" : (st.fixtures[n] ? st.fixtures[n].date : "9999");
  for (const m of otherResults(S, st)) if (m.date < until) addResult(T, m.h, m.a, m.hg, m.ag);
  for (let k = 0; k < n; k++) {
    const r = st.played[k];
    if (r.home) addResult(T, st.club, r.opp, r.us, r.them); else addResult(T, r.opp, st.club, r.them, r.us);
  }
  if (deductions) for (const [c, d] of Object.entries(deductions)) if (T[c]) T[c].pts -= d;
  return sortTable(Object.values(T));
}
function historyTable(S, deductions) {
  const ix = indexSeason(S);
  const T = {}; for (let c = 0; c < ix.nClubs; c++) T[c] = blankRow(c);
  for (const m of ix.matches) addResult(T, m.h, m.a, m.hg, m.ag);
  if (deductions) for (const [c, d] of Object.entries(deductions)) if (T[c]) T[c].pts -= d;
  return sortTable(Object.values(T));
}
// The club's real league position after each of its fixtures.
function historyPositions(S, club) {
  const ix = indexSeason(S);
  const T = {}; for (let c = 0; c < ix.nClubs; c++) T[c] = blankRow(c);
  const out = []; const ms = ix.matches;
  const fx = ms.filter(m => m.h === club || m.a === club);
  let k = 0;
  for (const f of fx) {
    while (k < ms.length && ms[k].date <= f.date) { const m = ms[k]; addResult(T, m.h, m.a, m.hg, m.ag); k++; }
    out.push(sortTable(Object.values(T)).findIndex(r => r.c === club) + 1);
  }
  return out;
}
function positionsSoFar(S, st) {
  const out = [];
  for (let g = 1; g <= st.played.length; g++) out.push(table(S, st, g, S.deductions).findIndex(r => r.c === st.club) + 1);
  return out;
}

/* ---------- end of season ---------- */
function seasonSummary(S, st) {
  const ded = S.deductions || null;
  const mine = table(S, st, null, ded), hist = historyTable(S, ded);
  const finish = mine.findIndex(r => r.c === st.club) + 1, histFinish = hist.findIndex(r => r.c === st.club) + 1;
  const row = mine[finish - 1], hrow = hist[histFinish - 1];
  const nC = mine.length, relN = S.relegationPlaces || 3;
  const changes = [];
  if (mine[0].c !== hist[0].c) changes.push({ kind: "champion", club: mine[0].c, was: hist[0].c });
  const relMine = new Set(mine.slice(nC - relN).map(r => r.c)), relHist = new Set(hist.slice(nC - relN).map(r => r.c));
  for (const c of relMine) if (!relHist.has(c) && c !== st.club) changes.push({ kind: "down", club: c });
  for (const c of relHist) if (!relMine.has(c) && c !== st.club) changes.push({ kind: "saved", club: c });
  // Goals and appearances for your players this season.
  const goals = {}; for (const r of st.played) for (const e of r.events) if (e.us) goals[e.id] = (goals[e.id] || 0) + 1;
  const topScorer = Object.entries(goals).sort((a, b) => b[1] - a[1])[0] || null;
  // Best signing: biggest rating gain over the player he replaced, weighted by games played for you.
  let best = null;
  for (const s of st.signed) {
    const p = playerOf(S, s.id, S.legends), o = s.out != null ? playerOf(S, s.out, S.legends) : null;
    const games = st.fixtures.length - s.gw + 1;
    const gain = ((p ? p.r : 0) - (o ? o.r : 50)) * games;
    if (!best || gain > best.gain) best = { id: s.id, gain, gw: s.gw };
  }
  const potw = st.xi.map(id => playerOf(S, id, S.legends)).filter(Boolean)
    .map(p => ({ id: p.id, score: p.r + (goals[p.id] || 0) * 1.5 })).sort((a, b) => b.score - a.score)[0];
  const stars = { survive: finish <= nC - relN, tophalf: finish <= nC / 2, champions: finish === 1 };
  return {
    finish, histFinish, rise: histFinish - finish, pts: row.pts, histPts: hrow.pts, gained: row.pts - hrow.pts,
    w: row.w, d: row.d, l: row.l, gf: row.gf, ga: row.ga, table: mine, histTable: hist,
    changes, topScorer: topScorer ? { id: topScorer[0], goals: topScorer[1] } : null,
    bestSigning: best, playerOfSeason: potw ? potw.id : null, positions: positionsSoFar(S, st), history: st.history, stars
  };
}

const API = {
  RULES, LEVELS, POS, NEAR, SLOT_BROAD, broadOf, FORMATIONS, FORMATION_NAMES, hash32, rng, stream, unit,
  fitOf, effRating, indexSeason, playerOf, xiStrength, userStrength, clubXI, clubStrength,
  schedule, fixturesOf, newRun, offerClubs, respinClubs, chooseClub, autoXI, setFormation, swapSetup, squadOf,
  startSeason, inWindow, currentWindow, newRoll, respinCards, signPreview, sign, pass,
  otherResults, strengthLoss, expectedGoals, simMatch, playMatch, table, historyTable, historyPositions, positionsSoFar, seasonSummary
};
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.D2T = API;
})(typeof window !== "undefined" ? window : globalThis);
