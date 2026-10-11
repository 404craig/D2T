// D2T prototype shell: router, saved state, chrome, logos, sheets, green backdrop.
// Screens register with D2T.screen(name, def). Routes are bare hash tokens (#home, #spin) so they work as artifact deep links.
(function () {
  const D2T = window.D2T = window.D2T || {};
  D2T.data = window.D2T_DATA;
  D2T.screens = {};
  D2T.screen = (name, def) => { D2T.screens[name] = def; };

  // ---------- saved state (phone only; safe if storage is blocked) ----------
  const KEY = 'd2t-proto-v1';
  const DEFAULT_STATE = {
    run: null, // { key: 'Wolves 2011/12', step: 'squad', gw: 1, formation: '4-4-2', xi: [...names], subs: [...names] }
    record: { drop: 4, half: 2, top3: 1, titles: 0, runs: 7 }, // example numbers, shown as examples
    account: { signedIn: false, name: '', email: '' },
    seenIntro: false
  };
  function load() { try { return Object.assign({}, DEFAULT_STATE, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULT_STATE); } }
  D2T.state = load();
  D2T.save = () => { try { localStorage.setItem(KEY, JSON.stringify(D2T.state)); } catch (e) { /* storage blocked: prototype keeps working in memory */ } };
  D2T.resetState = () => { D2T.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); D2T.save(); };
  D2T.run = () => D2T.state.run && D2T.data.runs[D2T.state.run.key] ? D2T.data.runs[D2T.state.run.key] : null;

  // ---------- helpers ----------
  D2T.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  D2T.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  D2T.reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  D2T.ASSET = {
    emblem: 'assets/logo/emblem.png', emblemLine: 'assets/logo/emblem_line.png',
    short: 'assets/logo/short.png', long: 'assets/logo/long.png',
    shortText: 'assets/logo/short_text.png', longText: 'assets/logo/long_text.png'
  };
  // Logo as a mask so it can be any colour or carry an animated fill. kind: emblem | short | long | shortText | longText | emblemLine
  D2T.logo = (kind, opts = {}) => `<span class="logo-mask ${opts.cls || ''}" role="img" aria-label="${opts.label || (kind === 'long' ? 'DROP2TOP' : 'D2T')}" style="--src:url('${new URL(D2T.ASSET[kind], document.baseURI).href}');aspect-ratio:${LOGO_RATIO[kind]};${opts.style || ''}"></span>`;
  const LOGO_RATIO = { emblem: '234/237', emblemLine: '258/261', short: '857/241', long: '1301/237', shortText: '617/160', longText: '1068/143' };
  D2T.LOGO_RATIO = LOGO_RATIO;

  // Green FC-style backdrop: soft vertical gradient (from the theme class) plus light beams and a dark streak.
  D2T.greenBackdrop = () => `<div class="green-backdrop" aria-hidden="true"><svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gbBand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".25"/><stop offset="1" stop-color="#2CF57F" stop-opacity=".9"/></linearGradient>
      <linearGradient id="gbThin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".2"/><stop offset=".8" stop-color="#0A0A0A" stop-opacity=".6"/><stop offset="1" stop-color="#0A0A0A" stop-opacity=".9"/></linearGradient>
      <linearGradient id="gbFoot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18F06F"/><stop offset=".55" stop-color="#18F06F"/><stop offset="1" stop-color="#0A0A0A"/></linearGradient>
    </defs>
    <polyline points="-40,30 210,690" fill="none" stroke="url(#gbBand)" stroke-width="46" stroke-linecap="butt"/>
    <polyline points="-20,-10 430,330" fill="none" stroke="url(#gbThin)" stroke-width="3"/>
    <polyline points="196,694 430,620" fill="none" stroke="url(#gbFoot)" stroke-width="20"/>
  </svg></div>`;

  const ICON = {
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1.6-3.6 4.6-5.2 8-5.2s6.4 1.6 8 5.2"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>'
  };
  D2T.ICON = ICON;

  // In-game chrome: small white D2T logo top left (taps home), account circle top right.
  D2T.topbar = (opts = {}) => {
    const el = D2T.h(`<header class="topbar"><button class="logo-home" aria-label="Home" style="border:0;background:none;padding:0;color:#fff;height:26px;display:flex">${D2T.logo('short', { style: 'height:26px' })}</button>
      ${opts.middle || '<span></span>'}<button class="acct-btn" aria-label="Account">${ICON.account}</button></header>`);
    el.querySelector('.logo-home').onclick = () => D2T.go('home');
    el.querySelector('.acct-btn').onclick = () => D2T.go('account');
    return el;
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
    let closed = false;
    const close = () => { if (closed) return; closed = true; scrim.classList.remove('open'); sh.style.transition = ''; sh.style.transform = ''; sh.classList.remove('open'); setTimeout(() => { scrim.remove(); sh.remove(); onClose && onClose(); }, 320); };
    scrim.onclick = close;
    const bar = sh.querySelector('.sheet-bar');
    bar.onclick = close;
    const handles = [bar, sh.querySelector('.sheet-title')].filter(Boolean);
    handles.forEach((hd) => {
      let y0 = null, dy = 0;
      hd.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; sh.style.transition = 'none'; hd.setPointerCapture(e.pointerId); });
      hd.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
      hd.addEventListener('pointerup', () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; if (dy > 80) close(); else sh.style.transform = ''; });
    });
    return { el: sh, body: bodyEl, close };
  };

  // ---------- router ----------
  D2T.params = {};
  let current = null, currentName = null;
  D2T.go = (name, params = {}) => {
    D2T.params = params;
    if (location.hash.slice(1) === name) render(name); else location.hash = name;
  };
  function routeName() { const n = location.hash.slice(1); return D2T.screens[n] ? n : (D2T.state.seenIntro ? 'home' : 'intro'); }
  function render(name) {
    const app = document.getElementById('app');
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
    app.querySelectorAll('.sheet, .sheet-scrim, .card-overlay').forEach((n) => n.remove());
    const def = D2T.screens[name];
    const root = D2T.h(`<main class="screen theme-${def.theme || 'black'}" data-screen="${name}"></main>`);
    app.querySelectorAll('.screen').forEach((n) => n.remove());
    app.appendChild(root);
    current = def; currentName = name;
    document.title = 'DROP2TOP' + (def.title ? ' · ' + def.title : '');
    try { def.mount(root, D2T.params || {}); } catch (e) { console.error(e); root.innerHTML = `<div style="padding:24px">Screen "${name}" failed to load: ${D2T.esc(e.message)}</div>`; }
    D2T.params = {};
  }
  window.addEventListener('hashchange', () => render(routeName()));
  D2T.start = () => render(routeName());
  D2T.currentScreen = () => currentName;
})();
