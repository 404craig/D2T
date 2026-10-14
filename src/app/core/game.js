// D2T game adapter: the real season data (window.D2T_GAME), crests and the engine (window.D2TE),
// handed to the screens in the shapes they draw. The engine stays the only judge of rolls, results and the table;
// this file only translates. Loads after core/app.js and core/cards.js.
(function () {
  const D2T = window.D2T, G = window.D2T_GAME, E = window.D2TE, CR = window.D2T_CRESTS || {};
  const LV = ['bronze', 'silver', 'gold', 'baller', 'legend'];
  // crest: for dark backgrounds (a white version where the club's own is too dark to see, Derby and Spurs);
  // crestLight: the club's own crest, for light faces (club cards, bronze, silver and gold player cards, white discs).
  const crestOf = (name) => (CR[name] && (CR[name]['128w'] || CR[name]['72w'] || CR[name]['128'] || CR[name]['72'])) || '';
  const crestLightOf = (name) => (CR[name] && (CR[name]['128'] || CR[name]['72'])) || '';
  // crestCard: on the club's own coloured card (a white version where the crest is all that colour, else crestLight)
  const crestCardOf = (name) => (CR[name] && (CR[name]['128c'] || CR[name]['72c'])) || crestLightOf(name);
  const meta = (name) => G.clubs[name] || { name, full: name, code: name.slice(0, 3).toUpperCase(), accent: '#12F06C', ink: '#000000', text: '#12F06C' };
  const GAME = D2T.game = {};

  // ---------- clubs ----------
  const clubs = {};
  Object.keys(G.clubs).forEach((n) => { const m = meta(n); clubs[n] = { name: n, full: m.full || n, code: m.code, crest: crestOf(n), crestLight: crestLightOf(n), crestCard: crestCardOf(n), accent: m.accent, ink: m.ink, text: m.text }; });
  // Club X: Craig's badge (assets/brand/club_x.png, embedded by build.py; the drawn shield is only a fallback), D2T green as its colour.
  const X_BADGE = window.D2T_CLUBX_BADGE || 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 116'><path d='M50 3 L94 18 V60 C94 86 74 104 50 113 C26 104 6 86 6 60 V18 Z' fill='#0E0E10' stroke='#12F06C' stroke-width='5'/><path d='M32 36 L68 80 M68 36 L32 80' stroke='#12F06C' stroke-width='11' stroke-linecap='round'/></svg>");
  clubs['Club X'] = { name: 'Club X', full: 'Club X', code: 'CLX', crest: X_BADGE, accent: '#12F06C', ink: '#000000', text: '#12F06C' };
  // Club X (Craig, 12 Oct): you name your club first, and that name takes over from "Club X" everywhere in the run (the
  // badge and green stay). The name lives on the run (state.run.xName); the last one is offered again (state.xName).
  // Proper capitals (Craig, 13 Oct): each word starts with a capital, small words inside stay small, and anything
  // already in capitals (FC, AFC) is kept, so "kilsyth athletic" shows as "Kilsyth Athletic".
  const SMALL = new Set(['of', 'the', 'and', 'de', 'la', 'le', 'in', 'on', 'at']);
  GAME.tidyXName = (n) => String(n || '').split(' ').map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  GAME.xName = () => { const r = D2T.state.run; return (r && r.xName && GAME.tidyXName(r.xName)) || 'Club X'; };
  const xCode = (n) => { const w = n.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean); return (w.length >= 3 ? w.map((x) => x[0]).join('') : w.join('')).slice(0, 3) || 'CLX'; };
  const xClub = () => { const n = GAME.xName(); return n === 'Club X' ? clubs['Club X'] : Object.assign({}, clubs['Club X'], { name: n, full: n, code: xCode(n) }); };
  // a name of your own: 2 to 18 letters, numbers, spaces and ' . & -, and never a real club's name
  const realNames = new Set(Object.values(G.clubs || {}).flatMap((c) => [c.name, c.full]).filter(Boolean).map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')));
  GAME.checkXName = (raw) => {
    const n = String(raw || '').replace(/\s+/g, ' ').trim();
    if (n.length < 2) return { error: 'Give it at least 2 letters.' };
    if (n.length > 18) return { error: 'Keep it to 18 letters or fewer.' };
    if (!/^[A-Za-z0-9 '.&-]+$/.test(n)) return { error: "Letters, numbers, spaces and ' . & - only." };
    if (realNames.has(n.toLowerCase().replace(/[^a-z0-9]/g, ''))) return { error: "That's a real club. Make up your own." };
    return { name: GAME.tidyXName(n) };
  };
  GAME.setXName = (raw) => { const r = GAME.checkXName(raw); if (r.name) { D2T.state.run.xName = r.name; D2T.state.xName = r.name; D2T.save(); } return r; };
  const inX = () => { const r = D2T.state.run; return !!(r && r.eng && r.eng.mode === 'clubx'); };   // read straight off the run: GAME.club runs while the adapter is still being set up
  GAME.club = (name) => (name === 'Club X' || (name && inX() && name === GAME.xName()) ? xClub() : clubs[name])
    || Object.assign({ crest: crestOf(name), crestLight: crestLightOf(name), crestCard: crestCardOf(name) }, meta(name));

  // ---------- the club pool: every relegated club-season ----------
  const pool = G.catalogue.map((c) => {
    const S = G.seasons[c.season], idx = S.clubs.findIndex((x) => x.name === c.club), rel = S.relegated.find((r) => r.c === idx) || {};
    return Object.assign({}, GAME.club(c.club), { key: c.key, season: c.season, pos: c.pos, pts: c.pts, w: rel.w, d: rel.d, l: rel.l, gf: rel.gf, ga: rel.ga });
  });
  GAME.pool = pool;
  // Dare2Dream: every club in every season, with the finish they really had.
  const allPool = (G.clubSeasons || []).map((c) => Object.assign({}, GAME.club(c.club), { key: c.key, season: c.season, pos: c.pos, pts: c.pts, w: c.w, d: c.d, l: c.l, gf: c.gf, ga: c.ga }));
  const byKey = new Map(allPool.concat(pool).map((p) => [p.key, p]));
  GAME.allPool = allPool;
  GAME.poolEntry = (key) => byKey.get(key);
  D2T.data = { clubs, relegatedPool: pool };

  // ---------- Goal Rush (was 433 Goals): a game of its own on real Premier League career goals ----------
  // The game in progress is state.g433; finished games go to record.g433 (apart from Classic and Dare2Dream).
  // Each game picks a formation at random (Craig, 12 Oct, UI_SPEC 8f): 352 means line up 3-5-2 and score exactly 352.
  const G4 = G.g433 || { GK: [], DEF: [], MID: [], FWD: [] }, g4lists = {};
  GAME.g433 = {
    TARGET: 433, RESPINS: 3, TOP: 220,
    FORMATIONS: ['442', '433', '451', '352', '343', '424', '532', '541'],
    // balance per formation (tests/sim-goalrush.js): how many top scorers per position each draws from, so a random XI
    // lands near 77% of the target whatever the shape, and the last-shot gift chance; a casual player lands exactly
    // about 1 game in 20 and within 10 about 1 in 5 (5-4-1 the hardest)
    DEPTH: { 442: 180, 433: 220, 451: 145, 352: 310, 343: 355, 424: 260, 532: 105, 541: 75 },
    GIFTS: { 442: 0.22, 433: 0.2, 451: 0.27, 352: 0.14, 343: 0.14, 424: 0.18, 532: 0.36, 541: 0.42 },
    // how often each shape comes up (Craig, 13 Oct): the back fives, 5-3-2 and 5-4-1, half as often as the rest
    // (about 1 game in 14 each, the other six about 1 in 7)
    FORM_WEIGHT: { 532: 0.5, 541: 0.5 },
    pickFormation: () => {
      const F = GAME.g433.FORMATIONS, w = (f) => (GAME.g433.FORM_WEIGHT[f] != null ? GAME.g433.FORM_WEIGHT[f] : 1);
      let x = Math.random() * F.reduce((t, f) => t + w(f), 0);
      for (const f of F) { x -= w(f); if (x < 0) return f; }
      return F[F.length - 1];
    },
    shape: (f) => { const [d, m, a] = String(f).split('').map(Number); return { GK: 1, DEF: d, MID: m, FWD: a }; },
    depth: (f) => GAME.g433.DEPTH[f] || GAME.g433.TOP,
    gift: (f) => (GAME.g433.GIFTS[f] != null ? GAME.g433.GIFTS[f] : 0.2),
    shapeText: (f) => String(f).split('').join('-'),
    list: (pos) => g4lists[pos] || (g4lists[pos] = G4[pos].map(([name, sur, club, goals]) => ({ name, sur, club, goals, pos }))),
    // Every spin (Craig, 12 Oct): three players from any position still open on the board, each position as likely as
    // its open shirts. On the last shot, if a player of that position has exactly the goals needed, one game in five
    // (GIFT, decided once per game, so respins keep it) puts him among the three. Balanced with a simulation of
    // 20,000 games per shape (tests/sim-goalrush.js): a casual player lands exactly about 1 game in 20, one who roughly
    // knows career goals about 1 in 10. The formation is required: it sets the pool depth and the gift chance.
    // Anti-repeat (Craig, 13 Oct): the players the last three games put on the table (state.g4recent, newest game first,
    // this game at the front) come up at a tenth, a quarter and half the chance of a fresh one, the same weights as the
    // Classic rolls (E.RULES.recent). The pools and the gift are untouched, so the balance in tests/sim-goalrush.js holds.
    newGame: () => { const st = D2T.state; st.g4recent = [[]].concat(st.g4recent || []).slice(0, E.RULES.recent.length + 1); },
    recentWeights: () => E.recentWeights((D2T.state.g4recent || []).slice(1)),
    drawOpen(openPos, avoid, need, f) {
      avoid = avoid || [];
      const slots = [], out = [], top = GAME.g433.depth(f), pickFrom = (pos) => GAME.g433.list(pos).slice(0, top);
      Object.keys(openPos).forEach((pos) => { for (let i = 0; i < openPos[pos]; i++) slots.push(pos); });
      if (!slots.length) return out;
      if (need != null) { const hits = pickFrom(slots[0]).filter((p) => p.goals === need && !avoid.includes(p.name)); if (hits.length) out.push(hits[Math.floor(Math.random() * hits.length)]); }
      const rw = GAME.g433.recentWeights(), wOf = (p) => (rw && rw[p.name] != null ? rw[p.name] : 1);
      const draw = (L) => { if (!rw) return L[Math.floor(Math.random() * L.length)]; let t = 0; for (const p of L) t += wOf(p); let x = Math.random() * t; for (const p of L) { x -= wOf(p); if (x <= 0) return p; } return L[L.length - 1]; };
      let guard = 0;
      while (out.length < 3 && guard++ < 999) { const p = draw(pickFrom(slots[Math.floor(Math.random() * slots.length)])); if (!out.includes(p) && !avoid.includes(p.name)) out.push(p); }
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      const st = D2T.state; if (!Array.isArray(st.g4recent) || !st.g4recent.length) st.g4recent = [[]];
      for (const p of out) if (!st.g4recent[0].includes(p.name)) st.g4recent[0].push(p.name);
      return out;
    },
    canGift: (pos, need, avoid, f) => need >= 0 && GAME.g433.list(pos).slice(0, GAME.g433.depth(f)).some((p) => p.goals === need && !avoid.includes(p.name)),
    // a best or last from 433 Goals has no target saved: it was 433
    record: () => { const r = Object.assign({ games: 0, exact: 0, best: null, bestTotal: null, last: null }, D2T.state.record.g433 || {}); if (r.best != null && !r.bestTarget) r.bestTarget = 433; if (r.last != null && !r.lastTarget) r.lastTarget = 433; return r; },
    // the record carries on from 433 Goals: best is "N away" whatever the target
    finish(total, target) {
      const r = GAME.g433.record(), gap = Math.abs(total - target), newBest = r.best == null || gap < r.best;
      r.games += 1; if (gap === 0) r.exact += 1;
      if (newBest) { r.best = gap; r.bestTotal = total; r.bestTarget = target; }
      r.last = total; r.lastTarget = target; D2T.state.record.g433 = r; D2T.save();
      return { rec: r, newBest };
    }
  };

  // ---------- modes ----------
  // classic: a relegated club, achievements for how high you take them. dare2dream: any club, beat their real finish
  // (or win the league again if they won it).
  GAME.MODES = {
    classic: { name: 'Classic', catalogue: () => G.catalogue, pool: () => pool },
    dare2dream: { name: 'Dare2Dream', catalogue: () => G.clubSeasons, pool: () => allPool },
    clubx: { name: 'Club X', catalogue: () => xCatalogue, pool: () => xPool }
  };
  // Club X: each season's bottom side, which your own club replaces. The season card shows who you replace.
  const xCatalogue = Object.keys(G.seasons).map((sk) => { const t = (G.clubSeasons || []).filter((c) => c.season === sk); return t.sort((a, b) => b.pos - a.pos)[0]; }).filter(Boolean);
  const xPool = xCatalogue.map((c) => { const champ = (G.clubSeasons || []).find((x) => x.season === c.season && x.pos === 1); return Object.assign({}, byKey.get(c.key), { champion: champ ? champ.club : '', championPts: champ ? champ.pts : 0 }); });
  GAME.xPool = xPool;
  GAME.isDraftMode = (m) => E.DRAFT_MODES.includes(m || GAME.mode());
  GAME.mode = () => { const e = GAME.eng(); return (e && e.mode) || 'classic'; };
  GAME.modeName = (m) => (GAME.MODES[m || GAME.mode()] || GAME.MODES.classic).name;
  // The finish a Dare2Dream run must reach: better than history, or first again for real champions.
  GAME.target = (histPos) => (GAME.mode() === 'clubx' || histPos <= 1 ? 1 : histPos - 1);
  GAME.dreamMet = (finish, histPos) => finish <= GAME.target(histPos);

  // ---------- legends: the top 3 players of every season (Craig, 11 Oct 2026) ----------
  // One card per player-season, so a great can be a legend from more than one season.
  // id "L:<name>:<season>"; his best legend card also answers to "L:<name>" for runs saved before.
  const LEGENDS = (() => {
    const out = [];
    for (const [sk, S] of Object.entries(G.seasons)) {
      const top = S.players.filter((p) => p.a >= 10).slice().sort((a, b) => b.r - a.r || b.a - a.a).slice(0, 3);
      for (const p of top) {
        const main = p.c2 != null && (p.a2 || 0) > (p.a1 || 0) ? p.c2 : p.c;
        out.push({ id: 'L:' + p.n + ':' + sk, k: p.k, n: p.n, b: p.b, p: p.p, r: p.r, lv: 4, a: p.a, g: p.g, as: p.as, cs: p.cs, s6: p.s6, nat: p.nat, c: null, cn: S.clubs[main].name, sk });
      }
    }
    out.sort((a, b) => b.r - a.r);
    const aliased = new Set();
    for (const l of out) if (!aliased.has(l.n)) { l.alias = 'L:' + l.n; aliased.add(l.n); }
    return out;
  })();
  GAME.legends = LEGENDS;
  GAME.season = (key) => { const S = G.seasons[key]; if (S && !S.legends) { S.legends = LEGENDS; E.indexSeason(S); } return S; };

  // ---------- cards ----------
  const KEYS = ['GOL', 'IMP', 'FIT', 'WIN', 'DEF', 'EXP'], GK_KEYS = ['WAL', 'CLN', 'FIT', 'WIN', 'EXP'];
  GAME.card = (S, id) => {
    const p = E.playerOf(S, id);
    if (!p) return null;
    const legend = !!p.cn;
    // A January mover shows your club if he is in your squad, otherwise the club he was at on the current match date.
    const eng = GAME.eng();
    let shown = p.c;
    if (!legend && p.c2 != null) {
      const mine = eng && eng.seasonKey === S.season ? eng.club : null;
      if (mine === p.c || mine === p.c2) shown = mine;
      else {
        const fx = eng && eng.fixtures && eng.seasonKey === S.season ? eng.fixtures[Math.max(0, (eng.gw || 1) - 1)] : null;
        shown = E.clubAt(p, fx ? fx.date : null);
      }
    }
    const clubName = legend ? p.cn : S.clubs[shown].name;
    const keys = p.b === 'GK' ? GK_KEYS : KEYS, stats = {};
    keys.forEach((k, i) => { stats[k] = p.s6 ? p.s6[i] : null; });
    const two = !legend && p.c2 != null ? S.clubs[shown === p.c2 ? p.c : p.c2].name : null;
    return {
      id: p.id, name: p.n, club: clubName, club2: two, crest: crestOf(clubName), crestLight: crestLightOf(clubName), pos: p.b, ovr: p.r, level: LV[p.lv || 0],
      apps: p.a, goals: p.g, assists: p.as, cleanSheets: p.cs, nat: p.nat, flag: GAME.flag(p.nat), season: p.sk || S.season,
      provisional: p.src === 'f', stats, career: p.k != null && G.careers ? G.careers[p.k] : null,
      // detailed positions when known (main first); role is the broad colour of his main one
      main: E.SLOT_BROAD[(p.p || [])[0]] ? p.p[0] : null, alt: (p.p || []).slice(1).filter((x) => E.SLOT_BROAD[x]),
      role: E.SLOT_BROAD[(p.p || [])[0]] || p.b
    };
  };
  GAME.LV = LV;
  // nationality flags (12 Oct): drawn pictures, never emoji (assets/flags, embedded by build.py as D2T_FLAGS and D2T_NATIONS)
  GAME.flag = (nat) => { const code = (window.D2T_NATIONS || {})[nat]; return (code && (window.D2T_FLAGS || {})[code]) || ''; };

  // ---------- the run ----------
  // D2T.state.run = { step, eng (the engine's run, saved whole), tableSeen, pending (a signing waiting for a shirt), match (gw on show) }
  GAME.eng = () => D2T.state.run && D2T.state.run.eng;
  // Build 3 held a signing on the squad screen; now you sign straight from the roll, so an open hold goes back to it.
  if (D2T.state.run && D2T.state.run.pending != null) { D2T.state.run.pending = null; D2T.state.run.step = 'transfer'; D2T.save(); }
  GAME.S = () => {
    const run = D2T.state.run, e = run && run.eng; if (!e || !e.seasonKey) return null;
    const cur = run.career && run.career.cur;
    return cur && cur.key === e.seasonKey ? careerSeason(cur) : GAME.season(e.seasonKey);
  };

  // ---------- Club X career (Craig, 13 Oct) ----------
  // After a season you can go on to the next one with the same club and XI, unless you went down. Up to 2025/26 it is
  // the next real season: your club takes that season's bottom side's place and each of your players moves to his real
  // card for it (a man with no Premier League season then keeps the card he had), leaving his real club like a draft
  // pick. After 2025/26 there is no real data, so the season is simulated: the 2025/26 fixture list a year on for each
  // season, the bottom three of your final table go down and three relegated club-seasons from the database come up,
  // rivals keep the squads they came with (minus your players), the other results are played out by the match model
  // (a forecast, never shown as real), and the rolls draw cards from any season. run.career = { id, n (this season's
  // number), seasons: [{season, finish, pts, sim}], cur (how this season is built: key, me, carry, slots...) }.
  const SEASON_KEYS = Object.keys(G.seasons).sort(), LAST_REAL = SEASON_KEYS[SEASON_KEYS.length - 1];
  const yearOf = (key) => parseInt(key, 10);
  const labelOf = (y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
  const shiftDate = (d, n) => (parseInt(d.slice(0, 4), 10) + n) + d.slice(4);
  const realPlayer = (sk, id) => { const S = GAME.season(sk); return S ? E.playerOf(S, id) : null; };
  const mainClub = (S, p) => S.clubs[p.c2 != null && (p.a2 || 0) > (p.a1 || 0) ? p.c2 : p.c].name;
  // a copy of a real player-season for a career season: at club c (a slot) or, with c null, under his real club's name
  const copyOf = (sk, p, id, c) => Object.assign({}, p, { id, c, c2: null, m2: null, cn: c == null ? mainClub(G.seasons[sk], p) : undefined, sk, oid: p.id });
  // where a card in a season came from: a legend id, or the real season and id of the player-season
  const originOf = (S, id) => {
    if (id == null) return null;
    if (String(id).startsWith('L:')) return { L: id };
    const p = E.playerOf(S, id); if (!p) return null;
    return p.oid != null ? { s: p.sk, id: p.oid } : { s: S.season, id };
  };
  const built = new WeakMap();
  function careerSeason(spec) {
    if (built.has(spec)) return built.get(spec);
    const ids = [];
    let S;
    if (!spec.sim) {
      const S0 = GAME.season(spec.key), byK = new Map(), extras = [];
      S0.players.forEach((p) => { if (p.k != null && !byK.has(p.k)) byK.set(p.k, p); });
      let next = S0.players.length;
      for (const o of spec.carry) {
        if (!o) { ids.push(null); continue; }
        if (o.L) { ids.push(o.L); continue; }
        const src = realPlayer(o.s, o.id), now = src && src.k != null ? byK.get(src.k) : null;
        if (now) { ids.push(now.id); continue; }
        extras.push(copyOf(o.s, src, next, null)); ids.push(next++);
      }
      S = Object.assign({}, S0, { players: S0.players.concat(extras), _ix: null, legends: LEGENDS, career: true });
    } else {
      const T = GAME.season(LAST_REAL), players = [], used = new Set();
      spec.carry.forEach((o) => { if (o && !o.L) used.add(o.s + '|' + o.id); });
      // the league: each club with the squad of the season it came from, minus your players
      spec.slots.forEach((sl, i) => {
        if (i === spec.me) return;
        const R = G.seasons[sl.src], ci = R.clubs.findIndex((c) => c.name === sl.name);
        for (const p of R.players) if ((p.c === ci || p.c2 === ci) && !used.has(sl.src + '|' + p.id)) { players.push(copyOf(sl.src, p, players.length, i)); used.add(sl.src + '|' + p.id); }
      });
      // your XI, then everyone else from every season as cards for the rolls
      for (const o of spec.carry) {
        if (!o) { ids.push(null); continue; }
        if (o.L) { ids.push(o.L); continue; }
        const id = players.length; players.push(copyOf(o.s, realPlayer(o.s, o.id), id, null)); ids.push(id);
      }
      for (const sk of SEASON_KEYS) for (const p of G.seasons[sk].players) if ((p.a || 0) >= E.RULES.minApps && !used.has(sk + '|' + p.id)) players.push(copyOf(sk, p, players.length, null));
      const shift = yearOf(spec.key) - yearOf(LAST_REAL);
      S = { season: spec.key, clubs: spec.slots.map((sl, i) => ({ id: i, name: sl.name })), matches: T.matches.map((m) => [shiftDate(m[0], shift), m[1], m[2], 0, 0]),
        players, relegated: [], deductions: {}, relegationPlaces: 3, legends: LEGENDS, career: true, sim: true };
      const me = E.xiStrength(ids.map((id) => (id == null ? null : E.playerOf(S, id))), E.FORMATIONS[spec.f].map((x) => x[0]));
      E.simResults(S, spec.seed, spec.me, me);
    }
    S.xiIds = ids;
    built.set(spec, S);
    return S;
  }
  GAME.isSim = () => { const S = GAME.S(); return !!(S && S.sim); };
  GAME.career = () => { const r = D2T.state.run; return r && r.eng && r.eng.mode === 'clubx' ? (r.career || { n: 1, seasons: [] }) : null; };
  // a Club X run whose season is over with the career still open (not relegated: bottom three, or four in 1994/95)
  GAME.careerOpen = (run) => {
    const e = run && run.eng;
    if (!e || e.mode !== 'clubx' || e.phase !== 'summary' || !e.final || !e.seasonKey) return false;
    const S = run === D2T.state.run ? GAME.S() : GAME.season(e.seasonKey), rel = (S && S.relegationPlaces) || 3, n = S ? S.clubs.length : 20;
    return e.final.finish <= n - rel;
  };
  // the season after this one, if the career can go on (Club X, the season over, not relegated)
  GAME.careerNext = () => {
    const run = D2T.state.run, e = GAME.eng();
    if (!GAME.careerOpen(run)) return null;
    const S = GAME.S();
    const i = SEASON_KEYS.indexOf(S.season);
    const key = i >= 0 && i < SEASON_KEYS.length - 1 ? SEASON_KEYS[i + 1] : labelOf(yearOf(S.season) + 1);
    return { key, sim: !G.seasons[key] };
  };
  GAME.nextSeason = () => {
    const nx = GAME.careerNext(); if (!nx) return false;
    GAME.finish();
    const run = D2T.state.run, e = GAME.eng(), S = GAME.S();
    const c = run.career = run.career || { id: e.seed, n: 1, seasons: [], start: { season: S.season, replaced: S.clubs[e.club].name } };
    c.seasons.push({ season: S.season, finish: e.final.finish, pts: e.final.pts, sim: !!S.sim });
    c.n += 1;
    const carry = e.xi.map((id) => originOf(S, id));
    let spec;
    if (!nx.sim) {
      const bottom = xCatalogue.find((x) => x.season === nx.key), S2 = GAME.season(nx.key);
      spec = { key: nx.key, me: S2.clubs.findIndex((x) => x.name === bottom.club), carry, f: e.formation };
    } else {
      const slots = S.sim ? c.cur.slots.map((x) => Object.assign({}, x)) : S.clubs.map((x) => ({ name: x.name, src: S.season }));
      const down = e.final.table.slice(-3).map((r) => r.c);
      const r = E.stream(c.id, 'promoted', nx.key);
      let cand = G.catalogue.filter((x) => !slots.some((sl) => sl.name === x.club));
      for (const d of down) {
        const pk = cand[Math.floor(r() * cand.length)];
        slots[d] = { name: pk.club, src: pk.season };
        cand = cand.filter((x) => x.club !== pk.club);
      }
      spec = { key: nx.key, sim: true, me: e.club, slots, carry, f: e.formation, seed: c.id + ':sim' };
    }
    c.cur = spec;
    const S2 = careerSeason(spec);
    const st = E.newRun({ seed: c.id + ':s' + c.n, mode: 'clubx', catalogue: [], recent: GAME.recentFor(S2, spec.me) });
    st.seasonKey = spec.key; st.club = spec.me; st.formation = e.formation; st.career = c.n;
    E.carryIn(st, S2, S2.xiIds);
    Object.assign(run, { eng: st, step: 'table', tableSeen: false, recorded: false, match: null, pending: null });
    D2T.save();
    return true;
  };
  const randomSeed = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  GAME.newRun = (mode = 'classic') => {
    const M = GAME.MODES[mode] || GAME.MODES.classic;
    GAME.rememberOffered();                                          // the run this one replaces still counts as recent
    D2T.state.run = { step: 'spin', eng: E.newRun({ seed: randomSeed(), mode, catalogue: M.catalogue() }), spun: false };
    D2T.save();
    return D2T.state.run;
  };
  GAME.offer = () => GAME.eng().clubOffer.map((k) => (GAME.mode() === 'clubx' ? xPool.find((x) => x.key === k) : null) || GAME.poolEntry(k));
  GAME.respinClubs = () => { const ok = E.respinClubs(GAME.eng(), (GAME.MODES[GAME.mode()] || GAME.MODES.classic).catalogue()); D2T.save(); return ok; };
  GAME.spinPool = () => (GAME.MODES[GAME.mode()] || GAME.MODES.classic).pool();
  // ---------- anti-repeat (Craig, 13 Oct: a club-season must never serve the same players run after run) ----------
  // The cards each of the last three runs of a club-season put on the table are kept per phone in state.recent
  // (newest run first, 3 runs a key, the 40 most recent keys) and handed to the engine as weights when the club is chosen
  // (E.recentWeights, st.recent: a tenth, a quarter and half the chance of a fresh card). The engine keeps them on the
  // run, so a seed and its history replay the same. A run counts once it is recorded, or when it is dropped for another
  // (newRun, Quit). The Daily (every go of the day's club), Club X (the replaced side's season) and a career's later
  // seasons use the same memory, so a second go never serves the first go's cards either.
  const RECENT_KEYS = 40;
  const recentKey = (S, club) => `${S.season}:${S.clubs[club].name}`;
  GAME.recentFor = (S, club) => E.recentWeights((D2T.state.recent || {})[recentKey(S, club)]);
  GAME.rememberOffered = (run) => {
    run = run || D2T.state.run;
    const e = run && run.eng, S = e && e.seasonKey ? (run === D2T.state.run ? GAME.S() : GAME.season(e.seasonKey)) : null;
    if (!S || !e.offered || !e.offered.length || run.remembered) return;
    run.remembered = true;
    const st = D2T.state, key = recentKey(S, e.club), rec = st.recent = st.recent || {};
    const list = [e.offered.slice()].concat(rec[key] || []).slice(0, E.RULES.recent.length);
    delete rec[key]; rec[key] = list;                                // newest key last, so the oldest is dropped first
    const keys = Object.keys(rec); while (keys.length > RECENT_KEYS) delete rec[keys.shift()];
  };
  GAME.chooseClub = (key) => {
    const eng = GAME.eng(), entry = GAME.poolEntry(key), S = GAME.season(entry.season);
    const club = S.clubs.findIndex((c) => c.name === entry.name);
    eng.recent = GAME.recentFor(S, club);
    E.chooseClub(eng, S, S.relegated.find((r) => r.c === club) || { c: club, f: '4-4-2', xi: [] });
    eng.formation = eng.formation || '4-4-2';
    D2T.state.run.step = 'table'; D2T.state.run.tableSeen = false;
    D2T.save();
  };
  // In a Club X run your club (the name you gave it) appears wherever the replaced side would.
  const nameOf = (S, c) => { const e = GAME.eng(); return e && e.mode === 'clubx' && e.seasonKey === S.season && c === e.club ? GAME.xName() : S.clubs[c].name; };
  GAME.clubName = () => { const S = GAME.S(); return S ? nameOf(S, GAME.eng().club) : null; };

  const rowOf = (S, r, pos) => { const n = nameOf(S, r.c), c = GAME.club(n); return { name: n, code: c.code, crest: c.crest, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts, pos }; };
  GAME.historyTable = () => { const S = GAME.S(); return E.historyTable(S, S.deductions).map((r, i) => rowOf(S, r, i + 1)); };
  GAME.standings = (upto) => { const S = GAME.S(); return E.table(S, GAME.eng(), upto, S.deductions).map((r, i) => rowOf(S, r, i + 1)); };
  GAME.fixtures = () => {
    const S = GAME.S(), eng = GAME.eng();
    const list = eng.fixtures || E.fixturesOf(S, eng.club);
    return list.map((f, i) => ({ gw: i + 1, date: f.date, opp: S.clubs[f.opp].name, ha: f.home ? 'H' : 'A' }));
  };
  GAME.fixture = (gw) => GAME.fixtures()[gw - 1] || null;
  // The prototype's run shape, built from the engine: { club, season, table (real final table), fixtures }.
  GAME.runData = () => {
    const S = GAME.S(); if (!S) return null;
    return { club: GAME.club(GAME.clubName()), season: S.season, table: GAME.historyTable(), fixtures: GAME.fixtures() };
  };
  // Everyone else's real matches around a gameweek (no scores are shown before they are played).
  GAME.gwFixtures = (gw) => {
    const S = GAME.S(), eng = GAME.eng(), fx = GAME.fixtures(), me = eng.club;
    const f = fx[gw - 1]; if (!f) return [];
    const prev = fx[gw - 2] ? fx[gw - 2].date : '0000', next = fx[gw] ? fx[gw].date : '9999';
    const day = (d) => Date.parse(d + 'T12:00:00Z') / 864e5, at = day(f.date);
    return E.indexSeason(S).matches.filter((m) => m.h !== me && m.a !== me && m.date > prev && m.date < next && Math.abs(day(m.date) - at) <= 3)
      .map((m) => ({ date: m.date, home: S.clubs[m.h].name, away: S.clubs[m.a].name }));
  };

  // ---------- squad and line-up ----------
  // Before the season: the whole real squad. Once the season starts the rest of the squad is gone: just your 11
  // (plus a new signing waiting for a shirt).
  GAME.preseason = () => GAME.eng().phase === 'setup';
  GAME.lineup = () => {
    const S = GAME.S(), eng = GAME.eng();
    const xi = eng.xi.map((id) => (id == null ? null : GAME.card(S, id)));
    let subs = [];
    if (GAME.preseason() && !GAME.isDraftMode()) subs = E.squadOf(S, eng.club).filter((p) => !eng.xi.includes(p.id)).map((p) => GAME.card(S, p.id));
    const all = new Map(); xi.concat(subs).forEach((c) => c && all.set(String(c.id), c));
    return { all, xi, subs };
  };
  GAME.slots = () => E.FORMATIONS[GAME.eng().formation].map(([pos, x, y]) => ({ pos, role: E.SLOT_BROAD[pos], x, y: 89 - y * 0.86 }));
  GAME.formations = () => E.FORMATION_NAMES;
  GAME.formationDots = (f) => E.FORMATIONS[f].map(([pos, x, y]) => ({ x, y: 89 - y * 0.86 }));
  GAME.fit = (cardId, slot) => { if (cardId == null) return 'green'; const S = GAME.S(), p = E.playerOf(S, cardId); return E.fitOf(p, E.FORMATIONS[GAME.eng().formation][slot][0]); };
  GAME.strength = () => E.userStrength(GAME.S(), GAME.eng());
  // During a Dare2Dream draft some shirts are empty: the rating is the average of the shirts filled so far.
  GAME.rating = () => {
    const eng = GAME.eng(), S = GAME.S();
    if (eng.xi.every((x) => x != null)) return Math.round(GAME.strength().ovr);
    const slots = E.FORMATIONS[eng.formation], got = eng.xi.map((id, i) => (id == null ? null : E.effRating(E.playerOf(S, id), slots[i][0]))).filter((x) => x != null);
    return got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : 0;
  };
  GAME.setFormation = (f) => {
    const S = GAME.S(), eng = GAME.eng();
    if (eng.phase === 'draft') E.draftFormation(eng, S, f);                                 // the empty shirts, before the first pick
    else if (GAME.preseason() && !GAME.isDraftMode()) { eng.formation = f; eng.xi = E.autoXI(S, eng.club, f, []); }   // a new best XI from the squad
    else E.setFormation(eng, S, f);                                                         // your 11, re-seated
    D2T.save();
  };
  // Swap two shirts, or bring a squad player in before the season.
  GAME.swap = (aId, bId) => {
    const eng = GAME.eng(), i = eng.xi.indexOf(aId), j = eng.xi.indexOf(bId);
    if (i >= 0 && j >= 0) { eng.xi[i] = bId; eng.xi[j] = aId; D2T.save(); return true; }
    if (!GAME.preseason()) return false;
    const pitch = i >= 0 ? i : j, sub = i >= 0 ? bId : aId;
    if (pitch < 0) return false;
    E.swapSetup(eng, pitch, sub); D2T.save(); return true;
  };
  GAME.startSeason = () => { const ok = E.startSeason(GAME.eng(), GAME.S()); D2T.state.run.step = GAME.eng().phase === 'window' ? 'transfer' : 'fixtures'; D2T.save(); return ok; };

  // ---------- Dare2Dream draft: one spin per shirt ----------
  GAME.inDraft = () => GAME.eng().phase === 'draft';
  // Club X (Craig, 13 Oct) drafts any open shirt: slot is null (open) and each card goes on an open shirt he lists
  GAME.draftInfo = () => {
    const eng = GAME.eng(), slot = E.draftSlot(eng);
    if (slot == null) return { step: eng.draft.step + 1, of: eng.xi.length, slot: -1, open: true, pos: '', broad: '' };
    const pos = E.FORMATIONS[eng.formation][slot][0];
    return { step: eng.draft.step + 1, of: eng.xi.length, slot, pos, broad: E.SLOT_BROAD[pos] };
  };
  GAME.draftFits = (cardId) => E.draftFits(GAME.eng(), GAME.S(), cardId);
  GAME.draftPick = (cardId, slot) => {
    const eng = GAME.eng();
    if (!E.draftPick(eng, GAME.S(), cardId, slot)) return false;
    D2T.state.run.step = eng.phase === 'draft' ? 'transfer' : 'squad';
    D2T.save(); return true;
  };

  // ---------- transfer rolls ----------
  GAME.rollCards = () => { const S = GAME.S(), r = GAME.eng().roll; return r ? r.cards.map((id) => GAME.card(S, id)) : []; };
  GAME.respinCards = () => { const ok = E.respinCards(GAME.eng(), GAME.S()); D2T.save(); return ok; };
  GAME.windowInfo = () => {
    const eng = GAME.eng(), w = E.currentWindow(eng);
    const total = eng.rolls.reduce((a, x) => a + x.n, 0);
    let done = 0; for (let i = 0; i < eng.rollIx; i++) done += eng.rolls[i].n;
    done += eng.rollStep;
    const name = !w ? 'Transfer window' : w.kind === 'pre' ? 'Summer transfer window' : w.kind === 'jan' ? 'January window' : 'Transfer window';
    return { name, step: eng.rollStep + 1, of: w ? w.n : 1, overall: done + 1, total, gw: eng.gw };
  };
  // The season's transfer track (Craig, 14 Oct): one segment per roll, each with its window's kind ('pre' for the
  // Summer window, 'jan' for January, 'reg' otherwise) and whether it is done, the current roll or still to come.
  GAME.rollTrack = () => {
    const eng = GAME.eng(), cur = GAME.windowInfo().overall - 1, out = [];
    eng.rolls.forEach((w) => { for (let k = 0; k < w.n; k++) { const i = out.length; out.push({ kind: w.kind || 'reg', state: i < cur ? 'done' : i === cur ? 'current' : 'todo' }); } });
    return out;
  };
  GAME.preview = (cardId) => E.signPreview(GAME.eng(), GAME.S(), cardId);
  GAME.bestSlot = (cardId) => { let b = 0, bd = -1e9; GAME.preview(cardId).forEach((o) => { if (o.delta > bd) { bd = o.delta; b = o.slot; } }); return b; };
  // Sign a rolled player into a shirt: the player there leaves for good.
  GAME.signAt = (cardId, slot) => {
    const run = D2T.state.run, eng = GAME.eng();
    if (!E.sign(eng, GAME.S(), cardId, slot)) return false;
    run.step = eng.phase === 'window' ? 'transfer' : 'fixtures';   // the window over: straight to the fixtures (Craig, 14 Oct)
    D2T.save(); return true;
  };
  GAME.pass = () => { const eng = GAME.eng(); E.pass(eng, GAME.S()); D2T.state.run.step = eng.phase === 'window' ? 'transfer' : 'fixtures'; D2T.save(); };

  // ---------- matches ----------
  // Plays the gameweek in the engine at once (so a refresh can never replay it) and returns what the screen shows.
  // Kick off is the fixtures screen's main button (Craig, 14 Oct): the match screen then plays the result out. run.match
  // holds the gameweek on show until afterMatch; run.watch is set here and taken by the match screen as it mounts, so a
  // refresh mid-match shows the match settled rather than playing it again.
  GAME.play = () => {
    const eng = GAME.eng(), S = GAME.S(), gw = eng.gw;
    const res = E.playMatch(eng, S);
    if (!res) return null;
    D2T.state.run.match = gw; D2T.state.run.step = 'match'; D2T.state.run.watch = true;
    D2T.save();
    return GAME.result(gw);
  };
  // the gameweek's other matches with their scores (raids applied, E.otherResults), the same window as gwFixtures
  GAME.gwResults = (gw) => {
    const S = GAME.S(), eng = GAME.eng(), fx = GAME.fixtures(), me = eng.club;
    const f = fx[gw - 1]; if (!f) return [];
    const prev = fx[gw - 2] ? fx[gw - 2].date : '0000', next = fx[gw] ? fx[gw].date : '9999';
    const day = (d) => Date.parse(d + 'T12:00:00Z') / 864e5, at = day(f.date);
    return E.otherResults(S, eng).filter((m) => m.h !== me && m.a !== me && m.date > prev && m.date < next && Math.abs(day(m.date) - at) <= 3)
      .map((m) => ({ date: m.date, home: S.clubs[m.h].name, away: S.clubs[m.a].name, hg: m.hg, ag: m.ag, changed: !!m.changed }));
  };
  // Players you have signed from each club this season, by club name (Craig, 14 Oct: dots on the results rows). A Club X
  // career's later seasons leave out the XI carried in from last season (gw 0), so only this season's signings count.
  GAME.signedFrom = () => {
    const S = GAME.S(), eng = GAME.eng(), out = {};
    for (const r of eng.raids || []) { if (eng.career > 1 && !r.gw) continue; const c = S.clubs[r.club]; if (c) out[c.name] = (out[c.name] || 0) + 1; }
    return out;
  };
  GAME.result = (gw) => {
    const eng = GAME.eng(), S = GAME.S(), r = eng.played[gw - 1]; if (!r) return null;
    const oppName = S.clubs[r.opp].name;
    const ev = r.events.map((e) => ({ min: e.min, side: e.us ? 'me' : 'opp', type: 'goal', who: e.name }));
    // Colour only (near misses and bookings): seeded from the run, never changes a result.
    const rnd = E.stream(eng.seed, 'flavour', gw);
    const mine = eng.xi.map((id) => GAME.card(S, id)).filter((c) => c && c.pos !== 'GK');
    const theirs = E.clubXI(S, r.opp, new Set()).filter((p) => p.b !== 'GK').map((p) => p.n);
    const pick = (arr) => arr.length ? arr[Math.floor(rnd() * arr.length)] : '';
    const misses = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < misses; i++) {
      const me = rnd() < (r.xg[0] / (r.xg[0] + r.xg[1]));
      ev.push({ min: 2 + Math.floor(rnd() * 87), side: me ? 'me' : 'opp', type: 'miss', who: me ? (pick(mine) || {}).name : pick(theirs), kind: Math.floor(rnd() * 4) });
    }
    const books = Math.floor(rnd() * 4);
    for (let i = 0; i < books; i++) { const me = rnd() < 0.5; ev.push({ min: 5 + Math.floor(rnd() * 84), side: me ? 'me' : 'opp', type: 'yellow', who: me ? (pick(mine) || {}).name : pick(theirs) }); }
    ev.push({ min: 45, type: 'ht' }, { min: 90, type: 'ft' });
    const order = { goal: 1, miss: 0, yellow: 2, ht: 3, ft: 4 };
    ev.sort((a, b) => a.min - b.min || order[a.type] - order[b.type]);
    const opp = E.clubStrength(S, r.opp, new Set(eng.signed.filter((x) => x.date <= r.date).map((x) => x.id)));
    return { gw, opp: oppName, ha: r.home ? 'H' : 'A', gf: r.us, ga: r.them, events: ev, me: Math.round(E.userStrength(S, eng).ovr), oppStrength: Math.round(opp.ovr), date: r.date };
  };
  GAME.oppStrength = (gw) => { const eng = GAME.eng(), S = GAME.S(), f = eng.fixtures[gw - 1]; return Math.round(E.clubStrength(S, f.opp, new Set(eng.signed.filter((x) => x.date <= f.date).map((x) => x.id))).ovr); };
  // After the final whistle: where to next (a transfer window, the next gameweek or the season summary).
  GAME.afterMatch = () => {
    const run = D2T.state.run, eng = GAME.eng();
    run.match = null;
    run.step = eng.phase === 'summary' ? 'summary' : eng.phase === 'window' ? 'transfer' : 'fixtures';
    D2T.save();
    return run.step;
  };

  // ---------- where the run is: the screen it belongs on, and which screens it may show ----------
  // Dare2Dream is locked for repair on home (Craig, 13 Oct): one flag. A saved Dare2Dream run is kept, but no screen of
  // it opens (stepFor null, so the router goes home) until the flag is false again.
  GAME.dreamLocked = true;
  GAME.locked = (run) => !!(GAME.dreamLocked && run && run.eng && run.eng.mode === 'dare2dream');
  const MATCH_STEPS = ['match', 'results', 'standings'];
  GAME.stepFor = () => {
    const run = D2T.state.run; if (!run || !run.eng || GAME.locked(run)) return null;
    const ph = run.eng.phase;
    if (ph === 'clubroll') return 'spin';
    if (ph === 'setup') return run.tableSeen ? 'squad' : 'table';
    // Dare2Dream: pick the shape on the squad screen, then the draft runs on the transfer screen
    if (ph === 'draft') return !run.tableSeen ? 'table' : (run.eng.draft.step === 0 && run.step !== 'transfer' ? 'squad' : 'transfer');
    // a match on show (Craig, 14 Oct): the match, then its results screen, then the table after the gameweek
    if (run.match) return MATCH_STEPS.includes(run.step) ? run.step : 'match';
    if (ph === 'window') return 'transfer';
    if (ph === 'summary') return 'summary';
    // between matches the run sits on the fixtures (Kick off); the squad is kept only when you went back to it
    return ['squad', 'fixtures'].includes(run.step) ? run.step : 'fixtures';
  };
  GAME.allowed = (screen) => {
    const run = D2T.state.run, step = GAME.stepFor();
    if (!step) return false;
    const ph = run.eng.phase;
    if (screen === step) return true;
    if (screen === 'squad') return ph === 'setup' || (ph === 'prematch' && !run.match) || (ph === 'draft' && run.eng.draft.step === 0 && run.tableSeen);
    if (screen === 'transfer') return ph === 'draft' && run.tableSeen;
    if (screen === 'fixtures') return ph === 'prematch' && !run.match;
    if (MATCH_STEPS.includes(screen)) return !!run.match;                 // the match, its results and the table can be stepped back through
    return false;
  };

  // ---------- end of season and the record ----------
  GAME.finish = () => {
    const run = D2T.state.run, eng = GAME.eng(), S = GAME.S(), F = eng.final;
    if (!F || run.recorded) return F;
    run.recorded = true;
    GAME.rememberOffered(run);
    const name = GAME.clubName(), n = S.clubs.length, rel = S.relegationPlaces || 3, mode = GAME.mode();
    const rec = D2T.state.record, k = `${S.season}:${name}`;
    const entry = { key: k, mode, season: S.season, club: name, finish: F.finish, rise: F.rise, pts: F.pts, histFinish: F.histFinish,
      drop: F.finish <= n - rel, half: F.finish <= n / 2, top3: F.finish <= 3, title: F.finish === 1, at: new Date().toISOString().slice(0, 10) };
    if (mode !== 'classic') entry.dream = GAME.dreamMet(F.finish, F.histFinish);
    if (mode === 'clubx') {
      entry.career = run.career ? run.career.n : 1; entry.careerId = run.career ? run.career.id : eng.seed; if (S.sim) entry.sim = true;
      // for the club history page (Craig, 14 Oct): the season's record, its scorers and its biggest win
      const P = eng.played || [], goals = {};
      entry.w = P.filter((m) => m.us > m.them).length; entry.d = P.filter((m) => m.us === m.them).length; entry.l = P.length - entry.w - entry.d;
      entry.gf = P.reduce((a, m) => a + m.us, 0); entry.ga = P.reduce((a, m) => a + m.them, 0);
      P.forEach((m) => m.events.forEach((e) => { if (e.us && e.name) goals[e.name] = (goals[e.name] || 0) + 1; }));
      entry.goals = Object.entries(goals).sort((a, b) => b[1] - a[1]);
      const big = P.filter((m) => m.us > m.them).sort((a, b) => (b.us - b.them) - (a.us - a.them) || b.us - a.us)[0];
      if (big) entry.big = { us: big.us, them: big.them, opp: S.clubs[big.opp].name };
    }
    if (run.daily) {
      entry.daily = run.daily;
      rec.daily = rec.daily || {};
      // the day's best go counts (biggest rise, then higher finish); goes counts them all
      const was = rec.daily[run.daily], goes = (was && was.goes || (was ? 1 : 0)) + 1;
      if (!was || F.rise > was.rise || (F.rise === was.rise && F.finish < was.finish)) rec.daily[run.daily] = { n: GAME.dailyNumber(run.daily), club: name, season: S.season, mode, finish: F.finish, histFinish: F.histFinish, rise: F.rise, pts: F.pts, histPts: F.histPts, dream: entry.dream, goes };
      else was.goes = goes;
    }
    rec.runs.push(entry);
    const book = mode === 'dare2dream' ? (rec.dreamClubs = rec.dreamClubs || {}) : mode === 'clubx' ? (rec.xClubs = rec.xClubs || {}) : rec.clubs;
    const c = book[k] || { runs: 0, finish: 99, rise: -99 };
    c.runs++; c.finish = Math.min(c.finish, F.finish); c.rise = Math.max(c.rise, F.rise);
    if (entry.dream) c.dream = true;
    book[k] = c;
    D2T.save();
    return F;
  };
  // The home record. Cumulative counts (Craig, 11 Oct): a title also counts as top 3, top half and beating the drop.
  // Every full season counts (Craig, 13 Oct): Classic, every Daily go and every Club X season; Dare2Dream stays apart.
  const classicRuns = () => D2T.state.record.runs.filter((r) => r.mode !== 'dare2dream');
  GAME.record = () => {
    const runs = classicRuns();
    return { runs: runs.length, drop: runs.filter((r) => r.drop).length, half: runs.filter((r) => r.half).length,
      top3: runs.filter((r) => r.top3).length, titles: runs.filter((r) => r.title).length,
      bestRise: runs.length ? Math.max(...runs.map((r) => r.rise)) : null };
  };
  GAME.classicRuns = classicRuns;
  // Club X: every season counts; seasons of one career share a careerId (a season before careers is a career of its own)
  GAME.xRecord = () => {
    const runs = D2T.state.record.runs.filter((r) => r.mode === 'clubx' && !r.daily);
    const careers = new Map();
    runs.forEach((r, i) => { const id = r.careerId || 'old' + i, c = careers.get(id) || { seasons: 0, titles: 0 }; c.seasons++; if (r.title) c.titles++; careers.set(id, c); });
    const list = [...careers.values()], longest = list.sort((a, b) => b.seasons - a.seasons || b.titles - a.titles)[0] || null;
    return { runs: runs.length, titles: runs.filter((r) => r.title).length, best: runs.length ? Math.min(...runs.map((r) => r.finish)) : null,
      careers: careers.size, longest, mostTitles: list.length ? Math.max(...list.map((c) => c.titles)) : 0 };
  };
  // One Club X career's seasons, oldest first, and its record (Craig, 14 Oct: the club history page). Seasons played
  // before the history page have only finish and points, so the counts that need more skip them.
  GAME.careerHistory = (id) => {
    const run = D2T.state.run;
    id = id || (run && run.eng && run.eng.mode === 'clubx' ? (run.career ? run.career.id : run.eng.seed) : null);
    const seasons = D2T.state.record.runs.filter((r) => r.mode === 'clubx' && !r.daily && r.careerId === id).sort((a, b) => (a.career || 1) - (b.career || 1));
    const full = seasons.filter((r) => r.w != null), goals = {};
    full.forEach((r) => (r.goals || []).forEach(([n, g]) => { goals[n] = (goals[n] || 0) + g; }));
    const top = Object.entries(goals).sort((a, b) => b[1] - a[1])[0] || null;
    const best = seasons.slice().sort((a, b) => b.pts - a.pts)[0] || null;
    const big = full.filter((r) => r.big).sort((a, b) => (b.big.us - b.big.them) - (a.big.us - a.big.them) || b.big.us - a.big.us)[0] || null;
    return { id, club: seasons.length ? seasons[seasons.length - 1].club : null, seasons,
      record: { runs: seasons.length, drop: seasons.filter((r) => r.drop).length, half: seasons.filter((r) => r.half).length, top3: seasons.filter((r) => r.top3).length, titles: seasons.filter((r) => r.title).length },
      best, wins: full.reduce((a, r) => a + r.w, 0), games: full.reduce((a, r) => a + r.w + r.d + r.l, 0), full: full.length,
      top: top ? { name: top[0], goals: top[1], seasons: full.filter((r) => (r.goals || []).some(([n]) => n === top[0])).length } : null,
      big: big ? Object.assign({ season: big.season }, big.big) : null };
  };
  GAME.dreamRecord = () => {
    const runs = D2T.state.record.runs.filter((r) => r.mode === 'dare2dream' && !r.daily);
    return { runs: runs.length, dreams: runs.filter((r) => r.dream).length, bestRise: runs.length ? Math.max(...runs.map((r) => r.rise)) : null };
  };

  // ---------- Daily challenge ----------
  // The same club for everyone each day (UK date), and only the club (Craig, 13 Oct: a shared seed meant everyone saw
  // the same cards, got the same results and shared the same scores). The clubs come round in a fixed cycle through
  // every relegated club-season, the same list Classic spins from (Craig, 13 Oct): Daily #1 is the first in the cycle,
  // each day the next, and after the last it starts again from the top. It is a Classic run (Craig, 13 Oct): their real
  // squad and XI, Classic's rolls and 5 respins. As many goes as you like (Craig, 13 Oct), the best of the day counts; it
  // has its own save, so another run is never lost. Every go, for every player, gets a random seed of its own, built
  // like Classic's and prefixed `daily-YYYY-MM-DD-` so it is still recognisably a Daily (`dailySeed`); it sits on the run
  // (run.eng.seed), so a refresh in the middle of a go keeps its cards and results.
  const DAILY_START = '2026-10-11';
  GAME.dailySeed = (date) => 'daily-' + date + '-' + randomSeed();
  GAME.today = () => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  // "Daily Challenge 11 Oct 2026": the name shown everywhere for a day's challenge
  GAME.dailyName = (date, short) => { const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [y, m, d] = date.split('-'); return `Daily Challenge ${+d} ${M[+m - 1]}${short ? '' : ' ' + y}`; };
  GAME.dailyNumber = (date) => Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(DAILY_START + 'T12:00:00Z')) / 864e5) + 1;
  // the cycle: every relegated club-season in a fixed shuffled order (a hash of its key), so seasons and clubs mix
  const dailyCycle = G.catalogue.map((c) => c.key).sort((a, b) => (E.hash32('d2t-daily-cycle|' + a) - E.hash32('d2t-daily-cycle|' + b)) || (a < b ? -1 : 1));
  GAME.dailyCycle = dailyCycle;
  GAME.dailyEntry = (date) => {
    const n = GAME.dailyNumber(date), L = dailyCycle.length;
    return Object.assign({}, GAME.poolEntry(dailyCycle[(((n - 1) % L) + L) % L]), { mode: 'classic', relegated: true, n, date });
  };
  GAME.isDaily = () => !!(D2T.state.run && D2T.state.run.daily);
  GAME.dailyResult = (date) => ((D2T.state.record.daily || {})[date || GAME.today()] || null);
  // A run is live until its summary, except a Club X career with its next season open (Craig, 13 Oct: Aiden's career
  // restarted instead of going on; home took a finished season as no run, so Club X started afresh and a Daily or a new
  // run dropped it). Such a run keeps its Continue card (to the summary and Next season), is parked for a Daily, and
  // home asks before replacing it.
  const live = (r) => !!(r && r.eng && r.eng.seasonKey && (r.eng.phase !== 'summary' || GAME.careerOpen(r)));
  GAME.live = (r) => live(r === undefined ? D2T.state.run : r);
  // The run not on screen: a run parked while the daily is played, or a daily put aside for another run.
  GAME.otherRun = () => {
    const st = D2T.state;
    if (st.parked && live(st.parked)) return st.parked;
    if (st.dailyRun && live(st.dailyRun) && !(st.record.daily || {})[st.dailyRun.daily]) return st.dailyRun;
    return null;
  };
  // Put the run on screen aside (a daily goes to its own slot, anything else is parked) and bring `next` in.
  const swapIn = (next) => {
    const st = D2T.state, cur = st.run;
    if (cur && live(cur) && cur !== next) { if (cur.daily) st.dailyRun = cur; else st.parked = cur; }
    if (st.parked === next) st.parked = null;
    if (st.dailyRun === next) st.dailyRun = null;
    st.run = next;
  };
  GAME.switchToOther = () => { const o = GAME.otherRun(); if (o) { swapIn(o); D2T.save(); } return o; };
  // Before a new Classic or Dare2Dream run: an unfinished daily keeps its own slot.
  GAME.stashDaily = () => { const st = D2T.state; if (st.run && st.run.daily && live(st.run)) { st.dailyRun = st.run; st.run = null; D2T.save(); } };
  GAME.startDaily = () => {
    GAME.closeOldDaily();
    const st = D2T.state, date = GAME.today();
    // as many goes as you like (Craig, 13 Oct): a go in progress carries on, a finished one makes way for a new go
    const over = (r) => r && (r.recorded || (r.eng && r.eng.phase === 'summary'));
    if (st.run && st.run.daily === date) { if (!over(st.run)) return true; st.run = null; }
    if (st.dailyRun && st.dailyRun.daily === date) { if (!over(st.dailyRun)) { swapIn(st.dailyRun); D2T.save(); return true; } st.dailyRun = null; }
    const d = GAME.dailyEntry(date);
    delete st.dailyGoes;                                             // the shared per-go seeds of build 95 are gone
    const eng = E.newRun({ seed: GAME.dailySeed(date), mode: d.mode, catalogue: [{ key: d.key }], fixedClub: d.key });
    swapIn({ step: 'table', eng, spun: true, daily: date });
    GAME.chooseClub(d.key);
    D2T.save();
    return true;
  };
  // a fresh go at today's Daily, throwing away the one on (from the run menu or the summary)
  GAME.restartDaily = () => { const st = D2T.state, date = GAME.today(); if (st.run && st.run.daily === date) st.run = null; if (st.dailyRun && st.dailyRun.daily === date) st.dailyRun = null; return GAME.startDaily(); };
  // A Daily closes at midnight (UK date, Craig 12 Oct): an unfinished one from an earlier day is dropped (no result, so it
  // never counts), a parked run comes back, and home says so once. Returns the closed date or null.
  const runKey = (eng) => eng.seasonKey + ':' + G.seasons[eng.seasonKey].clubs[eng.club].name;
  GAME.closeOldDaily = () => {
    const st = D2T.state, today = GAME.today(), done = (d) => !!(st.record.daily || {})[d];
    let closed = null;
    if (st.run && st.run.daily && st.run.daily !== today && !done(st.run.daily)) {
      closed = st.run.daily;
      st.run = st.parked && live(st.parked) ? st.parked : null;
      if (st.run === st.parked) st.parked = null;
    }
    if (st.dailyRun && st.dailyRun.daily !== today) { closed = closed || (done(st.dailyRun.daily) ? null : st.dailyRun.daily); st.dailyRun = null; }
    // a Daily for today begun before it became Classic's rotation (a draft, or another club) starts again as today's
    const stale = (r) => r && r.daily === today && !done(today) && r.eng && (r.eng.mode !== 'classic' || (r.eng.seasonKey && runKey(r.eng) !== GAME.dailyEntry(today).key));
    if (stale(st.run)) { st.run = st.parked && live(st.parked) ? st.parked : null; if (st.run === st.parked) st.parked = null; D2T.save(); }
    if (stale(st.dailyRun)) { st.dailyRun = null; D2T.save(); }
    if (closed) { st.dailyClosed = closed; D2T.save(); }
    return closed;
  };
  // Your best Daily: the biggest rise, then the higher finish. `except` leaves a date out (to compare today with the rest).
  GAME.dailyBest = (except) => {
    const days = D2T.state.record.daily || {};
    return Object.keys(days).filter((d) => d !== except).map((d) => Object.assign({ date: d }, days[d]))
      .sort((a, b) => b.rise - a.rise || a.finish - b.finish)[0] || null;
  };
  // today's Daily against your best other one, for home, the summary and the share text
  GAME.dailyCompare = (date) => {
    date = date || GAME.today();
    const today = GAME.dailyResult(date), best = GAME.dailyBest(date), sg = (n) => (n > 0 ? '+' : '') + n;
    const isBest = !!today && (!best || today.rise > best.rise || (today.rise === best.rise && today.finish < best.finish));
    const bestLine = best ? `Best Daily: ${best.club} ${best.season}, ${D2T.ordinal(best.finish)} (rise ${sg(best.rise)})` : '';
    return { today, best, isBest, sg, bestLine };
  };
  GAME.dailyStreak = () => {
    const days = D2T.state.record.daily || {};
    let n = 0, d = new Date(GAME.today() + 'T12:00:00Z');
    if (!days[GAME.today()]) d = new Date(d.getTime() - 864e5);                  // today not played yet: count to yesterday
    while (days[d.toISOString().slice(0, 10)]) { n++; d = new Date(d.getTime() - 864e5); }
    return n;
  };
})();
