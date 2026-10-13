// node tests/sim-goalrush.js: balance check for Goal Rush (12 Oct), every formation; based on sim-433.js. Was: balance check for 433 Goals (12 Oct). Plays 40,000 games per strategy with any-order spins and
// the last-shot gift (one game in five, only when an exact player exists), as in GAME.g433.drawOpen. Strategies: random
// picks, rough (knows career goals to within 40%) and exact (knows them).
const G = require(require('path').join(__dirname, '..', 'data', 'game', 'game.json')).g433;
const TOP = 220; let POS = { GK: 1, DEF: 4, MID: 3, FWD: 3 }, T = 433;
// pool depth per formation: each draws from that many top scorers per position, so a random XI lands near 77% of the
// target for every shape (as 433 does with 220); five-at-the-back shapes need the deeper scorers cut off
// last-shot gift chance per formation: a casual player lands exactly about 1 game in 20, one who roughly knows career goals about 1 in 10
const GIFT = { 442: 0.22, 433: 0.2, 451: 0.27, 352: 0.14, 343: 0.14, 424: 0.18, 532: 0.36, 541: 0.42 };
const DEPTH = { 442: 180, 433: 220, 451: 145, 352: 310, 343: 355, 424: 260, 532: 105, 541: 75 };
let L = {}, MEAN = {};
const setPool = (k) => { L = {}; MEAN = {}; for (const p in G) L[p] = G[p].slice(0, k).map(([n, s, c, g]) => ({ n, g, pos: p })); for (const p in L) MEAN[p] = L[p].reduce((t, x) => t + x.g, 0) / L[p].length; };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
// HIST=1: the app's anti-repeat (GAME.g433.drawOpen): players the last three games offered come up at a tenth, a quarter
// and half the chance of a fresh one. Games are chained so the memory builds as it does on a phone.
const HIST = !!process.env.HIST, RECENT = [0.1, 0.25, 0.5]; let recent = [], rw = null, offered = null;
const startGame = () => { if (!HIST) return; rw = {}; recent.slice(0, 3).forEach((ids, i) => { for (const n of ids) if (rw[n] == null || rw[n] > RECENT[i]) rw[n] = RECENT[i]; }); offered = new Set(); };
const endGame = () => { if (!HIST) return; recent.unshift([...offered]); recent = recent.slice(0, 3); };
const pick = (list) => { if (!rw) return rnd(list); let t = 0; for (const x of list) t += (rw[x.n] != null ? rw[x.n] : 1); let r = Math.random() * t; for (const x of list) { r -= (rw[x.n] != null ? rw[x.n] : 1); if (r <= 0) return x; } return list[list.length - 1]; };
function draw(open, used, need) {
  const slots = []; for (const p in open) for (let i = 0; i < open[p]; i++) slots.push(p);
  const out = [];
  if (need != null) {          // gift: one player of the last open position with exactly the goals needed
    const p = slots[0], hits = L[p].filter((x) => x.g === need && !used.has(x.n));
    if (hits.length) out.push(rnd(hits));
  }
  let guard = 0;
  while (out.length < 3 && guard++ < 999) { const x = pick(L[rnd(slots)]); if (!used.has(x.n) && !out.includes(x)) out.push(x); }
  if (offered) for (const x of out) offered.add(x.n);
  return out.sort(() => Math.random() - 0.5);
}
// strategies: how the player values a candidate (est = what they think his goals are)
// casual: a typical fan, often out by half or more (a quarter of the time no idea, a guess for the position)
const est = { random: () => 0, casual: (x) => (Math.random() < 0.25 ? MEAN[x.pos] * (0.4 + Math.random() * 1.2) : x.g * (0.4 + Math.random() * 1.2)), rough: (x) => x.g * (0.6 + Math.random() * 0.8), exact: (x) => x.g };
function play(strategy, giftRate, lastRule) {
  const open = Object.assign({}, POS), used = new Set(); let total = 0, gift = false, giftShown = false, natural = false;
  startGame();
  for (let k = 0; k < 11; k++) {
    const left = 11 - k, last = left === 1;
    const lastPos = last ? Object.keys(open).find((p) => open[p] > 0) : null;
    if (last) { const n0 = T - total; gift = L[lastPos].some((x) => x.g === n0 && !used.has(x.n)) && Math.random() < giftRate; }
    const need = last && gift ? T - total : null;
    const c = draw(open, used, need);
    if (last && c.some((x) => x.g === T - total)) { if (need != null && L[lastPos].some((x) => x.g === need)) giftShown = true; else natural = true; }
    let pick;
    if (strategy === 'random') pick = rnd(c);
    else {
      // projected final = total + his goals + mean of what is still open after him
      const score = (x) => { const o = Object.assign({}, open); o[x.pos]--; let rest = 0; for (const p in o) rest += o[p] * MEAN[p]; return Math.abs(total + est[strategy](x) + rest - T); };
      pick = c.slice().sort((a, b) => score(a) - score(b))[0];
    }
    open[pick.pos]--; used.add(pick.n); total += pick.g;
  }
  endGame();
  return { total, gap: Math.abs(total - T), giftShown, natural };
}
const N = 20000, F = ['442', '433', '451', '352', '343', '424', '532', '541'], RATES = (process.argv[2] || '-1').split(',').map(Number);
for (const gr of RATES) { console.log(gr < 0 ? 'gift per formation (GIFT)' : `gift ${gr} when possible`);
  for (const f of F) { const [d, m, a] = f.split('').map(Number); POS = { GK: 1, DEF: d, MID: m, FWD: a }; T = +f; setPool(process.argv[3] === 'flat' ? TOP : DEPTH[f]);
    const row = [];
    for (const s of (process.argv[4] || 'random,casual,rough,exact').split(',')) { let ex = 0, w10 = 0, sum = 0; for (let i = 0; i < N; i++) { const r = play(s, gr < 0 ? GIFT[f] : gr); if (r.gap === 0) ex++; if (r.gap <= 10) w10++; sum += r.total; }
      row.push(`${s} exact ${(100 * ex / N).toFixed(1)}% w10 ${(100 * w10 / N).toFixed(0)}% avg ${(sum / N).toFixed(0)}`); }
    console.log(f, row.join(' | ')); } }
