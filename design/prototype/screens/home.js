// Home (green, black buttons). Also defines D2T.toBlack(next): the move from green into the black game screens,
// where the logo turns from black to white with a green shimmer and lands as the small top-left logo.
(function () {
  const SAMPLE_RUN = { key: 'Wolves 2011/12', step: 'squad', gw: 5, formation: '4-4-2', xi: null, subs: null, signed: [] };
  const STEP_LABEL = { spin: 'Pick a club', table: 'Preview', squad: 'Squad', fixtures: 'Fixtures', match: 'Match day', transfer: 'Transfer' };
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  const TAB_ICON = {
    league: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 5.5H5.5a2.5 2.5 0 003 3.3M16 5.5h2.5a2.5 2.5 0 01-3 3.3M12 13v4M8.5 20h7"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="f" x="4" y="13" width="4.2" height="8" rx="1.2"/><rect class="f" x="9.9" y="8.5" width="4.2" height="12.5" rx="1.2"/><rect class="f" x="15.8" y="3.5" width="4.2" height="17.5" rx="1.2"/></svg>',
    howto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.8"/><circle class="f" cx="12" cy="17.3" r="1.2"/></svg>',
    account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>'
  };
  // card outline (chamfered top corners, shallow point at the bottom), as in .d2c-rim
  const FRAME = '<svg viewBox="0 0 100 128" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,11 11,1 89,1 99,11 99,108 50,127 1,108" stroke-linejoin="round"/></svg>';
  const MODES = [
    { name: 'Daily challenge', sub: '' },
    { name: 'Head to head', sub: 'Online, up to 3 players' },
    { name: 'Draft', sub: '' },
    { name: 'Legends', sub: '' }
  ];
  D2T.frFrame = FRAME;
  D2T.frRecord = (rec, cls = '') => `<div class="fr-record ${cls}">
      <div class="fr-frame">${FRAME}<b>${rec.drop}</b><span>Beat the drop</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.half}</b><span>Top half</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.top3}</b><span>Top 3</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.titles}</b><span>League titles</span></div></div>`;

  function continueCard() {
    const r = D2T.state.run, data = r && D2T.data.runs[r.key];
    if (!data) return '';
    const c = data.club, gw = r.gw || 1;
    return `<button class="fr-card-btn fr-cont fr-in" style="--club:${c.accent}" data-act="continue" aria-label="Continue with ${D2T.esc(c.full)} ${data.season}, gameweek ${gw}">
      <span class="fr-cont-crest"><img src="${c.crest}" alt=""></span>
      <span class="fr-cont-txt"><span class="fr-cont-lbl">CONTINUE</span><span class="fr-cont-name" style="display:block">${D2T.esc(c.name)}</span>
      <span class="fr-cont-meta" style="display:block">${data.season} · Gameweek ${gw} · ${STEP_LABEL[r.step] || 'In progress'}</span>
      <span class="fr-cont-bar" style="display:block"><i style="transform:scaleX(${Math.max(0.03, gw / 38)})"></i></span></span>
      <span class="fr-go">${ARROW}</span></button>`;
  }

  D2T.screen('home', {
    title: 'Home', theme: 'green',
    mount(root, params) {
      const rec = D2T.state.record;
      root.insertAdjacentHTML('beforeend', D2T.greenBackdrop());
      const body = D2T.h(`<div class="screen-body fr-home">
        <div class="fr-home-top"><button class="fr-home-logo" aria-label="DROP2TOP">${D2T.logo('long')}</button></div>
        ${continueCard()}
        <button class="fr-card-btn fr-pick fr-in" data-act="pick">
          <span class="fr-mark">${D2T.logo('emblem')}</span>
          <span><span class="fr-tag" style="display:block">CLASSIC</span><span class="fr-big" style="display:block">Pick a new club</span><span class="fr-sub" style="display:block">Dare to dream. Win the title!</span></span>
          <span class="fr-go">${ARROW}</span></button>
        <section class="fr-sect fr-in" aria-label="Your record">
          <div class="fr-sect-h"><h2>Your record</h2><span>${rec.runs} runs</span></div>
          ${D2T.frRecord(rec)}
          <p class="fr-note">Example numbers for the prototype.</p></section>
        <section class="fr-sect fr-in" aria-label="More game modes">
          <div class="fr-sect-h"><h2>More modes</h2><span>Coming soon</span></div>
          <div class="fr-modes">${MODES.map((m) => `<button class="fr-mode" aria-label="${m.name}, coming soon">
            <span class="fr-back" style="display:block"><span class="fr-back-rim"></span><span class="fr-back-face"></span>${D2T.logo('emblemLine')}<span class="fr-stamp">COMING SOON</span></span>
            <span class="fr-mode-name">${m.name}</span>${m.sub ? `<span class="fr-mode-sub">${m.sub}</span>` : ''}</button>`).join('')}</div></section>
        <p class="fr-proto fr-in">Prototype: <button data-act="sample">${D2T.state.run ? 'Show without a saved run' : 'Show with a saved run'}</button> · <button data-act="intro">Replay intro</button></p>
      </div>`);
      root.appendChild(body);
      const bar = D2T.h(`<nav class="fr-tabbar fr-in" aria-label="More">
        <button data-go="league">${TAB_ICON.league}League</button><button data-go="stats">${TAB_ICON.stats}Stats</button>
        <button data-go="howto">${TAB_ICON.howto}How to play</button><button data-go="account">${TAB_ICON.account}Account</button></nav>`);
      root.appendChild(bar);

      const logoBtn = body.querySelector('.fr-home-logo');
      const ins = [...root.querySelectorAll('.fr-in')];
      const reveal = (base) => ins.forEach((el, i) => setTimeout(() => el.classList.add('on'), base + i * 70));

      // arriving from the intro: take the logo from where the intro left it, then bring the content in
      const fi = params.fromIntro;
      if (fi && typeof fi === 'object' && !D2T.reduced()) {
        const r = logoBtn.getBoundingClientRect(), rr = root.getBoundingClientRect();
        const dx = fi.left - (r.left - rr.left), dy = fi.top - (r.top - rr.top), s = fi.width / r.width;
        logoBtn.style.transformOrigin = '0 0';
        logoBtn.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(.6,0,.2,1)' });
        reveal(380);
      } else if (fi && !D2T.reduced()) reveal(60);
      else ins.forEach((el) => el.classList.add('on'));

      body.querySelector('[data-act="pick"]').onclick = (e) => D2T.toBlack('spin', { from: e.currentTarget });
      const cont = body.querySelector('[data-act="continue"]');
      if (cont) cont.onclick = (e) => D2T.toBlack(D2T.state.run.step || 'squad', { from: e.currentTarget });
      const toggle = () => { D2T.state.run = D2T.state.run ? null : Object.assign({}, SAMPLE_RUN); D2T.save(); D2T.go('home'); };
      body.querySelector('[data-act="sample"]').onclick = toggle;
      body.querySelector('[data-act="intro"]').onclick = () => D2T.go('intro');
      // hidden extra: long-press the logo also toggles the sample run
      let lp = null;
      logoBtn.addEventListener('pointerdown', () => { lp = setTimeout(() => { lp = null; toggle(); }, 650); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => logoBtn.addEventListener(ev, () => { clearTimeout(lp); lp = null; }));
      logoBtn.addEventListener('contextmenu', (e) => e.preventDefault());
      body.querySelectorAll('.fr-mode').forEach((m) => m.onclick = () => { m.classList.remove('nudge'); void m.offsetWidth; m.classList.add('nudge'); });
      bar.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => D2T.go(b.dataset.go));
    }
  });

  // ---------- D2T.toBlack(next, {from}) ----------
  // Green collapses into black from the button you tapped, the home logo turns white as green light ripples through it,
  // then it shrinks into the small white top-left logo of the next (black) screen.
  let busy = false;
  D2T.toBlack = async (next, opts = {}) => {
    const app = document.getElementById('app');
    const scr = app.querySelector('.screen');
    const logoEl = scr && scr.querySelector('.fr-home-logo .logo-mask');
    if (busy) return;
    if (D2T.reduced() || !logoEl) { D2T.go(next); return; }
    busy = true;
    const ar = app.getBoundingClientRect();
    const lr = logoEl.getBoundingClientRect();
    const L = { x: lr.left - ar.left, y: lr.top - ar.top, w: lr.width, h: lr.height };
    let ox = ar.width / 2, oy = ar.height / 2;
    if (opts.from) { const b = opts.from.getBoundingClientRect(); ox = b.left - ar.left + b.width / 2; oy = b.top - ar.top + b.height / 2; }
    const R = Math.hypot(Math.max(ox, ar.width - ox), Math.max(oy, ar.height - oy)) / 30 + 0.5;

    const shortW = L.h * (857 / 241);
    const ov = D2T.h(`<div class="fr-tb" aria-hidden="true"><div class="fr-tb-black" style="left:${ox}px;top:${oy}px"></div>
      <div class="fr-tb-logo" style="width:${L.w}px;height:${L.h}px;transform:translate(${L.x}px,${L.y}px)">
        <span class="fr-tb-m fr-tb-long" style="-webkit-mask-image:url('${D2T.ASSET.long}');mask-image:url('${D2T.ASSET.long}')"><i class="w"></i><i class="k"></i><i class="s"></i></span>
        <span class="fr-tb-m fr-tb-short" style="-webkit-mask-image:url('${D2T.ASSET.short}');mask-image:url('${D2T.ASSET.short}');right:auto;width:${shortW}px;opacity:0"><i class="w"></i></span>
      </div></div>`);
    app.appendChild(ov);
    logoEl.style.visibility = 'hidden';
    const black = ov.querySelector('.fr-tb-black'), fly = ov.querySelector('.fr-tb-logo');
    const lng = ov.querySelector('.fr-tb-long'), shrt = ov.querySelector('.fr-tb-short');
    const ease = 'cubic-bezier(.6,0,.2,1)';

    // 1. home content drops away, black floods in from the tap
    const body = scr.querySelector('.screen-body'), bar = scr.querySelector('.fr-tabbar');
    [body, bar].forEach((el) => el && el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }));
    black.animate([{ transform: 'scale(0)' }, { transform: `scale(${R})` }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    // 2. logo: black fades to white while green glistens through it in waves, then settles on white
    lng.querySelector('.k').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 160, easing: 'ease-in-out', fill: 'forwards' });
    lng.querySelector('.s').animate([{ transform: 'translateX(-60%)' }, { transform: 'translateX(40%)' }], { duration: 1050, delay: 120, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
    await D2T.wait(620);

    // 3. the next screen mounts under the black; find its top-left logo and fly to it
    D2T.go(next);
    await D2T.wait(30);
    const nscr = app.querySelector('.screen');
    const target = nscr && nscr.querySelector('.topbar .logo-home .logo-mask');
    let T = { x: 16, y: 19, h: 26 };
    if (target) { const tr = target.getBoundingClientRect(); T = { x: tr.left - ar.left, y: tr.top - ar.top, h: tr.height }; target.style.visibility = 'hidden'; }
    const s = T.h / L.h;
    fly.animate([{ transform: `translate(${L.x}px,${L.y}px) scale(1)` }, { transform: `translate(${T.x}px,${T.y}px) scale(${s})` }], { duration: 640, easing: ease, fill: 'forwards' });
    // the long name folds back into D2T as it lands (emblems stay aligned on the left)
    lng.animate([{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    shrt.animate([{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], { duration: 600, fill: 'forwards' });
    // reveal the new screen by fading the black flood (black on black, so only its content appears)
    black.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 200, easing: 'ease-out', fill: 'forwards' });
    await D2T.wait(660);
    if (target) target.style.visibility = '';
    ov.remove();
    busy = false;
  };
})();
