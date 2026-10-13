// node tests/sim-433.js: balance check for 433 Goals (12 Oct). Plays 40,000 games per strategy with any-order spins and
// the last-shot gift (one game in five, only when an exact player exists), as in GAME.g433.drawOpen. Strategies: random
// picks, rough (knows career goals to within 40%) and exact (knows them).
const G = require(require('path').join(__dirname, '..', 'data', 'game', 'game.json')).g433;
const TOP = 220, POS = { GK: 1, DEF: 4, MID: 3, FWD: 3 };
const L = {}; for (const p in G) L[p] = G[p].slice(0, TOP).map(([n, s, c, g]) => ({ n, g, pos: p }));
const MEAN = {}; for (const p in L) MEAN[p] = L[p].reduce((t, x) => t + x.g, 0) / L[p].length;
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
function draw(open, used, need) {
  const slots = []; for (const p in open) for (let i = 0; i < open[p]; i++) slots.push(p);
  const out = [];
  if (need != null) {          // gift: one player of the last open position with exactly the goals needed
    const p = slots[0], hits = L[p].filter((x) => x.g === need && !used.has(x.n));
    if (hits.length) out.push(rnd(hits));
  }
  let guard = 0;
  while (out.length < 3 && guard++ < 999) { const x = rnd(L[rnd(slots)]); if (!used.has(x.n) && !out.includes(x)) out.push(x); }
  return out.sort(() => Math.random() - 0.5);
}
// strategies: how the player values a candidate (est = what they think his goals are)
const est = { random: () => 0, rough: (x) => x.g * (0.6 + Math.random() * 0.8), exact: (x) => x.g };
function play(strategy, giftRate, lastRule) {
  const open = Object.assign({}, POS), used = new Set(); let total = 0, gift = false, giftShown = false, natural = false;
  for (let k = 0; k < 11; k++) {
    const left = 11 - k, last = left === 1;
    const lastPos = last ? Object.keys(open).find((p) => open[p] > 0) : null;
    if (last) { const n0 = 433 - total; gift = L[lastPos].some((x) => x.g === n0 && !used.has(x.n)) && Math.random() < giftRate; }
    const need = last && gift ? 433 - total : null;
    const c = draw(open, used, need);
    if (last && c.some((x) => x.g === 433 - total)) { if (need != null && L[lastPos].some((x) => x.g === need)) giftShown = true; else natural = true; }
    let pick;
    if (strategy === 'random') pick = rnd(c);
    else {
      // projected final = total + his goals + mean of what is still open after him
      const score = (x) => { const o = Object.assign({}, open); o[x.pos]--; let rest = 0; for (const p in o) rest += o[p] * MEAN[p]; return Math.abs(total + est[strategy](x) + rest - 433); };
      pick = c.slice().sort((a, b) => score(a) - score(b))[0];
    }
    open[pick.pos]--; used.add(pick.n); total += pick.g;
  }
  return { total, gap: Math.abs(total - 433), giftShown, natural };
}
const N = 40000;
for (const s of ['random', 'rough', 'exact']) for (const gr of [1 / 5, 1 / 7]) {
  let ex = 0, w10 = 0, w25 = 0, gs = 0, nat = 0, sum = 0;
  for (let i = 0; i < N; i++) { const r = play(s, gr); if (r.gap === 0) ex++; if (r.gap <= 10) w10++; if (r.gap <= 25) w25++; if (r.giftShown) gs++; if (r.natural) nat++; sum += r.total; }
  console.log(`${s.padEnd(6)} gift ${gr > 0.18 ? '1 in 5 when possible' : '1 in 7 when possible'}: exact ${(100 * ex / N).toFixed(1)}%  within 10 ${(100 * w10 / N).toFixed(0)}%  within 25 ${(100 * w25 / N).toFixed(0)}%  avg total ${(sum / N).toFixed(0)}  gift shown ${(100 * gs / N).toFixed(1)}%  exact one offered by chance ${(100 * nat / N).toFixed(1)}%`);
}
