// The leaderboard (Craig, 31 Oct; TableKit on the leaderboard canvas, trophy style "card"): one table per game, read
// from Tenaball's server through core/board.js. A back-arrow header, the game's name with dots and arrows (or a swipe)
// to move between the Daily, Classic, Club X, Goal Rush and Unbeaten Run, two tabs (every game opens on All time, the
// second is the game's own: today, this week or the best season), the trophy card (the record and who holds it), the
// column headers with the ranking column in the game's colour, and the rows: gold, silver and bronze for the top three,
// your row in the game's colour and sticky so it pins to the edge when it scrolls out of view, "···" for a gap. Signed
// out, a pinned row says where your phone's numbers would sit and that signing in claims the place. The bottom bar is
// the game's: home, Share my place (greyed with no place to share) and the game's own button in its colour.
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const esc = (s) => D2T.esc(String(s == null ? '' : s));
  const CH = (d) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}"/></svg>`;
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.1 20.2C2.6 12.4 6.6 7.9 12.7 7.4V3.5l8.4 7.9-8.4 7.9v-4.8c-4.1-.1-7.3 2.1-9.6 5.7z"/></svg>';
  const ICON = { crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z M5 19h14', star: 'M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z' };
  const icon = (k, col, w) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${k === 'star' && w > 30 ? 1.6 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
  const hex = (h) => { const s = String(h || '#000000').replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0); };
  const dark = (c) => { const [r, g, b] = hex(c); return 0.299 * r + 0.587 * g + 0.114 * b < 150; };
  const CLASSIC = '#C9D0D9';
  const MEDAL = { 1: '#FFD21F', 2: '#D9DEE5', 3: '#E39A5B' };
  const fmt = (n) => Number(n || 0).toLocaleString('en-GB');

  // the games in the leaderboard's order, each with its colours, its second tab and its words when a table is empty
  function games() {
    const G = D2T.game, d = G.dailyEntry(G.today()), dc = G.club(d.name) || {};
    return [
      { id: 'daily', name: 'Daily Challenge', k: '#FFFFFF', kt: '#FFFFFF', ink: '#0A0A0A', tabs: ['All time', 'Today'], keys: ['all', 'today'], mark: { src: d.crest },
        empty: [['Be the first to win a Daily', 'No one on the table yet', 'Finish a Daily to get on it.'], [`Be the first to win the league with ${d.name} today`, 'No one has played today yet', 'The day starts at midnight. Your best go today puts you top of the table.']], dc },
      { id: 'classic', name: 'Classic', k: CLASSIC, kt: CLASSIC, ink: '#0A0A0A', tabs: ['All time', 'This week'], keys: ['all', 'week'], mark: { src: D2T.ASSET.emblem, tint: true },
        empty: [['Be the first to win a title', 'No one on the table yet', 'Finish a season to get on it.'], ['Be the first to win a title this week', 'No one has played this week yet', 'The week starts on Monday. Finish a season to get on the table.']] },
      { id: 'clubx', name: 'Club X', k: '#12F06C', kt: '#12F06C', ink: '#0A0A0A', tabs: ['All time', 'Best season'], keys: ['all', 'season'], mark: { src: G.club('Club X').crest },
        empty: [['Finish a Club X season to set the record', 'No seasons finished yet', 'Finish a Club X season to get on the table.'], ['Finish a Club X season to set the record', 'No seasons finished yet', 'Finish a Club X season to get on the table.']] },
      { id: 'goal', name: 'Goal Rush', k: '#FFD21F', kt: '#FFE375', ink: '#0A0A0A', tabs: ['All time', 'Today'], keys: ['all', 'today'], mark: { src: window.D2T_GOALRUSH_LOGO },
        empty: [['Be the first to hit the number spot on', 'No one on the table yet', 'Finish a game to get on it.'], ['Be the first spot on today', 'No one has played today yet', 'The day starts at midnight. Your first game puts you on the table.']] },
      { id: 'ub', name: 'Unbeaten Run', k: '#22D3EE', kt: '#22D3EE', ink: '#0A0A0A', tabs: ['All time', 'This week'], keys: ['all', 'week'], mark: { svg: true },
        empty: [['Be the first to set a run', 'No one on the table yet', 'Finish a run to get on it.'], ['Be the first to set a run this week', 'No one has played this week yet', 'The week starts on Monday. Your best run puts you on the table.']] }
    ];
  }

  // ---------- the game's own button: carry on with a run that is going, or start one ----------
  function playWord(g) {
    const G = D2T.game, st = D2T.state, today = G.today();
    const runs = [st.run, st.parked, st.dailyRun].filter((r) => r && G.live(r) && !G.locked(r));
    if (g.id === 'daily') return runs.some((r) => r.daily === today && !r.recorded && r.eng.phase !== 'summary') ? 'Carry on' : G.dailyResult(today) ? 'Go again' : 'Play today';
    if (g.id === 'goal') { const g4 = st.g433, n = g4 && Array.isArray(g4.filled) ? g4.filled.length : 0; return n > 0 && n < 11 ? 'Continue' : 'Play Goal Rush'; }
    if (g.id === 'ub') return st.ub && st.ub.run ? 'Continue' : 'Start a run';
    return runs.some((r) => !r.daily && r.eng.mode === g.id) ? 'Continue' : g.id === 'classic' ? 'Spin for a club' : 'Play Club X';
  }
  function play(g, from) {
    const G = D2T.game, st = D2T.state;
    st.stageAt = g.id; D2T.save();
    if (g.id === 'daily') { G.startDaily(); D2T.toBlack(G.stepFor() || 'table', { from }); return; }
    if (g.id === 'goal') { D2T.toBlack('goals433', { from }); return; }
    if (g.id === 'ub') { D2T.toBlack('unbeaten', { from }); return; }
    const mine = (r) => r && G.live(r) && !r.daily && r.eng.mode === g.id;
    if (mine(st.run)) { D2T.toBlack(G.stepFor() || 'squad', { from }); return; }
    if (mine(G.otherRun())) { G.switchToOther(); D2T.toBlack(G.stepFor() || 'squad', { from }); return; }
    G.stashDaily();
    // another run on screen with the parking space taken: home asks before anything is lost
    if (G.live(st.run) && st.parked && G.live(st.parked)) { D2T.go('home'); return; }
    if (G.live(st.run)) { st.parked = st.run; st.run = null; }
    G.newRun(g.id); D2T.toBlack('spin', { from });
  }

  let cleanups = [];
  D2T.screen('leaderboard', {
    title: 'Leaderboard', theme: 'black', chrome: ['#000000', '#000000'],
    mount(root, params) {
      const G = D2T.game, LB = D2T.lb, GM = games(), st = D2T.state;
      cleanups = [];
      let gi = Math.max(0, GM.findIndex((g) => g.id === (params.game || st.lbAt || st.stageAt))), tab = 0, data = null, req = 0, share = null;
      const narrow = root.clientWidth && root.clientWidth < 400;
      const el = D2T.h(`<div class="lb${narrow ? ' lb-narrow' : ''}">
        <div class="lb-head"><button class="lb-back" type="button" aria-label="Back">${D2T.ICON.back}</button><h1>Leaderboard</h1><span class="lb-count" aria-live="polite"></span></div>
        <div class="lb-game"><button class="lb-arr l" type="button" aria-label="Previous game">${CH(0)}</button><div class="lb-gn"><b></b><div class="lb-dots" aria-hidden="true">${GM.map(() => '<i></i>').join('')}</div></div><button class="lb-arr r" type="button" aria-label="Next game">${CH(1)}</button></div>
        <div class="lb-tabs" role="tablist" aria-label="Which table"><button role="tab" type="button" data-t="0"></button><button role="tab" type="button" data-t="1"></button></div>
        <div class="lb-trophy"></div>
        <div class="lb-cols" aria-hidden="true"><span class="c-pos">Pos</span><span class="c-name">Player</span><span class="c-v"></span><span class="c-v"></span><span class="c-v"></span></div>
        <div class="lb-list" role="list"></div>
        <div class="lb-pin"></div>
        ${SE.bar({ mid: `<button class="icon-btn lb-share bar-mid" type="button" aria-label="Share my place" disabled>${SHARE}</button>`, main: SE.mainBtn('Play', 'lb-main') })}</div>`);
      root.appendChild(el);
      const $ = (s) => el.querySelector(s), list = $('.lb-list'), pin = $('.lb-pin'), troph = $('.lb-trophy');
      const snd = (id) => { const S = window.D2TSound; if (S) S.play(id); };

      // ---------- the game on show ----------
      function showGame() {
        const g = GM[gi];
        st.lbAt = g.id; D2T.save();
        el.style.setProperty('--k', g.k); el.style.setProperty('--kt', g.kt); el.style.setProperty('--ink', g.ink);
        $('.lb-gn b').textContent = g.name;
        el.querySelectorAll('.lb-dots i').forEach((d, i) => d.classList.toggle('on', i === gi));
        el.querySelectorAll('.lb-tabs [role="tab"]').forEach((b, i) => { b.textContent = g.tabs[i]; b.setAttribute('aria-selected', String(i === tab)); });
        $('.lb-main').textContent = playWord(g);
        $('.lb-share').disabled = true; share = null;
        load();
      }
      const turn = (d) => { gi = (gi + d + GM.length) % GM.length; tab = 0; snd('tapSmall'); showGame(); };
      $('.lb-arr.l').onclick = () => turn(-1); $('.lb-arr.r').onclick = () => turn(1);
      el.querySelectorAll('.lb-tabs [role="tab"]').forEach((b) => { b.onclick = () => { const t = +b.dataset.t; if (t === tab) return; tab = t; snd('tapSmall'); showGame(); }; });
      // a swipe across the page turns to the next game (a vertical one scrolls the table)
      let sw = null;
      el.addEventListener('pointerdown', (e) => { if (e.button > 0 || e.target.closest('button')) { sw = null; return; } sw = { x: e.clientX, y: e.clientY }; });
      el.addEventListener('pointerup', (e) => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1); });
      el.addEventListener('pointercancel', () => { sw = null; });
      const onKey = (e) => { if (document.querySelector('.sheet')) return; if (e.key === 'ArrowRight') turn(1); else if (e.key === 'ArrowLeft') turn(-1); };
      document.addEventListener('keydown', onKey); cleanups.push(() => document.removeEventListener('keydown', onKey));

      // ---------- the table ----------
      const cell = (v, k, sort, me) => `<span class="c-v${k === sort ? ' is-sort' : ''}">${esc(v)}</span>`;
      const rowHTML = (r, sort) => r.gap ? '<div class="lb-gap" aria-hidden="true">···</div>'
        : `<div class="lb-row${r.me ? ' me' : ''}" role="listitem" aria-label="${r.pos}. ${esc(r.name)}"><span class="c-pos" style="${!r.me && MEDAL[r.pos] ? `color:${MEDAL[r.pos]}` : ''}">${esc(r.pos)}</span><span class="c-name">${esc(r.me ? 'You' : r.name)}</span>${(r.v || []).map((v, k) => cell(v, k, sort, r.me)).join('')}</div>`;
      const empty = (head, line) => `<div class="lb-empty">${icon('star', '#4a4a52', 40)}<b>${esc(head)}</b><span>${esc(line)}</span></div>`;
      function trophyHTML(g, t) {
        const k = tab === 0 ? 'crown' : 'star', title = t ? t.title : (tab === 0 ? TITLES[g.id][0] : TITLES[g.id][1]);
        return `<div class="lb-tc"><div class="lb-ti">${icon(k, g.ink, 22)}</div><div class="lb-tt"><i>${esc(title)}</i><b>${esc(t ? t.who : 'Nobody yet')}</b><span>${esc(t ? t.what : g.empty[tab][0])}</span></div></div>`;
      }
      const TITLES = { daily: ['Most Daily wins', 'First to win the league today'], classic: ['The hardest title', 'Most titles this week'], clubx: ['The longest dynasty', 'Most points in a season'], goal: ['Most times spot on', 'First spot on today'], ub: ['The record run', 'Best run this week'] };
      function draw() {
        const g = GM[gi], d = data;
        troph.innerHTML = trophyHTML(g, d && d.trophy);
        const cols = (d && d.cols) || DEFAULT_COLS[g.id][tab], sort = d && d.sort != null ? d.sort : 1;
        el.querySelectorAll('.lb-cols .c-v').forEach((c, i) => { c.textContent = cols[i] || ''; c.classList.toggle('is-sort', i === sort); });
        $('.lb-count').textContent = d && d.count ? `${fmt(d.count)} PLAYER${d.count === 1 ? '' : 'S'}` : '';
        pin.innerHTML = '';
        if (!d) { list.innerHTML = '<div class="lb-note">Loading the table…</div>'; return; }
        if (d.error) { list.innerHTML = `<div class="lb-empty">${icon('star', '#4a4a52', 40)}<b>Can't reach the leaderboard</b><span>${esc(d.error)}</span><button class="btn btn-ghost lb-retry" type="button">Try again</button></div>`; $('.lb-retry').onclick = load; return; }
        const rows = (d.rows || []).map((r) => rowHTML(r, sort));
        if (!rows.length) list.innerHTML = empty(g.empty[tab][1], g.empty[tab][2]);
        else {
          // signed in and not on this table: a dash row of your own under it
          if (d.signedIn && !d.me) rows.push('<div class="lb-gap" aria-hidden="true">···</div>', rowHTML({ pos: '–', name: 'You', v: ['–', '–', '–'], me: true }, -1));
          list.innerHTML = rows.join('') + '<div class="lb-end"></div>';
        }
        if (!rows.length && d.signedIn && !d.me) list.insertAdjacentHTML('beforeend', rowHTML({ pos: '–', name: 'You', v: ['–', '–', '–'], me: true }, -1));
        // signed out: where your phone's numbers would sit, and that signing in claims it
        if (!d.signedIn) {
          pin.innerHTML = `<button class="lb-row me lb-you" type="button" aria-label="Sign in to join the table">${d.you ? `<span class="c-name">You · would be ${esc(D2T.ordinal(d.you.pos))}</span><span class="c-claim">Sign in to claim it</span>` : '<span class="c-name">You</span><span class="c-claim">Sign in to join</span>'}</button>`;
          pin.querySelector('.lb-you').onclick = () => D2T.go('account');
        }
        $('.lb-share').disabled = !(d.me && d.me.pos);
        if (d.me && d.me.pos) buildShare(g, d, cols, sort);
      }
      const DEFAULT_COLS = { daily: [['Played', 'Wins', 'Best rise'], ['Goes', 'Best finish', 'Rise']], classic: [['Seasons', 'Titles', 'Top 3'], ['Seasons', 'Titles', 'Top 3']], clubx: [['Seasons', 'Titles', 'In a row'], ['Points', 'Wins', 'Goal diff']], goal: [['Games', 'Spot on', 'Hit rate'], ['Games', 'Spot on', 'Closest']], ub: [['Runs', 'Best run', 'Average'], ['Runs', 'Best run', 'Average']] };
      async function load() {
        const g = GM[gi], t = g.keys[tab], my = ++req;
        data = null; draw();
        const r = await LB.board(g.id, t);
        if (my !== req || !root.isConnected) return;
        data = r.ok ? r.data : { error: r.status === 0 ? 'Check your connection and try again.' : r.status === 404 || r.status === 405 ? 'The leaderboards are not switched on yet.' : (r.data && r.data.error) || 'Something went wrong. Try again.' };
        draw();
      }

      // ---------- Share my place ----------
      function buildShare(g, d, cols, sort) {
        const o = D2T.ordinal, when = tab === 0 ? 'all time' : g.tabs[1].toLowerCase(), label = g.id === 'daily' ? 'Daily Challenge' : g.name;
        const line = cols.map((c, i) => `${d.me.v[i]} ${c.toLowerCase()}`).join(' · ');
        const text = [`*DROP2TOP leaderboard · ${label}*`, '', `I'm ${o(d.me.pos)} of ${fmt(d.count)} ${when}.`, line, '', '_Your turn. Catch me!_', D2T.share.LINK].join('\n');
        const imgs = {};
        if (g.mark.svg) imgs.mark = D2T.share.svgSrc(D2T.ubMark.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" color="${g.k}" `)); else if (g.mark.src) imgs.mark = g.mark.src;
        const c = g.id === 'daily' ? (g.dc.accent || '#FFFFFF') : g.k, ink = g.id === 'daily' ? (g.dc.ink || (dark(c) ? '#FFFFFF' : '#0A0A0A')) : g.ink, txt = g.id === 'daily' ? '#FFFFFF' : g.kt;
        share = D2T.share.build({ text, c, wash: c, band: c, ink, tag: `${label} · ${when}`, dare: 'Can you catch me?', imgs,
          draw: (gx, im, k) => {
            const W = k.W;
            if (im.mark) {
              if (g.mark.tint) { const t = document.createElement('canvas'), S = 300; t.width = S; t.height = S; const tg = t.getContext('2d'), r = Math.min(S / im.mark.naturalWidth, S / im.mark.naturalHeight), w = im.mark.naturalWidth * r, h = im.mark.naturalHeight * r; tg.drawImage(im.mark, (S - w) / 2, (S - h) / 2, w, h); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = c; tg.fillRect(0, 0, S, S); gx.drawImage(t, W / 2 - 75, 250, 150, 150); }
              else k.pic(im.mark, W / 2, 250, 150);
            }
            k.mid('LEAGUE TABLE', W / 2, 462, 900, 900, 48, true, '#FFFFFF', 'center', '3px');
            k.mid(o(d.me.pos).toUpperCase(), W / 2, 660, 960, 900, 230, true, txt);
            k.fit(`OF ${fmt(d.count).toUpperCase()} PLAYER${d.count === 1 ? '' : 'S'} · ${when.toUpperCase()}`, W / 2, 800, 960, 800, 30, false, '#FFFFFF', 'center', '3px');
            cols.forEach((cl, i) => { const x = W / 2 + (i - 1) * 300; k.mid(String(d.me.v[i]), x, 940, 280, 900, 72, true, i === sort ? txt : '#FFFFFF'); k.fit(cl.toUpperCase(), x, 1000, 280, 800, 24, false, '#B5B5BB', 'center', '2px'); });
          } });
      }
      $('.lb-share').onclick = () => { if (!share) return; snd('share'); const fire = () => (share.done ? D2T.share.send(share) : setTimeout(fire, 80)); fire(); };

      // ---------- the bar ----------
      $('.lb-back').onclick = () => { snd('tapSmall'); D2T.back(); };
      $('.bar-home').onclick = () => D2T.go('home');
      $('.lb-main').onclick = (e) => play(GM[gi], e.currentTarget);
      showGame();
    },
    unmount() { cleanups.forEach((f) => { try { f(); } catch (e) { /* gone */ } }); cleanups = []; }
  });
})();
