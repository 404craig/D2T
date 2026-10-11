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
  // Dare2Dream: every club in every season, with the finish they really had.
  const allPool = (G.clubSeasons || []).map((c) => Object.assign({}, GAME.club(c.club), { key: c.key, season: c.season, pos: c.pos, pts: c.pts, w: c.w, d: c.d, l: c.l, gf: c.gf, ga: c.ga }));
  const byKey = new Map(allPool.concat(pool).map((p) => [p.key, p]));
  GAME.allPool = allPool;
  GAME.poolEntry = (key) => byKey.get(key);
  D2T.data = { clubs, relegatedPool: pool };

  // ---------- modes ----------
  // classic: a relegated club, achievements for how high you take them. dare2dream: any club, beat their real finish
  // (or win the league again if they won it).
  GAME.MODES = {
    classic: { name: 'Classic', catalogue: () => G.catalogue, pool: () => pool },
    dare2dream: { name: 'Dare2Dream', catalogue: () => G.clubSeasons, pool: () => allPool }
  };
  GAME.mode = () => { const e = GAME.eng(); return (e && e.mode) || 'classic'; };
  GAME.modeName = (m) => (GAME.MODES[m || GAME.mode()] || GAME.MODES.classic).name;
  // The finish a Dare2Dream run must reach: better than history, or first again for real champions.
  GAME.target = (histPos) => (histPos <= 1 ? 1 : histPos - 1);
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
        out.push({ id: 'L:' + p.n + ':' + sk, n: p.n, b: p.b, p: p.p, r: p.r, lv: 4, a: p.a, g: p.g, as: p.as, cs: p.cs, s6: p.s6, nat: p.nat, c: null, cn: S.clubs[main].name, sk });
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
  GAME.newRun = (mode = 'classic') => {
    const M = GAME.MODES[mode] || GAME.MODES.classic;
    const seed = 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
    D2T.state.run = { step: 'spin', eng: E.newRun({ seed, mode, catalogue: M.catalogue() }), spun: false };
    D2T.save();
    return D2T.state.run;
  };
  GAME.offer = () => GAME.eng().clubOffer.map(GAME.poolEntry);
  GAME.respinClubs = () => { const ok = E.respinClubs(GAME.eng(), (GAME.MODES[GAME.mode()] || GAME.MODES.classic).catalogue()); D2T.save(); return ok; };
  GAME.spinPool = () => (GAME.MODES[GAME.mode()] || GAME.MODES.classic).pool();
  GAME.chooseClub = (key) => {
    const eng = GAME.eng(), entry = GAME.poolEntry(key), S = GAME.season(entry.season);
    const club = S.clubs.findIndex((c) => c.name === entry.name);
    E.chooseClub(eng, S, S.relegated.find((r) => r.c === club) || { c: club, f: '4-4-2', xi: [] });
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
    const xi = eng.xi.map((id) => (id == null ? null : GAME.card(S, id)));
    let subs = [];
    if (GAME.preseason() && GAME.mode() !== 'dare2dream') subs = E.squadOf(S, eng.club).filter((p) => !eng.xi.includes(p.id)).map((p) => GAME.card(S, p.id));
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
    else if (GAME.preseason() && GAME.mode() !== 'dare2dream') { eng.formation = f; eng.xi = E.autoXI(S, eng.club, f, []); }   // a new best XI from the squad
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
  GAME.draftInfo = () => {
    const eng = GAME.eng(), slot = E.draftSlot(eng), pos = E.FORMATIONS[eng.formation][slot][0];
    return { step: eng.draft.step + 1, of: eng.xi.length, slot, pos, broad: E.SLOT_BROAD[pos] };
  };
  GAME.draftPick = (cardId) => {
    const eng = GAME.eng();
    if (!E.draftPick(eng, GAME.S(), cardId)) return false;
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
    // Dare2Dream: pick the shape on the squad screen, then the draft runs on the transfer screen
    if (ph === 'draft') return !run.tableSeen ? 'table' : (run.eng.draft.step === 0 && run.step !== 'transfer' ? 'squad' : 'transfer');
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
    if (screen === 'squad') return ph === 'setup' || ph === 'prematch' || (ph === 'draft' && run.eng.draft.step === 0 && run.tableSeen);
    if (screen === 'transfer') return ph === 'draft' && run.tableSeen;
    if (screen === 'fixtures' || screen === 'match') return ph === 'prematch' && !run.match;
    return false;
  };

  // ---------- end of season and the record ----------
  GAME.finish = () => {
    const run = D2T.state.run, eng = GAME.eng(), S = GAME.S(), F = eng.final;
    if (!F || run.recorded) return F;
    run.recorded = true;
    const name = GAME.clubName(), n = S.clubs.length, rel = S.relegationPlaces || 3, mode = GAME.mode();
    const rec = D2T.state.record, k = `${S.season}:${name}`;
    const entry = { key: k, mode, season: S.season, club: name, finish: F.finish, rise: F.rise, pts: F.pts, histFinish: F.histFinish,
      drop: F.finish <= n - rel, half: F.finish <= n / 2, top3: F.finish <= 3, title: F.finish === 1, at: new Date().toISOString().slice(0, 10) };
    if (mode === 'dare2dream') entry.dream = GAME.dreamMet(F.finish, F.histFinish);
    if (run.daily) {
      entry.daily = run.daily;
      rec.daily = rec.daily || {};
      if (!rec.daily[run.daily]) rec.daily[run.daily] = { n: GAME.dailyNumber(run.daily), club: name, season: S.season, mode, finish: F.finish, histFinish: F.histFinish, rise: F.rise, pts: F.pts, dream: entry.dream };
    }
    rec.runs.push(entry);
    const book = mode === 'dare2dream' ? (rec.dreamClubs = rec.dreamClubs || {}) : rec.clubs;
    const c = book[k] || { runs: 0, finish: 99, rise: -99 };
    c.runs++; c.finish = Math.min(c.finish, F.finish); c.rise = Math.max(c.rise, F.rise);
    if (entry.dream) c.dream = true;
    book[k] = c;
    D2T.save();
    return F;
  };
  // Classic's record. Cumulative counts (Craig, 11 Oct): a title also counts as top 3, top half and beating the drop.
  // Dare2Dream runs are kept apart: rescuing a relegated club is what these counts are about.
  const classicRuns = () => D2T.state.record.runs.filter((r) => (!r.mode || r.mode === 'classic') && !r.daily);
  GAME.record = () => {
    const runs = classicRuns();
    return { runs: runs.length, drop: runs.filter((r) => r.drop).length, half: runs.filter((r) => r.half).length,
      top3: runs.filter((r) => r.top3).length, titles: runs.filter((r) => r.title).length,
      bestRise: runs.length ? Math.max(...runs.map((r) => r.rise)) : null };
  };
  GAME.classicRuns = classicRuns;
  GAME.dreamRecord = () => {
    const runs = D2T.state.record.runs.filter((r) => r.mode === 'dare2dream' && !r.daily);
    return { runs: runs.length, dreams: runs.filter((r) => r.dream).length, bestRise: runs.length ? Math.max(...runs.map((r) => r.rise)) : null };
  };

  // ---------- Daily challenge ----------
  // The same club and seed for everyone each day (UK date): one of the bottom 10 of any season, picked from a hash of
  // the date. A real bottom-3 side plays Classic; anyone above the drop plays Dare2Dream. No respins, so everyone sees
  // the same cards and only their choices differ. One go a day; it has its own save, so another run is never lost.
  const DAILY_START = '2026-10-11';
  GAME.today = () => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  // "Daily Challenge 11 Oct 2026": the name shown everywhere for a day's challenge
  GAME.dailyName = (date, short) => { const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [y, m, d] = date.split('-'); return `Daily Challenge ${+d} ${M[+m - 1]}${short ? '' : ' ' + y}`; };
  GAME.dailyNumber = (date) => Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(DAILY_START + 'T12:00:00Z')) / 864e5) + 1;
  const dailyPool = (G.clubSeasons || []).filter((c) => c.pos > G.seasons[c.season].clubs.length - 10);
  GAME.dailyEntry = (date) => {
    const c = dailyPool[E.hash32('d2t-daily|' + date) % dailyPool.length], S = G.seasons[c.season];
    const mode = c.pos > S.clubs.length - (S.relegationPlaces || 3) ? 'classic' : 'dare2dream';
    return Object.assign({}, GAME.poolEntry(c.key), { mode, n: GAME.dailyNumber(date), date });
  };
  GAME.isDaily = () => !!(D2T.state.run && D2T.state.run.daily);
  GAME.dailyResult = (date) => ((D2T.state.record.daily || {})[date || GAME.today()] || null);
  const live = (r) => !!(r && r.eng && r.eng.seasonKey && r.eng.phase !== 'summary');
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
    const st = D2T.state, date = GAME.today();
    if (GAME.dailyResult(date)) return false;                                   // one go a day
    if (st.run && st.run.daily === date) return true;
    if (st.dailyRun && st.dailyRun.daily === date) { swapIn(st.dailyRun); D2T.save(); return true; }
    const d = GAME.dailyEntry(date);
    const eng = E.newRun({ seed: 'daily-' + date, mode: d.mode, catalogue: [{ key: d.key }], fixedClub: d.key });
    eng.respins = 0;
    swapIn({ step: 'table', eng, spun: true, daily: date });
    GAME.chooseClub(d.key);
    D2T.save();
    return true;
  };
  GAME.dailyStreak = () => {
    const days = D2T.state.record.daily || {};
    let n = 0, d = new Date(GAME.today() + 'T12:00:00Z');
    if (!days[GAME.today()]) d = new Date(d.getTime() - 864e5);                  // today not played yet: count to yesterday
    while (days[d.toISOString().slice(0, 10)]) { n++; d = new Date(d.getTime() - 864e5); }
    return n;
  };
})();
