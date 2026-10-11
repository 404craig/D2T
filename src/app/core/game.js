// D2T game adapter: the real season data (window.D2T_GAME), crests and the engine (window.D2TE),
// handed to the screens in the shapes they draw. The engine stays the only judge of rolls, results and the table;
// this file only translates. Loads after core/app.js and core/cards.js.
(function () {
  const D2T = window.D2T, G = window.D2T_GAME, E = window.D2TE, CR = window.D2T_CRESTS || {};
  const LV = ['bronze', 'silver', 'gold', 'baller', 'legend'];
  const crestOf = (name) => (CR[name] && (CR[name]['128'] || CR[name]['72'])) || '';
  const meta = (name) => G.clubs[name] || { name, full: name, code: name.slice(0, 3).toUpperCase(), accent: '#12F06C', ink: '#000000', text: '#12F06C' };
  const GAME = D2T.game = {};

  // ---------- clubs ----------
  const clubs = {};
  Object.keys(G.clubs).forEach((n) => { const m = meta(n); clubs[n] = { name: n, full: m.full || n, code: m.code, crest: crestOf(n), accent: m.accent, ink: m.ink, text: m.text }; });
  GAME.club = (name) => clubs[name] || Object.assign({ crest: crestOf(name) }, meta(name));

  // ---------- the club pool: every relegated club-season ----------
  const pool = G.catalogue.map((c) => {
    const S = G.seasons[c.season], idx = S.clubs.findIndex((x) => x.name === c.club), rel = S.relegated.find((r) => r.c === idx) || {};
    return Object.assign({}, GAME.club(c.club), { key: c.key, season: c.season, pos: c.pos, pts: c.pts, w: rel.w, d: rel.d, l: rel.l, gf: rel.gf, ga: rel.ga });
  });
  GAME.pool = pool;
  GAME.poolEntry = (key) => pool.find((p) => p.key === key);
  D2T.data = { clubs, relegatedPool: pool };

  // ---------- legends: the best Premier League seasons in the fully rated data ----------
  const LEGENDS = (() => {
    const best = new Map();
    for (const [sk, S] of Object.entries(G.seasons)) {
      for (const p of S.players) {
        if (p.src !== 'x' || p.r < 93 || p.a < 20) continue;
        const cur = best.get(p.n);
        if (!cur || p.r > cur.r) best.set(p.n, { id: 'L:' + p.n, n: p.n, b: p.b, p: p.p, r: p.r, lv: 4, a: p.a, g: p.g, as: p.as, cs: p.cs, s6: p.s6, nat: p.nat, c: null, cn: S.clubs[p.c].name, sk });
      }
    }
    return [...best.values()].sort((a, b) => b.r - a.r);
  })();
  GAME.legends = LEGENDS;
  GAME.season = (key) => { const S = G.seasons[key]; if (S && !S.legends) { S.legends = LEGENDS; E.indexSeason(S); } return S; };

  // ---------- cards ----------
  const KEYS = ['GOL', 'IMP', 'FIT', 'WIN', 'DEF', 'EXP'], GK_KEYS = ['WAL', 'CLN', 'FIT', 'WIN', 'EXP'];
  GAME.card = (S, id) => {
    const p = E.playerOf(S, id);
    if (!p) return null;
    const legend = !!p.cn;
    const clubName = legend ? p.cn : S.clubs[p.c].name;
    const keys = p.b === 'GK' ? GK_KEYS : KEYS, stats = {};
    keys.forEach((k, i) => { stats[k] = p.s6 ? p.s6[i] : null; });
    const two = !legend && p.c2 != null ? S.clubs[p.c2].name : null;
    return {
      id: p.id, name: p.n, club: clubName, club2: two, crest: crestOf(clubName), pos: p.b, ovr: p.r, level: LV[p.lv || 0],
      apps: p.a, goals: p.g, assists: p.as, cleanSheets: p.cs, nat: p.nat, season: legend ? p.sk : S.season,
      provisional: p.src === 'f', stats, career: p.k != null && G.careers ? G.careers[p.k] : null
    };
  };
  GAME.LV = LV;

  // ---------- the run ----------
  // D2T.state.run = { step, eng (the engine's run, saved whole), tableSeen, pending (a signing waiting for a shirt), match (gw on show) }
  GAME.eng = () => D2T.state.run && D2T.state.run.eng;
  // Build 3 held a signing on the squad screen; now you sign straight from the roll, so an open hold goes back to it.
  if (D2T.state.run && D2T.state.run.pending != null) { D2T.state.run.pending = null; D2T.state.run.step = 'transfer'; D2T.save(); }
  GAME.S = () => { const e = GAME.eng(); return e && e.seasonKey ? GAME.season(e.seasonKey) : null; };
  GAME.newRun = () => {
    const seed = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
    D2T.state.run = { step: 'spin', eng: E.newRun({ seed, catalogue: G.catalogue }), spun: false };
    D2T.save();
    return D2T.state.run;
  };
  GAME.offer = () => GAME.eng().clubOffer.map(GAME.poolEntry);
  GAME.respinClubs = () => { const ok = E.respinClubs(GAME.eng(), G.catalogue); D2T.save(); return ok; };
  GAME.chooseClub = (key) => {
    const eng = GAME.eng(), entry = GAME.poolEntry(key), S = GAME.season(entry.season);
    const club = S.clubs.findIndex((c) => c.name === entry.name);
    E.chooseClub(eng, S, S.relegated.find((r) => r.c === club));
    eng.formation = eng.formation || '4-4-2';
    D2T.state.run.step = 'table'; D2T.state.run.tableSeen = false;
    D2T.save();
  };
  GAME.clubName = () => { const S = GAME.S(); return S ? S.clubs[GAME.eng().club].name : null; };

  const rowOf = (S, r, pos) => { const n = S.clubs[r.c].name, c = GAME.club(n); return { name: n, code: c.code, crest: c.crest, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts, pos }; };
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
    const xi = eng.xi.map((id) => GAME.card(S, id));
    let subs = [];
    if (GAME.preseason()) subs = E.squadOf(S, eng.club).filter((p) => !eng.xi.includes(p.id)).map((p) => GAME.card(S, p.id));
    const all = new Map(); xi.concat(subs).forEach((c) => c && all.set(String(c.id), c));
    return { all, xi, subs };
  };
  GAME.slots = () => E.FORMATIONS[GAME.eng().formation].map(([pos, x, y]) => ({ pos, role: E.SLOT_BROAD[pos], x, y: 89 - y * 0.86 }));
  GAME.formations = () => E.FORMATION_NAMES;
  GAME.formationDots = (f) => E.FORMATIONS[f].map(([pos, x, y]) => ({ x, y: 89 - y * 0.86 }));
  GAME.fit = (cardId, slot) => { const S = GAME.S(), p = E.playerOf(S, cardId); return E.fitOf(p, E.FORMATIONS[GAME.eng().formation][slot][0]); };
  GAME.strength = () => E.userStrength(GAME.S(), GAME.eng());
  GAME.rating = () => Math.round(GAME.strength().ovr);
  GAME.setFormation = (f) => {
    const S = GAME.S(), eng = GAME.eng();
    if (GAME.preseason()) { eng.formation = f; eng.xi = E.autoXI(S, eng.club, f, []); }   // a new best XI from the squad
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
  GAME.startSeason = () => { const ok = E.startSeason(GAME.eng(), GAME.S()); D2T.state.run.step = 'transfer'; D2T.save(); return ok; };

  // ---------- transfer rolls ----------
  GAME.rollCards = () => { const S = GAME.S(), r = GAME.eng().roll; return r ? r.cards.map((id) => GAME.card(S, id)) : []; };
  GAME.respinCards = () => { const ok = E.respinCards(GAME.eng(), GAME.S()); D2T.save(); return ok; };
  GAME.windowInfo = () => {
    const eng = GAME.eng(), w = E.currentWindow(eng);
    const total = eng.rolls.reduce((a, x) => a + x.n, 0);
    let done = 0; for (let i = 0; i < eng.rollIx; i++) done += eng.rolls[i].n;
    done += eng.rollStep;
    const name = !w ? 'Transfer window' : w.kind === 'pre' ? 'Pre-season' : w.kind === 'jan' ? 'January window' : 'Transfer window';
    return { name, step: eng.rollStep + 1, of: w ? w.n : 1, overall: done + 1, total, gw: eng.gw };
  };
  GAME.preview = (cardId) => E.signPreview(GAME.eng(), GAME.S(), cardId);
  GAME.bestSlot = (cardId) => { let b = 0, bd = -1e9; GAME.preview(cardId).forEach((o) => { if (o.delta > bd) { bd = o.delta; b = o.slot; } }); return b; };
  // Sign a rolled player into a shirt: the player there leaves for good.
  GAME.signAt = (cardId, slot) => {
    const run = D2T.state.run, eng = GAME.eng();
    if (!E.sign(eng, GAME.S(), cardId, slot)) return false;
    run.step = eng.phase === 'window' ? 'transfer' : 'squad';
    D2T.save(); return true;
  };
  GAME.pass = () => { const eng = GAME.eng(); E.pass(eng, GAME.S()); D2T.state.run.step = eng.phase === 'window' ? 'transfer' : 'squad'; D2T.save(); };

  // ---------- matches ----------
  // Plays the gameweek in the engine at once (so a refresh can never replay it) and returns what the screen shows.
  GAME.play = () => {
    const eng = GAME.eng(), S = GAME.S(), gw = eng.gw;
    const res = E.playMatch(eng, S);
    if (!res) return null;
    D2T.state.run.match = gw; D2T.state.run.step = 'match';
    D2T.save();
    return GAME.result(gw);
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
  GAME.stepFor = () => {
    const run = D2T.state.run; if (!run || !run.eng) return null;
    const ph = run.eng.phase;
    if (ph === 'clubroll') return 'spin';
    if (ph === 'setup') return run.tableSeen ? 'squad' : 'table';
    if (run.match) return 'match';
    if (ph === 'window') return 'transfer';
    if (ph === 'summary') return 'summary';
    return ['squad', 'fixtures', 'match'].includes(run.step) ? run.step : 'fixtures';
  };
  GAME.allowed = (screen) => {
    const run = D2T.state.run, step = GAME.stepFor();
    if (!step) return false;
    const ph = run.eng.phase;
    if (screen === step) return true;
    if (screen === 'squad') return ph === 'setup' || ph === 'prematch';
    if (screen === 'fixtures' || screen === 'match') return ph === 'prematch' && !run.match;
    return false;
  };

  // ---------- end of season and the record ----------
  GAME.finish = () => {
    const run = D2T.state.run, eng = GAME.eng(), S = GAME.S(), F = eng.final;
    if (!F || run.recorded) return F;
    run.recorded = true;
    const name = GAME.clubName(), n = S.clubs.length, rel = S.relegationPlaces || 3;
    const rec = D2T.state.record;
    rec.runs.push({ key: `${S.season}:${name}`, season: S.season, club: name, finish: F.finish, rise: F.rise, pts: F.pts, histFinish: F.histFinish,
      drop: F.finish <= n - rel, half: F.finish <= n / 2, top3: F.finish <= 3, title: F.finish === 1, at: new Date().toISOString().slice(0, 10) });
    const k = `${S.season}:${name}`, c = rec.clubs[k] || { runs: 0, finish: 99, rise: -99 };
    c.runs++; c.finish = Math.min(c.finish, F.finish); c.rise = Math.max(c.rise, F.rise); rec.clubs[k] = c;
    D2T.save();
    return F;
  };
  // Cumulative counts (Craig, 11 Oct): a title also counts as top 3, top half and beating the drop.
  GAME.record = () => {
    const runs = D2T.state.record.runs;
    return { runs: runs.length, drop: runs.filter((r) => r.drop).length, half: runs.filter((r) => r.half).length,
      top3: runs.filter((r) => r.top3).length, titles: runs.filter((r) => r.title).length,
      bestRise: runs.length ? Math.max(...runs.map((r) => r.rise)) : null };
  };
})();
