/* DROP2TOP sound: recorded clips (window.D2T_SOUNDS, data URIs) plus small synth cues,
   ported from the D2T Sound Desk (audio work, 10 October 2026) with its default settings.
   The audio context starts on the first tap (iPhones refuse sound before one) and every
   call is safe to make before then, when muted, or where Web Audio is missing. */
(function (root) {
"use strict";
const MIX = { master: 0.9, bed: 0.4, rec: 1, syn: 0.8, verb: 0.25 };
let ctx = null, master, bus = {}, verbIn, noiseBuf, buffers = {}, muted = false, bed = null, decoding = null;

function init() {
  if (ctx) return ctx;
  const AC = root.AudioContext || root.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = muted ? 0 : MIX.master; master.connect(comp); comp.connect(ctx.destination);
  for (const k of ["bed", "rec", "syn"]) { bus[k] = ctx.createGain(); bus[k].gain.value = MIX[k]; bus[k].connect(master); }
  verbIn = ctx.createGain();
  const verb = ctx.createConvolver(), verbOut = ctx.createGain();
  const len = Math.floor(ctx.sampleRate * 2.4), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 900 ? i / 900 : 1); } }
  verb.buffer = b; verbOut.gain.value = MIX.verb * 1.4;
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}
function dataToBuf(uri) {
  const b64 = uri.slice(uri.indexOf(",") + 1), bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function decodeAll() {
  if (decoding || !ctx) return decoding;
  const src = root.D2T_SOUNDS || {};
  decoding = Promise.all(Object.keys(src).map(k => new Promise(res => {
    try {
      const p = ctx.decodeAudioData(dataToBuf(src[k]), buf => { buffers[k] = buf; res(); }, () => res());
      if (p && p.then) p.then(buf => { buffers[k] = buf; res(); }, () => res());
    } catch (e) { res(); }
  })));
  return decoding;
}
function unlock() {
  if (!init()) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  decodeAll();
}
root.addEventListener("pointerdown", unlock, { capture: true, passive: true });
root.addEventListener("keydown", unlock, { capture: true });
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {}); else if (!muted) ctx.resume().catch(() => {});
});

/* ---------- building blocks ---------- */
function ok() { return ctx && ctx.state === "running" && !muted; }
function envGain(dest, t, attack, decay, peak) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); g.connect(dest); return g;
}
function tone(dest, type, f, t, dur, peak, attack = 0.004) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(Math.min(f, 18000), t);
  o.connect(envGain(dest, t, attack, dur, peak)); o.start(t); o.stop(t + attack + dur + 0.05); return o;
}
function noise(dest, t, dur, { type = "bandpass", f = 2000, f2, q = 1, peak = 0.5, attack = 0.003 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  s.connect(fl); fl.connect(envGain(dest, t, attack, dur, peak)); s.start(t, Math.random()); s.stop(t + attack + dur + 0.05); return fl;
}
const semi = n => Math.pow(2, n / 12);
function synthOut(gain) {
  const o = ctx.createGain(); o.gain.value = gain; o.connect(bus.syn);
  const s = ctx.createGain(); s.gain.value = 0.5; o.connect(s); s.connect(verbIn); return o;
}
function clip(id, at = 0, gain = 1, loop = false, out = bus.rec, send = 0.6) {
  const buf = buffers[id]; if (!buf) return null;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
  const g = ctx.createGain(); g.gain.value = gain; src.connect(g); g.connect(out);
  const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(verbIn);
  src.start(ctx.currentTime + at);
  return { stop(fade = 0.4) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); try { src.stop(t + fade + 0.02); } catch (e) {} } };
}

/* ---------- synth cues (Sound Desk defaults) ---------- */
const SYN = {
  tap(o, t) { const s = tone(o, "triangle", 880, t, 0.07, 0.6); s.frequency.exponentialRampToValueAtTime(880 * 0.76, t + 0.07); noise(o, t, 0.012, { type: "highpass", f: 4000, peak: 0.15 }); },
  cardFlip(o, t) { noise(o, t, 0.14, { f: 1200, f2: 5200, q: 1.6, peak: 0.9 }); },
  ratingScan(o, t) { let tt = t, g = 0.045; for (let i = 0; i < 14; i++) { tone(o, "square", 520 * semi(i), tt, 0.025, 0.14); tt += g; g = Math.min(g * 1.12, 0.5); }
    const top = 520 * semi(14); [1, 1.26, 1.5, 2].forEach(r => tone(o, "sine", top * r, tt, 1.1, 0.18)); },
  kick(o, t) { const s = tone(o, "sine", 308, t, 0.14, 0.95, 0.002); s.frequency.exponentialRampToValueAtTime(40, t + 0.14); noise(o, t, 0.025, { type: "highpass", f: 2500, peak: 0.3 }); },
  climb(o, t, places = 8) { let tt = t, g = 1 / 11; for (let i = 0; i < places; i++) { const f = 420 * semi(i), s = tone(o, "sine", f, tt, 0.07, 0.35); s.frequency.exponentialRampToValueAtTime(f * 1.5, tt + 0.05); tt += g; g = Math.min(g * 1.05, 0.4); }
    const f = 420 * semi(places); tone(o, "triangle", f, tt, 0.5, 0.3); tone(o, "triangle", f * 1.5, tt, 0.5, 0.2); },
  buzzer(o, t) { for (let i = 0; i < 2; i++) { const st = t + i * 0.16 * 1.25; const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 1800; fl.connect(o);
    tone(fl, "sawtooth", 120, st, 0.16, 0.35, 0.005); tone(fl, "square", 121.4, st, 0.16, 0.2, 0.005); } },
  stamp(o, t) { const s = tone(o, "sine", 170, t, 0.18, 0.9, 0.002); s.frequency.exponentialRampToValueAtTime(51, t + 0.18); noise(o, t, 0.11, { type: "lowpass", f: 1200, peak: 0.5 }); noise(o, t + 0.01, 0.08, { f: 3200, q: 0.8, peak: 0.17 }); },
  deal3(o, t) { let tt = t; for (let i = 0; i < 3; i++) { tt = t + i * 0.2; noise(o, tt, 0.09, { f: 1400, f2: 6500, q: 1.4, peak: 0.56 }); tone(o, "triangle", 660 * semi(i * 4), tt + 0.06, 0.28, 0.26); }
    const top = 660 * semi(8) * 2; [0, 4, 7, 12].forEach((n, i) => tone(o, "sine", top * semi(n), tt + 0.25 + i * 0.05, 0.3, 0.03)); },
  pick(o, t) { tone(o, "triangle", 700, t, 0.09, 0.35); tone(o, "triangle", 700 * semi(7), t + 0.063, 0.16, 0.35); const s = tone(o, "sine", 180, t, 0.1, 0.35, 0.002); s.frequency.exponentialRampToValueAtTime(70, t + 0.1); },
  subIn(o, t) { const s = tone(o, "triangle", 300, t, 0.3, 0.25, 0.18); s.frequency.exponentialRampToValueAtTime(1300, t + 0.3); noise(o, t, 0.3, { f: 500, f2: 6000, q: 1.2, peak: 0.3, attack: 0.18 }); tone(o, "sine", 1950, t + 0.27, 0.12, 0.21, 0.002); },
  subOut(o, t) { const s = tone(o, "triangle", 1100, t, 0.32, 0.25, 0.01); s.frequency.exponentialRampToValueAtTime(220, t + 0.32); noise(o, t, 0.32, { f: 6000, f2: 500, q: 1.2, peak: 0.3 }); const k = tone(o, "sine", 140, t + 0.27, 0.14, 0.35, 0.002); k.frequency.exponentialRampToValueAtTime(55, t + 0.44); },
  survived(o, t) { [[5, 9, 12], [7, 11, 14], [0, 4, 7, 12]].forEach((c, i) => c.forEach(n => tone(o, "triangle", 262 * semi(n), t + i * 0.42, i === 2 ? 1.26 : 0.46, 0.14, 0.02))); tone(o, "sine", 1048, t + 0.84, 1.4, 0.05); },
  champions(o, t) { const seq = [[0, 1], [0, 1], [0, 1], [7, 3], [5, 1], [7, 1], [12, 0]]; let tt = t;
    seq.forEach(([n, d], i) => { const last = i === seq.length - 1, len = last ? 1.3 : 0.14 * d; const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 2; fl.frequency.setValueAtTime(770, tt); fl.frequency.linearRampToValueAtTime(2200, tt + 0.05); fl.connect(o);
      [1, 1.006].forEach(dt => tone(fl, "sawtooth", 233 * semi(n) * dt, tt, len * 0.95, 0.12, 0.02)); if (last) [4, 7].forEach(x => tone(fl, "sawtooth", 233 * semi(x), tt, len, 0.08, 0.03));
      if (i === 0 || i === 3 || last) { const k = tone(o, "sine", 110, tt, 0.4, 0.48, 0.003); k.frequency.exponentialRampToValueAtTime(60, tt + 0.4); }
      tt += last ? len : 0.14 * d * 1.15; }); }
};
function syn(id, at = 0, gain = 1, arg) { const o = synthOut(gain); try { SYN[id](o, ctx.currentTime + at + 0.01, arg); } catch (e) {} }

const SCENES = {
  tap: [["syn", "tap", 0, 0.6]],
  kickoff: [["rec", "whistle", 0], ["rec", "cheer_short", 0.25, 0.6]],
  goal: [["syn", "kick", 0], ["rec", "net_ripple", 0.12], ["rec", "goal_roar", 0.35]],
  conceded: [["rec", "groan", 0], ["rec", "crowd_moan", 1.4, 0.8]],
  halftime: [["rec", "half_time", 0], ["rec", "applause", 2.2, 0.5]],
  fulltime: [["rec", "full_time", 0], ["rec", "applause", 2.8, 0.6]],
  roll3: [["rec", "card_shuffle", 0, 0.8], ["syn", "deal3", 0.55]],
  reveal: [["rec", "card_slide", 0], ["syn", "cardFlip", 0.2]],
  pick: [["syn", "pick", 0], ["rec", "card_slide", 0.05, 0.7]],
  subIn: [["syn", "subIn", 0], ["rec", "cheer_short", 0.25, 0.35]],
  subOut: [["syn", "subOut", 0]],
  lockin: [["syn", "stamp", 0], ["syn", "tap", 0.2]],
  buzzer: [["syn", "buzzer", 0]],
  climb: [["syn", "climb", 0]],
  champions: [["rec", "trophy_fanfare", 0], ["syn", "champions", 0.1, 0.6], ["rec", "goal_roar", 0.3, 0.7], ["rec", "celebration", 2.2, 0.8]],
  survived: [["syn", "survived", 0], ["rec", "applause", 0.4, 0.7]],
  relegated: [["rec", "stunned_silence", 0], ["rec", "relegation_sting", 0.5], ["rec", "boos", 2.8, 0.4]]
};
function play(id, arg) {
  if (!ok()) return;
  for (const [kind, name, at, gain = 1] of SCENES[id] || []) {
    if (kind === "rec") clip(name, at, gain); else syn(name, at, gain, arg);
  }
}
function crowd(on) {
  if (!ok() && on) return;
  if (on && !bed) bed = clip("crowd_loop", 0, 1, true, bus.bed, 0.3);
  if (!on && bed) { bed.stop(0.8); bed = null; }
}
function setMuted(m) {
  muted = !!m;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : MIX.master, ctx.currentTime, 0.03);
  if (muted) crowd(false);
}
root.D2TSound = { play, crowd, setMuted, isMuted: () => muted, unlock };
})(typeof window !== "undefined" ? window : globalThis);
