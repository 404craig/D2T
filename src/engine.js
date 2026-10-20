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
  // bronze silver gold purple legend (docs/cards/ICONS.md for who is purple and legend). Craig, 15 Oct: a Classic game shows
  // about 66 cards (17 rolls and 5 respins, 3 each); purple 3% and legend 1% of draws, so a purple about every half season
  // and a legend about every 1.5 seasons, gold 40% with the rating-weighted draws (elite, below) carrying the title lift.
  // His pick over purple 1.5% and legend 0.6%, which needed gold at 50% and left two goes sharing 40% of their cards for
  // the same title rate. Balance and the trade-off table are in ICONS.md and CLAUDE.md.
  // 18 Oct (the engine rethink, docs/SCOPE_ENGINE.md): purple 3%, legend 1%, and every season puts one legend on the table
  // (legendRoll below) so a player who only plays a few games always meets one; whether he takes him is the game.
  // 19 Oct: gold 36% (was 41%; the game was too easy, and more silver and bronze in the rolls makes a gold count for more).
  levelOdds: [0.37, 0.23, 0.36, 0.03, 0.01],
  // Stars play above their number, for the user's XI only (Craig, 18 Oct: history's clubs play as they did; your built side
  // is where the stars count): above `from` each rating point counts `slope` for his level (purple 1.5, legend 2; a gold
  // plays at his number, so the levels matter, not just the rating), so an 89 purple plays as 93.5 and a 93 legend as 106.
  // The card shows his real rating. Tuned 18 Oct (tests/calibrate-all.js, tests/landed.js): with gold at 1.2 to 1.5 the
  // whole XI lifted and an average player won the title 8.5% to 15.7% of the time; at 1 / 1.5 / 2 it is 5.7% (Craig's 5%).
  // cap: the whole XI's lift above its numbers is capped (19 Oct: a side of legends played at 100+ and a Club X career won
  // nine titles in nine seasons); about two legends' worth, so the third star adds his number, not his aura.
  star: { from: 80, slope: [1, 1, 1, 1.5, 2], cap: 24 },
  // Transfers out (Craig, 19 Oct): one of your players is taken at the start of the January window in every run (never the
  // keeper, weighted to your stars by (rating / the outfield average) to this power, to a top-half club by its real final
  // position, never his own real club); a Club X career's Summer poach takes your best outfield player for certain and two
  // more by the same weight. The club he joins is stronger for it from that date (joinersOf), as a raid is in reverse.
  raidOut: { janPower: 6, poachPower: 6, janTopHalf: true },
  // A Club X career's carried cards age (19 Oct): a player with no real card for the new season keeps his old one for a
  // season, then loses `perSeason` a season (a 1998/99 legend cannot play on at 93 in 2018/19). agedRating.
  aging: { free: 1, perSeason: 3, floor: 55 },
  // Tactics (user only): which of your lines settles matches, measured against your own XI's average (O). k is 1 in a shape
  // the tactic is built for and 0.5 in any other, so the shape decides how hard the tactic bites and never pays on its own.
  tactics: {
    mid: {},
    low: { shapes: ["5-3-2", "4-5-1"], defUp: 0.9, attDown: 0.35 },
    press: { shapes: ["4-3-3", "3-4-3", "4-2-3-1"], attUp: 0.9, defDown: 0.35 },
    poss: { shapes: ["4-3-3", "4-2-3-1", "3-5-2"], midInto: 0.5 },
    counter: { shapes: ["4-4-2", "3-5-2", "5-3-2"], fwd: 0.5, fwdCap: 4, attCost: 3, defUp: 0.5 }
  },
  halfShape: 0.5,
  // the lines are not on quite the same scale (keepers rate high, so a defence reads a shade above its XI): a tactic
  // measures each line's edge against the real clubs' average offsets, so no tactic is the right pick for everyone
  lineOffset: { def: 0.26, mid: -0.54, att: 0.11 },
  // Settling in (Craig, 18 Oct): a new signing hits the ground running, settles in over two games at halfway, or takes
  // three games climbing from a quarter of the way up; seeded per card. He never plays below the shirt's rating before.
  // Purples and legends always hit the ground running (Craig, 18 Oct).
  settle: { run: [0.3, 0.3, 0.3, 1, 1], slow: [0.2, 0.2, 0.2, 0, 0], floor: 60 },
  // Scouting: 2 respins for three cards green in one shirt and better than the man in it (never a legend card).
  scoutCost: 2,
  // Raids: a raided club's real scorelines shrink by what its XI lost, through the match model's own sensitivity (m), and
  // harder the better the opponent (amp = a - b x the opponent's real final position, never under min): losing Keane,
  // Beckham and Scholes costs Man Utd 2000/01 about 19 of their 32 points against the top half and 10 of 48 against the
  // bottom half (Craig, 18 Oct: 29 / 25 / 20 of 32 with one, two, three of them gone; measured 29 / 24 / 19).
  raid: { m: 2.5, amp: [1.6, 0.06], min: 0.3 },
  // Anti-repeat (Craig, 13 Oct: a club-season must never serve the same players run after run). The app remembers the cards
  // each of the last three runs of a club-season offered (per phone) and hands them in as `recent`: a card from the last run
  // is drawn at a tenth of the weight of a fresh one, from the run before at a quarter, from the one before that at half.
  // The level odds are untouched, so balance holds; only which faces come up within a level changes.
  recent: [0.1, 0.25, 0.5],
  // From gold up (`from`: level 2) a card's draw weight within its level doubles every `step` rating points above `mid`
  // (pickCard; mid only sets the scale, the step sets the slope: a 93 is drawn twice as often as a 90, an 87 half).
  elite: { from: 2, mid: 90, step: 3 },
  // green: his main position 100%, his other preferred positions 95% (alt); amber next to one of them; red elsewhere.
  fit: { green: 1, alt: 0.95, amber: 0.9, red: 0.7 },
  raidBaseline: 60,        // strengthLoss: strength lost as a share of strength above this (the tests and screens read it)
  // Fitted to every PL result (tests/fit-match.js, 13 Oct: a converged fit; the old numbers gave 3.4 goals a game against 2.7
  // real and twice the real share of 5-goal margins). On real fixtures the model gives 2.70 goals a game, 23.7% draws and 2.2%
  // of matches won by 5 or more (real: 2.69, 25.6%, 2.0%).
  // Refitted 18 Oct with the new slot weights and the defender lift (model 2.695 goals a game, real 2.695).
  match: { base: 1.279, att: 0.0408, mid: 0.0055, home: 0.138, away: -0.138, cap: 6 }
};
const LEVELS = ["bronze", "silver", "gold", "purple", "legend"];

/* ---------- positions and formations ---------- */
const POS = ["GK","RB","CB","LB","RWB","LWB","CDM","CM","CAM","RM","LM","RW","LW","ST"];
// How a player fits each shirt, by the positions he plays (Craig, 13 Oct; set on the Position fit page,
// claude.ai/artifact/Xod2g9hMPi9QHxqnkCtjWD). Stay in your lane: a player in the middle never goes amber out wide,
// a wide player never goes amber in the middle or on the other side. Shirts not listed are red. A player with several
// positions is green at all of them and takes the best colour any of them gives (Pearce, CB and LB: green CB, LB and
// LWB; amber CDM, LM and LW; red on the right).
const FIT = {
  GK: {}, CB: { CDM: "amber" },
  LB: { LWB: "green", LM: "amber", LW: "amber" }, RB: { RWB: "green", RM: "amber", RW: "amber" },
  LWB: { LB: "green", LM: "amber", LW: "amber" }, RWB: { RB: "green", RM: "amber", RW: "amber" },
  CDM: { CB: "amber", CM: "amber", CAM: "amber" }, CM: { CDM: "amber", CAM: "amber" }, CAM: { CDM: "amber", CM: "amber", ST: "amber" },
  LM: { LWB: "amber", LW: "amber", CM: "amber" }, RM: { RWB: "amber", RW: "amber", CM: "amber" },
  LW: { LM: "amber", ST: "amber" }, RW: { RM: "amber", ST: "amber" }, ST: { CAM: "amber", LW: "amber", RW: "amber" }
};
// Slot weights into Defence, Midfield, Attack. 18 Oct: a centre back was a sixth of the defence and a striker over a
// quarter of the attack (a rating point on a CB worth 0.17 points a season, on a ST 0.40); now GK 1.8, CB 1.6, ST 1.0,
// measured 0.24 and 0.36: a striker still matters most, by 1.5 times rather than 2.4 (docs/SCOPE_ENGINE.md).
const SLOTW = {
  GK: [1.8, 0, 0], CB: [1.6, 0.15, 0], RB: [0.9, 0.3, 0.15], LB: [0.9, 0.3, 0.15],
  RWB: [0.7, 0.5, 0.25], LWB: [0.7, 0.5, 0.25], CDM: [0.5, 1, 0.1], CM: [0.2, 1, 0.3],
  CAM: [0, 0.6, 0.8], RM: [0.1, 0.8, 0.5], LM: [0.1, 0.8, 0.5],
  RW: [0, 0.3, 0.85], LW: [0, 0.3, 0.85], ST: [0, 0.1, 1.0]
};
const TACTIC_NAMES = ["mid", "low", "poss", "counter", "press"];
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

// p is his preferred positions for the season, main first (from the match line-ups, built by
// tools/positions_rule.py). Without them, p holds the broad position and fit is judged on that.
const SLOT_BROAD = { GK: "GK", RB: "DEF", CB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", RM: "MID", LM: "MID", RW: "FWD", LW: "FWD", ST: "FWD" };
const NEAR_BROAD = { GK: [], DEF: ["MID"], MID: ["DEF", "FWD"], FWD: ["MID"] };
function broadOf(player) { return player.b || SLOT_BROAD[(player.p || [])[0]] || "MID"; }
function fitOf(player, slotPos) {
  if (!player) return "red";
  const ps = player.p || [];
  if (ps.some(p => SLOT_BROAD[p]) ) {                 // detailed positions known
    if (ps.includes(slotPos)) return "green";
    const got = ps.map(p => (FIT[p] || {})[slotPos]);
    return got.includes("green") ? "green" : got.includes("amber") ? "amber" : "red";
  }
  const pb = broadOf(player), sb = SLOT_BROAD[slotPos];
  if (pb === sb) return "green";
  if ((NEAR_BROAD[sb] || []).includes(pb)) return "amber";
  return "red";
}
// Keepers only ever play in goal and outfield players never do (Craig, 20 Oct): no shirt, swap, sign, draft or re-seat crosses that line.
function isGK(p) { return !!p && broadOf(p) === "GK"; }
function canPlay(p, slotPos) { return !!p && isGK(p) === (slotPos === "GK"); }
function effRating(player, slotPos) {
  if (!player) return 40;
  const f = fitOf(player, slotPos), main = (player.p || [])[0];
  return player.r * (f === "green" && SLOT_BROAD[main] && main !== slotPos ? RULES.fit.alt : RULES.fit[f]);
}

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
  // Legend ids are "L:<name>:<season>"; runs saved before that used "L:<name>" (the alias of his best card).
  if (legends && String(id).startsWith("L:")) return legends.find(l => l.id === id) || legends.find(l => l.alias === id) || null;
  return null;
}
// The club a player was at on a date: a January mover belongs to his second club from his first game for it (m2).
function clubAt(p, date) {
  if (!p) return null;
  return p.c2 != null && p.m2 && date && date >= p.m2 ? p.c2 : p.c;
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
// A star's rating as the match sees it (user's XI only): above RULES.star.from each point counts his level's slope.
function starRating(p) {
  const S = RULES.star; if (!p || p.r <= S.from) return p ? p.r : 40;
  return S.from + (p.r - S.from) * (S.slope[p.lv || 0] || 1);
}
// How a signing plays in his gw-th game for you while he settles (the signed entry's `settle`): null when settled.
function settledRating(p, s, gw) {
  if (!s || !s.settle || !s.settle.games || gw == null) return null;
  const played = gw - s.gw; if (played < 0 || played >= s.settle.games) return null;
  const progress = s.settle.games === 2 ? 0.5 : (played + 1) / (s.settle.games + 1);
  const from = Math.min(s.settle.from, p.r);
  return from + (p.r - from) * progress;
}
// Your XI as the match plays it: settling signings at their settling rating (opts.gw), stars above their number
// (opts.star, default on), then the tactic's lean on your lines (opts.tactic, default on; the shape sets how hard).
// plainStrength is the squad as the card numbers say, for the team rating on the screens.
function userStrength(S, st, legends, opts) {
  opts = opts || {};
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  const bySigned = opts.gw != null ? new Map((st.signed || []).map(s => [String(s.id), s])) : null;
  const players = st.xi.map(id => {
    const p = playerOf(S, id, legends); if (!p) return p;
    let r = p.r;
    if (bySigned) { const sr = settledRating(p, bySigned.get(String(id)), opts.gw); if (sr != null) r = sr; }
    if (opts.star !== false) r = starRating(Object.assign({}, p, { r }));
    return r === p.r ? p : Object.assign({}, p, { r, base: p.r });
  });
  // the dressing room: the XI's lift above its numbers is capped (RULES.star.cap), every star scaled alike
  if (opts.star !== false && RULES.star.cap) {
    const lift = players.reduce((a, p) => a + (p && p.base != null ? Math.max(0, p.r - p.base) : 0), 0);
    if (lift > RULES.star.cap) { const f = RULES.star.cap / lift; players.forEach((p, i) => { if (p && p.base != null && p.r > p.base) players[i] = Object.assign({}, p, { r: p.base + (p.r - p.base) * f }); }); }
  }
  const lines = xiStrength(players, slots);
  if (opts.tactic === false) return lines;
  return tacticLines(st, lines, players, slots);
}
function plainStrength(S, st, legends) { return userStrength(S, st, legends, { star: false, tactic: false }); }
// The tactic's effect on your lines (RULES.tactics): everything is measured against your own XI's average, so a
// tactic pays when the line it leans on is your strength and costs when it is your weakness; in a shape it is built
// for it bites in full, in any other at half (RULES.halfShape). Mid block changes nothing.
function tacticOf(st) { return RULES.tactics[st.tactic] ? st.tactic : "mid"; }
function tacticLines(st, L, players, slots) {
  const name = tacticOf(st), T = RULES.tactics[name];
  if (name === "mid") return L;
  const k = (T.shapes || []).includes(st.formation) ? 1 : RULES.halfShape, O = L.ovr, X = RULES.lineOffset;
  const eD = L.def - X.def - O, eM = L.mid - X.mid - O, eA = L.att - X.att - O;   // each line's edge over the XI
  const out = Object.assign({}, L);
  if (name === "low") { out.def = L.def + T.defUp * k * eD; out.att = L.att - T.attDown * k * eA; }
  else if (name === "press") { out.att = L.att + T.attUp * k * eA; out.def = L.def - T.defDown * k * eD; }
  else if (name === "poss") { out.def = L.def + T.midInto * k * (eM - eD); out.att = L.att + T.midInto * k * (eM - eA); }
  else if (name === "counter") {
    let F = 0; slots.forEach((pos, i) => { if (SLOT_BROAD[pos] === "FWD") F = Math.max(F, effRating(players[i], pos)); });
    out.att = L.att + k * (Math.min(T.fwdCap, T.fwd * (F - L.att)) - T.attCost); out.def = L.def + T.defUp * k;
  }
  return out;
}
function setTactic(st, name) {
  if (!RULES.tactics[name] || !["setup", "window", "prematch", "draft"].includes(st.phase)) return false;
  if (tacticOf(st) === name) return true;
  st.tactic = name; st.log.push(["tactic", name]);
  return true;
}
// what a signing's settling will be, seeded per card (never for a card already in the XI, a draft pick or a free agent)
function agedRating(r, age) { const A = RULES.aging; return Math.max(A.floor, Math.min(r, r - A.perSeason * Math.max(0, (age || 0) - A.free))); }
function settleOf(st, p, outRating) {
  const u = unit(st.seed, "settle", p.id), lv = p.lv || 0, R = RULES.settle;
  if (u < R.run[lv]) return null;
  const from = Math.max(R.floor, outRating == null ? R.floor : outRating);
  return u < R.run[lv] + R.slow[lv] ? { games: 3, from } : { games: 2, from };
}
// A historical club's best XI from its real squad, minus anyone the user has signed.
// Broad shape: 1 GK, 4 DEF, 4 MID, 2 FWD by rating, weighting regular starters.
// join: players who joined the club from outside its real squad (a Club X career's poached players, poach below).
function clubXI(S, club, gone, join) {
  const ix = indexSeason(S);
  const pool = (ix.byClub.get(club) || []).filter(p => !gone.has(p.id)).concat(join || []);
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
function clubStrength(S, club, gone, join) {
  const xi = clubXI(S, club, gone, join);
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
// The weights for `recent`: runs is a list of the cards offered by recent runs of the club-season, newest first; a card in
// more than one takes the lowest weight. Null when there is nothing to avoid.
function recentWeights(runs) {
  const w = {};
  (runs || []).slice(0, RULES.recent.length).forEach((ids, i) => { for (const id of ids || []) if (w[id] == null || w[id] > RULES.recent[i]) w[id] = RULES.recent[i]; });
  return Object.keys(w).length ? w : null;
}
function newRun(opts) {
  // opts: { seed, catalogue:[{key, season, club, ...}], fixedClub?, recent? }
  // recent: { cardId: weight } for cards offered in recent runs of the club-season (recentWeights), kept on the run so a
  // seed and its history always replay the same; offered: every card every roll put on the table (for the next run's recent).
  const st = {
    v: 1, seed: String(opts.seed), mode: opts.mode || "classic",
    phase: "clubroll", respins: RULES.respins, clubSpin: 0,
    clubOffer: [], seasonKey: null, club: null,
    formation: null, xi: [], gw: 0, rolls: [], rollIx: 0, rollStep: 0,
    roll: null, seen: [], signed: [], gone: [], raids: [], played: [], log: [],
    recent: opts.recent || null, offered: []
  };
  if (opts.fixedClub) { st.clubOffer = [opts.fixedClub]; }
  else st.clubOffer = offerClubs(st, opts.catalogue);
  return st;
}
// Club X spins one season at a time (Craig, 12 Oct: one central spin); the other modes offer three.
function offerClubs(st, catalogue) {
  const r = stream(st.seed, "club", st.clubSpin);
  const pool = catalogue.slice(), out = [], n = st.mode === "clubx" ? 1 : 3;
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].key);
  return out;
}
function respinClubs(st, catalogue) {
  if (st.phase !== "clubroll" || st.respins < 1) return false;
  st.respins--; st.clubSpin++; st.clubOffer = offerClubs(st, catalogue);
  st.log.push(["clubspin"]);
  return true;
}
function chooseClub(st, S, rel) {
  // rel = { c, f, xi } for the chosen club-season
  st.seasonKey = S.season; st.club = rel.c;
  st.formation = FORMATIONS[rel.f] ? rel.f : "4-4-2";
  st.log.push(["club", S.season, rel.c]);
  if (DRAFT_MODES.includes(st.mode)) { startDraft(st, S); return; }
  st.xi = autoXI(S, rel.c, st.formation, rel.xi);
  st.phase = "setup";
}

/* ---------- Dare2Dream and Club X draft: start with no players, one spin per shirt ---------- */
// Club X (Craig, 11 Oct): your own club replaces the season's bottom side, drafts 11 the same way and must win the league.
const DRAFT_MODES = ["dare2dream", "clubx"];
// Dare2Dream fills keeper first, then defence, midfield and attack, each spin three players for that shirt's position.
// Club X (Craig, 13 Oct) fills them in any order: each of the three cards is drawn for one of the open shirts (each open shirt
// as likely as the next), from players who are green there (they list it, or FIT makes it green), and he goes on any open
// shirt, green, amber or red; the shape can change after every spin, the players already in are re-seated. All from the same season, never your club's own squad, never one seen before. No respins in the draft.
// A drafted player leaves his real club for the whole season, like a signing (a raid dated before the season).
const BROAD_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
function draftOrder(formation) {
  const f = FORMATIONS[formation];
  return f.map((_, i) => i).sort((a, b) => BROAD_ORDER[SLOT_BROAD[f[a][0]]] - BROAD_ORDER[SLOT_BROAD[f[b][0]]] || a - b);
}
function shuffledOrder(st) {
  const r = stream(st.seed, "draftorder", st.formation), a = FORMATIONS[st.formation].map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Does he list this position? Players without detailed positions fall back to the broad one.
function listsPos(p, pos) {
  const d = (p.p || []).filter(x => SLOT_BROAD[x]);
  return d.length ? d.includes(pos) : broadOf(p) === SLOT_BROAD[pos];
}
const openDraft = (st) => st.mode === "clubx" && !st.draft.order;
const openSlots = (st) => st.xi.map((id, i) => (id == null ? i : -1)).filter(i => i >= 0);
// The open shirts a drafted card can go on: every open one, best first (his main position, then green, amber, red).
function draftFits(st, S, cardId) {
  const p = playerOf(S, cardId, S.legends), open = openSlots(st), f = FORMATIONS[st.formation];
  if (!p || !openDraft(st)) return open;
  const main = (p.p || [])[0], rank = (i) => (f[i][0] === main ? 0 : { green: 1, amber: 2, red: 3 }[fitOf(p, f[i][0])]);
  return open.filter(i => canPlay(p, f[i][0])).sort((a, b) => rank(a) - rank(b) || a - b);
}
function startDraft(st, S) {
  st.xi = new Array(FORMATIONS[st.formation].length).fill(null);
  st.seen = squadOf(S, st.club).map(p => p.id);
  st.draft = { step: 0 };
  st.phase = "draft";
  newDraftRoll(st, S);
}
function draftSlot(st) { return openDraft(st) ? null : (st.draft.order || draftOrder(st.formation))[st.draft.step]; }
function newDraftRoll(st, S) {
  const r = stream(st.seed, "draft", st.draft.step);
  const taken = new Set(), cards = [];
  if (openDraft(st)) {
    const open = openSlots(st), f = FORMATIONS[st.formation];
    for (let k = 0; k < 3; k++) {
      const pos = f[open[Math.floor(r() * open.length)]][0];
      // Club X's first 11 are never purple or legend cards (Craig, 20 Oct): a purple drawn comes down to gold
      const id = drawCard(r, S, st, S.legends, taken, null, (p) => fitOf(p, pos) === "green" && p.lv < 3);
      if (id != null) { cards.push(id); taken.add(id); }
    }
    st.roll = { key: `d${st.draft.step}`, spin: 0, cards, window: "draft", slot: null, step: st.draft.step + 1, of: st.xi.length };
    noteOffered(st, cards);
    return;
  }
  const slot = draftSlot(st), broad = SLOT_BROAD[FORMATIONS[st.formation][slot][0]];
  for (let k = 0; k < 3; k++) { const id = drawCard(r, S, st, S.legends, taken, broad); if (id != null) { cards.push(id); taken.add(id); } }
  st.roll = { key: `d${st.draft.step}`, spin: 0, cards, window: "draft", slot, step: st.draft.step + 1, of: st.xi.length };
  noteOffered(st, cards);
}
// The shape can change until the first pick; in Club X's open draft at any time, the players already in re-seated to the
// shirts they fit best and the three cards on the table kept (no fresh cards from a change of shape).
function draftFormation(st, S, f) {
  if (st.phase !== "draft" || !FORMATIONS[f]) return false;
  if (openDraft(st) && st.draft.step > 0) { st.xi = reseat(st, S, f); st.formation = f; st.log.push(["formation", f]); return true; }
  if (st.draft.step > 0) return false;
  st.formation = f; st.xi = new Array(FORMATIONS[f].length).fill(null);
  if (st.draft.order) st.draft.order = shuffledOrder(st);
  newDraftRoll(st, S);
  return true;
}
function draftPick(st, S, cardId, at) {
  if (st.phase !== "draft" || !st.roll || !st.roll.cards.includes(cardId)) return false;
  let slot = draftSlot(st);
  if (slot == null) {   // Club X: any open shirt he lists, the one asked for or his best
    const fits = draftFits(st, S, cardId);
    slot = at == null ? fits[0] : (fits.includes(at) ? at : null);   // any open shirt
    if (slot == null) return false;
  }
  const p = playerOf(S, cardId, S.legends);
  st.xi[slot] = cardId;
  for (const id of st.roll.cards) if (!st.seen.includes(id)) st.seen.push(id);
  st.signed.push({ id: cardId, gw: 0, slot, out: null, from: p ? p.c : null, date: "0000-00-00", draft: true });
  if (p && p.c != null && !String(cardId).startsWith("L:")) {
    st.gone.push(cardId);
    st.raids.push({ club: p.c, date: "0000-00-00", gw: 0 });
  }
  st.log.push(["draft", cardId, slot]);
  st.draft.step++;
  if (st.draft.step >= st.xi.length) { st.roll = null; st.phase = "setup"; return true; }
  newDraftRoll(st, S);
  return true;
}
// A Club X career's next season (Craig, 13 Oct): your XI comes with you. Anyone who belongs to another club this
// season leaves it before the season, like a draft pick (a raid dated before the season).
function carryIn(st, S, ids) {
  st.xi = ids.slice();
  for (let slot = 0; slot < ids.length; slot++) {
    const id = ids[slot], p = playerOf(S, id, S.legends);
    st.signed.push({ id, gw: 0, slot, out: null, from: p ? p.c : null, date: "0000-00-00", draft: true });
    if (p && p.c != null && p.c !== st.club && !String(id).startsWith("L:")) {
      st.gone.push(id);
      st.raids.push({ club: p.c, date: "0000-00-00", gw: 0 });
    }
  }
  st.phase = "setup";
  st.log.push(["carry"]);
}
// Seasons after 2025/26 have no real results: every other match is played out by the match model, from the clubs'
// squads (seeded, so the same career always gets the same season). Your club plays at the strength of your XI.
function simResults(S, seed, meClub, meStrength) {
  const cache = new Map(), none = new Set();
  const str = (c) => { if (c === meClub && meStrength) return meStrength; if (!cache.has(c)) cache.set(c, clubStrength(S, c, none)); return cache.get(c); };
  S.matches = S.matches.map((m, i) => {
    const r = stream(seed, "simseason", S.season, i), h = str(m[1]), a = str(m[2]);
    return [m[0], m[1], m[2], poisson(r, expectedGoals(h, a, true)), poisson(r, expectedGoals(a, h, false))];
  });
  S._ix = null;
  return S;
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
        const best = cands.filter(p => !used.has(p.id) && canPlay(p, pos) && fitOf(p, pos) === tier).sort((x, y) => val(y, pos) - val(x, pos))[0];
        if (best) { xi[i] = best.id; used.add(best.id); }
      });
    }
  };
  if (preferred && preferred.length) place(preferred.map(id => ix.byId.get(id)).filter(Boolean));
  place(squad);
  return xi;
}
// Keep the same players, re-seated to the slots they fit best.
function reseat(st, S, f) {
  const players = st.xi.filter(Boolean).map(id => playerOf(S, id, S.legends));
  const slots = FORMATIONS[f].map(s => s[0]);
  const xi = new Array(slots.length).fill(null), used = new Set();
  for (const tier of ["green", "amber", "red"]) {
    slots.forEach((pos, i) => {
      if (xi[i]) return;
      const best = players.filter(p => !used.has(p.id) && canPlay(p, pos) && fitOf(p, pos) === tier).sort((x, y) => y.r - x.r)[0];
      if (best) { xi[i] = best.id; used.add(best.id); }
    });
  }
  // nobody is ever lost by a change of shape: a second keeper, say, takes an empty shirt rather than vanishing
  const left = players.filter(p => !used.has(p.id));
  slots.forEach((pos, i) => { if (xi[i] == null && left.length) { xi[i] = left.shift().id; } });
  return xi;
}
function setFormation(st, S, f) {
  if (!["setup", "window", "prematch"].includes(st.phase)) return false;
  if (!FORMATIONS[f]) return false;
  st.xi = reseat(st, S, f); st.formation = f;
  st.log.push(["formation", f]);
  return true;
}
function swapSetup(st, slot, playerId, S) {
  if (st.phase !== "setup") return false;
  const other = st.xi.indexOf(playerId);
  if (S) {   // a keeper only in goal, an outfield player never (both ways round)
    const f = FORMATIONS[st.formation], pin = playerOf(S, playerId, S.legends), pout = st.xi[slot] != null ? playerOf(S, st.xi[slot], S.legends) : null;
    if (!canPlay(pin, f[slot][0])) return false;
    if (other >= 0 && pout && !canPlay(pout, f[other][0])) return false;
  }
  if (other >= 0) st.xi[other] = st.xi[slot];
  st.xi[slot] = playerId;
  return true;
}
function squadOf(S, club) { return (indexSeason(S).byClub.get(club) || []).slice().sort((a, b) => b.r - a.r); }

function startSeason(st, S) {
  if (st.phase !== "setup") return false;
  st.fixtures = fixturesOf(S, st.club);
  st.rolls = schedule(st.fixtures);
  // Dare2Dream's draft is its pre-season: no pre-season rolls. A Club X career's later seasons (st.career > 1) have
  // no draft, so they get Classic's pre-season rolls back.
  if (DRAFT_MODES.includes(st.mode) && !(st.career > 1)) st.rolls = st.rolls.filter(w => w.kind !== "pre");
  st.rollIx = 0; st.rollStep = 0; st.gw = 1;
  st.seen = [...new Set((st.seen || []).concat(st.xi))];
  // Your own club's real squad never turns up as a card.
  for (const p of squadOf(S, st.club)) if (!st.seen.includes(p.id)) st.seen.push(p.id);
  st.history = historyPositions(S, st.club);
  if (inWindow(st)) { st.phase = "window"; newRoll(st, S); }
  else { st.phase = "prematch"; fillHoles(st, S); }
  st.log.push(["start"]);
  return true;
}

/* ---------- the roll ---------- */
function currentWindow(st) { return st.rolls[st.rollIx] || null; }
function inWindow(st) { const w = currentWindow(st); return !!(w && w.gw === st.gw && st.rollStep < w.n); }
function cardPool(S, st) {
  const seen = new Set(st.seen);
  // In a Club X career a season can hold more than one card of the same man (cards from any season after 2025/26):
  // never offer another card of someone already in your XI.
  let mine = null;
  if (st.career > 1) { mine = new Set(); for (const id of st.xi.concat((st.poached || []).map(x => x.id))) { const p = playerOf(S, id, S.legends); if (p && p.k != null) mine.add(p.k); } }
  return S.players.filter(p => (p.a || 0) >= RULES.minApps && !seen.has(p.id) && !(mine && p.k != null && mine.has(p.k)));
}
// One card from a level's pool: every player as likely as the next, except those offered in recent runs of this
// club-season (st.recent), who come up at their recent weight, and gold, purple and legend cards, which come up by
// rating (RULES.elite: doubling every `step` points, so with step 3 a 99 is drawn 8 times as often as a 90 and an 81 an
// eighth as often; the purple and legend pools hold honoured and iconic cards from the high 70s up, Craig 15 Oct).
// Without a history or a weighted pool the draw is a plain uniform pick.
function eliteWeight(p) { return p.lv >= RULES.elite.from ? Math.pow(2, (p.r - RULES.elite.mid) / RULES.elite.step) : 1; }
function pickCard(r, st, pool) {
  const rw = st.recent, elite = pool.length && pool[0].lv >= RULES.elite.from;
  if (!rw && !elite) return pool[Math.floor(r() * pool.length)];
  return pickWeighted(r, pool, p => (rw && rw[p.id] != null ? rw[p.id] : 1) * (elite ? eliteWeight(p) : 1));
}
function drawCard(r, S, st, legends, taken, broad, fit, force) {
  const drawn = (() => { let x = r(); for (let i = 0; i < 5; i++) { x -= RULES.levelOdds[i]; if (x <= 0) return i; } return 0; })();
  const lv = force != null ? force : drawn;
  const pool = cardPool(S, st).filter(p => !taken.has(p.id) && (!broad || broadOf(p) === broad) && (!fit || fit(p)));
  if (lv === 4 && legends && legends.length) {
    const lp = legends.filter(l => !st.seen.includes(l.id) && !taken.has(l.id) && (!broad || broadOf(l) === broad) && (!fit || fit(l)));
    if (lp.length) return pickCard(r, st, lp).id;
  }
  // Best level at or below the one drawn that still has players; then above.
  for (let want = Math.min(lv, 3); want >= 0; want--) {
    const at = pool.filter(p => p.lv === want);
    if (at.length) return pickCard(r, st, at).id;
  }
  return pool.length ? pickCard(r, st, pool).id : null;
}
// every card put on the table in this run, for the next run's `recent`
function noteOffered(st, cards) { st.offered = st.offered || []; for (const id of cards) if (!st.offered.includes(id)) st.offered.push(id); }
// Every season puts one legend on the table (Craig, 18 Oct: players play a few games, not a hundred, and every one of
// them should meet a legend): if none has come up by a roll chosen for the season (seeded, the 3rd to the 3rd-last roll),
// that roll's first card is a legend. Rolls that bring one by the odds make it moot.
function legendRoll(st) {
  const total = st.rolls.reduce((a, w) => a + w.n, 0); if (total < 7) return -1;
  return 2 + Math.floor(unit(st.seed, "legendroll", st.career || 1) * (total - 4));
}
function rollIndex(st) { let n = 0; for (let i = 0; i < st.rollIx; i++) n += st.rolls[i].n; return n + st.rollStep; }
function newRoll(st, S) {
  const w = currentWindow(st);
  const spin = (st.roll && st.roll.key === `${st.rollIx}.${st.rollStep}`) ? st.roll.spin + 1 : 0;
  if (spin === 0 && st.fixtures) januaryRaid(st, S);
  const r = stream(st.seed, "roll", st.rollIx, st.rollStep, spin);
  const taken = new Set(), cards = [];
  const due = spin === 0 && rollIndex(st) === legendRoll(st) && !(st.offered || []).some(id => String(id).startsWith("L:"));
  // with outfield shirts empty and the keeper's filled, no keeper comes up (Craig, 20 Oct)
  const fslots = FORMATIONS[st.formation], empty = st.xi.map((id, i) => (id == null ? fslots[i][0] : null)).filter(Boolean);
  const fit = empty.length && !empty.includes("GK") ? (p) => !isGK(p) : null;
  for (let k = 0; k < 3; k++) { const id = drawCard(r, S, st, S.legends, taken, null, fit, due && k === 0 ? 4 : null); if (id != null) { cards.push(id); taken.add(id); } }
  st.roll = { key: `${st.rollIx}.${st.rollStep}`, spin, cards, window: w ? w.kind : "reg", step: st.rollStep + 1, of: w ? w.n : 1 };
  noteOffered(st, cards);
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
  // The change in each shirt if this card took it, as the matches would feel it (stars and the tactic count, so a gold
  // centre back under a low block shows a bigger gain than a gold striker); `delta` is the change in the lines the match
  // uses (attack and defence, with a fifth of the midfield), `ovr` the plain team rating's.
  const p = playerOf(S, cardId, legends);
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  const base = userStrength(S, st, legends), pb = plainStrength(S, st, legends);
  const score = (L) => (L.att + L.def + 0.2 * L.mid) / 2.2;
  return slots.map((pos, i) => {
    const xi = st.xi.slice(); xi[i] = cardId;
    const st2 = Object.assign({}, st, { xi }), s = userStrength(S, st2, legends), ps = plainStrength(S, st2, legends);
    if (!canPlay(p, pos)) return { slot: i, pos, fit: "never", delta: -999, ovr: -999, def: 0, mid: 0, att: 0 };
    return { slot: i, pos, fit: fitOf(p, pos), delta: score(s) - score(base), ovr: ps.ovr - pb.ovr, def: s.def - base.def, mid: s.mid - base.mid, att: s.att - base.att };
  });
}
// ---------- scouting (Craig, 18 Oct) ----------
// For each shirt, how many cards the scouts could bring: this season's cards (never legend cards) green in the shirt and
// rated above the man in it, not seen this run. Zero means nobody better (the shirt is red on the sheet).
function scoutPool(st, S, slot) {
  const pos = FORMATIONS[st.formation][slot][0], holder = st.xi[slot] != null ? playerOf(S, st.xi[slot], S.legends) : null, hr = holder ? holder.r : 0;
  const pool = cardPool(S, st).filter(p => fitOf(p, pos) === "green");
  return { pos, hr, better: pool.filter(p => p.r > hr), below: pool.filter(p => p.r <= hr).sort((a, b) => b.r - a.r || b.a - a.a) };
}
function scoutInfo(st, S) {
  return FORMATIONS[st.formation].map((_, slot) => { const q = scoutPool(st, S, slot); return { slot, pos: q.pos, better: q.better.length, best: q.better.length ? null : (q.below[0] ? q.below[0].id : null) }; });
}
// Spend 2 respins on a shirt: three cards, as many as there are better than the man in it (drawn as a roll draws, so a
// higher-rated card comes up more often), the rest filled with the best below him, each tagged. Refused with nobody better.
function scout(st, S, slot) {
  if (st.phase !== "window" || !st.roll || st.roll.window === "draft" || st.respins < RULES.scoutCost) return false;
  const q = scoutPool(st, S, slot); if (!q.better.length) return false;
  st.respins -= RULES.scoutCost;
  for (const id of st.roll.cards) if (!st.seen.includes(id)) st.seen.push(id);
  const spin = st.roll.spin + 1, r = stream(st.seed, "scout", st.rollIx, st.rollStep, spin), cards = [], tags = [], taken = new Set();
  const w = (p) => Math.pow(2, (p.r - RULES.elite.mid) / RULES.elite.step) * (st.recent && st.recent[p.id] != null ? st.recent[p.id] : 1);
  while (cards.length < 3 && taken.size < q.better.length) { const p = pickWeighted(r, q.better.filter(x => !taken.has(x.id)), w); taken.add(p.id); cards.push(p.id); tags.push("better"); }
  for (const p of q.below) { if (cards.length >= 3) break; cards.push(p.id); tags.push("next"); }
  st.roll = Object.assign({}, st.roll, { spin, cards, scout: slot, tags });
  noteOffered(st, cards);
  st.log.push(["scout", slot]);
  return true;
}
// Scout a club (Craig, 20 Oct): the clubs of the season with cards still to come (never your own), by their final
// position, and the spend of 2 respins on one of them: three of its cards drawn by rating like a roll (never legend cards).
function scoutDate(st) { return st.fixtures && st.gw > 0 && st.fixtures[st.gw - 1] ? st.fixtures[st.gw - 1].date : "0000-00-00"; }
function scoutClubPool(st, S, c) { const d = scoutDate(st); return cardPool(S, st).filter(p => clubAt(p, d) === c && p.c != null); }
function scoutClubs(st, S) {
  const d = scoutDate(st), count = new Map();
  for (const p of cardPool(S, st)) { const c = clubAt(p, d); if (c == null || c === st.club) continue; count.set(c, (count.get(c) || 0) + 1); }
  let order = S.clubs.map((_, i) => i);
  try { order = historyTable(S, S.deductions).map(row => row.c); } catch (e) { /* no table: club order */ }
  return order.filter(c => count.has(c)).map(c => ({ club: c, n: count.get(c) }));
}
function scoutClub(st, S, c) {
  if (st.phase !== "window" || !st.roll || st.roll.window === "draft" || st.respins < RULES.scoutCost || c === st.club) return false;
  const pool = scoutClubPool(st, S, c); if (!pool.length) return false;
  st.respins -= RULES.scoutCost;
  for (const id of st.roll.cards) if (!st.seen.includes(id)) st.seen.push(id);
  const spin = st.roll.spin + 1, r = stream(st.seed, "scoutclub", st.rollIx, st.rollStep, spin), cards = [], taken = new Set();
  const w = (p) => eliteWeight(p) * (st.recent && st.recent[p.id] != null ? st.recent[p.id] : 1);
  while (cards.length < 3 && taken.size < pool.length) { const p = pickWeighted(r, pool.filter(x => !taken.has(x.id)), w); taken.add(p.id); cards.push(p.id); }
  st.roll = Object.assign({}, st.roll, { spin, cards, scout: null, scoutClub: c, tags: null });
  noteOffered(st, cards);
  st.log.push(["scoutclub", c]);
  return true;
}
function sign(st, S, cardId, slot) {
  if (st.phase !== "window" || !st.roll || !st.roll.cards.includes(cardId)) return false;
  const p = playerOf(S, cardId, S.legends);
  if (!canPlay(p, FORMATIONS[st.formation][slot][0])) return false;
  const out = st.xi[slot];
  st.xi[slot] = cardId;
  const sdate = st.fixtures[st.gw - 1].date, outP = out != null ? playerOf(S, out, S.legends) : null;
  st.signed.push({ id: cardId, gw: st.gw, slot, out, from: p ? clubAt(p, sdate) : null, date: sdate, settle: p ? settleOf(st, p, outP ? outP.r : null) : null });
  if (p && p.c != null && !String(cardId).startsWith("L:")) {
    st.gone.push(cardId);
    st.raids.push({ club: clubAt(p, sdate), date: sdate, gw: st.gw });
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
  fillHoles(st, S);
}

/* ---------- Poached: a Club X career's later seasons (Craig, 14 Oct) ---------- */
// Before the Summer window of every season after the first, three of your XI are taken by other sides: never the
// keeper, each to a different club in the league (never yours, never his own real club that season). Victims are drawn
// weighted by their rating against the XI's outfield average to the 4th power, so stars are about three times as likely
// to go as the weakest man but anyone can; clubs by their final position that season (the real one, or the forecast's):
// weight 21 - position, so the champions are 20 times as likely as the bottom side. Seeded by stream(seed, "poach", n),
// done once (st.poached). Their shirts are left empty for the Summer rolls; a poached player joins his new club for the
// season (joinersOf: he plays for it against you and strengthens it, so some of its results improve, the inverse of a
// raid) and never comes back in your rolls this season.
function poach(st, S) {
  if (st.phase !== "setup" || !(st.career > 1) || st.poached) return null;
  const r = stream(st.seed, "poach", st.career), slots = FORMATIONS[st.formation].map(s => s[0]);
  const cand = st.xi.map((id, i) => ({ id, i, p: id == null ? null : playerOf(S, id, S.legends) })).filter(c => c.p && slots[c.i] !== "GK");
  const avg = cand.reduce((a, c) => a + c.p.r, 0) / Math.max(1, cand.length);
  const hist = historyTable(S, S.deductions), out = [], usedClubs = new Set([st.club]);
  for (let k = 0; k < 3 && cand.length; k++) {
    // your best outfield player goes for certain (Craig, 19 Oct: a career kept its legends), the other two by weight
    const v = k === 0 ? cand.slice().sort((a, b) => b.p.r - a.p.r)[0] : pickWeighted(r, cand, c => Math.pow(c.p.r / avg, RULES.raidOut.poachPower));
    cand.splice(cand.indexOf(v), 1);
    const clubs = hist.map((row, pos) => ({ c: row.c, w: hist.length + 1 - (pos + 1) }))
      .filter(x => !usedClubs.has(x.c) && x.c !== v.p.c && x.c !== v.p.c2);
    if (!clubs.length) break;
    const to = pickWeighted(r, clubs, x => x.w).c;
    usedClubs.add(to);
    out.push({ id: v.id, name: v.p.n, club: to, slot: v.i });
  }
  for (const x of out) { st.xi[x.slot] = null; if (!st.seen.includes(x.id)) st.seen.push(x.id); }
  st.poached = out;
  st.log.push(["poach", out.map(x => x.id)]);
  return out;
}
// the players poached to a club this season, as player-seasons it can pick
function joinersOf(S, st, club, date) {
  if (!st.poached || !st.poached.length) return null;
  const out = st.poached.filter(x => x.club === club && (!x.date || !date || x.date <= date)).map(x => playerOf(S, x.id, S.legends)).filter(Boolean);
  return out.length ? out : null;
}
// The January raid (Craig, 19 Oct): as the January window opens, one of your outfield players is taken by a top-half club
// (by its real final position; never his own real club, never yours). Seeded, once a season (st.janRaid). His shirt is
// left empty for the January rolls; fillHoles fills it with a free agent if it is still empty when the window closes.
function januaryRaid(st, S) {
  if (st.janRaid) return null;
  const w = currentWindow(st); if (!w || w.kind !== "jan" || st.rollStep !== 0) return null;
  const r = stream(st.seed, "janraid", st.career || 1), slots = FORMATIONS[st.formation].map(s => s[0]);
  const cand = st.xi.map((id, i) => ({ id, i, p: id == null ? null : playerOf(S, id, S.legends) })).filter(c => c.p && slots[c.i] !== "GK");
  if (!cand.length) return null;
  const avg = cand.reduce((a, c) => a + c.p.r, 0) / cand.length;
  const v = pickWeighted(r, cand, c => Math.pow(c.p.r / avg, RULES.raidOut.janPower));
  const hist = historyTable(S, S.deductions), half = RULES.raidOut.janTopHalf ? Math.ceil(hist.length / 2) : hist.length;
  const clubs = hist.slice(0, half).map((row, pos) => ({ c: row.c, w: hist.length + 1 - (pos + 1) })).filter(x => x.c !== st.club && x.c !== v.p.c && x.c !== v.p.c2);
  if (!clubs.length) return null;
  const to = pickWeighted(r, clubs, x => x.w).c, date = st.fixtures[st.gw - 1].date;
  const out = { id: v.id, name: v.p.n, club: to, slot: v.i, gw: st.gw, date, jan: true };
  st.xi[v.i] = null; if (!st.seen.includes(v.id)) st.seen.push(v.id);
  st.poached = (st.poached || []).concat([out]); st.janRaid = out;
  st.log.push(["janraid", v.id, to]);
  return out;
}
// Shirts still empty when the Summer window closes (you passed, or signed over someone else) are filled before the
// first game with free agents: for each empty shirt a bronze player (rating under 70) who is green there, drawn at
// random from the season's cards (stream(seed, "poachfill", n, slot)); failing that any bronze, then anyone. He is
// signed like a roll's pick (his club is raided from the first game). Listed in st.freeFill for the screens.
function fillHoles(st, S) {
  if (!st.xi.some(id => id == null) || !st.fixtures) return;
  const slots = FORMATIONS[st.formation].map(s => s[0]), date = st.fixtures[Math.max(0, st.gw - 1)].date;
  st.freeFill = st.freeFill || [];
  st.xi.forEach((id, slot) => {
    if (id != null) return;
    const r = stream(st.seed, "poachfill", st.career || 1, slot), pool = cardPool(S, st), bronze = pool.filter(p => p.lv === 0);
    const green = bronze.filter(p => fitOf(p, slots[slot]) === "green");
    const from = green.length ? green : bronze.length ? bronze : pool;
    if (!from.length) return;
    const p = from[Math.floor(r() * from.length)];
    st.xi[slot] = p.id; st.seen.push(p.id);
    st.signed.push({ id: p.id, gw: st.gw, slot, out: null, from: clubAt(p, date), date, free: true });
    if (p.c != null) { st.gone.push(p.id); st.raids.push({ club: clubAt(p, date), date, gw: st.gw }); }
    st.freeFill.push({ id: p.id, slot });
    st.log.push(["free", p.id, slot]);
  });
}

/* ---------- raids: weakening other clubs ---------- */
function goneBefore(st, date) {
  const s = new Set();
  st.signed.forEach(x => { if (x.date <= date && !String(x.id).startsWith("L:")) s.add(x.id); });
  return s;
}
// Negative when the club is stronger than its real squad: players poached from a Club X career joined it (join).
function strengthLoss(S, club, gone, cache, join) {
  const key = club + ":" + [...gone].filter(id => { const p = indexSeason(S).byId.get(id); return p && (p.c === club || p.c2 === club); }).sort().join(",") + "+" + (join || []).map(p => p.id).join(",");
  if (cache && cache.has(key)) return cache.get(key);
  const full = clubStrength(S, club, new Set()).ovr, now = clubStrength(S, club, gone, join).ovr;
  const L = join && join.length ? (full - now) / Math.max(5, full - RULES.raidBaseline) : Math.max(0, (full - now) / Math.max(5, full - RULES.raidBaseline));
  if (cache) cache.set(key, L);
  return L;
}
// What a raided club's lines lost (negative) or, strengthened by a poached player, gained, against its full real XI.
function lineLoss(S, club, gone, cache, join) {
  const key = club + ":" + [...gone].filter(id => { const p = indexSeason(S).byId.get(id); return p && (p.c === club || p.c2 === club); }).sort().join(",") + "+" + (join || []).map(p => p.id).join(",");
  if (cache.has(key)) return cache.get(key);
  const full = clubStrength(S, club, new Set()), now = clubStrength(S, club, gone, join);
  const d = { att: now.att - full.att, def: now.def - full.def, mid: now.mid - full.mid };
  const out = Math.abs(d.att) + Math.abs(d.def) + Math.abs(d.mid) < 1e-9 ? null : d;
  cache.set(key, out);
  return out;
}
// The other clubs' results: history, bent by your signings (18 Oct, docs/SCOPE_ENGINE.md). A raided club's real scoreline
// shrinks by what its XI lost, through the match model's own sensitivity: its goals by the attack and midfield lost, the
// goals it let in up by the defence and midfield lost, each value rounded up or down by one seeded draw (so 2.3 goals is 2
// seven times in ten and 3 three times). The bite is harder the better the opponent (RULES.raid.amp by his real final
// position: losing your best players shows in the big games, less so against the bottom half). A club a poached player
// joined (Club X) gets the same with the signs reversed. With nobody taken every result is history, untouched.
function otherResults(S, st) {
  const ix = indexSeason(S), cache = new Map(), out = [], R = RULES.raid, M = RULES.match;
  const any = st.signed.length || (st.poached && st.poached.length);
  let rank = null;
  if (any) { rank = {}; historyTable(S, S.deductions).forEach((row, i) => { rank[row.c] = i + 1; }); }
  const round = (x, u) => { x = Math.max(0, x); const f = Math.floor(x); return f + (u < x - f ? 1 : 0); };
  for (const m of ix.matches) {
    if (m.h === st.club || m.a === st.club) continue;
    let hg = m.hg, ag = m.ag;
    if (any) {
      const gone = goneBefore(st, m.date);
      for (const side of ["h", "a"]) {
        const club = side === "h" ? m.h : m.a, opp = side === "h" ? m.a : m.h;
        const d = lineLoss(S, club, gone, cache, joinersOf(S, st, club, m.date));
        if (!d) continue;
        const amp = R.m * Math.max(R.min, R.amp[0] - R.amp[1] * (rank[opp] || 10));
        const mine = side === "h" ? hg : ag, theirs = side === "h" ? ag : hg;
        const gf = round((mine + 0.25) * Math.exp(amp * (M.att * d.att + M.mid * d.mid)) - 0.25, unit(st.seed, "raid", m.i, side, "f"));
        const ga = round((theirs + 0.25) * Math.exp(-amp * (M.att * d.def + M.mid * d.mid)) - 0.25, unit(st.seed, "raid", m.i, side, "a"));
        if (side === "h") { hg = gf; ag = ga; } else { ag = gf; hg = ga; }
      }
    }
    out.push({ i: m.i, date: m.date, h: m.h, a: m.a, hg, ag, changed: hg !== m.hg || ag !== m.ag });
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
  const us = userStrength(S, st, legends, { gw });   // settling signings, stars above their number, the tactic's lean
  const gone = goneBefore(st, fx.date);
  const join = joinersOf(S, st, fx.opp, fx.date);
  const them = clubStrength(S, fx.opp, gone, join);
  const r = stream(st.seed, "match", gw);
  const lu = expectedGoals(us, them, fx.home), lt = expectedGoals(them, us, !fx.home);
  const gu = poisson(r, lu), gt = poisson(r, lt);
  const slots = FORMATIONS[st.formation].map(s => s[0]);
  const ours = scorerWeights(st.xi.map(id => playerOf(S, id, legends)), slots);
  const theirsXI = clubXI(S, fx.opp, gone, join);
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
  const goalMap = new Map(); for (const r of st.played) for (const e of r.events) if (e.us) goalMap.set(e.id, (goalMap.get(e.id) || 0) + 1);
  const goals = Object.fromEntries(goalMap);
  const topScorer = [...goalMap.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  // Best signing: biggest rating gain over the player he replaced, weighted by games played for you.
  let best = null;
  for (const s of st.signed) {
    if (s.draft || s.free) continue;
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
  RULES, LEVELS, POS, FIT, SLOT_BROAD, broadOf, FORMATIONS, FORMATION_NAMES, hash32, rng, stream, unit,
  fitOf, effRating, isGK, canPlay, indexSeason, playerOf, clubAt, xiStrength, userStrength, plainStrength, starRating, settledRating, clubXI, clubStrength,
  TACTIC_NAMES, tacticOf, tacticLines, setTactic, scoutInfo, scout, scoutClubs, scoutClub, legendRoll, januaryRaid, agedRating,
  schedule, fixturesOf, recentWeights, newRun, offerClubs, respinClubs, chooseClub, autoXI, setFormation, swapSetup, squadOf,
  poach, joinersOf, fillHoles, draftOrder, draftSlot, draftFormation, draftPick, draftFits, listsPos, DRAFT_MODES, carryIn, simResults,
  startSeason, inWindow, currentWindow, newRoll, respinCards, signPreview, sign, pass,
  otherResults, strengthLoss, expectedGoals, simMatch, playMatch, table, historyTable, historyPositions, positionsSoFar, seasonSummary
};
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.D2TE = API;
})(typeof window !== "undefined" ? window : globalThis);
