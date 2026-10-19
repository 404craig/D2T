// A Club X career played out in the engine (19 Oct): the greedy and average test players from a season's bottom club through
// the next real seasons, with the carry-in built the way core/game.js builds it (a player moves to his real card for the new
// season, else keeps his old card as a copy; legend cards carry as they are), the Summer poach and everything else.
// node tests/career.js [start season] [seasons] [seeds]   e.g. node tests/career.js 2012/13 8 6
// Prints, per season: the XI's plain rating, purples and legends in it, points, finish and the title count so far.
const D = require("../src/engine.js");
const { decide } = require("./policy.js");
const G = require("../data/game/game.json");
const L = require("./legends.js")(G);
const [start = "2012/13", nSeasons = "8", nSeeds = "6"] = process.argv.slice(2);
if (process.env.STAR) D.RULES.star.slope = JSON.parse(process.env.STAR);
if (process.env.STARCAP) D.RULES.star.cap = +process.env.STARCAP;
const KEYS = Object.keys(G.seasons).sort();
const bottomOf = (S) => D.historyTable(S, S.deductions).slice(-1)[0].c;
const mainClub = (S, p) => S.clubs[p.c2 != null && (p.a2 || 0) > (p.a1 || 0) ? p.c2 : p.c].name;
// the next season's version of each carried card, as careerSeason does it (no forecast seasons here)
function carrySeason(prevS, carry, key, aging) {
  const S0 = G.seasons[key], byK = new Map(), extras = [];
  S0.players.forEach((p) => { if (p.k != null && !byK.has(p.k)) byK.set(p.k, p); });
  let next = S0.players.length; const ids = [];
  for (const o of carry) {
    if (!o) { ids.push(null); continue; }
    const age = parseInt(key, 10) - parseInt(o.sk, 10);
    if (o.L) {
      if (!aging) { ids.push(o.L); continue; }
      const l = L.find((x) => x.id === o.L), r = D.agedRating ? D.agedRating(l.r, age) : l.r;
      extras.push(Object.assign({}, l, { id: next, r, c: null, oid: o.L })); ids.push(next++); continue;
    }
    const src = G.seasons[o.sk].players.find((p) => p.id === o.id), now = src && src.k != null ? byK.get(src.k) : null;
    if (now) { ids.push(now.id); continue; }
    const r = aging && D.agedRating ? D.agedRating(src.r, age) : src.r;
    extras.push(Object.assign({}, src, { id: next, c: null, c2: null, m2: null, cn: mainClub(G.seasons[o.sk], src), sk: o.sk, oid: o.id, r })); ids.push(next++);
  }
  return { S: Object.assign({}, S0, { players: S0.players.concat(extras), _ix: null, legends: L, career: true }), ids };
}
const originOf = (S, id) => { if (id == null) return null; if (String(id).startsWith("L:")) return { L: id, sk: id.split(":").pop() }; const p = D.playerOf(S, id); if (p.oid != null && String(p.oid).startsWith("L:")) return { L: p.oid, sk: p.sk }; return p.oid != null ? { sk: p.sk, id: p.oid } : { sk: S.season, id }; };
function playSeason(st, S, strategy, seed) {
  let guard = 0; const r = D.stream(seed, "policy");
  while (st.phase !== "summary" && guard++ < 600) { if (st.phase === "setup") { D.poach(st, S); D.startSeason(st, S); } else if (st.phase === "window") decide(st, S, strategy, r); else if (st.phase === "draft") { const id = st.roll.cards[0]; D.draftPick(st, S, id, D.draftFits(st, S, id)[0]); } else if (st.phase === "prematch") D.playMatch(st, S); }
}
for (const strategy of ["average", "greedy"]) {
  const rows = [];
  for (let s = 0; s < +nSeeds; s++) {
    let key = start, S = G.seasons[key]; S.legends = L;
    let st = D.newRun({ seed: "career" + s, mode: "clubx", catalogue: [] });
    const me = bottomOf(S); st.clubOffer = [key]; D.chooseClub(st, S, { c: me, f: "4-4-2", xi: [] });
    let titles = 0;
    for (let n = 1; n <= +nSeasons; n++) {
      playSeason(st, S, strategy, "career" + s + key);
      const xi = st.xi.map((id) => D.playerOf(S, id, L)), P = D.plainStrength(S, st);
      titles += st.final.finish === 1;
      rows.push({ n, key, ovr: P.ovr, pur: xi.filter((p) => p && p.lv === 3).length, leg: xi.filter((p) => p && p.lv === 4).length, pts: st.final.pts, fin: st.final.finish, titles });
      const i = KEYS.indexOf(key); if (i < 0 || i >= KEYS.length - 1 || st.final.finish > S.clubs.length - 3) break;
      const carry = st.xi.map((id) => originOf(S, id)), nextKey = KEYS[i + 1];
      const built = carrySeason(S, carry, nextKey, !!process.env.AGING); S = built.S; key = nextKey;
      const nst = D.newRun({ seed: "career" + s + ":s" + (n + 1), mode: "clubx", catalogue: [] });
      nst.seasonKey = key; nst.club = bottomOf(G.seasons[key]); nst.formation = st.formation; nst.career = n + 1; nst.tactic = st.tactic;
      D.carryIn(nst, S, built.ids); st = nst;
    }
  }
  console.log(strategy + ":");
  for (let n = 1; n <= +nSeasons; n++) {
    const a = rows.filter((x) => x.n === n); if (!a.length) break;
    const avg = (f) => (a.reduce((t, x) => t + f(x), 0) / a.length);
    console.log(`  season ${n} (${a.length} careers): XI ${avg((x) => x.ovr).toFixed(1)}, purples ${avg((x) => x.pur).toFixed(1)}, legends ${avg((x) => x.leg).toFixed(1)}, pts ${avg((x) => x.pts).toFixed(0)}, finish ${avg((x) => x.fin).toFixed(1)}, titles ${(100 * a.filter((x) => x.fin === 1).length / a.length).toFixed(0)}%`);
  }
}
