// The account backup (Craig, 1 Nov, build 218: Aiden's records went with Safari's clear-out, which deletes a site's saved
// data after 7 days of using Safari without opening it). Signed in, everything worth keeping is backed up to the account on
// Tenaball's server (/api/d2t/backup there): every record (Classic, Daily, Club X, Dare2Dream, Goal Rush, Unbeaten), the
// runs and games in progress, the club name, the anti-repeat memory and the tips seen. It goes up a few seconds after a
// change, when the game goes to the background and on every sign-in; it comes back down on every sign-in, on load and on
// every return to the tab, and is merged with what the phone holds, never written over it:
// - finished runs are joined (by seed and time), the bests per club and per day worked out from both;
// - Goal Rush and Unbeaten keep totals, so the side that has played more wins them, the best per stat the higher;
// - a run, Daily go, parked run or game in progress comes down only the first time an account syncs on a phone, and only
//   into an empty slot (after that each phone keeps its own);
// - a phone with nothing gets back what the account's leaderboard results can rebuild (finishes, points, titles; from 31
//   Oct, when the tables began).
// Each account's records on a shared phone stay its own: when someone else signs in, the last account's are put aside on
// the phone (d2t-keep-<id>) and come back when they sign in again. The server keeps a version, so two phones never write
// over each other: a phone that is behind is sent the newer copy, merges it and tries again.
(function () {
  const D2T = window.D2T;
  // the keys that are the phone's own, never backed up: the account, the leaderboard queue, settings and screen positions
  const OWN = ['account', 'lb', 'notYou', 'backup', 'stageAt', 'lbAt', 'dailyNudge', 'migrated', 'settings'];
  const SLOTS = ['run', 'dailyRun', 'parked', 'g433'];   // games in progress
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; };
  // never over the server's limit: the games in progress are left out before the records ever are
  const pick = (st) => { const o = {}; Object.keys(st).forEach((k) => { if (!OWN.includes(k) && st[k] !== undefined) o[k] = st[k]; });
    for (const k of ['parked', 'dailyRun', 'run', 'g433']) { if (JSON.stringify(o).length < 1400000) break; delete o[k]; }
    return clone(o); };
  const empty = (v) => v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

  // ---------- merging two copies ----------
  const runId = (r) => (r.seed ? `s:${r.seed}:${r.ms || r.at || ''}` : `k:${[r.key, r.mode, r.daily || '', r.at, r.finish, r.pts, r.career || ''].join('|')}`);
  const runTime = (r) => r.ms || Date.parse(String(r.at || '') + 'T12:00:00Z') || 0;
  const better = (a, b) => (!a ? b : !b ? a : (b.rise > a.rise || (b.rise === a.rise && b.finish < a.finish)) ? b : a);
  function mergeRecord(a, b) {
    a = a || {}; b = b || {};
    const out = Object.assign({}, b, a);
    const seen = new Map();
    (a.runs || []).concat(b.runs || []).forEach((r) => { if (r && !seen.has(runId(r))) seen.set(runId(r), r); });
    out.runs = [...seen.values()].sort((x, y) => runTime(x) - runTime(y));
    // the Daily: the day's best go, and every go counted
    const days = {}, goes = {};
    out.runs.forEach((r) => { if (r.daily) goes[r.daily] = (goes[r.daily] || 0) + 1; });
    new Set(Object.keys(a.daily || {}).concat(Object.keys(b.daily || {}))).forEach((d) => {
      const x = (a.daily || {})[d], y = (b.daily || {})[d], best = Object.assign({}, better(x, y));
      if (!best.topScorer && !best.best) { const o = best === x ? y : x; if (o && o.finish === best.finish && o.rise === best.rise) ['topScorer', 'best'].forEach((k) => { if (o[k]) best[k] = o[k]; }); }
      best.goes = Math.max((x && x.goes) || (x ? 1 : 0), (y && y.goes) || (y ? 1 : 0), goes[d] || 0);
      days[d] = best;
    });
    out.daily = days;
    // the best per club-season, from the joined runs and from both books (a book can hold runs older than the list)
    [['clubs', (r) => r.mode !== 'dare2dream' && r.mode !== 'clubx'], ['xClubs', (r) => r.mode === 'clubx'], ['dreamClubs', (r) => r.mode === 'dare2dream']].forEach(([k, is]) => {
      const book = {};
      out.runs.filter(is).forEach((r) => { const c = book[r.key] || (book[r.key] = { runs: 0, finish: 99, rise: -99 }); c.runs++; c.finish = Math.min(c.finish, r.finish); c.rise = Math.max(c.rise, r.rise); if (r.dream) c.dream = true; });
      [a[k], b[k]].forEach((bk) => Object.keys(bk || {}).forEach((key) => {
        const x = bk[key], c = book[key] || (book[key] = { runs: 0, finish: 99, rise: -99 });
        c.runs = Math.max(c.runs, x.runs || 0); c.finish = Math.min(c.finish, x.finish == null ? 99 : x.finish); c.rise = Math.max(c.rise, x.rise == null ? -99 : x.rise); if (x.dream) c.dream = true;
      }));
      if (Object.keys(book).length || a[k] || b[k]) out[k] = book;
    });
    // Goal Rush keeps totals: the side that has played more
    if (a.g433 || b.g433) out.g433 = clone(((b.g433 && b.g433.games) || 0) > ((a.g433 && a.g433.games) || 0) ? b.g433 : a.g433);
    return out;
  }
  function mergeUb(a, b) {
    if (!a || !b) { const o = clone(a || b); if (o) o.run = (a && a.run) || null; return o; }
    const more = (b.runs || 0) > (a.runs || 0) ? b : a, out = Object.assign({}, b, a, { runs: more.runs || 0, lastRun: more.lastRun, last: more.last });
    out.best = {}; [a.best, b.best].forEach((x) => Object.keys(x || {}).forEach((k) => { out.best[k] = Math.max(out.best[k] == null ? -1 : out.best[k], x[k]); }));
    out.run = a.run || null;
    return clone(out);
  }
  // a: the phone's, b: the backup's; first: the first time this account syncs on this phone (games in progress come down)
  function merge(a, b, first) {
    a = clone(a || {}); b = b || {};
    const out = Object.assign({}, a);
    out.record = mergeRecord(a.record, b.record);
    out.ub = mergeUb(a.ub, b.ub);
    if (out.ub === undefined) delete out.ub;
    if (first && b.ub && b.ub.run && out.ub && !out.ub.run) out.ub.run = clone(b.ub.run);
    out.tips = Object.assign({}, b.tips || {}, a.tips || {});
    if (empty(out.tips)) delete out.tips;
    Object.keys(b).forEach((k) => {
      if (k === 'record' || k === 'ub' || k === 'tips' || OWN.includes(k)) return;
      if (SLOTS.includes(k)) { if (first && empty(out[k]) && !empty(b[k])) out[k] = clone(b[k]); return; }
      if (empty(out[k]) && !empty(b[k])) out[k] = clone(b[k]);
    });
    return out;
  }

  // ---------- rebuilding from the leaderboard results (a phone with nothing) ----------
  function entryFrom(game, x) {
    const raw = (window.D2T_GAME || {}).seasons || {}, S = raw[x.season], n = S && S.clubs ? S.clubs.length : 20, rel = (S && S.relegationPlaces) || 3;
    const mode = game === 'clubx' ? 'clubx' : 'classic', at = new Date(x.at || Date.now()).toISOString().slice(0, 10);
    const e = { key: `${x.season}:${x.club}`, mode, season: x.season, club: x.club, finish: x.finish, rise: game === 'clubx' ? 0 : (x.histFinish - x.finish), pts: x.pts,
      histFinish: x.histFinish, histPts: x.histPts, drop: x.finish <= n - rel, half: x.finish <= n / 2, top3: x.finish <= 3, title: x.finish === 1, at, seed: x.rid, ms: x.at, rebuilt: true };
    if (game === 'daily') e.daily = x.date;
    if (game === 'clubx') { e.dream = x.finish === 1; e.career = x.career || 1; e.careerId = x.careerId; ['w', 'd', 'l', 'gf', 'ga'].forEach((k) => { if (x[k] != null) e[k] = x[k]; }); if (x.sim) e.sim = true; }
    return e;
  }
  function fromResults(st, results) {
    const rec = st.record || (st.record = { runs: [], clubs: {} }), have = new Set((rec.runs || []).map((r) => r.seed).filter(Boolean));
    const same = (r, e) => r.season === e.season && r.finish === e.finish && r.pts === e.pts && (r.daily || '') === (e.daily || '') && (r.mode === 'clubx') === (e.mode === 'clubx');
    const add = [], goal = [], ub = [];
    let carryG = null, carryU = null;
    (results || []).forEach(({ game, rec: x }) => {
      if (!x || !x.rid) return;
      if (game === 'goal') { if (x.carry) carryG = x; else goal.push(x); return; }
      if (game === 'ub') { if (x.carry) carryU = x; else ub.push(x); return; }
      if (have.has(x.rid)) return;
      const e = entryFrom(game, x);
      if (/^old:/.test(x.rid) && (rec.runs || []).some((r) => same(r, e))) return;
      add.push(e);
    });
    if (add.length) {
      const extra = { runs: add, daily: {} };
      add.forEach((e) => { if (!e.daily) return; const g = (results.find((y) => y.rec.rid === e.seed) || {}).rec || {};
        const d = { n: D2T.game && D2T.game.dailyNumber ? D2T.game.dailyNumber(e.daily) : undefined, club: e.club, season: e.season, mode: 'classic', finish: e.finish, histFinish: e.histFinish, rise: e.rise, pts: e.pts, histPts: e.histPts, goes: g.goes || 1 };
        extra.daily[e.daily] = better(extra.daily[e.daily], d); extra.daily[e.daily].goes = Math.max(extra.daily[e.daily].goes || 1, d.goes); });
      st.record = mergeRecord(rec, extra);
    }
    // Goal Rush and Unbeaten from their totals and games, when they come to more than the phone has
    const g0 = st.record.g433 || {}, gGames = ((carryG && carryG.games) || 0) + goal.length;
    if (gGames > (g0.games || 0)) {
      const gaps = goal.map((x) => x.gap), best = [carryG && carryG.best, ...gaps].filter((v) => v != null), bi = goal.reduce((m, x, i) => (m < 0 || x.gap < goal[m].gap ? i : m), -1), last = goal[goal.length - 1];
      st.record.g433 = { games: gGames, exact: ((carryG && carryG.exact) || 0) + gaps.filter((v) => v === 0).length, best: best.length ? Math.min(...best) : null,
        bestTotal: bi >= 0 ? goal[bi].total : null, bestTarget: bi >= 0 ? goal[bi].target : null, last: last ? last.total : null, lastTarget: last ? last.target : null,
        gapSum: gaps.reduce((s, v) => s + v, 0), gapGames: gaps.length };
    }
    const u0 = st.ub || {}, uRuns = ((carryU && carryU.runs) || 0) + ub.length;
    if (uRuns > (u0.runs || 0)) {
      const bestU = Object.assign({}, (carryU && carryU.best) || {});
      ub.forEach((x) => { bestU[x.stat] = Math.max(bestU[x.stat] == null ? -1 : bestU[x.stat], x.run); });
      st.ub = Object.assign({}, u0, { runs: uRuns, best: mergeUb({ best: u0.best || {} }, { best: bestU }).best, lastRun: ub.length ? ub[ub.length - 1].run : u0.lastRun });
    }
    return st;
  }

  // ---------- talking to the server ----------
  const acct = () => D2T.state.account || {};
  const uid = () => (acct().user && acct().token ? acct().user.id : null);
  const B = () => D2T.state.backup || (D2T.state.backup = {});
  // its own calls, not the leaderboards' (a server without this route must never switch the tables off)
  async function call(body, keepalive) {
    const server = D2T.lb && D2T.lb.server, token = acct().token;
    if (!server || !token) return { ok: false, status: 0, data: {} };
    try {
      const r = await fetch(server + '/api/d2t/backup', { method: 'POST', keepalive: !!keepalive, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
      return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) { return { ok: false, status: 0, data: {} }; }
  }
  // put the phone's part of the state in place of what is there (the keys not backed up stay)
  // (a game in progress the copy left out for size stays, unless all is being swapped for another account's)
  function apply(part, all) {
    const st = D2T.state;
    Object.keys(st).forEach((k) => { if (!OWN.includes(k) && (all || !SLOTS.includes(k) || k in part)) delete st[k]; });
    Object.assign(st, clone(part));
    if (!st.record) st.record = { runs: [], clubs: {} };
  }
  // another account signs in on this phone: put the last one's records aside, bring this one's back if they were here
  function swapOwner(id) {
    const b = B();
    if (b.owner && b.owner !== id) {
      try { localStorage.setItem('d2t-keep-' + b.owner, JSON.stringify(pick(D2T.state))); } catch (e) { /* no room: the server has them */ }
      let kept = null; try { kept = JSON.parse(localStorage.getItem('d2t-keep-' + id) || 'null'); } catch (e) { kept = null; }
      apply(kept || {}, true);
      try { localStorage.removeItem('d2t-keep-' + id); } catch (e) { /* fine */ }
      D2T.state.backup = { owner: id };
      D2T.save(true);
    }
    B().owner = id;
  }
  let busy = null, again = false;
  // the whole round: down, merge, up
  function sync() {
    if (busy) { again = true; return busy; }
    busy = (async () => {
      const id = uid(); if (!id) return false;
      swapOwner(id);
      const first = B().for !== id;
      let r = await call({ results: first });
      if (!r.ok || uid() !== id) return false;
      for (let tries = 0; tries < 3; tries++) {
        const before = JSON.stringify(pick(D2T.state));
        if (D2T.lb && D2T.lb.results) D2T.lb.results();                  // the leaderboards' carried totals are frozen first, so restored games are never sent twice
        let mine = merge(pick(D2T.state), r.data.data, first && tries === 0);
        if (first && tries === 0 && r.data.results) mine = fromResults(mine, r.data.results);
        const now = JSON.stringify(mine), changed = now !== before;
        if (changed) { apply(mine); }
        Object.assign(B(), { for: id, v: r.data.v, got: hash(JSON.stringify(r.data.data || {})), at: Date.now() });
        D2T.save(true);
        if (changed) refresh();
        const h = hash(now);
        if (r.data.data && hash(JSON.stringify(r.data.data)) === h) { B().sent = h; D2T.save(true); return true; }
        const p = await call({ op: 'put', base: r.data.v, data: mine });
        if (uid() !== id) return false;
        if (p.ok) { Object.assign(B(), { v: p.data.v, sent: h, at: Date.now() }); D2T.save(true); return true; }
        if (p.status !== 409) return false;
        r = { ok: true, data: p.data };                                    // another phone got there first: merge its copy and go again
      }
      return false;
    })().finally(() => { busy = null; if (again) { again = false; setTimeout(sync, 50); } });
    return busy;
  }
  // after a change: up if anything changed since the last time (the round above takes care of a phone that is behind)
  async function push(keepalive) {
    const id = uid(); if (!id || busy || B().for !== id || B().owner !== id) return;
    const part = pick(D2T.state), s = JSON.stringify(part), h = hash(s);
    if (h === B().sent) return;
    if (keepalive && s.length > 60000) return;                              // too big to send on the way out: it goes next time
    const p = await call({ op: 'put', base: B().v || 0, data: part }, keepalive);
    if (p.ok) { Object.assign(B(), { v: p.data.v, sent: h, at: Date.now() }); D2T.save(true); }
    else if (p.status === 409) sync();
  }
  // what's on screen shows what came back: home and the account page are drawn again (never a game screen)
  function refresh() {
    const name = (location.hash || '').slice(1).split(/[?&]/)[0];
    if ((name === 'home' || name === 'account') && D2T.go) D2T.go(name);
  }
  let timer = null;
  const later = () => { if (!timer) timer = setTimeout(() => { timer = null; push(); }, 4000); };   // at most one a few seconds after a change (home saves often)
  const save = D2T.save;
  D2T.save = (quiet) => { save(); if (!quiet && uid()) later(); };

  D2T.backup = { sync, push, merge, mergeRecord, fromResults, pick, last: () => B().at || 0,
    onSignIn: () => setTimeout(sync, 80),
    onSignOut: () => { clearTimeout(timer); timer = null; } };
  D2T.whenReady(() => { setTimeout(sync, 1500); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); timer = null; push(true); } else sync(); });
})();
