// D2T card engine. Pure: rate(data, cfg) -> cards. Same inputs always give the same cards.
const DEFAULT_CFG = {
  weights: {
    FWD: { GOL: 40, IMP: 20, FIT: 15, DEF: 0, WIN: 15, EXP: 10 },
    MID: { GOL: 20, IMP: 10, FIT: 25, DEF: 10, WIN: 20, EXP: 15 },
    DEF: { GOL: 5, IMP: 0, FIT: 25, DEF: 35, WIN: 20, EXP: 15 },
    GK:  { WAL: 30, CLN: 20, FIT: 25, WIN: 15, EXP: 10 }
  },
  shrink: 6,          // small-sample shrinkage: phantom apps at the position average
  attenuate: true,    // team stats count in proportion to the player's share of the 38 games
  mid: 64,            // overall for an average player at his position
  spread: 9           // rating points per standard deviation above average
};
const FACES = { OUT: ['GOL', 'IMP', 'FIT', 'DEF', 'WIN', 'EXP'], GK: ['WAL', 'CLN', 'FIT', 'WIN', 'EXP'] };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lin = (x, lo, hi) => hi === lo ? 0.5 : clamp((x - lo) / (hi - lo), 0, 1);
const face = f => Math.round(20 + 79 * f); // every face stat sits on 20..99

function rate(data, cfg = DEFAULT_CFG) {
  const G = data.clubs[0].p, P = data.players;
  const club = Object.fromEntries(data.clubs.map(c => [c.name, c]));
  const per = k => data.clubs.map(c => c[k] / G);
  const lg = k => per(k).reduce((a, b) => a + b, 0) / data.clubs.length;
  const range = k => [Math.min(...per(k)), Math.max(...per(k))];
  const [gaLo, gaHi] = range('ga'), [ptLo, ptHi] = range('pts'), [csLo, csHi] = range('cs');
  const posAvg = {};
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    const r = P.filter(p => p.pos === pos);
    posAvg[pos] = r.reduce((s, p) => s + p.goals, 0) / Math.max(1, r.reduce((s, p) => s + p.apps, 0));
  }
  // Team numbers count in proportion to the games he played; the rest is league average.
  const team = (p, k) => { const s = cfg.attenuate ? Math.min(p.apps, G) / G : 1; return lg(k) + (club[p.club][k] / G - lg(k)) * s; };
  const raw = P.map(p => ({
    gpa: (p.goals + cfg.shrink * posAvg[p.pos]) / (p.apps + cfg.shrink),
    imp: p.goals / Math.max(1, club[p.club].gf),
    ga: team(p, 'ga'), ppg: team(p, 'pts'), cs: team(p, 'cs'),
    exp: p.prevApps + p.apps
  }));
  const gpaMax = Math.max(...raw.map(r => r.gpa)), impMax = Math.max(...raw.map(r => r.imp));
  const cards = P.map((p, i) => {
    const r = raw[i], s = {};
    s.FIT = face(Math.min(p.apps, G) / G);
    s.WIN = face(lin(r.ppg, ptLo, ptHi));
    s.EXP = face(Math.min(1, Math.log1p(r.exp) / Math.log1p(450)));
    if (p.pos === 'GK') {
      s.WAL = face(1 - lin(r.ga, gaLo, gaHi));
      s.CLN = face(lin(r.cs, csLo, csHi));
    } else {
      s.GOL = face(Math.sqrt(r.gpa / gpaMax));
      s.IMP = face(Math.sqrt(r.imp / impMax));
      s.DEF = face(1 - lin(r.ga, gaLo, gaHi));
    }
    const w = cfg.weights[p.pos];
    const tw = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    const score = Object.entries(w).reduce((a, [k, v]) => a + (s[k] || 0) * v, 0) / tw;
    return { ...p, i, raw: r, stats: s, score };
  });
  // Overall: how far above his position's average he is, in standard deviations.
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    const grp = cards.filter(c => c.pos === pos);
    const m = grp.reduce((a, c) => a + c.score, 0) / grp.length;
    const sd = Math.sqrt(grp.reduce((a, c) => a + (c.score - m) ** 2, 0) / grp.length) || 1;
    grp.forEach(c => { c.ovr = Math.round(clamp(cfg.mid + cfg.spread * (c.score - m) / sd, 40, 95)); });
  }
  const topGoals = Math.max(...P.map(p => p.goals));
  const clubTop = {}, clubBest = {};
  for (const c of cards) {
    clubTop[c.club] = Math.max(clubTop[c.club] || 0, c.goals);
    const b = clubBest[c.club];
    if (!b || c.ovr > b.ovr || (c.ovr === b.ovr && c.score > b.score)) clubBest[c.club] = c;
  }
  for (const c of cards) {
    const cl = club[c.club], b = [];
    c.teamBest = clubBest[c.club] === c;
    // Tiers: bronze, silver, gold by rating; each club's best player gets his own card.
    c.tier = c.teamBest ? 'best' : c.ovr >= 75 ? 'gold' : c.ovr >= 65 ? 'silver' : 'bronze';
    if (c.goals === topGoals) b.push('Golden Boot');
    else if (c.goals >= 3 && c.goals === clubTop[c.club]) b.push('Club top scorer');
    if (c.apps >= G) b.push('Ever-present');
    if (cl.pos === 1 && c.apps >= 10) b.push('Champion');
    if (cl.pos > data.clubs.length - 3) b.push('Relegated');
    if (c.prevApps === 0) b.push('PL debut season');
    if (c.prevApps + c.apps >= 300) b.push('Veteran');
    if (c.moved) b.push('Moved mid-season');
    c.badges = b;
    c.clubPos = cl.pos;
  }
  return cards;
}
if (typeof module !== 'undefined') module.exports = { rate, DEFAULT_CFG, FACES };
