// D2T prototype shell: router, saved state, chrome, logos, sheets, green backdrop.
// Screens register with D2T.screen(name, def). Routes are bare hash tokens (#home, #spin) so they work as artifact deep links.
(function () {
  const D2T = window.D2T = window.D2T || {};
  D2T.data = window.D2T_DATA;
  D2T.screens = {};
  D2T.screen = (name, def) => { D2T.screens[name] = def; };

  // ---------- saved state (phone only; safe if storage is blocked) ----------
  const KEY = 'd2t-v2';
  const DEFAULT_STATE = {
    run: null,                         // { step, eng (the engine's run), tableSeen, pending, match } (core/game.js)
    record: { runs: [], clubs: {} },   // finished runs, best per club
    account: { signedIn: false, name: '', email: '' },
    settings: { muted: false }
  };
  function load() {
    let s;
    try { s = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { s = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
    if (s.run && (!s.run.eng || s.run.eng.v !== 1)) s.run = null;
    // Build 1 saved finished runs under another key: bring them across once.
    try {
      if (!s.migrated) {
        const old = JSON.parse(localStorage.getItem('d2t-record-v1') || 'null');
        if (old && old.runs) old.runs.forEach((r) => s.record.runs.push({ key: r.key, season: r.season, club: r.club, finish: r.finish, rise: r.rise, pts: r.pts,
          drop: r.finish <= 17, half: r.finish <= 10, top3: r.finish <= 3, title: r.finish === 1, at: r.at }));
        s.migrated = true;
      }
    } catch (e) { /* nothing to bring across */ }
    return s;
  }
  D2T.state = load();
  D2T.save = () => { try { localStorage.setItem(KEY, JSON.stringify(D2T.state)); } catch (e) { /* storage blocked: the game keeps working in memory */ } };
  D2T.resetState = () => { D2T.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); D2T.state.migrated = true; D2T.save(); };
  D2T.run = () => (D2T.game && D2T.state.run && D2T.state.run.eng && D2T.state.run.eng.seasonKey ? D2T.game.runData() : null);

  // ---------- helpers ----------
  D2T.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  D2T.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  D2T.reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOGOS = window.D2T_LOGOS || {};
  D2T.ASSET = {
    emblem: LOGOS.emblem || 'assets/logo/emblem.png', emblemLine: LOGOS.emblem_line || 'assets/logo/emblem_line.png',
    short: LOGOS.short || 'assets/logo/short.png', long: LOGOS.long || 'assets/logo/long.png',
    shortText: LOGOS.short_text || 'assets/logo/short_text.png', longText: LOGOS.long_text || 'assets/logo/long_text.png'
  };
  // Logo as a mask so it can be any colour or carry an animated fill. kind: emblem | short | long | shortText | longText | emblemLine
  D2T.logo = (kind, opts = {}) => `<span class="logo-mask ${opts.cls || ''}" role="img" aria-label="${opts.label || (kind === 'long' ? 'DROP2TOP' : 'D2T')}" style="--src:url('${new URL(D2T.ASSET[kind], document.baseURI).href}');aspect-ratio:${LOGO_RATIO[kind]};${opts.style || ''}"></span>`;
  const LOGO_RATIO = { emblem: '234/237', emblemLine: '520/513', short: '857/241', long: '1301/237', shortText: '617/160', longText: '1068/143' };
  D2T.LOGO_RATIO = LOGO_RATIO;

  // Green FC-style backdrop: soft vertical gradient (from the theme class) plus light beams and a dark streak.
  D2T.greenBackdrop = () => `<div class="green-backdrop" aria-hidden="true"><svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gbBand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".25"/><stop offset="1" stop-color="#2CF57F" stop-opacity=".9"/></linearGradient>
      <linearGradient id="gbThin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".2"/><stop offset=".8" stop-color="#0A0A0A" stop-opacity=".6"/><stop offset="1" stop-color="#0A0A0A" stop-opacity=".9"/></linearGradient>
      <linearGradient id="gbArw" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".5"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".12"/></linearGradient>
      <linearGradient id="gbFoot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18F06F"/><stop offset=".55" stop-color="#18F06F"/><stop offset="1" stop-color="#0A0A0A"/></linearGradient>
    </defs>
    <polyline points="-40,30 210,690" fill="none" stroke="url(#gbBand)" stroke-width="46" stroke-linecap="butt"/>
    <polyline points="-20,-10 430,330" fill="none" stroke="url(#gbThin)" stroke-width="3"/>
    ${gbArrows()}
    <polyline points="196,694 430,620" fill="none" stroke="url(#gbFoot)" stroke-width="20"/>
  </svg></div>`;
  // The emblem's corner arrows, faded into the green (Craig, 12 Oct). Each is an up-right arrow with its tip at the
  // origin (a: head arm length, t: arm thickness, c: shaft half-width x root 2, d: shaft length), then placed and
  // turned; they drift a little along their own direction and breathe in and out (.gb-arw, off with reduced motion).
  function arrowPath(a, t, c, d) {
    const p = [[0, 0], [-a, 0], [-a + t, t], [-t - c, t], [-t - c - d, t + d], [-t - d, t + c + d], [-t, t + c], [-t, a - t], [0, a]];
    return 'M' + p.map((q) => q.join(',')).join(' L') + ' Z';
  }
  function gbArrows() {
    const big = [ // x, y of the tip, rotation (0 up-right, 180 down-left), size, delay
      [368, 116, 0, [150, 40, 34, 170], 0],
      [92, 289, 180, [42, 14, 12, 105], -2.2],
      [207, 608, 180, [82, 24, 22, 165], -4.1]
    ];
    const thin = [[137, 179, 233, 94, -1], [300, 352, 367, 283, -3.4], [179, 534, 221, 489, -0.6], [266, 712, 331, 641, -2.8], [10, 330, 120, 230, -5]];
    const head = (x2, y2, x1, y1) => { const ang = Math.atan2(y2 - y1, x2 - x1), h = 9; return `M${x2 - h * Math.cos(ang - 0.6)},${y2 - h * Math.sin(ang - 0.6)} L${x2},${y2} L${x2 - h * Math.cos(ang + 0.6)},${y2 - h * Math.sin(ang + 0.6)}`; };
    return `<g class="gb-arrows">
      ${big.map(([x, y, r, k, dl], i) => `<g transform="translate(${x},${y}) rotate(${r})"><path class="gb-arw gb-big" style="animation-delay:${dl}s" d="${arrowPath(...k)}" fill="url(#gbArw)"/></g>`).join('')}
      ${thin.map(([x1, y1, x2, y2, dl]) => `<path class="gb-arw gb-thin" style="animation-delay:${dl}s" d="M${x1},${y1} L${x2},${y2} ${head(x2, y2, x1, y1)}" fill="none" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    </g>`;
  }

  const ICON = {
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1.6-3.6 4.6-5.2 8-5.2s6.4 1.6 8 5.2"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    // the respin arrow (the bottom bar's middle button, design/prototype bottom-bar.html, Craig 13 Oct)
    respin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>'
  };
  D2T.ICON = ICON;

  // In-game chrome: small white D2T logo top left (taps home), account circle top right.
  // Pages reached from home or the account circle (howto, league, stats, account) get a back arrow before the logo.
  // In a game the mode sits in a slanted tag in its colour, centred in the top bar (chosen 12 Oct, "tag, centred" in
  // design/prototype/mode-logo.html): Classic in the club's colour, Daily white, Dare2Dream blue, Club X green; Goal Rush passes its own (yellow).
  const modeWord = () => {
    const r = D2T.state.run; if (!r || !D2T.game) return null;
    if (r.daily) return ['Daily', '#FFFFFF'];
    const m = D2T.game.mode();
    if (m === 'dare2dream') return ['Dare2Dream', '#3BA4FF'];
    if (m === 'clubx') return ['Club X', '#12F06C'];
    const d = D2T.run(), c = d && d.club;
    return ['Classic', c ? (c.text || c.accent) : '#12F06C'];
  };
  D2T.topbar = (opts = {}) => {
    const mw = opts.back || opts.mode === false ? null : (opts.mode || modeWord());
    const tag = mw ? `<span class="mode-tag" style="--c:${mw[1]}"><span>${D2T.esc(mw[0])}</span></span>` : '';
    const el = D2T.h(`<header class="topbar${mw ? ' has-mode' : ''}"><span class="topbar-l">${opts.back ? `<button class="back-btn" aria-label="Back">${ICON.back}</button>` : ''}<button class="logo-home" aria-label="Home${mw ? ', ' + D2T.esc(mw[0]) : ''}" style="border:0;background:none;padding:0;color:#fff;height:26px;display:flex">${D2T.logo('short', { style: 'height:26px' })}</button></span>
      ${tag || opts.middle || '<span></span>'}${opts.noAccount ? '<span></span>' : `<button class="acct-btn" aria-label="Account">${ICON.account}</button>`}</header>`);
    el.querySelector('.logo-home').onclick = () => D2T.go('home');
    const acct = el.querySelector('.acct-btn'); if (acct) acct.onclick = () => D2T.go('account');
    const back = el.querySelector('.back-btn'); if (back) back.onclick = D2T.back;
    return el;
  };
  // First-time tips (12 Oct): a handwritten note with a curved arrow (the respin tip's style), each shown once ever
  // (state.tips), one at a time, gone on the next tap. place: 'above' (default) or 'below' the target; side: 'right'
  // puts the words more to the left of the arrow. D2T.tips([[key, el, text, opts], ...]) shows the first unseen.
  let tipEl = null;
  D2T.tip = (key, target, text, opts = {}) => {
    const st = D2T.state; st.tips = st.tips || {};
    const scr = document.querySelector('#app .screen');
    if (!target || !scr || st.tips[key] || tipEl || !target.isConnected) return false;
    st.tips[key] = true; D2T.save();
    const below = opts.place === 'below';
    const el = D2T.h(`<div class="d2t-tip${below ? ' below' : ''}" aria-hidden="true"><span>${text}</span><svg viewBox="0 0 44 60"><path d="M40 8 C20 6 8 22 14 52" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 43 L14 54 L22 45" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);
    el.style.visibility = 'hidden'; scr.appendChild(el);
    window.D2TSound && window.D2TSound.play('tip');
    // the words sit where they fit on screen; the arrow is placed on its own so its point lands on the target
    const s = scr.getBoundingClientRect(), t = target.getBoundingClientRect(), sp = el.querySelector('span').getBoundingClientRect();
    const cx = t.left - s.left + t.width / 2, w = sp.width, h = sp.height, AW = 34, AH = 46;
    const left = Math.max(8, Math.min(s.width - w - 8, cx - w * (opts.side === 'right' ? 0.75 : 0.25)));
    const ax = cx - left, flip = ax > w / 2, svg = el.querySelector('svg');
    svg.style.left = (flip ? ax - AW + 11 : ax - 11) + 'px';
    svg.style.transform = `scale(${flip ? -1 : 1}, ${below ? -1 : 1})`;
    el.style.width = w + 'px'; el.style.height = (h + AH - 6) + 'px'; el.style.left = left + 'px';
    if (below) { svg.style.top = '0px'; el.querySelector('span').style.top = (AH - 6) + 'px'; el.style.top = (t.bottom - s.top - 2) + 'px'; }
    else { svg.style.top = (h - 6) + 'px'; el.style.top = (t.top - s.top - h - AH + 8) + 'px'; }
    el.style.visibility = '';
    tipEl = el;
    const close = () => { if (tipEl !== el) return; tipEl = null; document.removeEventListener('pointerdown', close, true); el.classList.add('gone'); setTimeout(() => el.remove(), 400); };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 300);
    setTimeout(close, opts.ms || 9000);
    return true;
  };
  D2T.tips = (list) => { for (const [k, el, text, o] of list) { if (!(D2T.state.tips || {})[k]) return D2T.tip(k, el, text, o); } return false; };
  D2T.back = () => { const p = prevName; D2T.go(p && p !== 'intro' && p !== currentName ? p : 'home'); };

  // ---------- browser chrome: status bar, toolbars and page background follow each screen's top and bottom colours ----------
  const THEME_CHROME = { green: ['#12F06C', '#9DF4D8'], black: ['#000000', '#000000'] };
  let strips = null;
  D2T.chrome = (top, bottom) => {
    if (!strips) {
      strips = [D2T.h('<div class="chrome-top" aria-hidden="true"></div>'), D2T.h('<div class="chrome-bot" aria-hidden="true"></div>')];
      document.body.append(...strips);
    }
    strips[0].style.backgroundColor = top; strips[1].style.backgroundColor = bottom;
    document.documentElement.style.backgroundColor = bottom; document.body.style.backgroundColor = bottom;
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = top;
  };

  // ---------- slide-up sheet with drag-to-close ----------
  D2T.sheet = ({ title = '', body = '', onClose } = {}) => {
    const host = document.getElementById('app');
    const scrim = D2T.h('<div class="sheet-scrim"></div>');
    const sh = D2T.h(`<section class="sheet" role="dialog" aria-label="${D2T.esc(title)}"><div class="sheet-bar" aria-label="Close"><span></span></div>${title ? `<div class="sheet-title">${title}</div>` : ''}<div class="sheet-body"></div></section>`);
    const bodyEl = sh.querySelector('.sheet-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    host.append(scrim, sh);
    requestAnimationFrame(() => { scrim.classList.add('open'); sh.classList.add('open'); });
    window.D2TSound && window.D2TSound.play('sheet', 0);
    let closed = false;
    const close = () => { if (closed) return; closed = true; window.D2TSound && window.D2TSound.play('sheet', 1); scrim.classList.remove('open'); sh.style.transition = ''; sh.style.transform = ''; sh.classList.remove('open'); setTimeout(() => { scrim.remove(); sh.remove(); onClose && onClose(); }, 320); };
    scrim.onclick = close;
    const bar = sh.querySelector('.sheet-bar');
    bar.onclick = close;
    const handles = [bar, sh.querySelector('.sheet-title')].filter(Boolean);
    // the content drags the sheet down too, once it is scrolled to the top (touch)
    let ty = null, tdy = 0;
    bodyEl.addEventListener('touchstart', (e) => { ty = bodyEl.scrollTop <= 0 ? e.touches[0].clientY : null; tdy = 0; }, { passive: true });
    bodyEl.addEventListener('touchmove', (e) => { if (ty == null) return; tdy = Math.max(0, e.touches[0].clientY - ty); if (tdy > 0) { sh.style.transition = 'none'; sh.style.transform = `translateY(${tdy}px)`; if (e.cancelable) e.preventDefault(); } }, { passive: false });
    bodyEl.addEventListener('touchend', () => { if (ty == null) return; ty = null; sh.style.transition = ''; if (tdy > 90) close(); else sh.style.transform = ''; });
    handles.forEach((hd) => {
      let y0 = null, dy = 0;
      hd.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; sh.style.transition = 'none'; hd.setPointerCapture(e.pointerId); });
      hd.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
      hd.addEventListener('pointerup', () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; if (dy > 80) close(); else sh.style.transform = ''; if (dy > 4) { bar.onclick = null; setTimeout(() => { bar.onclick = close; }, 60); } });
      hd.addEventListener('pointercancel', () => { y0 = null; sh.style.transition = ''; sh.style.transform = ''; });
    });
    return { el: sh, body: bodyEl, close };
  };

  // ---------- router ----------
  D2T.params = {};
  let current = null, currentName = null, prevName = null, introPlayed = false;
  D2T.go = (name, params = {}) => {
    D2T.params = params;
    if (location.hash.slice(1) === name) render(name); else location.hash = name;
  };
  const RUN_SCREENS = ['spin', 'table', 'squad', 'fixtures', 'match', 'results', 'standings', 'transfer', 'summary'];
  // In-run screens only open when the saved run has reached them; anything else goes to where the run is.
  function routeName() {
    let n = location.hash.slice(1);
    if (!D2T.screens[n]) n = 'home';
    if (RUN_SCREENS.includes(n) && D2T.game) {
      if (n === 'spin' && !D2T.state.run) return n;
      if (!D2T.game.allowed(n)) { const step = D2T.game.stepFor(); return step || 'home'; }
    }
    return n;
  }
  function render(name) {
    const app = document.getElementById('app');
    if (tipEl) { tipEl.remove(); tipEl = null; }
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
    app.querySelectorAll('.sheet, .sheet-scrim, .card-overlay').forEach((n) => n.remove());
    const def = D2T.screens[name];
    const root = D2T.h(`<main class="screen theme-${def.theme || 'black'}" data-screen="${name}"></main>`);
    app.querySelectorAll('.screen').forEach((n) => n.remove());
    app.appendChild(root);
    if (currentName !== name) prevName = currentName;
    current = def; currentName = name;
    const ch = def.chrome || THEME_CHROME[def.theme || 'black'] || THEME_CHROME.black;
    D2T.chrome(ch[0], ch[1]);
    // home (and the intro) read "Drop2Top Football" in the browser's tabs and history (Craig, 13 Oct); other screens add their name
    document.title = def.title && def.title !== 'Home' ? 'DROP2TOP · ' + def.title : 'Drop2Top Football';
    try { def.mount(root, D2T.params || {}); } catch (e) { console.error(e); root.innerHTML = `<div style="padding:24px">Screen "${name}" failed to load: ${D2T.esc(e.message)}</div>`; }
    D2T.params = {};
  }
  window.addEventListener('hashchange', () => {
    const n = routeName();
    if (location.hash.slice(1) !== n) { history.replaceState(null, '', '#' + n); }
    render(n);
  });
  // Every fresh load opens with the intro, which hands over to home (where Continue picks up a run).
  // The page streams in three parts (scripts/build.py): this shell and the intro first, so the intro starts while the
  // data and the rest of the game are still arriving. The intro waits at its handover until boot.js calls D2T.ready().
  let isReady = false; const readyQ = [];
  D2T.ready = () => { if (isReady) return; isReady = true; readyQ.splice(0).forEach((f) => f()); };
  D2T.whenReady = (f) => { if (isReady) f(); else readyQ.push(f); };
  D2T.start = () => {
    let n = routeName();
    if (!introPlayed) { introPlayed = true; n = 'intro'; }
    if (location.hash.slice(1) !== n) history.replaceState(null, '', '#' + n);
    render(n); checkVersion();
  };

  // Home Screen copies keep an old page in memory: look for a newer build when the game opens or comes back,
  // and reload only on screens where nothing is lost (Tenaball lesson).
  function checkVersion() {
    if (location.protocol === 'file:' || !window.D2T_BUILD) return;
    fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).then((t) => {
      if (!t) return;
      if (parseInt(t, 10) > parseInt(window.D2T_BUILD, 10) && ['home', 'intro', 'howto', 'stats', 'league', 'account'].includes(currentName)) location.reload();
    }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
  D2T.currentScreen = () => currentName;
})();
