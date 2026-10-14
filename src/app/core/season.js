// Shared helpers for the in-season screens (table, squad, fixtures, match), backed by the engine through D2T.game.
// Loads before table.js, squad.js, fixtures.js and match.js.
(function () {
  const D2T = window.D2T, GAME = D2T.game;
  const SE = D2T.se = {};

  // ---------- run state ----------
  SE.ensure = () => ({ st: D2T.state.run, data: GAME.runData(), sample: false });
  SE.setStep = (ctx, step) => { ctx.st.step = step; D2T.save(); };

  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  SE.rgba = rgba;
  // The club colour is the accent inside a run.
  SE.accent = (root, club) => {
    root.style.setProperty('--se-acc', club.accent);
    root.style.setProperty('--se-ink', club.ink);
    root.style.setProperty('--se-text', club.text);
    root.style.setProperty('--se-acc-a', rgba(club.accent, 0.22));
    root.style.setProperty('--se-acc-b', rgba(club.accent, 0.55));
    root.classList.add('se-run');
  };
  SE.club = (data, name) => GAME.club(name);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  SE.date = (iso, year = true) => { const d = new Date(iso + 'T12:00:00Z'); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`; };
  SE.fixture = (data, gw) => GAME.fixture(gw);

  SE.pitchLines = `<svg class="se-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="2" width="94" height="96" rx=".6"/><line x1="3" y1="50" x2="97" y2="50"/>
    <rect x="24" y="2" width="52" height="15"/><rect x="38" y="2" width="24" height="5.5"/>
    <rect x="24" y="83" width="52" height="15"/><rect x="38" y="92.5" width="24" height="5.5"/>
  </svg><span class="se-circle" aria-hidden="true"></span><span class="se-spot" aria-hidden="true"></span>`;

  // An empty shirt on the pitch (Dare2Dream draft): the shape of a mini card with the position on it.
  // the wrap carries the fit ring round the shirt (the shirt itself is clipped to its shield shape)
  // `to` (a Club X career's poached player, Craig 14 Oct): the shirt shows the crest of the club he went to and "TO {CLUB}"
  // (the club's name sized so its longest word fits the shirt, never broken inside a word)
  const toSize = (club, w) => { const L = Math.max(...String(club).split(/\s+/).map((x) => x.length)); return Math.max(5, Math.min(w * 0.18, (w - 6) / (L * 0.66 + 0.4))).toFixed(1); };
  SE.emptyShirt = (pos, w, to) => `<span class="se-emptywrap"><div class="se-empty${to ? ' se-empty-to' : ''}" style="width:${w}px;height:${Math.round(w * 1.3)}px" aria-label="Empty ${pos} shirt${to ? `, ${D2T.esc(to.name)} left for ${D2T.esc(to.club)}` : ''}">${to ? `<span class="se-to">${to.crest ? `<img src="${to.crest}" alt="">` : ''}<i>To</i> <b style="font-size:${toSize(to.club, w)}px">${D2T.esc(to.club)}</b></span>` : `<span>${pos}</span>`}</div></span>`;

  // ---------- league table ----------
  SE.sortRows = (rows) => rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
  // The table after gameweek `upto`: your simulated results, everyone else's real results on their real dates (raids applied).
  SE.standings = (ctx, upto) => GAME.standings(upto);
  const COLS = ['p', 'w', 'd', 'l', 'gf', 'ga', 'pts'];
  SE.tableHead = () => `<div class="se-tr se-th" aria-hidden="true"><span class="se-pos">#</span><span></span><span class="se-team">Club</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span class="se-pts">Pts</span></div>`;
  SE.rowHTML = (r, me, extra = '') => `<div class="se-tr${r.name === me ? ' se-me' : ''} ${extra}" data-name="${D2T.esc(r.name)}" role="row" aria-label="${r.pos}. ${D2T.esc(r.name)}, ${r.pts} points">
    <span class="se-pos">${r.pos}</span><img class="se-crest" src="${r.crest}" alt=""><span class="se-team"><span class="se-tname">${D2T.esc(r.name)}</span></span>
    ${COLS.map((k) => `<span class="se-n${k === 'pts' ? ' se-pts' : ''}" data-k="${k}" data-v="${r[k]}">${r[k]}</span>`).join('')}</div>`;
  SE.COLS = COLS;

  // FLIP: animate elements from their old rects (map key -> DOMRect) to where they are now.
  SE.flip = (els, before, opts = {}) => {
    if (D2T.reduced()) return;
    els.forEach((el, i) => {
      const k = el.dataset.name, b = before.get(k); if (!b) return;
      const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: opts.duration || 600, delay: (opts.stagger || 0) * i, easing: opts.easing || 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
  };
  SE.rects = (els) => new Map([...els].map((el) => [el.dataset.name, el.getBoundingClientRect()]));

  // Smooth follow-scroll (as Tenaball's scan camera): eases the scroller towards a target row each frame.
  SE.follow = (scroller) => {
    let target = null, on = true;
    const tick = () => {
      if (!on) return;
      if (target !== null) { const y = scroller.scrollTop, d = target - y; if (Math.abs(d) > 0.5) scroller.scrollTop = y + d * 0.2; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return {
      to: (el, at = 0.45) => { const sr = scroller.getBoundingClientRect(), r = el.getBoundingClientRect(); target = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + r.top - sr.top + r.height / 2 - scroller.clientHeight * at)); },
      stop: () => { on = false; }
    };
  };


  // ---------- the bottom bar in a game (Craig, 13 Oct; design bottom-bar.html) ----------
  // One order on every in-game bar, left to right: the home button (round, the menu once a game is under way), a round
  // middle button (a respin with its count where a respin applies, a back arrow where going back applies, otherwise the
  // same button greyed out so the bar never jumps about), then the main button filling the rest in the mode's colour.
  // Every bar carries `game-bar`, its buttons `bar-home`, `bar-mid` and `bar-main` (the ui test checks the order).
  SE.homeBtn = () => `<button class="icon-btn se-home bar-home" type="button" aria-label="Home">${D2T.ICON.home}</button>`;
  SE.backBtn = (label = 'Back') => `<button class="icon-btn se-back bar-mid" type="button" aria-label="${D2T.esc(label)}">${D2T.ICON.back}</button>`;
  // greyed: disabled, hidden from assistive tech, keeps the main button in place
  SE.backOff = () => `<button class="icon-btn se-off bar-mid" type="button" disabled aria-hidden="true" tabindex="-1">${D2T.ICON.back}</button>`;
  SE.respinOff = () => `<button class="icon-btn se-off bar-mid" type="button" disabled aria-hidden="true" tabindex="-1">${D2T.ICON.respin}</button>`;
  // the main button: `cls` adds classes (se-btn-ghost, se-play), `attrs` other attributes (data-act), `label` is its text
  SE.mainBtn = (label, cls = '', attrs = '') => `<button class="btn se-btn se-wide bar-main${cls ? ' ' + cls : ''}" type="button"${attrs ? ' ' + attrs : ''}>${label}</button>`;
  SE.bar = ({ mid, main, cls = '' } = {}) => `<footer class="actionbar game-bar${cls ? ' ' + cls : ''}">${SE.homeBtn()}${mid || SE.backOff()}${main || ''}</footer>`;

  // the flat football (Craig, 13 Oct; design/prototype/assets/icons/football-flat.svg): the scorers panel on the match
  // and results screens. The patches are cut by the ball's edge with one clip path shared by every ball on the page.
  if (!document.getElementById('d2t-ball-clip')) document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="d2t-ball-clip"><circle cx="12" cy="12" r="11"/></clipPath></defs></svg>');
  SE.ball = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fff"/><g clip-path="url(#d2t-ball-clip)" fill="#0A0A0A" stroke="#0A0A0A" stroke-linejoin="round" stroke-width=".5"><polygon points="12.00,8.40 15.42,10.89 14.12,14.91 9.88,14.91 8.58,10.89"/><polygon points="12.00,5.00 9.24,3.00 10.30,-0.25 13.70,-0.25 14.76,3.00"/><polygon points="18.66,9.84 19.71,6.59 23.12,6.59 24.17,9.84 21.42,11.84"/><polygon points="16.11,17.66 19.52,17.66 20.58,20.91 17.82,22.91 15.06,20.91"/><polygon points="7.89,17.66 8.94,20.91 6.18,22.91 3.42,20.91 4.48,17.66"/><polygon points="5.34,9.84 2.58,11.84 -0.17,9.84 0.88,6.59 4.29,6.59"/></g><path d="M12.00 8.40L12.00 5.00M15.42 10.89L18.66 9.84M14.12 14.91L16.11 17.66M9.88 14.91L7.89 17.66M8.58 10.89L5.34 9.84" stroke="#0A0A0A" stroke-width=".8" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="10.6" fill="none" stroke="#0A0A0A" stroke-width=".8"/></svg>';
  // the scorers panel (the full-time look, Craig 14 Oct): home scorers right-aligned on the left, the ball, away scorers
  // on the right, each with his minute. `hg` and `ag` are lists of { who, min }; an empty side reads "No goals".
  SE.surname = (n) => String(n || '').split(' ').slice(-1)[0];
  SE.scorers = (hg, ag) => {
    const side = (L) => L.length ? L.map((s) => `<li>${D2T.esc(SE.surname(s.who))} <span>${s.min}'</span></li>`).join('') : '<li class="se-none">No goals</li>';
    return `<div class="se-scorers" aria-label="Scorers"><ul>${side(hg)}</ul><span class="se-ball">${SE.ball}</span><ul>${side(ag)}</ul></div>`;
  };

  // ---------- the end-of-game sheet (Craig, 14 Oct) ----------
  // One slide-up sheet for every game once it is over: a headline, a line or two, then Share, Play again (whatever the
  // game calls it) and Home. It is a D2T.sheet, so it drags closed; a peek bar ("Season over", in the game's colour)
  // then sits at the bottom of the screen and brings it back. `buttons`: [{ k, label, fn, primary }] in order, each fn
  // called after the sheet closes; `peek`: the peek bar's words (none means no peek bar); `host` the element it goes in
  // (before `before`); `colour` and `ink` paint the primary button and the peek bar; `onClose` runs when the sheet closes
  // without a button (a drag or a tap on the scrim). Returns { open, close, el }.
  D2T.endSheet = (o) => {
    let sh = null, peek = null, chosen = false;
    const colour = o.colour || '#12F06C', ink = o.ink || '#0A0A0A';
    const removePeek = () => { if (peek) { peek.remove(); peek = null; } };
    const showPeek = () => {
      if (!o.peek || !o.host || !o.host.isConnected || peek) return;
      peek = D2T.h(`<button class="end-peek${o.slim ? ' end-peek-slim' : ''}" type="button" style="--c:${colour};--ink:${ink}"><span>${D2T.esc(o.peek)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`);
      peek.onclick = () => { window.D2TSound && window.D2TSound.play('tapSmall'); open(); };
      if (o.before && o.before.parentNode === o.host) o.host.insertBefore(peek, o.before); else o.host.appendChild(peek);
    };
    const open = () => {
      if (sh) return sh;
      chosen = false; removePeek();
      const rows = (o.buttons || []).map((b) => `<button class="btn ${b.primary ? 'end-primary' : 'btn-ghost'} fr-btn-wide" type="button" data-k="${D2T.esc(b.k)}"${b.primary ? ` style="background:${colour};color:${ink}"` : ''}>${b.label}</button>`).join('');
      sh = D2T.sheet({ title: o.title || '', body: `${o.lead ? `<div class="end-lead">${o.lead}</div>` : ''}<div class="fr-stack end-stack">${rows}</div>`,
        onClose: () => { sh = null; if (chosen) return; showPeek(); o.onClose && o.onClose(); } });
      sh.el.classList.add('end-sheet');
      (o.buttons || []).forEach((b) => { const el = sh.body.querySelector(`[data-k="${b.k}"]`); if (el) el.onclick = () => { chosen = true; const s = sh; sh = null; s.close(); b.fn && b.fn(); }; });
      return sh;
    };
    const close = () => { if (sh) { const s = sh; sh = null; chosen = true; s.close(); } removePeek(); };
    return { open, close, get el() { return sh && sh.el; } };
  };

  // ---------- the home button's menu (Craig, 13 Oct) ----------
  // One sheet for every game: Keep playing, Restart (a new game from the start), Home (the game is saved) and Quit
  // (thrown away), nothing recorded. Each game passes what applies: `restart`, `quit` and `home` are functions (home may be
  // `true` for a plain trip home); a key left out is not offered. Before the first interaction, or once a game is over,
  // the games skip the menu and go straight home.
  D2T.leaveMenu = (o) => {
    const rows = [['keep', o.keepLabel || 'Keep playing', ''], o.restart && ['restart', o.restartLabel || 'Restart the game', ''], o.home && ['home', o.homeLabel || 'Home, save the game', ''],
      o.quit && ['quit', o.quitLabel || 'Quit the game', ' fr-danger']].filter(Boolean);
    const sh = D2T.sheet({ title: o.title || 'Leave the game?', body: `<p class="fr-lead">${o.lead || ''}</p>
      <div class="fr-stack">${rows.map(([k, t, c]) => `<button class="btn btn-ghost fr-btn-wide${c}" data-k="${k}">${t}</button>`).join('')}</div>` });
    rows.forEach(([k]) => { sh.body.querySelector(`[data-k="${k}"]`).onclick = () => { sh.close(); const fn = o[k]; if (typeof fn === 'function') fn(); else if (k === 'home') D2T.go('home'); }; });
    return sh;
  };
  // a run (Classic, Daily, Dare2Dream, Club X): before a club is picked, or once the run is over, straight home; mid-run
  // the menu. A Daily offers Keep playing, Restart (a fresh go at today's Daily) and Home, no Quit (Craig, 13 Oct).
  D2T.runMenu = () => {
    const r = D2T.state.run, G = D2T.game, e = r && r.eng;
    if (!e || !e.seasonKey || e.phase === 'summary' || r.recorded) { D2T.go('home'); return; }
    const daily = !!r.daily, mode = G.mode(), name = G.modeName(mode);
    D2T.leaveMenu({
      lead: daily ? 'Home keeps this go for later, any time before midnight. Restart throws it away and starts a fresh go. Your best go today is the one that counts.'
        : `Home keeps this run for later. Restart throws it away and starts a new ${name} run. Quit throws it away. Nothing is recorded.`,
      homeLabel: `Home, save the ${daily ? 'Daily' : 'run'}`, quitLabel: 'Quit the run',
      home: true,
      restart: () => { if (daily) { G.restartDaily(); D2T.go(G.stepFor() || 'table'); return; } G.newRun(mode); D2T.go('spin'); },
      quit: daily ? null : () => { G.rememberOffered(); D2T.state.run = null; D2T.save(); D2T.go('home'); }
    });
  };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('.se-home')) D2T.runMenu(); });
})();
