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
  const ACCT = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/></svg>';
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


  // the entrance (Craig, 31 Oct, build 197: the outline flying from home's shield is gone): the heading types in and the
  // table's rows drop into place one by one
  const still = () => (D2T.reduced ? D2T.reduced() : matchMedia('(prefers-reduced-motion: reduce)').matches);

  let cleanups = [];
  D2T.screen('leaderboard', {
    title: 'Leaderboard', theme: 'black', chrome: ['#000000', '#000000'],
    mount(root, params) {
      const G = D2T.game, LB = D2T.lb, GM = games(), st = D2T.state;
      cleanups = [];
      let gi = Math.max(0, GM.findIndex((g) => g.id === (params.game || st.lbAt || st.stageAt))), tab = 0, data = null, req = 0, share = null;
      const narrow = root.clientWidth && root.clientWidth < 400;
      const el = D2T.h(`<div class="lb${narrow ? ' lb-narrow' : ''}">
        <div class="lb-head"><h1>Leaderboards</h1><span class="lb-count" aria-live="polite"></span></div>
        <div class="lb-game"><button class="lb-arr l" type="button" aria-label="Previous game">${CH(0)}</button><div class="lb-gn"><b></b><div class="lb-dots" aria-hidden="true">${GM.map(() => '<i></i>').join('')}</div></div><button class="lb-arr r" type="button" aria-label="Next game">${CH(1)}</button></div>
        <div class="lb-tabs" role="tablist" aria-label="Which table"><button role="tab" type="button" data-t="0"></button><button role="tab" type="button" data-t="1"></button></div>
        <div class="lb-trophy"></div>
        <div class="lb-cols" aria-hidden="true"><span class="c-pos">Pos</span><span class="c-name">Player</span><span class="c-v"></span><span class="c-v"></span><span class="c-v"></span></div>
        <div class="lb-list" role="list"></div>
        <div class="lb-pin"></div>
        <div class="actionbar game-bar lb-bar">${SE.mainBtn('Back to home', 'lb-main')}</div></div>`);
      // the game's own top bar (Craig, 31 Oct, build 190): the D2T logo home, then Share my place and the account
      // home's own top bar (Craig, 31 Oct, build 193): the long logo at home's size, Share my place, the game's ? and the account
      const top = D2T.h(`<div class="lb-top"><button class="fr-home-logo stg-logo lb-logo" type="button" aria-label="DROP2TOP home">${D2T.homeLogo()}</button><button class="stg-rb lb-share" type="button" aria-label="Share my place">${SHARE}</button><button class="stg-rb lb-q" type="button" aria-label="How to play this game">?</button><button class="stg-rb lb-acct" type="button" aria-label="Account">${ACCT}</button></div>`);
      top.querySelector('.lb-logo').onclick = () => backHome();
      top.querySelector('.lb-q').onclick = () => { if (D2T.gameHelp) D2T.gameHelp(GM[gi]); };
      top.querySelector('.lb-acct').onclick = () => D2T.go('account');
      el.prepend(top);
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
        share = null;
        load();
      }
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let slideDir = 0;
      const body4 = () => [troph, $('.lb-cols'), list, pin];
      function slideIn(nodes, d) {
        nodes.forEach((n) => { n.style.transition = ''; n.style.transform = ''; n.style.opacity = ''; if (!reduce && d && n.animate) n.animate([{ transform: `translateX(${d * 46}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
      }
      const turn = (d) => {
        gi = (gi + d + GM.length) % GM.length; tab = 0; snd('tapSmall');
        slideIn([$('.lb-gn')], d);          // the game's name and dots at once
        slideDir = d; showGame();           // the table when it is in (draw slides it)
      };
      $('.lb-arr.l').onclick = () => turn(-1); $('.lb-arr.r').onclick = () => turn(1);
      el.querySelectorAll('.lb-tabs [role="tab"]').forEach((b) => { b.onclick = () => { const t = +b.dataset.t; if (t === tab) return; tab = t; snd('tapSmall'); showGame(); }; });
      // a swipe across the page turns to the next game (Craig, 31 Oct, build 193: the pointer swipe was patchy on iPhone,
      // where a scroll that starts takes the pointer away). Touch: the direction is decided after 8px; a sideways one is
      // ours (the page follows the finger) and turns on 40px or a quick flick, an upright one is left to the table's scroll.
      // The mouse keeps the plain drag.
      const moving = () => [$('.lb-gn'), troph, $('.lb-cols'), list, pin];
      const follow = (dx) => moving().forEach((n) => { n.style.transition = 'none'; n.style.transform = dx ? `translateX(${dx}px)` : ''; n.style.opacity = dx ? String(Math.max(.4, 1 - Math.abs(dx) / 400)) : ''; });
      const settle = () => moving().forEach((n) => { n.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s'; n.style.transform = ''; n.style.opacity = ''; });
      let tc = null;
      el.addEventListener('touchstart', (e) => { if (e.touches.length !== 1 || e.target.closest('button, .sheet')) { tc = null; return; } const t = e.touches[0]; tc = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0 }; }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        if (!tc) return; const t = e.touches[0], dx = t.clientX - tc.x, dy = t.clientY - tc.y;
        if (!tc.axis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; tc.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
        if (tc.axis !== 'x') return;
        e.preventDefault(); tc.dx = dx; follow(dx * 0.5);
      }, { passive: false });
      const endTouch = () => {
        if (!tc) return; const c = tc; tc = null; if (c.axis !== 'x') return;
        const v = Math.abs(c.dx) / Math.max(1, Date.now() - c.t);
        if (Math.abs(c.dx) > 40 || (Math.abs(c.dx) > 16 && v > 0.35)) turn(c.dx < 0 ? 1 : -1); else settle();
      };
      el.addEventListener('touchend', endTouch); el.addEventListener('touchcancel', endTouch);
      let sw = null;
      el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button > 0 || e.target.closest('button')) { sw = null; return; } sw = { x: e.clientX, y: e.clientY }; });
      el.addEventListener('pointerup', (e) => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) turn(dx < 0 ? 1 : -1); });
      el.addEventListener('pointercancel', () => { sw = null; });
      const onKey = (e) => { if (document.querySelector('.sheet')) return; if (e.key === 'ArrowRight') turn(1); else if (e.key === 'ArrowLeft') turn(-1); };
      document.addEventListener('keydown', onKey); cleanups.push(() => document.removeEventListener('keydown', onKey));

      // ---------- the table ----------
      const cell = (v, k, sort, me) => `<span class="c-v${k === sort ? ' is-sort' : ''}">${esc(v)}</span>`;
      const rowHTML = (r, sort) => r.gap ? '<div class="lb-gap" aria-hidden="true">···</div>'
        : `<div class="lb-row${r.me ? ' me' : ''}" role="listitem" aria-label="${r.pos}. ${esc(r.name)}"><span class="c-pos" style="${!r.me && MEDAL[r.pos] ? `color:${MEDAL[r.pos]}` : ''}">${esc(r.pos)}</span><span class="c-name">${esc(r.me ? 'You' : r.name)}</span>${lastSort(r.v || [], sort).map((v, k, a) => cell(v, sort >= 0 && k === a.length - 1 ? sort : -2, sort, r.me)).join('')}</div>`;
      // the ranking column always sits on the right (Craig, 31 Oct, build 191): the others keep their order before it
      function lastSort(a, sort) { return sort >= 0 && sort < a.length ? a.filter((_, i) => i !== sort).concat([a[sort]]) : a; }
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
        const hc = lastSort(cols, sort); el.querySelectorAll('.lb-cols .c-v').forEach((c, i) => { c.textContent = HEAD[hc[i]] || hc[i] || ''; c.classList.toggle('is-sort', i === hc.length - 1 && sort >= 0); });
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
        if (d.me && d.me.pos) buildShare(g, d, cols, sort);
      }
      // the rows drop into place one by one, quickly, once the outline has landed (the first table on the way in only)
      let dropPending = !still(), landAt = 0;
      function dropRows() {
        if (!dropPending || !data) return;
        dropPending = false;
        const wait = Math.max(0, landAt - performance.now()) + 40;
        list.style.opacity = ''; pin.style.opacity = '';
        [...list.children, ...pin.children].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(-18px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: wait + i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      }
      // short column headers so none wraps (Craig, 31 Oct, build 203: BEST FINISH went over two lines); the share card keeps the full words
      const HEAD = { 'Best finish': 'Best' };
      const DEFAULT_COLS = { daily: [['Played', 'Wins', 'Best rise'], ['Goes', 'Best finish', 'Rise']], classic: [['Seasons', 'Titles', 'Top 3'], ['Seasons', 'Titles', 'Top 3']], clubx: [['Seasons', 'Titles', 'In a row'], ['Points', 'Wins', 'Goal diff']], goal: [['Games', 'Spot on', 'Hit rate'], ['Games', 'Spot on', 'Closest']], ub: [['Runs', 'Best run', 'Average'], ['Runs', 'Best run', 'Average']] };
      // every table loaded is kept for the visit, and the other games' all-time tables are fetched quietly after the first,
      // so a change of game is usually instant (build 201)
      const memo = {};
      const errText = (r) => (r.status === 0 ? 'Check your connection and try again.' : r.status === 404 || r.status === 405 ? 'The leaderboards are not switched on yet.' : (r.data && r.data.error) || 'Something went wrong. Try again.');
      let prefetched = false;
      function prefetch() {
        if (prefetched) return; prefetched = true;
        GM.forEach((g) => { const k = g.id + ':' + g.keys[0]; if (!memo[k]) LB.board(g.id, g.keys[0]).then((r) => { if (r.ok && !memo[k]) memo[k] = r.data; }).catch(() => {}); });
      }
      function shown(d) {                   // the table on screen, sliding in after a change of game
        data = d; draw();
        // back to full brightness whatever brought the table in (build 202: a change of tab left it dimmed at .35)
        if (slideDir) { slideIn(body4(), slideDir); slideDir = 0; } else body4().forEach((n) => { n.style.transition = 'opacity .15s'; n.style.opacity = ''; });
        dropRows();
      }
      async function load() {
        const g = GM[gi], t = g.keys[tab], my = ++req, key = g.id + ':' + t;
        if (memo[key]) shown(memo[key]);
        else if (!data) draw();             // the first table of the visit: "Loading the table..."
        else body4().forEach((n) => { n.style.transition = 'opacity .12s'; n.style.opacity = '.35'; });   // the old table dimmed until the new one is in
        const r = await LB.board(g.id, t);
        if (my !== req || !root.isConnected) return;
        if (r.ok) {
          const same = memo[key] && JSON.stringify(memo[key]) === JSON.stringify(r.data);
          memo[key] = r.data;
          if (!same) shown(r.data);
        } else if (!memo[key]) shown({ error: errText(r) });
        prefetch();
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
      // the share button always looks the same (Craig, 31 Oct, build 201: it greyed out and came back on every change of game);
      // with no place to share yet, a tap says how to get one
      $('.lb-share').onclick = () => {
        if (!share) {
          const signed = LB && LB.signedIn && LB.signedIn(), loading = !data;
          if (loading) return;
          D2T.sheet({ title: 'No place to share yet', body: `<p class="fr-lead">${signed ? `Finish a game of ${esc(GM[gi].name)} to get on this table, then share your place.` : 'Sign in and finish a game to get on the table, then share your place.'}</p>` });
          return;
        } snd('share'); const fire = () => (share.done ? D2T.share.send(share) : setTimeout(fire, 80)); fire(); };

      // ---------- the bar ----------
      $('.lb-main').onclick = () => backHome();
      if (!still()) { list.style.opacity = '0'; pin.style.opacity = '0'; }
      showGame();
      // the heading types in, left to right
      const h1 = $('.lb-head h1'), word = 'Leaderboards';
      if (!still()) {
        h1.setAttribute('aria-label', word); h1.textContent = '';
        let n = 0, tm = 0; const tick = () => { if (!h1.isConnected) return; h1.textContent = word.slice(0, ++n); if (n < word.length) tm = setTimeout(tick, 34); };
        tm = setTimeout(tick, 60); cleanups.push(() => clearTimeout(tm));
      }
      landAt = performance.now();
      dropRows();
      function backHome() { st.stageAt = GM[gi].id; D2T.save(); D2T.go('home'); }
    },
    unmount() { cleanups.forEach((f) => { try { f(); } catch (e) { /* gone */ } }); cleanups = []; }
  });
})();
