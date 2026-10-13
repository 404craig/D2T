// Fit the match model (Poisson goals from strength gaps) to every real Premier League result.
// Newton's method on the four identifiable parameters (a home and an away intercept, att, mid): base, home and away
// together are one parameter too many (base * exp(home) and base * exp(away) are all the data can see), so the old
// gradient descent drifted along that flat direction and never converged (it left the model 26% too high on goals).
// The result is reported in the engine's shape, with base the geometric mean of the two intercepts.
const D = require("../src/engine.js");
const G = require("../data/game/game.json");
const rows = [];
for (const S of Object.values(G.seasons)) {
  const ix = D.indexSeason(S), str = {};
  for (let c = 0; c < ix.nClubs; c++) str[c] = D.clubStrength(S, c, new Set());
  for (const m of ix.matches) {
    const H = str[m.h], A = str[m.a];
    // two Poisson observations per match: [intercept is home?, att gap, mid gap, goals]
    rows.push([1, H.att - A.def, H.mid - A.mid, m.hg]);
    rows.push([0, A.att - H.def, A.mid - H.mid, m.ag]);
  }
}
// p = [bh, ba, att, mid]; log-rate = (home ? bh : ba) + att * dAtt + mid * dMid
const x = (r) => [r[0], 1 - r[0], r[1], r[2]];
let p = [Math.log(1.5), Math.log(1.15), 0.03, 0.01];
function nll(p) {
  let s = 0;
  for (const r of rows) { const X = x(r), l = X.reduce((t, v, k) => t + v * p[k], 0); s += Math.exp(l) - r[3] * l; }
  return s / rows.length;
}
function solve(A, b) {               // Gaussian elimination, 4 x 4
  const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
  for (let i = 0; i < n; i++) {
    let piv = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]];
    for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
for (let it = 0; it < 30; it++) {
  const g = [0, 0, 0, 0], H = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (const r of rows) {
    const X = x(r), mu = Math.exp(X.reduce((t, v, k) => t + v * p[k], 0)), d = mu - r[3];
    for (let i = 0; i < 4; i++) { g[i] += d * X[i]; for (let j = 0; j < 4; j++) H[i][j] += mu * X[i] * X[j]; }
  }
  const step = solve(H, g);
  p = p.map((v, k) => v - step[k]);
  if (Math.max(...step.map(Math.abs)) < 1e-9) break;
}
const base = Math.exp((p[0] + p[1]) / 2);
let fit = 0, obs = 0;
for (const r of rows) { const X = x(r); fit += Math.exp(X.reduce((t, v, k) => t + v * p[k], 0)); obs += r[3]; }
console.log("matches", rows.length / 2, "nll", nll(p).toFixed(4), "goals per game: model", (2 * fit / rows.length).toFixed(3), "real", (2 * obs / rows.length).toFixed(3));
console.log(JSON.stringify({ base: +base.toFixed(3), att: +p[2].toFixed(4), mid: +p[3].toFixed(4), home: +(p[0] - Math.log(base)).toFixed(3), away: +(p[1] - Math.log(base)).toFixed(3) }));
