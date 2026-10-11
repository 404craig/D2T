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

})();
