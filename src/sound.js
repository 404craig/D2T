/* DROP2TOP sound: Craig's Classic picks (13 Oct 2026), from the Classic sound kit
   (claude.ai/artifact/5K8i5k3cEhWwVX1pDNbr4P; picks and notes in audio/CLASSIC_SOUND_PICKS.md).
   Rules: soft, subtle and quiet; no glass or tin (no bells, chimes, pings or metal clinks); small actions are muted.
   Recorded clips (window.D2T_SOUNDS, softened ElevenLabs files from audio/game) plus small synth cues made here.
   The audio context starts on the first tap (iPhones refuse sound before one) and every call is safe to make before
   then, when muted, or where Web Audio is missing. Back from another app it is revived on the next tap (see revive). */
(function (root) {
"use strict";
const MIX = { master: 0.85, bed: 0.9, verb: 0.25 };
let ctx = null, master, fx, bedBus, verbIn, quietIn, noiseBuf, buffers = {}, muted = false, bed = null, bedOn = false, started = {};

function init() {
  if (ctx) return ctx;
  const AC = root.AudioContext || root.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const c = ctx; c.onstatechange = () => { if (c === ctx && c.state === "running" && bedOn && !bed) crowd(true); };
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
  master = ctx.createGain(); master.gain.value = muted || document.hidden ? 0 : MIX.master; master.connect(lim); lim.connect(ctx.destination);
  // everything passes a gentle top cut, so nothing is bright or tinny
  const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 7000; tone.Q.value = 0.5; tone.connect(master);
  fx = ctx.createGain(); fx.connect(tone);
  bedBus = ctx.createGain(); bedBus.gain.value = MIX.bed; bedBus.connect(master);
  // muted actions (back, tabs, panels, tips, card picks): low-passed and capped, so they stay soft at any volume
  quietIn = ctx.createGain(); const qlp = ctx.createBiquadFilter(), qout = ctx.createGain();
  qlp.type = "lowpass"; qlp.frequency.value = 1800; qout.gain.value = 0.19; quietIn.connect(qlp); qlp.connect(qout); qout.connect(master);
  // a small stadium-ish room
  verbIn = ctx.createGain();
  const verb = ctx.createConvolver(), verbOut = ctx.createGain(), sr = ctx.sampleRate, len = Math.floor(sr * 1.8), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / sr, k = 0.35 + 0.6 * Math.exp(-t * 2.2); lp += k * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * 3.4); } }
  verb.buffer = b; verbOut.gain.value = MIX.verb * 1.1;
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
  noiseBuf = ctx.createBuffer(1, sr * 2, sr);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}
function dataToBuf(uri) {
  const b64 = uri.slice(uri.indexOf(",") + 1), bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
// a decoded clip lands in the map (only for the context that asked); the crowd bed starts as soon as its loop is in
function decode(k, raw) {
  const c = ctx, got = buf => { if (c !== ctx) return; buffers[k] = buf; if (k === "crowd_loop" && bedOn && !bed) crowd(true); };
  try { const p = c.decodeAudioData(raw, got, () => {}); if (p && p.then) p.then(got, () => {}); } catch (e) { /* that clip stays silent */ }
}
// decodes every clip not started yet: the clips arrive at the end of the page, so this runs again when they land
// One clip a task, after the tap that asked (Fable's review, 30 Oct: reading every clip at once held the first tap for
// 140 ms on a slow phone); a context thrown away meanwhile stops its queue, its successor starts its own
function decodeAll() {
  if (!ctx) return;
  const src = root.D2T_SOUNDS || {}, c = ctx, keys = Object.keys(src).filter(k => !started[k]);
  keys.forEach(k => { started[k] = 1; });
  const next = () => { if (c !== ctx || !keys.length) return; const k = keys.shift(); decode(k, dataToBuf(src[k])); if (keys.length) setTimeout(next, 0); };
  if (keys.length) setTimeout(next, 0);
}
function unlock() {
  if (!init()) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  decodeAll(); decodeReveal();
}
// a silent sample started inside a tap is what unlocks (and re-unlocks) sound on iPhones
function blip() { try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0); } catch (e) { /* nothing to unlock */ } }
// Back from another app, iPhones leave the context "interrupted" or "suspended" (resume() only works inside a tap, and
// only the events that count as one: touchend, pointerup, click, keydown), or "running" with its clock stopped and no
// sound. So on every such tap: resume and blip; if a tap 0.8 s or more later still finds it not running, or running
// with the clock where it was, throw it away and build a new one (graph, clips and the crowd bed if it was on).
let asked = 0, built = 0, seen = { t: -1, at: 0 };
function revive() {
  if (!init()) return; const now = Date.now();
  if (ctx.state === "running") {
    if (ctx.currentTime === seen.t && now - seen.at > 300 && now - built > 3000) rebuild(); else seen = { t: ctx.currentTime, at: now };
    asked = 0;
  } else if (asked && now - asked > 800 && now - built > 3000) rebuild();
  else { asked = now; ctx.resume().catch(() => {}); blip(); }
  decodeAll(); decodeReveal();
}
function rebuild() {
  const old = ctx; ctx = null; bed = null; buffers = {}; started = {}; asked = 0; built = Date.now(); seen = { t: -1, at: 0 };
  try { old.close().catch(() => {}); } catch (e) { /* already gone */ }
  if (!init()) return;
  ctx.resume().catch(() => {}); blip(); decodeAll(); decodeReveal();
}
// the master follows mute and the page being hidden: the context is never suspended by hand, since an iPhone will not
// resume one that was, and this keeps the crowd quiet in the background on Android
function level() { if (ctx) master.gain.setTargetAtTime(muted || document.hidden ? 0 : MIX.master, ctx.currentTime, 0.03); }
function wake() { if (!ctx) return; if (!document.hidden && ctx.state !== "running") ctx.resume().catch(() => {}); level(); seen = { t: ctx.currentTime, at: Date.now() }; }
// The rare card reveal's clips (Craig, 13 Oct; design/prototype/rare-reveal-v3.html): files in audio/reveal, never in
// the page, fetched once home is up (core/boot.js) so they never slow the start. Until they are in, the reveal is silent.
// The glass smash is Craig's one exception to the no glass rule, for the rare reveal only.
const REVEAL = ["glass_smash", "crowd_long", "fireworks_long", "swoosh_up", "thud_low", "tick_wood", "tick_mech"];
let revealAsked = false; const revealRaw = {};
function loadReveal(base = "audio/reveal/") {
  // a copy opened from disk (file://) cannot fetch: the reveal plays silently there
  if (revealAsked || typeof fetch !== "function" || (root.location && root.location.protocol === "file:")) return; revealAsked = true;
  REVEAL.forEach(k => fetch(base + k + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).then(b => { if (b) { revealRaw[k] = b; decodeReveal(); } }).catch(() => {}));
}
// the raw files are kept (decoding takes a copy) so a rebuilt context can decode them again
function decodeReveal() {
  if (!ctx) return;
  Object.keys(revealRaw).forEach(k => { if (started["rv_" + k]) return; started["rv_" + k] = 1; decode("rv_" + k, revealRaw[k].slice(0)); });
}
// one reveal clip: o.gain, o.rate, o.lp (a low-pass in Hz), o.fadeIn, and o.raw, which skips the top cut and goes
// straight to the master (the glass, crowd and fireworks); the master volume and mute still apply. Returns { stop(fade) }.
function reveal(id, o = {}) {
  if (!ok()) return null;
  const buf = buffers["rv_" + id]; if (!buf) return null;
  try {
    const t = ctx.currentTime + 0.01, src = ctx.createBufferSource(), g = ctx.createGain(), gain = o.gain == null ? 1 : o.gain;
    src.buffer = buf; src.playbackRate.value = o.rate || 1;
    if (o.fadeIn) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + o.fadeIn); } else g.gain.value = gain;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; src.connect(f); f.connect(g); } else src.connect(g);
    g.connect(o.raw ? master : fx); src.start(t);
    return { stop(fade = 0.6) { try { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0.0001, n + fade); src.stop(n + fade + 0.05); } catch (e) {} } };
  } catch (e) { return null; }
}
root.addEventListener("pointerdown", unlock, { capture: true, passive: true });
["touchend", "pointerup", "click", "keydown"].forEach(e => root.addEventListener(e, revive, { capture: true, passive: true }));
document.addEventListener("visibilitychange", wake);
root.addEventListener("pageshow", wake); root.addEventListener("focus", wake);

/* ---------- building blocks ---------- */
let QUIET = false;
function ok() { return ctx && ctx.state === "running" && !muted; }
const rnd = (a, b) => a + Math.random() * (b - a);
const vr = (amt = 0.025) => 1 + rnd(-amt, amt);          // small variation so repeats don't nag
const N = (n) => 293.66 * Math.pow(2, n / 12);           // semitones from D4 (everything sits in D major)
const D3 = N(-12), F3 = N(-9), Fs3 = N(-8), A3 = N(-5), D4 = N(0), A4 = N(7), D5 = N(12);
function O(gain = 1, send = 0.25) {
  const o = ctx.createGain(); o.gain.value = gain;
  if (QUIET) { o.connect(quietIn); return o; }
  o.connect(fx); const s = ctx.createGain(); s.gain.value = send; o.connect(s); s.connect(verbIn); return o;
}
function pan(dest, p) { if (!ctx.createStereoPanner || !p) return dest; const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(dest); return n; }
function env(dest, t, a, d, peak) { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g; }
function osc(dest, type, f, t, dur, peak, o = {}) {
  const s = ctx.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t);
  if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  s.connect(env(pan(dest, o.pan), t, o.a || 0.003, dur, peak)); s.start(t); s.stop(t + (o.a || 0.003) + dur + 0.05); return s;
}
function nz(dest, t, dur, o = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.type || "bandpass"; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f || 2000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  s.connect(f); f.connect(env(pan(dest, o.pan), t, o.a || 0.002, dur, o.peak || 0.4)); s.start(t, Math.random()); s.stop(t + (o.a || 0.002) + dur + 0.05);
}
function soft(dest, cut = 1600) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cut; f.connect(dest); return f; }
function swish(d, t, dur, from, to, pk = 0.25, o = {}) {       // air: swells to the middle, then away
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.1; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + dur * (o.peakAt || 0.55)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  let out = d; if (o.panFrom != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(o.panFrom, t); p.pan.linearRampToValueAtTime(o.panTo, t + dur); p.connect(d); out = p; }
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const thump = (d, t, f0 = 170, f1 = 50, dur = 0.12, pk = 0.6) => osc(d, "sine", f0 * vr(0.02), t, dur, pk, { to: f1, a: 0.002 });
const felt = (d, t, f = 220, pk = 0.4, dur = 0.09) => { const lp = soft(d, 900); osc(lp, "sine", f * vr(0.03), t, dur, pk, { to: f * 0.7, a: 0.004 }); nz(lp, t, 0.02, { type: "lowpass", f: 700, peak: pk * 0.25 }); };
const tap = (d, t, pk = 0.1, f = 260) => { const lp = soft(d, 1100); nz(lp, t, 0.018, { type: "lowpass", f: 900, peak: pk }); osc(lp, "sine", f * vr(0.04), t, 0.03, pk * 0.8); };
// a soft explosion (Craig, 14 Oct): a sub thump, a dark burst of air and a muffled crack, then a low rumble of tail
// seconds that dies away; everything under 1.2 kHz so it is felt more than heard, never bright
function boom(d, t, pk, tail) {
  const lp = soft(d, 1200);
  osc(lp, "sine", 110 * vr(0.03), t, 0.55, pk, { to: 32, glide: 0.5, a: 0.004 });
  nz(lp, t, 0.4, { type: "lowpass", f: 900, f2: 140, peak: pk * 0.55 });
  nz(lp, t, 0.035, { type: "lowpass", f: 1800, peak: pk * 0.22 });
  if (tail > 0.3) {   // the rumble swells in and dies on a slow curve, so it is still there near the end of the tail
    const g = ctx.createGain(), f = ctx.createBiquadFilter(), n = ctx.createBufferSource(), s = ctx.createOscillator(), sg = ctx.createGain(), end = t + tail + 0.3;
    f.type = "lowpass"; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(70, end); n.buffer = noiseBuf; n.loop = true;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk * 0.9, t + 0.14); g.gain.setTargetAtTime(0.0001, t + 0.3, tail / 5);
    s.frequency.setValueAtTime(46 * vr(0.04), t); s.frequency.exponentialRampToValueAtTime(30, end); sg.gain.value = 0.5;
    n.connect(f); s.connect(sg); sg.connect(f); f.connect(g); g.connect(d); n.start(t, Math.random()); s.start(t); n.stop(end); s.stop(end);
  }
}
function swell(d, t, dur) { swish(d, t, dur, 200, 3200, 0.16, { peakAt: 0.97 }); osc(soft(d, 2200), "triangle", D4, t, dur, 0.05, { to: D5, a: dur * 0.9 }); }
function pea(d, t, blasts = 1, len1 = 0.32) { let st = t; for (let b = 0; b < blasts; b++) { const L = blasts === 3 && b === 2 ? len1 * 2.4 : len1;
  const s = ctx.createOscillator(); s.frequency.value = 2900 * vr(0.01); const l = ctx.createOscillator(); l.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 230; l.connect(lg); lg.connect(s.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.22, st + 0.015); g.gain.setValueAtTime(0.22, st + L - 0.03); g.gain.linearRampToValueAtTime(0, st + L); s.connect(g); g.connect(d);
  s.start(st); l.start(st); s.stop(st + L + 0.02); l.stop(st + L + 0.02); nz(d, st, L, { f: 2900, q: 1, peak: 0.04 }); st += L + 0.22; } }
function clip(d, id, t, o = {}) {
  const buf = buffers[id]; if (!buf) return null;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = !!o.loop; src.playbackRate.value = (o.rate || 1) * (o.fixed ? 1 : vr(0.012));
  const g = ctx.createGain(); const gain = o.gain == null ? 1 : o.gain;
  if (o.fadeIn) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + o.fadeIn); } else g.gain.value = gain;
  if (o.dur) { g.gain.setValueAtTime(gain, t + Math.max(0.01, o.dur - 0.12)); g.gain.linearRampToValueAtTime(0.0001, t + o.dur); }
  src.connect(g); g.connect(d); src.start(t, o.offset || 0); if (o.dur) src.stop(t + o.dur + 0.02);
  return { stop(fade = 0.6) { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0.0001, n + fade); try { src.stop(n + fade + 0.02); } catch (e) {} } };
}
function duck(t, dur = 1.6, depth = 0.35) { if (!bedBus) return; const g = bedBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(MIX.bed * depth, t + 0.05); g.linearRampToValueAtTime(MIX.bed, t + dur); }
// bedOn remembers that a match wants the bed, so it starts once the context and the loop are ready (or after a rebuild)
function crowd(on) {
  bedOn = !!on;
  if (on && !ok()) return;
  if (on && !bed) bed = clip(bedBus, "crowd_loop", ctx.currentTime, { loop: true, fadeIn: 0.8, fixed: true });
  if (!on && bed) { bed.stop(0.8); bed = null; }
}

/* ---------- the cues: arg is the version (reel 0-2, card level 0-4, win/draw/loss 0-2, and so on) ---------- */
const QUIET_CUES = { tapSmall: 1, sheet: 1, tip: 1, cardSelect: 1, shirtFit: 1, dropCancel: 1 };
const CUES = {
  // around the game
  intro(t) { clip(O(1, 0.15), "logo_deep", t); },
  tap(t) { felt(O(1, 0.04), t, 260, 0.42); },
  tapSmall(t) { felt(O(1, 0), t, 200, 0.35, 0.06); },
  sheet(t, v) { const o = soft(O(1, 0), 1800); v ? swish(o, t, 0.2, 1600, 400, 0.22) : swish(o, t, 0.22, 400, 1800, 0.25); },
  cardZoom(t, v) { clip(O(1, 0.08), "card_slide", t, { gain: 0.55, rate: v ? 0.9 : 1.1, dur: 0.35 }); },
  denied(t) { const o = soft(O(1, 0.05), 1100); [0, 0.11].forEach((x, i) => { nz(o, t + x, 0.05, { f: 640 - i * 100, q: 5, peak: 0.16 }); osc(o, "sine", 180 - i * 25, t + x, 0.07, 0.12); }); },
  tip(t) { osc(soft(O(1, 0), 2200), "sine", 420, t, 0.07, 0.2, { to: 760, glide: 0.05 }); },
  // club spin and transfer reels
  spinStart(t) { const o = O(1, 0.08); felt(o, t, 150, 0.4, 0.12); swish(soft(o, 1500), t, 0.3, 300, 1200, 0.12); },
  reelLand(t, v = 0) { const o = O(1, 0.08); felt(o, t, [145, 160, 178][v] || 160, 0.45, 0.1); tap(o, t, 0.08, [200, 220, 245][v] || 220); },
  cardSelect(t, v) { osc(soft(O(1, 0.05), 1600), "sine", v ? 520 : 380, t, 0.08, 0.2, { to: v ? 380 : 520 }); },
  respin(t) { const o = O(1, 0.06); for (let i = 0; i < 9; i++) tap(o, t + i * 0.034 * (1 - i * 0.04), 0.07, 300 - i * 12); swish(soft(o, 1600), t, 0.35, 1500, 350, 0.06); },
  clubConfirm(t) { const o = O(1, 0.08); tap(o, t, 0.07, 220); felt(o, t + 0.01, 150, 0.25, 0.1); clip(o, "cheer_short", t + 0.12, { gain: 0.45 }); },
  clubReveal(t) { const o = O(1, 0.15); felt(o, t, 140, 0.45, 0.2); swish(soft(o, 1600), t, 0.4, 1600, 400, 0.1); },
  // table reveal
  tableScan(t, i = 0) { tap(O(1, 0.04), t, 0.09, 280 - i * 5); },
  tableLand(t) { clip(O(1, 0.2), "doom_boom", t); },
  tableReset(t) { const o = O(1, 0.1); for (let i = 0; i < 18; i++) { const x = 1 - Math.pow(1 - i / 18, 1 / 2.4); tap(o, t + x * 1.25, 0.075 * (1 - i / 30), 300 - i * 6); } swish(soft(o, 1400), t, 1.3, 1200, 300, 0.07, { peakAt: 0.3 }); },
  // squad
  dealPitch(t) { const o = soft(O(1, 0.08), 2600); for (let i = 0; i < 11; i++) nz(o, t + i * 0.04, 0.03, { f: 1500 * vr(0.08), q: 1.2, peak: 0.1, pan: -0.5 + i * 0.1 }); felt(O(1, 0.05), t + 0.45, 170, 0.3, 0.1); },
  shirtFit(t, v = 0) { osc(soft(O(1, 0), 1400), "sine", [N(12), N(7), N(0) * 0.95][v] || N(7), t, 0.08, 0.2); },
  cardDrop(t) { const o = O(1, 0.1); felt(o, t, 190, 0.4, 0.08); swish(soft(o, 1800), t + 0.02, 0.18, 600, 1600, 0.1); },
  dropCancel(t) { swish(soft(O(1, 0), 1800), t, 0.2, 1800, 500, 0.15); },
  formation(t) { const o = soft(O(1, 0.08), 2200); for (let i = 0; i < 7; i++) swish(o, t + i * 0.05, 0.16, 700 * vr(0.1), 2000, 0.06, { panFrom: -0.5 + i * 0.16, panTo: -0.5 + i * 0.16 }); tap(O(1, 0.04), t + 0.45, 0.08); },
  // match day
  fixtures(t) { const o = O(1, 0.04); for (let i = 0; i < 10; i++) tap(o, t + i * 0.04, 0.07, 300 - i * 8); },
  kickoff(t) { pea(soft(O(0.55, 0.2), 2800), t, 1); crowd(true); },
  goal(t) { const o = O(1, 0.2); duck(t, 3); felt(o, t, 240, 0.35, 0.1); clip(o, "net_ripple", t + 0.1, { gain: 0.9 }); react(clip(o, "goal_roar", t + 0.35)); },
  conceded(t) { const o = O(1, 0.2); duck(t, 4.5); react(clip(o, "groan", t)); react(clip(o, "boos", t + 0.9, { gain: 0.9, dur: 4.2 })); },
  halftime(t) { clip(O(1, 0.15), "whistle_two", t); },
  // the final whistle fades out any goal reaction still going (Craig, 14 Oct: a late goal's boos carried over the win's cheer)
  fulltime(t) { hush(0.5); clip(O(1, 0.15), "whistle_three", t); },
  skip(t) { const o = O(1, 0.06); let x = 0; for (let i = 0; i < 14; i++) { tap(o, t + x, 0.06, 220 + i * 8); x += 0.06 * Math.pow(0.86, i); } swish(soft(o, 1800), t + x - 0.1, 0.3, 500, 1800, 0.08); },
  result(t, v = 0) { const o = O(1, 0.2); if (v === 0) { clip(o, "cheer_short", t, { gain: 0.9 }); clip(o, "applause", t + 0.6, { gain: 0.8 }); } else if (v === 1) clip(o, "applause", t, { gain: 0.8, dur: 2 }); else clip(o, "crowd_moan", t); },
  tableMove(t, v = 2) { const o = O(1, 0.06); if (v === 2) return tap(o, t, 0.07); v === 0 ? swish(soft(o, 1800), t, 0.25, 500, 1800, 0.1) : swish(soft(o, 1800), t, 0.25, 1800, 400, 0.1); tap(o, t + 0.25, 0.06); },
  // transfer window
  windowOpen(t) { const o = O(1, 0.3); const lp = soft(o, 2400); swish(lp, t, 0.64, 250, 2200, 0.12, { panFrom: -0.3, panTo: 0.3 }); osc(lp, "triangle", 220, t, 0.64, 0.035, { to: 660 }); felt(o, t + 0.79, 140, 0.4, 0.2); [D3, A3, D4].forEach((n) => osc(soft(o, 1100), "triangle", n, t + 0.79, 1.1, 0.035, { a: 0.06 })); },
  rarity(t, v = 0) { const o = O(1, 0.25);
    if (v <= 0) felt(o, t, 180, 0.35, 0.08);
    else if (v === 1) { felt(o, t, 180, 0.3, 0.07); osc(soft(o, 1100), "triangle", A3, t, 0.5, 0.05, { a: 0.02 }); }
    else if (v === 2) { felt(o, t, 170, 0.35, 0.09); [D3, Fs3, A3].forEach((n) => osc(soft(o, 1100), "triangle", n, t, 0.9, 0.035, { a: 0.03 })); }
    else if (v === 3) { felt(o, t, 150, 0.4, 0.14); swish(soft(o, 1400), t, 0.6, 250, 1200, 0.1); [D3, Fs3, A3, D4].forEach((n) => osc(soft(o, 1100), "triangle", n, t, 1.4, 0.035, { a: 0.05 })); }
    else { duck(t, 3, 0.4); felt(o, t, 130, 0.45, 0.22); swish(soft(o, 1400), t, 0.9, 200, 1300, 0.12); [D3, Fs3, A3, D4, N(4)].forEach((n) => osc(soft(o, 1200), "triangle", n, t, 2.0, 0.035, { a: 0.12 })); clip(o, "applause", t + 0.3, { gain: 0.6, dur: 2.5 }); } },
  trayDrop(t) { const o = O(1, 0.1); [0, 0.06, 0.12].forEach((x, i) => felt(pan(o, -0.4 + i * 0.4), t + x, 170, 0.3, 0.07)); },
  sign(t, v = 2) { const o = O(1, 0.15); clip(o, "stamp", t, { gain: 0.9 }); if (v >= 1) clip(o, "cheer_short", t + 0.15, { gain: 0.35 + v * 0.12 }); if (v >= 3) clip(o, "applause", t + 0.5, { gain: 0.7, dur: 2.2 }); },
  playerOut(t) { const o = O(1, 0.1); swish(soft(o, 1800), t, 0.35, 1800, 300, 0.12); osc(soft(o, 1000), "triangle", A4, t, 0.35, 0.045, { to: D4 }); },
  pass(t) { swish(soft(O(1, 0.06), 2000), t, 0.25, 800, 2200, 0.12, { panFrom: 0, panTo: 0.7 }); },
  // season end
  finishCount(t) { const o = soft(O(1, 0.12), 1200); let x = 0; for (let i = 0; i < 10; i++) { thump(o, t + x, 130, 60, 0.07, 0.18); x += 0.05 + 0.45 * Math.pow(i / 9, 2.6); } thump(o, t + x, 140, 40, 0.35, 0.45); },
  riseCount(t) { const o = soft(O(1, 0.12), 1200); const sc = [0, 2, 4, 7, 9, 12, 14, 16, 19]; sc.forEach((n, i) => osc(o, "triangle", N(n - 12), t + i * 0.07, 0.12, 0.05, { a: 0.01 })); felt(O(1, 0.1), t + sc.length * 0.07, 170, 0.4, 0.15); },
  achievement(t, v = 0) { const o = O(1, 0.1); felt(o, t, 150, 0.22, 0.1); [D3, Fs3, A3, D4].slice(0, v + 1).forEach((n, i) => osc(soft(o, 700), "triangle", n, t + 0.03 + i * 0.06, 0.5, 0.025, { a: 0.03 })); },
  champions(t) { const o = O(1, 0.2); clip(o, "trophy_fanfare", t); clip(o, "goal_roar", t + 0.3, { gain: 0.7 }); clip(o, "flares", t + 0.4, { gain: 0.7 }); clip(o, "air_horn", t + 1.2, { gain: 0.8 }); clip(o, "celebration", t + 2.0, { gain: 0.9 }); },
  top3(t) { const o = O(1, 0.2); clip(o, "cheer_short", t, { gain: 0.9 }); clip(o, "applause", t + 0.6, { gain: 0.8 }); },
  tophalf(t) { clip(O(1, 0.2), "applause", t, { gain: 0.9 }); },
  survived(t) { clip(O(1, 0.2), "applause", t, { gain: 0.7, dur: 2.5 }); },
  relegated(t) { const o = O(1, 0.2); clip(o, "stunned_silence", t); clip(o, "relegation_sting", t + 0.5, { gain: 0.9 }); clip(o, "boos", t + 2.8, { gain: 0.6 }); },
  share(t) { swish(soft(O(1, 0.1), 2000), t, 0.25, 500, 2000, 0.16); },
  // shared by the other games (Goal Rush, Unbeaten Run and anything new): the same soft family, nothing louder
  // Club X's card smashing the real club's off the screen: a boom and a rumble fading over about 2 s
  explode(t) { const o = O(1, 0.3); duck(t, 2.4, 0.4); boom(o, t, 0.22, 2.2); },
  // Goal Rush, as a placed player's number finishes rolling up to his goals: the same boom, short and punchy, no rumble
  // Goal Rush, as a placed player's goals fly up to the tally (Craig, 14 Oct, option 9 on the launch sound board): muffled taps
  // speeding up over the 0.64 s flight, like counting them in, and a soft felt tap as they land in the total
  countIn(t) { const o = O(1, 0.05); let x = 0, g = 0.085; for (let i = 0; i < 12 && x < 0.6; i++) { tap(o, t + x, 0.05, 260 + i * 12); x += g; g *= 0.86; } felt(o, t + 0.64, 190, 0.3, 0.08); },
  land(t) { const o = O(1, 0.08); felt(o, t, 160, 0.4, 0.1); tap(o, t, 0.06, 230); },
  numberTick(t) { tap(O(1, 0.03), t, 0.045, 300); },
  correct(t) { const o = O(1, 0.12); felt(o, t, 180, 0.3, 0.08); osc(soft(o, 1100), "triangle", D4, t, 0.4, 0.04, { a: 0.02 }); },
  close(t) { const o = soft(O(1, 0.12), 1000); osc(o, "triangle", A3, t, 0.35, 0.05, { a: 0.03 }); osc(o, "triangle", F3, t + 0.3, 0.7, 0.05, { a: 0.03 }); },
  over(t) { const o = O(1, 0.1); felt(o, t, 120, 0.4, 0.2); swish(soft(o, 1400), t, 0.4, 1400, 300, 0.08); },
  perfect(t) { const o = O(1, 0.25); felt(o, t, 130, 0.45, 0.22); swish(soft(o, 1400), t, 0.9, 200, 1300, 0.12); [D3, Fs3, A3, D4, N(4)].forEach((n) => osc(soft(o, 1200), "triangle", n, t, 2.0, 0.035, { a: 0.12 })); clip(o, "applause", t + 0.3, { gain: 0.6, dur: 2.5 }); },
  // the boo (Craig, 14 Oct): a 60,000 crowd, two ElevenLabs takes layered (audio/sfx/boos_60k_a and _b), let run to about 4 s
  // game results, the same crowd as Classic: a cheer for a win or a right answer, a groan for falling short, boos for over or wrong
  win(t) { const o = O(1, 0.2); duck(t, 3); felt(o, t, 240, 0.35, 0.1); clip(o, "goal_roar", t + 0.1, { gain: 0.9 }); clip(o, "applause", t + 1.2, { gain: 0.7 }); },
  short(t) { const o = O(1, 0.2); duck(t, 3); clip(o, "groan", t); clip(o, "crowd_moan", t + 1.3, { gain: 0.7 }); },
  bust(t) { const o = O(1, 0.2); duck(t, 4.2); clip(o, "boos", t, { gain: 1, dur: 4.2 }); clip(o, "groan", t + 0.1, { gain: 0.6 }); },
  right(t) { const o = O(1, 0.15); felt(o, t, 180, 0.3, 0.08); osc(soft(o, 1100), "triangle", D4, t, 0.4, 0.04, { a: 0.02 }); clip(o, "cheer_short", t + 0.05, { gain: 0.4 }); },
  // wrong: a clear "cross", two short low muffled buzzes stepping down (soft, never harsh), then boos
  wrong(t) { const o = O(1, 0.12), lp = soft(o, 900); [[N(-14), 0], [N(-17), 0.19]].forEach(([f, x]) => { osc(lp, "sawtooth", f, t + x, 0.16, 0.07, { a: 0.008 }); osc(lp, "triangle", f, t + x, 0.18, 0.08, { a: 0.008 }); felt(o, t + x, 110, 0.25, 0.1); }); clip(o, "boos", t + 0.3, { gain: 0.95, dur: 4.2 }); },
  highScore(t) { const o = O(1, 0.2); duck(t, 3); felt(o, t, 150, 0.4, 0.15); clip(o, "cheer_short", t, { gain: 0.9 }); clip(o, "applause", t + 0.7, { gain: 0.8 }); },
  newBest(t) { const o = O(1, 0.2); felt(o, t, 140, 0.4, 0.18); [D3, Fs3, A3, D4].forEach((n) => osc(soft(o, 1100), "triangle", n, t, 1.4, 0.035, { a: 0.08 })); clip(o, "applause", t + 0.25, { gain: 0.5, dur: 2 }); }
};
// names the screens already used, kept so nothing breaks
const ALIAS = { roll3: "spinStart", lockin: "clubConfirm", pick: "cardSelect", reveal: "clubReveal", subIn: "cardDrop", subOut: "dropCancel", buzzer: "denied", climb: "riseCount" };

// the crowd's reactions to goals, kept so the final whistle can fade out any still going before the result
let reactions = [];
function react(c) { if (c) { reactions.push(c); if (reactions.length > 8) reactions.shift(); } return c; }
function hush(fade = 0.5) { for (const c of reactions) c.stop(fade); reactions = []; }
function play(id, arg, at = 0) {
  if (!ok()) return;
  const name = ALIAS[id] || id, fn = CUES[name]; if (!fn) return;
  QUIET = !!QUIET_CUES[name];
  try { fn(ctx.currentTime + 0.01 + at, arg); } catch (e) { /* a cue never breaks the game */ } finally { QUIET = false; }
}
// one muffled tap per card passing a reel; quiet at full speed, a little clearer as it slows
function tick(reel = 0, speed = 0) {
  if (!ok()) return;
  try { tap(O(1, 0.04), ctx.currentTime, speed < 13 ? 0.09 : 0.04, 240 + reel * 20); } catch (e) {}
}
// the build-up before a Baller or Legend lands: a soft swell of air and a low tone that ends as the reel stops
function tease(landsIn = 2) {
  if (!ok()) return;
  try { const dur = Math.min(2.4, Math.max(0.8, landsIn)), st = ctx.currentTime + landsIn - dur, q = O(0.7, 0.2); duck(st, dur + 0.4, 0.4); swell(soft(q, 1500), st, dur); } catch (e) {}
}
function setMuted(m) {
  muted = !!m; level();
  if (muted) { if (bed) { bed.stop(0.8); bed = null; } } else if (bedOn && !bed) crowd(true);
}
root.D2TSound = { play, tick, tease, crowd, setMuted, isMuted: () => muted, unlock, clipsLoaded: decodeAll, loadReveal, reveal };
})(typeof window !== "undefined" ? window : globalThis);
