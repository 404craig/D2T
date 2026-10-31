// Leaderboards (Craig, 31 Oct; HomeKit and TableKit on the leaderboard canvas): one table per game on Tenaball's server
// (server/src/d2t.js there), every signed-in player on it automatically. This is the phone's side: each finished game is
// sent as it ends (queued and retried quietly when offline), the records a phone already held are sent once per account
// through the merge endpoint, and the home page's shields and the leaderboard screen read from here. Nothing here is
// needed for a game to work: with no server, or with the endpoints not yet deployed, every call fails quietly and
// D2T.lb.available() stays false, so home keeps its four record shields.
// Results are keyed by a run id of their own (the engine's seed, or 'old:<phone>:<n>' for a record from before this), so
// sending one twice never counts twice. Goal Rush and Unbeaten Run keep only totals, so those go once as a 'carry'
// record, frozen the first time they are built (state.lb.carry) so later games never count in it as well.
(function () {
  const D2T = window.D2T;
  // the page opened from a file (the tests) never reaches the live server: a test sets D2T_SERVER_URL to the one it mocks
  const SERVER = location.protocol === 'file:' && !('D2T_SERVER_URL' in window) ? '' : String(('D2T_SERVER_URL' in window ? window.D2T_SERVER_URL : 'https://tenaball.crw84.workers.dev') || '').replace(/\/+$/, '');
  const GAMES = ['daily', 'classic', 'clubx', 'goal', 'ub'];
  const hex = (n) => { const a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; }); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); };
  // the phone's own corner of the saved state: its id, the queue of results still to send, which account the old
  // records went to, the cached positions and whether the server answers at all
  const lb = () => { const st = D2T.state; if (!st.lb || !st.lb.phone) st.lb = Object.assign({ phone: hex(12), queue: [], sentFor: null, pos: {}, posAt: 0, ok: null }, st.lb || {}); return st.lb; };
  const acct = () => D2T.state.account || {};
  const token = () => acct().token || null;
  const signedIn = () => !!(acct().user && token());
  const uid = () => (acct().user ? acct().user.id : null);

  async function api(path, body) {
    if (!SERVER) return { ok: false, status: 0, data: {} };
    try {
      const r = await fetch(SERVER + '/api/d2t' + path, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token() ? { Authorization: 'Bearer ' + token() } : {}), body: JSON.stringify(body || {}) });
      const data = await r.json().catch(() => ({}));
      // 404 or 405: the endpoints are not there yet (the server is deployed on its own); nothing on home then
      if (r.status === 404 || r.status === 405) { lb().ok = false; D2T.save(); }
      else if (r.ok) { if (lb().ok !== true) { lb().ok = true; D2T.save(); } }
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: {} }; }
  }

  // ---------- the results a phone holds, as the server takes them ----------
  const noon = (d) => Date.parse(String(d) + 'T12:00:00Z') || Date.now();
  // a finished run from the record (GAME.finish's entry): a Daily go (goes: which go of the day), a Classic season or a
  // Club X season; the run id is the engine's seed, or `old` for a record from before the seed was kept
  function fromRun(r, old, goes) {
    const rid = r.seed || old, at = r.ms || noon(r.at);
    if (r.daily) return { game: 'daily', rec: { rid, date: r.daily, club: r.club, season: r.season, finish: r.finish, histFinish: r.histFinish, pts: r.pts, histPts: r.histPts, goes: goes || 1, at } };
    if (r.mode === 'clubx') return { game: 'clubx', rec: { rid, careerId: r.careerId || rid, career: r.career || 1, season: r.season, club: r.club, finish: r.finish, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, sim: !!r.sim, at } };
    return { game: 'classic', rec: { rid, club: r.club, season: r.season, finish: r.finish, histFinish: r.histFinish, pts: r.pts, histPts: r.histPts, at } };
  }
  function results() {
    const st = D2T.state, L = lb(), rec = st.record || {}, out = [], runs = rec.runs || [], seen = {};
    runs.forEach((r, i) => { if (r.mode === 'dare2dream') return; if (r.daily) seen[r.daily] = (seen[r.daily] || 0) + 1; out.push(fromRun(r, `old:${L.phone}:${i}`, r.daily ? seen[r.daily] : 0)); });
    // a Daily best from before every go was kept in runs (build 95 and before) would have no run of its own: fill from the day's record
    Object.keys(rec.daily || {}).forEach((d) => { if (seen[d]) return; const x = rec.daily[d]; out.push({ game: 'daily', rec: { rid: `old:${L.phone}:daily:${d}`, date: d, club: x.club, season: x.season, finish: x.finish, histFinish: x.histFinish, pts: x.pts, histPts: x.histPts, goes: x.goes || 1, at: noon(d) } }); });
    // Goal Rush and Unbeaten totals from before the tables, frozen the first time they are sent
    if (!L.carry) {
      const g = rec.g433 || {}, u = st.ub || {};
      L.carry = { goal: g.games ? { games: g.games, exact: g.exact || 0, best: g.best == null ? null : g.best } : null, ub: u.runs ? { runs: u.runs, best: Object.assign({}, u.best || {}) } : null };
      D2T.save();
    }
    if (L.carry.goal) out.push({ game: 'goal', rec: Object.assign({ rid: `carry:${L.phone}`, carry: true, at: Date.now() }, L.carry.goal) });
    if (L.carry.ub) out.push({ game: 'ub', rec: Object.assign({ rid: `carry:${L.phone}`, carry: true, at: Date.now() }, L.carry.ub) });
    // the results that came after, kept on the phone so a guest's place and a second sign-in have them too
    (L.sent || []).forEach((x) => out.push(x));
    (L.queue || []).forEach((x) => out.push(x));
    return out;
  }

  // ---------- sending ----------
  let flushing = false;
  const notePos = (pos) => { if (!pos) return; const L = lb(); Object.keys(pos).forEach((g) => { L.pos[g] = pos[g]; }); L.posAt = Date.now(); D2T.save(); };
  // a finished game: queued, saved, sent now if it can be
  function record(game, rec) {
    if (!GAMES.includes(game) || !rec || !rec.rid) return;
    const L = lb();
    if ((L.queue || []).some((x) => x.rec.rid === rec.rid) || (L.sent || []).some((x) => x.rec.rid === rec.rid)) return;
    L.queue = (L.queue || []).concat([{ game, rec }]).slice(-200);
    D2T.save();
    flush();
  }
  async function flush() {
    const L = lb();
    if (flushing || !signedIn() || !(L.queue || []).length || L.ok === false) return;
    flushing = true;
    try {
      while ((L.queue || []).length) {
        const batch = L.queue.slice(0, 80);
        const r = await api('/merge', { results: batch });
        if (!r.ok) break;                                                  // offline, signed out or refused: try again later
        L.queue = L.queue.slice(batch.length);
        L.sent = (L.sent || []).concat(batch).slice(-300);
        notePos(r.data.pos);
      }
    } finally { flushing = false; D2T.save(); }
  }
  // the records a phone already held go up once per account (sentFor remembers which)
  let merging = false;
  async function mergeOnce() {
    const L = lb(), id = uid();
    if (merging || !signedIn() || L.sentFor === id || L.ok === false) return;
    merging = true;
    try {
      const all = results().filter((x) => !(L.queue || []).some((q) => q.rec.rid === x.rec.rid));
      let ok = true;
      for (let i = 0; i < all.length && ok; i += 80) { const r = await api('/merge', { results: all.slice(i, i + 80) }); if (!r.ok) ok = false; else notePos(r.data.pos); }
      if (ok) { L.sentFor = id; D2T.save(); }
    } finally { merging = false; }
  }
  // the player's position on every game's table, kept for a minute (the home page's shields)
  let posReq = null;
  function positions(force) {
    const L = lb();
    if (!force && L.posAt && Date.now() - L.posAt < 60000 && L.ok === true) return Promise.resolve(L.pos);
    if (posReq) return posReq;
    posReq = api('/me').then((r) => {
      if (r.ok) { L.pos = r.data.games || {}; L.posAt = Date.now(); L.signedIn = !!r.data.signedIn; D2T.save(); }
      return L.pos;
    }).finally(() => { posReq = null; });
    return posReq;
  }
  // everything in order: the old records, then the queue, then where that leaves us
  async function sync() { await mergeOnce(); await flush(); await positions(true); }
  // one table: the game and its tab; signed out, the phone's own results go with it so the server can say where they would sit
  const board = (game, tab) => api('/board', Object.assign({ game, tab }, signedIn() ? {} : { mine: results().filter((x) => x.game === game).map((x) => x.rec) }));

  // ---------- what home shows ----------
  // state: 'off' (no server yet: keep the four record shields), 'pos' (n the ordinal), 'join' (signed in, never played
  // this game), 'signin' (signed out)
  function shield(game) {
    const L = lb();
    if (L.ok !== true) return { state: 'off' };
    if (!signedIn()) return { state: 'signin', n: '-', l: 'Sign in to join' };
    const p = L.pos && L.pos[game];
    return p && p.pos ? { state: 'pos', n: D2T.ordinal(p.pos), l: 'League table', count: p.count } : { state: 'join', n: '-', l: 'Play to join' };
  }

  D2T.lb = { GAMES, api, record, flush, mergeOnce, positions, sync, board, shield, results, signedIn, available: () => lb().ok === true, phone: () => lb().phone,
    // GAME.finish hands over each finished run as it is recorded
    onRun: (entry, goes) => { const x = fromRun(entry, null, goes); if (x.rec.rid) record(x.game, x.rec); },
    // sign-in and sign-out from the account page
    onSignIn: () => { lb().posAt = 0; setTimeout(sync, 50); },
    onSignOut: () => { const L = lb(); L.pos = {}; L.posAt = 0; D2T.save(); } };
  // the first sync a little after the game is up, then whenever the game comes back to the front or online
  D2T.whenReady(() => { setTimeout(() => { sync(); }, 2500); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('online', () => { flush(); });
})();
