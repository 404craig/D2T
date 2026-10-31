// Small motions (Craig, 31 Oct, build 196; design/prototype/anim-polish.html on the design branch): numbers that roll
// like an odometer, a white glint, and one rule for all of them: each plays once, never blocks a tap, a tap anywhere
// jumps every running one to its end, and with reduced motion the final values are there at once.
(function () {
  const D2T = window.D2T;
  const live = new Set();
  const still = () => (D2T.reduced ? D2T.reduced() : false);
  // a running motion is anything with finish(); finish() must leave the element in its final state
  const track = (m) => { live.add(m); return m; };
  const untrack = (m) => live.delete(m);
  const finishAll = () => { [...live].forEach((m) => { try { m.finish(); } catch (e) { /* gone */ } }); };
  // a tap jumps them all to the end; it never stops the tap itself
  document.addEventListener('pointerdown', finishAll, true);

  // "+20", "-3", "1st", "40%", "8-": a sign, a number and a suffix; anything else ("-") just appears
  function parse(v) {
    const m = String(v).match(/^([+\-]?)(\d+)(.*)$/);
    return m ? { sign: m[1], n: +m[2], suf: m[3] } : null;
  }
  const ORD = /^(st|nd|rd|th)$/;

  // the odometer: each step slides up out of a clipped box and the next slides up from below. from: the start (0, or
  // 20 for a finish), dur, delay; the steps follow an ease-out cubic, at most 14 of them, so a big number still rolls.
  // Built once as a column of the values in one clipped box and moved by one transform animation (Fable's review, 31 Oct,
  // build 198: a span per step laid the page out every frame); finish() jumps it to the end.
  function odometer(el, to, o = {}) {
    if (!el) return null;
    const p = parse(to);
    if (!p || still()) { el.textContent = String(to); return null; }
    const ord = ORD.test(p.suf);
    const fmt = (n) => (n === 0 && !ord ? '0' + p.suf : ord ? D2T.ordinal(n) : p.sign + n + p.suf);
    const from = o.from != null ? o.from : ord ? Math.max(p.n, 20) : 0;
    if (from === p.n) { el.textContent = String(to); return null; }
    const dur = o.dur || 950, delay = o.delay || 0;
    const N = Math.min(Math.abs(p.n - from), 14), vals = [];
    for (let k = 0; k <= N; k++) vals.push(k === N ? String(to) : fmt(Math.round(from + (p.n - from) * (k / N))));
    const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    // its own element names, so no screen's span rules (home's shield label, for one) reach inside it
    el.innerHTML = `<d2t-odo class="mo-odo" style="height:${lh}px"><d2t-col class="mo-col">${vals.map((v) => `<d2t-v style="height:${lh}px;line-height:${lh}px">${v}</d2t-v>`).join('')}</d2t-col></d2t-odo>`;
    const col = el.querySelector('.mo-col');
    // a keyframe for each value at its ease-out time (the time at which an ease-out cubic reaches it)
    const kf = vals.map((_, k) => ({ offset: 1 - Math.cbrt(1 - k / N), transform: `translateY(${(-k * lh).toFixed(2)}px)`, easing: 'ease-out' }));
    const a = col.animate(kf, { duration: dur, delay, fill: 'both' });
    let done = false;
    const m = track({
      finish() { if (done) return; done = true; untrack(m); try { a.cancel(); } catch (e) { /* gone */ } el.textContent = String(to); if (o.done) o.done(); },
    });
    a.finished.catch(() => {}).then(() => m.finish());
    return m;
  }

  // the glint: a white diagonal sweep (rotated 18deg, blended as overlay), clipped to the element it runs over
  function glint(el, o = {}) {
    if (!el || still()) return null;
    const g = document.createElement('i'); g.className = 'mo-glint'; g.setAttribute('aria-hidden', 'true');
    const timer = setTimeout(() => {
      if (!el.isConnected) { untrack(m); return; }
      el.appendChild(g);
      g.animate([{ transform: 'translateX(-120%) rotate(18deg)' }, { transform: 'translateX(120%) rotate(18deg)' }], { duration: o.dur || 500, easing: 'ease-in-out' })
        .finished.catch(() => {}).then(() => m.finish());
    }, o.delay || 0);
    const m = track({ finish() { clearTimeout(timer); g.remove(); untrack(m); } });
    return m;
  }

  // a Web Animation that a tap jumps to its end
  function anim(el, kf, opts) {
    if (!el || still()) return null;
    const a = el.animate(kf, opts);
    const m = track({ finish() { try { a.finish(); } catch (e) { /* gone */ } untrack(m); } });
    a.finished.catch(() => {}).then(() => untrack(m));
    return a;
  }
  // timers that a tap runs at once (in order), so a sequence ends where it would have
  function later(fn, ms) {
    if (still()) { fn(); return null; }
    const t = setTimeout(() => { untrack(m); fn(); }, ms);
    const m = track({ finish() { clearTimeout(t); untrack(m); fn(); } });
    return m;
  }

  // what an odometer shows before it rolls: 0 (keeping the sign and suffix), a finish from 20th; anything else as it is
  function startText(v) {
    const p = parse(v); if (!p) return String(v);
    return ORD.test(p.suf) ? D2T.ordinal(Math.max(p.n, 20)) : '0' + p.suf;   // a zero start has no sign (no "+0", "-0")
  }
  D2T.mo = { startText, still, track, untrack, finishAll, parse, odometer, glint, anim, later, live: () => live.size };
})();
