// What a season looks like by what it landed (18 Oct, docs/SCOPE_ENGINE.md): runs grouped by the purples and legends in the
// XI at the end, with points and titles, for the average and greedy test players. node tests/landed.js [runs per club]
// (the same knobs as calibrate-all.js: STAR, TACT, HALF, NOTACT, ODDS). The table in CLAUDE.md comes from here.
const D = require("../src/engine.js");
const { decide } = require("./policy.js");
const G = require("../data/game/game.json");
require("./legends.js")(G);
const per = +(process.argv[2] || 12);
if (process.env.ODDS) D.RULES.levelOdds = JSON.parse(process.env.ODDS);
if (process.env.STAR) D.RULES.star.slope = JSON.parse(process.env.STAR);
if (process.env.TACT) { const t = JSON.parse(process.env.TACT); for (const k of Object.keys(t)) Object.assign(D.RULES.tactics[k], t[k]); }
if (process.env.HALF) D.RULES.halfShape = +process.env.HALF;
function run(entry, seed, strategy) {
  const S = G.seasons[entry.season], club = S.clubs.find(c => c.name === entry.club).id;
  const rel = S.relegated.find(r => r.c === club) || { c: club, f: "4-4-2", xi: [] };
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: entry.key });
  D.chooseClub(st, S, rel); D.startSeason(st, S);
  let guard = 0; const r = D.stream(seed, "policy");
  while (st.phase !== "summary" && guard++ < 500) { if (st.phase === "window") decide(st, S, strategy, r); else if (st.phase === "prematch") D.playMatch(st, S); }
  const xi = st.xi.map(id => D.playerOf(S, id, S.legends));
  return { pts: st.final.pts, fin: st.final.finish, ovr: D.plainStrength(S, st).ovr, P: xi.filter(p => p && p.lv === 3).length, L: xi.filter(p => p && p.lv === 4).length, tactic: D.tacticOf(st) };
}
const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length, pc = (a, f) => (100 * a.filter(f).length / a.length).toFixed(0) + "%";
for (const strat of ["average", "greedy"]) {
  const rs = []; for (const e of G.catalogue) for (let i = 0; i < per; i++) rs.push(run(e, "landed" + i + e.key, strat));
  console.log(`${strat}: ${rs.length} runs, end XI ${avg(rs, x => x.ovr).toFixed(1)}, purples ${avg(rs, x => x.P).toFixed(2)}, legends ${avg(rs, x => x.L).toFixed(2)}, pts ${avg(rs, x => x.pts).toFixed(1)}, titles ${pc(rs, x => x.fin === 1)}, tactics ${["mid", "low", "poss", "counter", "press"].map(t => t + " " + pc(rs, x => x.tactic === t)).join(", ")}`);
  const by = {}; for (const x of rs) { const k = `${Math.min(2, x.P)}P${Math.min(1, x.L)}L`; (by[k] = by[k] || []).push(x); }
  for (const [k, a] of Object.entries(by).sort()) console.log(`   ${k}: n ${a.length}, XI ${avg(a, x => x.ovr).toFixed(1)}, pts ${avg(a, x => x.pts).toFixed(1)}, titles ${pc(a, x => x.fin === 1)}, top 4 ${pc(a, x => x.fin <= 4)}`);
}
