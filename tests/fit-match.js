// Fit the match model (Poisson goals from strength gaps) to every real Premier League result.
const D = require("../src/engine.js");
const G = require("../data/game/game.json");
const rows = [];
for (const S of Object.values(G.seasons)) {
  const ix = D.indexSeason(S), str = {};
  for (let c = 0; c < ix.nClubs; c++) str[c] = D.clubStrength(S, c, new Set());
  for (const m of ix.matches) {
    const H = str[m.h], A = str[m.a];
    rows.push([H.att - A.def, H.mid - A.mid, A.att - H.def, m.hg, m.ag]);
  }
}
let p = [Math.log(1.35), 0.04, 0.02, 0.15, -0.1];   // b0, att, mid, home, away
function nll(p) {
  let s = 0;
  for (const [dh, dm, da, hg, ag] of rows) {
    const lh = p[0] + p[1] * dh + p[2] * dm + p[3], la = p[0] + p[1] * da - p[2] * dm + p[4];
    s += Math.exp(lh) - hg * lh + Math.exp(la) - ag * la;
  }
  return s / rows.length;
}
for (let it = 0; it < 400; it++) {
  const g = p.map((_, k) => { const e = 1e-4, q = p.slice(); q[k] += e; return (nll(q) - nll(p)) / e; });
  const lr = [0.5, 0.0005, 0.0005, 0.5, 0.5];
  p = p.map((v, k) => v - lr[k] * g[k]);
}
console.log("rows", rows.length, "nll", nll(p).toFixed(4));
console.log(JSON.stringify({ base: +Math.exp(p[0]).toFixed(3), att: +p[1].toFixed(4), mid: +p[2].toFixed(4), home: +p[3].toFixed(3), away: +p[4].toFixed(3) }));
