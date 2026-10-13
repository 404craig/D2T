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
  SE.emptyShirt = (pos, w) => `<div class="se-empty" style="width:${w}px;height:${Math.round(w * 1.3)}px" aria-label="Empty ${pos} shirt"><span>${pos}</span></div>`;

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


  // ---------- the home button in a run (Craig, 13 Oct) ----------
  // Every in-run screen keeps a home button at the bottom right (main buttons sit to its left). Mid-run it opens a menu:
  // Keep playing, Restart the game (a new run of the same mode from the start), Home (the run is saved) or Quit (thrown
  // away). A Daily offers Keep playing, Restart (a fresh go at today's Daily) and Home. Before a club is picked, or once the run is over,
  // it simply goes home.
  // a greyed back button where there is nowhere to go back to (Craig, 13 Oct): it keeps the main button centred
  SE.backOff = () => `<button class="icon-btn se-off" type="button" disabled aria-hidden="true" tabindex="-1">${D2T.ICON.back}</button>`;
  SE.homeBtn = () => `<button class="icon-btn se-home" type="button" aria-label="Home">${D2T.ICON.home}</button>`;
  D2T.runMenu = () => {
    const r = D2T.state.run, G = D2T.game, e = r && r.eng;
    if (!e || !e.seasonKey || e.phase === 'summary' || r.recorded) { D2T.go('home'); return; }
    const daily = !!r.daily, mode = G.mode(), name = G.modeName(mode);
    const lead = daily ? 'Home keeps this go for later, any time before midnight. Restart throws it away and starts a fresh go. Your best go today is the one that counts.'
      : `Home keeps this run for later. Restart throws it away and starts a new ${name} run. Quit throws it away. Nothing is recorded.`;
    const sh = D2T.sheet({ title: 'Leave the game?', body: `<p class="fr-lead">${lead}</p>
      <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-k="keep">Keep playing</button><button class="btn btn-ghost fr-btn-wide" data-k="restart">Restart the game</button><button class="btn btn-ghost fr-btn-wide" data-k="home">Home, save the ${daily ? 'Daily' : 'run'}</button>${daily ? '' : '<button class="btn btn-ghost fr-danger fr-btn-wide" data-k="quit">Quit the run</button>'}</div>` });
    const on = (k, fn) => { const b = sh.body.querySelector(`[data-k="${k}"]`); if (b) b.onclick = () => { sh.close(); fn(); }; };
    on('keep', () => {});
    on('home', () => D2T.go('home'));
    on('restart', () => { if (daily) { G.restartDaily(); D2T.go(G.stepFor() || 'table'); return; } G.newRun(mode); D2T.go('spin'); });
    on('quit', () => { D2T.state.run = null; D2T.save(); D2T.go('home'); });
  };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('.se-home')) D2T.runMenu(); });
})();
