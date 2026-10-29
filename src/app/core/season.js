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

  // ---------- tactics (Craig, 18 Oct; docs/SCOPE_ENGINE.md) ----------
  // The tactics chip sits bottom right of the pitch, the twin of the shape chip bottom left: the tactic's name and a chevron.
  SE.tacticChip = () => `<button class="se-formlink se-taclink" type="button" aria-label="Tactic"><b class="se-tname">${D2T.esc(GAME.tacticName())}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  // your three lines as short bars (Defence, Midfield, Attack, the engine's own numbers), the best in the accent colour;
  // no judgement beyond that: reading the bars and the boards is the game
  SE.lineBars = () => {
    const L = GAME.lines(), top = Math.max(L.def, L.mid, L.att), lo = 55, hi = 95;
    const bar = (k, label, v) => `<span class="se-line${v === top ? ' is-top' : ''}" aria-label="${label} ${v}"><i>${k}</i><b><u style="width:${Math.max(4, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(0)}%"></u></b><em>${v}</em></span>`;
    return `<div class="se-linebars">${bar('DEF', 'Defence', L.def)}${bar('MID', 'Midfield', L.mid)}${bar('ATT', 'Attack', L.att)}</div>`;
  };
  // the tactics sheet: five boards, each a small pitch in your current shape that moves the way the tactic does (reduced
  // motion: still), the tactic's name, one line on what it leans on, and the shapes it is built for. Done applies it.
  // `onApply(k)` runs when the sheet closes on a change.
  SE.tacticSheet = (root, onApply) => {
    const f = GAME.eng().formation, dots = GAME.formationDots(f);
    let pending = GAME.tactic();
    const tile = (t) => `<button class="se-taccard${t.k === pending ? ' is-on' : ''}" type="button" data-t="${t.k}" aria-pressed="${t.k === pending}">
      <span class="se-fpitch se-tacpitch is-${t.k}"><span class="se-fline"></span>${dots.map((d, i) => `<i style="left:${d.x}%;top:${d.y}%;--i:${i}"></i>`).join('')}${t.k === 'poss' ? '<s class="se-tacball"></s>' : ''}</span>
      <span class="se-tactext"><b>${t.name}</b><span>${t.line}</span><small>${t.any ? 'Any shape' : 'Built for ' + GAME.tacticShapes(t.k).join(', ').replace(/, ([^,]*)$/, ' and $1')}${!t.any && GAME.tacticShapes(t.k).includes(f) ? ' · your shape' : ''}</small></span></button>`;
    const el = D2T.h(`<div><div class="se-tacgrid">${GAME.TACTICS.map(tile).join('')}</div><p class="se-note">A tactic leans on one of your lines: it pays when that line is your strength and costs when it is your weakness. In a shape it is built for it bites in full; in any other, half. Change it whenever your squad is up.</p><button class="btn se-btn se-done" type="button">Done</button></div>`);
    const sh = D2T.sheet({ title: 'Tactics', body: el, onClose: () => { if (pending === GAME.tactic()) return; GAME.setTactic(pending); window.D2TSound && window.D2TSound.play('formation'); onApply && onApply(pending); } });
    sh.el.classList.add('se-run', 'se-tacsheet');
    ['--se-acc', '--se-ink', '--se-text', '--se-acc-a', '--se-acc-b'].forEach((v) => sh.el.style.setProperty(v, root.style.getPropertyValue(v)));
    el.querySelectorAll('.se-taccard').forEach((b) => { b.onclick = () => { pending = b.dataset.t; el.querySelectorAll('.se-taccard').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); }); }; });
    el.querySelector('.se-done').onclick = () => sh.close();
    return sh;
  };

  // ---------- the end-of-game sheet (Craig, 14 Oct) ----------
  // One slide-up sheet for every game once it is over: a headline, a line or two, then Share, Play again (whatever the
  // game calls it) and Home. It is a D2T.sheet, so it drags closed; a peek bar ("Season over", in the game's colour)
  // then sits at the bottom of the screen and brings it back. `buttons`: [{ k, label, fn, primary, outline (a ghost button with a white border) }] in order, each fn
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
      const rows = (o.buttons || []).map((b) => `<button class="btn ${b.primary ? 'end-primary' : 'btn-ghost'} fr-btn-wide" type="button" data-k="${D2T.esc(b.k)}"${b.primary ? ` style="background:${colour};color:${ink}"` : b.outline ? ' style="border-color:#fff"' : ''}>${b.label}</button>`).join('');
      sh = D2T.sheet({ title: o.title || '', body: `${o.lead ? `<div class="end-lead">${o.lead}</div>` : ''}<div class="fr-stack end-stack">${rows}</div>`,
        onClose: () => { sh = null; if (chosen) return; showPeek(); o.onClose && o.onClose(); } });
      sh.el.classList.add('end-sheet');
      (o.buttons || []).forEach((b) => { const el = sh.body.querySelector(`[data-k="${b.k}"]`); if (el) el.onclick = () => { chosen = true; const s = sh; sh = null; s.close(); if (b.peek) showPeek(); b.fn && b.fn(); }; });
      return sh;
    };
    const close = () => { if (sh) { const s = sh; sh = null; chosen = true; s.close(); } removePeek(); };
    // peek(): start collapsed, the peek bar only (the season summary, Craig 25 Oct: the stats first); a button with
    // `peek: true` (Final table) leaves the peek bar behind it
    return { open, close, peek: showPeek, get el() { return sh && sh.el; } };
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

  // ---------- Sweep and strike (Craig, 20 Oct; animation B in design/prototype/raid-crosshair.html) ----------
  // The take when another side comes in for one of yours: the Club X Summer poach (squad.js, one per player) and the
  // January raid (transfer.js). A red scan line sweeps the pitch and a crosshair rides it, wide and turning, dropping
  // onto each player on its path (each flashes red and is passed over); it dives onto the target, spins tight and locks
  // with a double pulse; he shakes; the rival's badge comes in fast from the far touchline and stamps down on him (a white
  // shock ring, the pitch kicks); he is pulled into the badge, which lifts and flies off, leaving his shirt empty. Drawn in
  // a layer inside the pitch (`.rd-fx`, a `.rd-wash` under the players), every position measured against the pitch's box.
  // opts: pitch (.se-pitch), slotsEl (.se-slots), slot (the target's index), crest (the rival's), onLanded() as the badge
  // lands (the headline), onEmpty() when the shirt is to be emptied (the caller draws the empty shirt and the rating; the
  // helper fades it in). Returns { done, cancel }: cancel stops it at once and clears the layer.
  // the crosshair, every shape drawn twice: a black edge underneath, yellow on top (deadline-day colours, Craig 21 Oct)
  const RD_SHAPES = '<circle class="ring" cx="48" cy="48" r="40"/><circle class="ring" cx="48" cy="48" r="22"/><line class="tick" x1="48" y1="2" x2="48" y2="18"/><line class="tick" x1="48" y1="78" x2="48" y2="94"/><line class="tick" x1="2" y1="48" x2="18" y2="48"/><line class="tick" x1="78" y1="48" x2="94" y2="48"/><circle class="dot" cx="48" cy="48" r="2.6"/><path class="brk" d="M14 30 V14 H30"/><path class="brk" d="M66 14 H82 V30"/><path class="brk" d="M82 66 V82 H66"/><path class="brk" d="M30 82 H14 V66"/>';
  const RD_X = `<svg viewBox="0 0 96 96" aria-hidden="true"><g class="rd-edge">${RD_SHAPES}</g><g class="rd-fg">${RD_SHAPES}</g></svg>`;
  // the four players nearest the target's line, never the target, left to right (the sweep's order)
  SE.raidPath = (slotsEl, target, n = 4) => {
    const at = (sl) => { const w = sl.querySelector('.se-cardwrap'); if (!w || !w.querySelector('.d2c')) return null; const r = w.getBoundingClientRect(); return { i: +sl.dataset.i, x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const all = [...slotsEl.querySelectorAll('.se-slot[data-i]')].map(at).filter(Boolean), t = all.find((s) => s.i === target);
    if (!t) return [];
    return all.filter((s) => s.i !== target).sort((a, b) => Math.abs(a.y - t.y) - Math.abs(b.y - t.y)).slice(0, n).sort((a, b) => a.x - b.x).map((s) => s.i);
  };
  SE.raidTake = (opts) => {
    const { pitch, slotsEl, slot, crest } = opts, SND = window.D2TSound || { play() {} };
    let alive = true; const anims = [], timers = [];
    const fx = D2T.h('<div class="rd-fx" aria-hidden="true"></div>'), wash = D2T.h('<div class="rd-wash" aria-hidden="true"></div>'), beam = D2T.h('<div class="rd-beam"></div>');
    const cancel = () => { if (!alive) return; alive = false; timers.forEach(clearTimeout); anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); fx.remove(); wash.remove(); pitch.classList.remove('rd-on', 'rd-dim'); pitch.querySelectorAll('.rd-tint').forEach((e) => e.classList.remove('rd-tint')); const w = slotsEl.querySelector(`.se-slot[data-i="${slot}"] .se-cardwrap`); if (w) w.style.visibility = ''; };
    const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
    const anim = (el, k, o) => { const a = el.animate(k, Object.assign({ fill: 'forwards' }, o)); anims.push(a); return a.finished.catch(() => {}); };
    // positions in the pitch's own pixels (the page never scales, but a scaled ancestor would otherwise miss the cards)
    const centre = (i) => { const w = slotsEl.querySelector(`.se-slot[data-i="${i}"] .se-cardwrap`), pr = pitch.getBoundingClientRect(), r = w.getBoundingClientRect(), k = pr.width / (pitch.offsetWidth || pr.width) || 1; const l = (r.left - pr.left) / k, t = (r.top - pr.top) / k, wd = r.width / k, ht = r.height / k; return { x: l + wd / 2, y: t + ht / 2, l, t, wd, ht, pw: pitch.offsetWidth || pr.width, ph: pitch.offsetHeight || pr.height, w }; };
    const slotOf = (i) => slotsEl.querySelector(`.se-slot[data-i="${i}"]`);
    const done = (async () => {
      const tw = slotsEl.querySelector(`.se-slot[data-i="${slot}"] .se-cardwrap`); if (!tw) return;
      const path = (opts.path || SE.raidPath(slotsEl, slot)).filter((i) => i !== slot && slotOf(i) && slotOf(i).querySelector('.se-cardwrap .d2c'));
      pitch.classList.add('rd-on'); pitch.insertBefore(wash, slotsEl); pitch.appendChild(fx); fx.appendChild(beam);
      const x = D2T.h(`<div class="rd-x">${RD_X}</div>`); fx.appendChild(x);
      // 1. the hunt, 3.6 s (Craig, 21 Oct): the wash comes up, the beam runs left to right and back, the crosshair rides it,
      //    stopping on each player on the path (a hold of 45% of a step), smaller and 45 degrees further round each time
      anim(wash, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); pitch.classList.add('rd-dim');
      SND.play('dropCancel'); opts.onStart && opts.onStart();
      const T = centre(slot), P = path.map(centre), Hh = T.ph, HUNT = 3600, n = Math.max(1, P.length), step = 0.84 / n;
      anim(beam, [{ opacity: 0, transform: 'translateX(-50%)' }, { opacity: 1, transform: 'translateX(-40%)', offset: 0.08 }, { opacity: 1, transform: 'translateX(40%)', offset: 0.5 }, { opacity: 1, transform: 'translateX(-20%)', offset: 0.85 }, { opacity: 0, transform: 'translateX(-25%)' }], { duration: HUNT, easing: 'ease-in-out' });
      const kf = [{ transform: `translate(-60px,${Hh * 0.35}px) scale(1.9) rotate(0deg)`, opacity: 1, offset: 0, easing: 'cubic-bezier(.4,0,.2,1)' }];
      P.forEach((p, k) => { const o = 0.08 + k * step; kf.push({ transform: `translate(${p.x}px,${p.y}px) scale(${1.6 - k * 0.12}) rotate(${(k + 1) * 45}deg)`, opacity: 1, offset: o, easing: 'cubic-bezier(.4,0,.2,1)' }); kf.push({ transform: `translate(${p.x}px,${p.y}px) scale(${1.48 - k * 0.12}) rotate(${(k + 1) * 45}deg)`, opacity: 1, offset: Math.min(0.99, o + step * 0.45), easing: 'cubic-bezier(.4,0,.2,1)' }); });
      const rotEnd = (P.length + 1) * 45 + 45;
      kf.push({ transform: `translate(${T.x}px,${T.y}px) scale(1) rotate(${rotEnd}deg)`, opacity: 1, offset: 1 });
      const mv = anim(x, kf, { duration: HUNT });
      P.forEach((p, k) => { timers.push(setTimeout(() => { if (!alive) return; const sl = slotOf(path[k]); if (!sl) return; sl.classList.add('rd-tint'); timers.push(setTimeout(() => sl.classList.remove('rd-tint'), 380)); }, HUNT * (0.08 + k * step) + 60)); });
      await mv; if (!alive) return;
      // 2. the lock: the rings snap tight, the brackets come in, two pulses, he shakes
      const tsl = slotOf(slot); tsl && tsl.classList.add('rd-tint');
      anim(x, [{ transform: `translate(${T.x}px,${T.y}px) scale(1) rotate(${rotEnd}deg)` }, { transform: `translate(${T.x}px,${T.y}px) scale(.78) rotate(${(P.length + 2) * 45}deg)` }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1.35)' });
      x.querySelectorAll('.brk').forEach((b) => anim(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
      for (let k = 0; k < 2; k++) {
        const pulse = D2T.h(`<div class="rd-pulse" style="left:${T.x}px;top:${T.y}px"></div>`); fx.appendChild(pulse);
        anim(pulse, [{ transform: 'scale(.6)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).then(() => pulse.remove());
        await wait(180); if (!alive) return;
      }
      await anim(T.w, [{ transform: 'none' }, { transform: 'translateX(-3px)', offset: 0.2 }, { transform: 'translateX(3px)', offset: 0.4 }, { transform: 'translateX(-2px)', offset: 0.6 }, { transform: 'translateX(2px)', offset: 0.8 }, { transform: 'none' }], { duration: 420, fill: 'none' });
      if (!alive) return;
      await wait(650); if (!alive) return;
      anim(x, [{ opacity: 1, transform: `translate(${T.x}px,${T.y}px) scale(.78) rotate(${(P.length + 2) * 45}deg)` }, { opacity: 0, transform: `translate(${T.x}px,${T.y}px) scale(1.6) rotate(${(P.length + 2) * 45}deg)` }], { duration: 260 }).then(() => x.remove());
      beam.remove();
      // 3. the strike: the badge comes in fast from the far touchline and stamps down on him
      const top = T.t, fromX = T.x < T.pw / 2 ? T.pw + 80 : -80;
      const rv = D2T.h(`<div class="se-pc-rival${opts.dark ? ' rd-dark' : ''}" style="left:${T.x}px;top:${T.y}px;z-index:3">${crest ? `<img src="${crest}" alt="">` : ''}</div>`);
      const clone = T.w.cloneNode(true);
      clone.style.cssText = `position:absolute;left:${T.l}px;top:${top}px;width:${T.wd}px;height:${T.ht}px;margin:0`;
      fx.appendChild(clone); fx.appendChild(rv); T.w.style.visibility = 'hidden';
      await anim(rv, [{ transform: `translate(${fromX - T.x}px,-40px) scale(2.2) rotate(-30deg)`, opacity: 0 }, { transform: `translate(${(fromX - T.x) * 0.35}px,-30px) scale(1.8) rotate(-10deg)`, opacity: 1, offset: 0.45 }, { transform: 'translate(0,-6px) scale(1.15)', opacity: 1, offset: 0.85 }, { transform: 'none', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (!alive) return;
      SND.play('land'); opts.onLanded && opts.onLanded();
      const shock = D2T.h(`<div class="rd-pulse rd-white" style="left:${T.x}px;top:${T.y}px"></div>`); fx.appendChild(shock);   // the stamp's shock ring stays white
      anim(shock, [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 450, easing: 'ease-out' }).then(() => shock.remove());
      anim(pitch, [{ transform: 'none' }, { transform: 'translateY(3px)', offset: 0.3 }, { transform: 'none' }], { duration: 260, fill: 'none' });
      // 4. he is pulled into the badge
      SND.play('playerOut');
      await anim(clone, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.25 }, { transform: 'scale(.1) rotate(25deg)', opacity: 0 }], { duration: 460, easing: 'cubic-bezier(.6,0,.9,.4)' });
      if (!alive) return;
      clone.remove();
      // 5. his shirt is left empty; the badge lifts and flies off with him
      tsl && tsl.classList.remove('rd-tint');
      opts.onEmpty && opts.onEmpty();
      const nsl = slotOf(slot), fresh = nsl && nsl.firstElementChild; if (fresh) anim(fresh, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
      SND.play('pass');
      await anim(rv, [{ transform: 'none' }, { transform: 'translateY(-14px) scale(1.1)', offset: 0.3 }, { transform: `translate(${fromX > 0 ? 90 : -90}px,-200px) scale(.4) rotate(${fromX > 0 ? 25 : -25}deg)`, opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.5,0,.8,.3)' });
      if (!alive) return;
      rv.remove();
      await anim(wash, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
      if (!alive) return;
      alive = false; fx.remove(); wash.remove(); pitch.classList.remove('rd-on', 'rd-dim');
    })();
    return { done, cancel };
  };

  // ---------- the Transfer News bar (Craig, 21 Oct; option A in design/prototype/raid-deadline.html) ----------
  // Full width, 50px, yellow: a black TRANSFER / NEWS tag on the left, the headline in black capitals always on two lines
  // broken at the word gap that makes them most even (never mid-word, never inside a name: names come with non-breaking
  // spaces), printed letter by letter once the lines are laid out (28 ms a letter, 60 at a word gap, 200 ms after the
  // change; reduced motion: at once), stepping down to 10px if a line still overflows; on the right the count "n/3"
  // (dimmed while the hunt is on), none when `count` is false. say(text, { n, dim }).
  SE.newsBar = ({ count = true } = {}) => {
    // hidden until its first headline; then it wipes in left to right over a second (Craig, 25 Oct), the black tag
    // first, and that headline prints once the wipe is done; later headlines never wipe; `still` (a refresh's last deal)
    // and reduced motion show it at once
    const el = D2T.h(`<div class="se-news se-nb-wait" role="status" aria-label="Transfer news"><b class="se-nb-tag"><span>Transfer</span><span>News</span></b><div class="se-nb-view"><span class="se-nb-text"></span></div>${count ? '<b class="se-nb-count"></b>' : ''}</div>`);
    const tx = el.querySelector('.se-nb-text'), ct = el.querySelector('.se-nb-count');
    let timers = [], shown = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const say = (text, o = {}) => {
      clear();
      if (ct) { ct.textContent = `${o.n == null ? 0 : o.n}/${o.of == null ? 3 : o.of}`; ct.classList.toggle('is-dim', !!o.dim); }
      tx.style.fontSize = ''; tx.style.letterSpacing = '';
      tx.innerHTML = String(text).split(' ').map((w) => `<span class="w">${[...w].map((ch) => `<i>${D2T.esc(ch)}</i>`).join('')}</span>`).join(' ');
      const fit = () => {
        tx.querySelectorAll('br').forEach((b) => b.remove());
        const ws = [...tx.querySelectorAll('.w')]; if (ws.length < 2) return 0;
        const wd = ws.map((w) => w.getBoundingClientRect().width), sp = 4, tot = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
        let best = 1, bd = 1e9, acc = 0;
        for (let i = 1; i < ws.length; i++) { acc += wd[i - 1] + (i > 1 ? sp : 0); const d = Math.abs(acc - (tot - acc - sp)); if (d < bd) { bd = d; best = i; } }
        ws[best].before(document.createElement('br'));
        return Math.max(...ws.map((w) => w.getBoundingClientRect().right)) - tx.parentNode.getBoundingClientRect().right;
      };
      // too wide for two lines at 11px: 10px, then 9px with the letter-spacing eased (320px phones)
      // the size follows the phone (CSS clamp); too wide for two lines: 90% of it, then 80% with the letter-spacing eased
      const base = parseFloat(getComputedStyle(tx).fontSize) || 11;
      if (fit() > 0) { tx.style.fontSize = `${(base * 0.9).toFixed(1)}px`; if (fit() > 0) { tx.style.fontSize = `${(base * 0.8).toFixed(1)}px`; tx.style.letterSpacing = '.04em'; fit(); } } else tx.style.letterSpacing = '';
      const cs = [...tx.querySelectorAll('i')];
      let wait = 200;
      if (!shown) {
        shown = true; el.classList.remove('se-nb-wait');
        if (!o.still && !D2T.reduced()) { el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1000, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); wait = 1000; }
      }
      if (D2T.reduced() || o.still) { cs.forEach((c) => c.classList.add('on')); return; }
      let k = 0;
      const type = () => { if (k >= cs.length || !el.isConnected) return; cs[k].classList.add('on'); const gap = cs[k + 1] && cs[k + 1].parentNode !== cs[k].parentNode; k++; timers.push(setTimeout(type, gap ? 60 : 28)); };
      timers.push(setTimeout(type, wait));
    };
    return { el, say, stop: clear };
  };
  // the headlines: {club} the buying club, {you} your club's name, {surname} everything after his first name; a rumour as
  // the sweep starts, the deal as the badge lands; the variants cycle from a seeded start so the same never comes twice
  // in a row; names never break across the two lines (non-breaking spaces)
  const NB = (t) => String(t).replace(/ /g, ' ');
  const RUMOURS = [(c, y) => `${c} are eyeing a ${y} star`, (c, y) => `${c} scouts watching ${y} closely`, (c, y) => `${c} plot a raid on ${y}`, (c, y) => `${c} make an enquiry to ${y}`];
  const DEALS = [(c, y, p) => `${c} sign ${p} for an undisclosed fee`, (c, y, p) => `${p} leaves ${y} for ${c}`, (c, y, p) => `${c} snap up ${y}'s ${p}`];
  const hashOf = (str) => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  SE.raidWords = (k = 0) => {
    const e = GAME.eng(), you = NB(GAME.mode() === 'clubx' ? GAME.xName() : (GAME.clubName() || 'us')), start = hashOf(e ? e.seed : '');
    const surname = (n) => { const parts = String(n || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; };
    return {
      rumour: (club) => RUMOURS[(start + k) % RUMOURS.length](NB(club), you),
      deal: (club, name) => DEALS[(start + k) % DEALS.length](NB(club), you, NB(surname(name)))
    };
  };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('.se-home')) D2T.runMenu(); });
})();
