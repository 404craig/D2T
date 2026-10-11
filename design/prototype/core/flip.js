// D2T card flip: D2T.cards.openLarge(fromEl, html, opts) lifts a small card from its on-screen rect,
// spins it one full turn around the Y axis (D2T back visible mid-turn) while it grows to a large card
// front and centre, with a dark scrim behind. Tap anywhere to play the exact reverse back into the slot.
// opts: { w (large width, default 280), below (html under the big card), onClose }
// Returns { close }.
(function () {
  const D2T = window.D2T = window.D2T || {};
  let uid = 0;

  // easing
  const outBack = (t, c1) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  // move and scale: eases out with a small overshoot settle (about 4 percent)
  const moveEase = (t) => outBack(t, 0.75);
  // rotation: gentle start, fastest through the middle of the turn, small overshoot as it lands
  const rotEase = (t) => outBack(Math.pow(t, 1.55), 0.55);
  // scrim
  const scrimEase = (t) => 1 - Math.pow(1 - t, 2);

  function backFace(w) {
    return `<div class="d2c sp-back" style="--w:${w}px" aria-hidden="true"><div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span>
      <div class="sp-back-edge"></div><div class="sp-back-mark">${D2T.logo('emblem', { label: '' })}</div><span class="sp-back-word">DROP2TOP</span></div></div>`;
  }

  function openLarge(fromEl, html, opts = {}) {
    const host = document.getElementById('app');
    const W = opts.w || 280, H = Math.round(W * 1.667);
    const id = 'spf' + (++uid);
    const reduced = D2T.reduced();
    const ov = D2T.h(`<div class="card-overlay sp-ov" role="dialog" aria-label="Card">
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" x="-40%" y="-20%" width="180%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
      <div class="sp-ov-scrim"></div>
      <div class="sp-ov-blur"><div class="sp-ov-stage"><div class="sp-flip" style="width:${W}px;height:${H}px;left:${-W / 2}px;top:${-H / 2}px">
        <div class="sp-face is-front">${html}</div><div class="sp-face is-back">${backFace(W)}</div></div></div></div>
      ${opts.below ? `<div class="sp-ov-below">${opts.below}</div>` : ''}
      <div class="sp-ov-hint">Tap to put it back</div></div>`);
    host.appendChild(ov);
    const scrim = ov.querySelector('.sp-ov-scrim'), blurBox = ov.querySelector('.sp-ov-blur'), flip = ov.querySelector('.sp-flip');
    const below = ov.querySelector('.sp-ov-below'), hint = ov.querySelector('.sp-ov-hint');
    const gauss = ov.querySelector('feGaussianBlur');

    // geometry: where the small card is, where the big card ends up (both relative to the app frame centre)
    const appR = host.getBoundingClientRect();
    const endY = () => {
      const bh = below ? below.offsetHeight + 22 : 0;
      return Math.round((appR.height - H - bh) / 2 + H / 2) - appR.height / 2 + (opts.yShift || 0);
    };
    const measure = () => {
      const r = fromEl.getBoundingClientRect();
      return { x: r.left + r.width / 2 - appR.left - appR.width / 2, y: r.top + r.height / 2 - appR.top - appR.height / 2, s: r.width / W };
    };
    let from = measure();
    const ey = endY();
    if (below) below.style.top = `${appR.height / 2 + ey + H / 2 + 22}px`;
    fromEl.style.visibility = 'hidden';

    let raf = 0, closed = false, busy = true, lastA = 0, lastT = 0;
    const paint = (t) => {
      const m = moveEase(t), a = 360 * rotEase(t);
      const x = from.x * (1 - m), y = from.y + (ey - from.y) * m, s = from.s + (1 - from.s) * m;
      flip.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s}) rotateY(${a}deg)`;
      scrim.style.opacity = scrimEase(clamp01(t * 1.6));
      if (below) { const b = clamp01((t - 0.72) / 0.28); below.style.opacity = b; below.style.transform = `translateY(${(1 - b) * 10}px)`; }
      hint.style.opacity = clamp01((t - 0.85) / 0.15) * 0.9;
    };
    const blurTo = (sd) => {
      if (sd < 0.35) { if (blurBox.style.filter) { blurBox.style.filter = ''; gauss.setAttribute('stdDeviation', '0 0'); } return; }
      gauss.setAttribute('stdDeviation', `${sd.toFixed(1)} 0`);
      if (!blurBox.style.filter) blurBox.style.filter = `url(#${id})`;
    };
    // run t from a to b over ms, blur from angular speed, then done()
    const run = (a, b, ms, done) => {
      const t0 = performance.now(); lastA = 360 * rotEase(a); lastT = t0;
      const step = (now) => {
        const k = clamp01((now - t0) / ms), t = a + (b - a) * (ms ? k : 1);
        paint(t);
        const ang = 360 * rotEase(t), dt = Math.max(1, now - lastT);
        const degPerMs = Math.abs(ang - lastA) / dt; lastA = ang; lastT = now;
        // apparent horizontal smear: angular speed times the visible width of the turning face
        blurTo(degPerMs * 10 * Math.max(0.25, Math.abs(Math.cos(ang * Math.PI / 180))));
        if (k < 1) raf = requestAnimationFrame(step); else { blurTo(0); done && done(); }
      };
      raf = requestAnimationFrame(step);
    };

    if (reduced) {
      paint(1); flip.style.transform = `translate3d(0, ${ey}px, 0)`; ov.style.opacity = '0'; ov.style.transition = 'opacity .2s';
      requestAnimationFrame(() => { ov.style.opacity = '1'; setTimeout(() => { busy = false; }, 200); });
    } else {
      paint(0);
      run(0, 1, 800, () => { busy = false; });
    }

    const close = () => {
      if (closed || busy) return;
      closed = true; busy = true;
      cancelAnimationFrame(raf);
      const finish = () => { ov.remove(); fromEl.style.visibility = ''; opts.onClose && opts.onClose(); };
      if (reduced) { ov.style.opacity = '0'; setTimeout(finish, 200); return; }
      from = measure(); // the slot may have moved or scaled while the big card was open
      run(1, 0, 640, finish);
    };
    ov.addEventListener('click', close);
    return { close, el: ov };
  }

  D2T.cards.openLarge = openLarge;
})();
