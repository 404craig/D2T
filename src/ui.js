/* DROP2TOP interface. Renders the engine's state; every game decision goes through D2T (engine.js).
   Phone rules carried over from Tenaball: every tap target 44px or more, the game's own pop-ups (never
   confirm or alert), no stuck states (busy guard plus a watchdog), safe areas, a solid status-bar strip,
   Home Screen copies that reload themselves when a new build is out, and sound only after a tap. */
(function () {
"use strict";
const G = window.D2T_GAME, E = window.D2T, SND = window.D2TSound || { play() {}, crowd() {}, setMuted() {}, isMuted: () => false };
const CRESTS = window.D2T_CRESTS || {}, BRAND = window.D2T_BRAND || {};
const $app = document.getElementById("app"), $layer = document.getElementById("layer");
const NEUTRAL = { btn: "#D4FF00", ink: "#000000", text: "#D4FF00" };
const KEY = { run: "d2t-run-v1", record: "d2t-record-v1", settings: "d2t-settings-v1" };
const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- storage (private windows can refuse it: the game still plays) ---------- */
function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
let run = load(KEY.run, null);
let record = load(KEY.record, { runs: [], clubs: {}, daily: {} });
let settings = Object.assign({ muted: false, fastMatches: false, seenIntro: false }, load(KEY.settings, {}));
SND.setMuted(settings.muted);
const ui = { view: "home", sel: null, slot: null, reveal: false, clubSel: 0, anim: null, tableTab: "now", busyUntil: 0 };

/* ---------- legends: the best Premier League seasons from the rated data, used for rare legend cards ---------- */
const LEGENDS = (() => {
  const best = new Map();
  for (const [sk, S] of Object.entries(G.seasons)) {
    for (const p of S.players) {
      if (p.src !== "x" || p.r < 93 || p.a < 20) continue;
      const cur = best.get(p.n);
      if (!cur || p.r > cur.r) best.set(p.n, { id: "L:" + p.n, n: p.n, b: p.b, p: p.p, r: p.r, lv: 4, a: p.a, g: p.g, as: p.as, cs: p.cs, c: null, cn: S.clubs[p.c].name, sk });
    }
  }
  return [...best.values()].sort((a, b) => b.r - a.r);
})();
function seasonOf(key) {
  const S = G.seasons[key];
  if (S && !S.legends) { S.legends = LEGENDS; E.indexSeason(S); }
  return S;
}

/* ---------- helpers ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const sign = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function fdate(iso) { const [y, m, d] = iso.split("-").map(Number); const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${DAYS[w]} ${d} ${MONTHS[m - 1]} ${y}`; }
const meta = name => (G.clubs && G.clubs[name]) || { name, full: name, code: name.slice(0, 3).toUpperCase(), accent: NEUTRAL.btn, ink: NEUTRAL.ink, text: NEUTRAL.text };
const fullName = name => meta(name).full || name;
function crest(name, size, cls = "") {
  const c = CRESTS[name];
  const src = c && (size > 72 ? c["128"] || c["72"] : c["72"] || c["128"]);
  if (src) return `<img class="crest ${cls}" src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`;
  return `<span class="crest-fb ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 3.4)}px">${esc(meta(name).code)}</span>`;
}
function logo(kind) {
  const base = BRAND[kind === "l" ? "logo_long_base" : "logo_short_base"];
  return `<span class="logo logo-${kind}" role="img" aria-label="DROP2TOP"><img src="${base}" alt=""><span class="two two-${kind}"></span></span>`;
}
(function injectLogoMasks() {
  const st = document.createElement("style");
  st.textContent = `.two-s{-webkit-mask-image:url(${BRAND.logo_short_two});mask-image:url(${BRAND.logo_short_two})}.two-l{-webkit-mask-image:url(${BRAND.logo_long_two});mask-image:url(${BRAND.logo_long_two})}`;
  document.head.appendChild(st);
})();
function theme(clubName) {
  const m = clubName ? meta(clubName) : null;
  const t = m && m.accent ? { btn: m.accent, ink: m.ink, text: m.text } : NEUTRAL;
  const r = document.documentElement.style;
  r.setProperty("--btn", t.btn); r.setProperty("--ink", t.ink); r.setProperty("--text", t.text);
}
const ICON = {
  menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sound: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  mute: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>',
  arrow: c => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`,
  star: (fill) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="${fill ? "var(--text)" : "none"}" stroke="var(--text)" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`
};
const TIER = ["bronze", "silver", "gold", "best", "legend"];
const TIER_LABEL = ["Bronze", "Silver", "Gold", "Club's best", "Legend"];
const POS_NAME = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };

/* ---------- busy guard and watchdog: a double tap never applies twice, and nothing stays stuck ---------- */
// Per action, so a quick "Next match" then "Kick off" is never swallowed, but a double tap on one button is.
const busyAt = {};
function busy(key, ms = 450) { const now = Date.now(); if (now < (busyAt[key] || 0)) return true; busyAt[key] = now + ms; return false; }
setInterval(() => {
  if (ui.anim && Date.now() - ui.anim.t0 > ui.anim.dur + 8000) { ui.anim = null; render(); }
}, 1000);

/* ---------- sheets and the game's own questions ---------- */
let sheetClose = null;
function openSheet(title, body, { onClose, wide } = {}) {
  closeSheet(true);
  $layer.innerHTML = `<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grabzone" data-act="sheet-close" role="button" aria-label="Close (or swipe down)"><div class="grab"></div></div><div class="sh"><span class="h2">${esc(title)}</span><button class="icon-btn" data-act="sheet-close" aria-label="Close">${ICON.close}</button></div><div class="sb">${body}</div></div>`;
  sheetClose = onClose || null;
  requestAnimationFrame(() => { $layer.querySelector(".scrim").classList.add("on"); $layer.querySelector(".sheet").classList.add("on"); });
  dragToClose($layer.querySelector(".sheet"));
  history.pushState({ sheet: 1 }, "");
}
// Every slide-up panel can be swept away (Craig, 10 October 2026): drag the bar or the title row down,
// or drag the content down once it is scrolled to the top. A short drag springs back.
function dragToClose(sheet) {
  const body = sheet.querySelector(".sb"), scrim = $layer.querySelector(".scrim");
  let y0 = null, dy = 0, t0 = 0, moved = false;
  const begin = y => { y0 = y; dy = 0; t0 = Date.now(); moved = false; sheet.style.transition = "none"; };
  const follow = y => {
    if (y0 == null) return false;
    dy = Math.max(0, y - y0);
    if (dy > 4) moved = true;
    sheet.style.transform = dy ? `translateY(${dy}px)` : "";
    if (scrim) scrim.style.opacity = String(Math.max(0, 1 - dy / (sheet.offsetHeight || 400)));
    return dy > 0;
  };
  const release = () => {
    if (y0 == null) return;
    const fast = dy / Math.max(1, Date.now() - t0) > 0.5 && dy > 30;
    sheet.style.transition = ""; sheet.style.transform = ""; if (scrim) scrim.style.opacity = "";
    y0 = null;
    if (dy > 90 || fast) closeSheet();
    if (moved) { sheet.dataset.dragged = "1"; setTimeout(() => { delete sheet.dataset.dragged; }, 60); }
  };
  // The bar and title row: pointer events, so it works with a finger, a pen or a mouse.
  sheet.querySelectorAll(".grabzone, .sh").forEach(h => {
    h.addEventListener("pointerdown", e => {
      if (e.target.closest("button") && !e.target.closest(".grabzone")) return;
      begin(e.clientY); h.setPointerCapture && h.setPointerCapture(e.pointerId);
    });
    h.addEventListener("pointermove", e => follow(e.clientY));
    h.addEventListener("pointerup", release);
    h.addEventListener("pointercancel", release);
  });
  // The content: touch only, and only when it is already scrolled to the top.
  let fromTop = false;
  body.addEventListener("touchstart", e => { fromTop = body.scrollTop <= 0; if (fromTop) begin(e.touches[0].clientY); }, { passive: true });
  body.addEventListener("touchmove", e => { if (fromTop && follow(e.touches[0].clientY) && e.cancelable) e.preventDefault(); }, { passive: false });
  body.addEventListener("touchend", () => { if (fromTop) release(); });
  body.addEventListener("touchcancel", () => { if (fromTop) release(); });
}
function closeSheet(silent) {
  if (!$layer.innerHTML) return;
  const cb = sheetClose; sheetClose = null;
  const sh = $layer.querySelector(".sheet"), sc = $layer.querySelector(".scrim");
  if (sh) sh.classList.remove("on"); if (sc) sc.classList.remove("on");
  if (silent) { $layer.innerHTML = ""; } else setTimeout(() => { if (!$layer.querySelector(".sheet.on")) $layer.innerHTML = ""; }, 260);
  if (cb) cb();
}
function ask(text, { ok = "OK", cancel = "Cancel", title = "Are you sure?" } = {}) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (done) return; done = true; res(v); };
    openSheet(title, `<p>${esc(text)}</p><div class="bar" style="margin-top:6px"><button class="btn2 grow" data-act="ask-no">${esc(cancel)}</button><button class="cta grow" style="min-height:52px" data-act="ask-yes"><span class="t" style="font-size:18px">${esc(ok)}</span></button></div>`, { onClose: () => finish(false) });
    ui.askResolve = v => { finish(v); closeSheet(); };
  });
}
let toastT = 0;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- navigation ---------- */
function go(view, opts = {}) {
  ui.view = view;
  if (!opts.keepSel) { ui.sel = null; ui.slot = null; }
  if (view === "home" || view === "record" || view === "howto" || view === "updates") theme(null);
  else if (run && run.club != null) theme(currentClubName());
  history.pushState({ v: view }, "");
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("popstate", () => {
  if ($layer.innerHTML) { closeSheet(); return; }
  if (ui.view === "match" && ui.anim) return;
  if (ui.view !== "home") { ui.view = (["roll", "match", "squad", "summary"].includes(ui.view) && run) ? "hub" : "home"; if (ui.view === "home") theme(null); render(); }
});

/* ---------- run helpers ---------- */
function S() { return run && run.seasonKey ? seasonOf(run.seasonKey) : null; }
function currentClubName() { const s = S(); return s ? s.clubs[run.club].name : null; }
function saveRun() { save(KEY.run, run); }
function catEntry(key) { return G.catalogue.find(c => c.key === key); }
function relOf(S_, club) { return S_.relegated.find(r => r.c === club); }
function playerName(p) { return p ? p.n : "?"; }
function surname(p) { if (!p) return "?"; const parts = p.n.split(" "); return parts.length > 1 ? parts.slice(1).join(" ") : p.n; }
function pclubName(S_, p) {
  if (!p) return "";
  if (p.cn) return p.cn;
  const a = S_.clubs[p.c] ? S_.clubs[p.c].name : "";
  return p.c2 != null && S_.clubs[p.c2] ? `${a} / ${S_.clubs[p.c2].name}` : a;
}
function curPos() { const s = S(); if (!run.played.length) return null; return E.table(s, run, null, s.deductions).findIndex(r => r.c === run.club) + 1; }
function curRow() { const s = S(); return E.table(s, run, null, s.deductions).find(r => r.c === run.club); }
function totalRolls() { return run.rolls.reduce((a, w) => a + w.n, 0); }
function rollsDone() { let n = 0; for (let i = 0; i < run.rollIx; i++) n += run.rolls[i].n; return n + (run.roll ? run.rollStep : 0); }
function nextFixture() { return run.fixtures && run.fixtures[run.gw - 1]; }
function fixtureLine(f) { const s = S(); return `${s.clubs[f.opp].name} (${f.home ? "H" : "A"})`; }
function windowName() {
  const w = E.currentWindow(run);
  if (!w) return "Transfer window";
  return w.kind === "pre" ? "Pre-season" : w.kind === "jan" ? "January window" : "Transfer window";
}

/* ---------- version check: Home Screen copies keep an old page in memory, so look for a newer build ---------- */
function checkVersion() {
  if (location.protocol === "file:") return;
  fetch("version.txt?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : null).then(t => {
    if (!t) return;
    const latest = parseInt(t, 10), mine = parseInt(window.D2T_BUILD, 10);
    if (latest > mine && !(ui.view === "match" && ui.anim)) location.reload();
  }).catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkVersion(); });

/* ========================== VIEWS ========================== */
function render() {
  const v = ui.view;
  const html = v === "clubroll" ? viewClubRoll() : v === "hub" ? viewHub() : v === "squad" ? viewSquad() : v === "roll" ? viewRoll()
    : v === "match" ? viewMatch() : v === "summary" ? viewSummary() : v === "record" ? viewRecord() : v === "howto" ? viewHowTo()
    : v === "updates" ? viewUpdates() : viewHome();
  $app.innerHTML = html;
  ui.reveal = false;
  if (v === "summary") afterSummary();
}

/* ---------- home ---------- */
function viewHome() {
  const rec = recordTotals();
  const today = dailyKey(), daily = dailyEntry(today), dailyDone = record.daily && record.daily[today];
  const live = run && run.phase !== "summary" && run.seasonKey;
  let cont = "";
  if (live) {
    const s = S(), name = s.clubs[run.club].name, f = nextFixture();
    const pct = Math.round(100 * run.played.length / (run.fixtures ? run.fixtures.length : 38));
    cont = `<button class="continue" data-act="continue">
      <div class="hrow" style="gap:12px">${crest(name, 46)}<span style="display:flex;flex-direction:column;flex:1;min-width:0"><span class="label">${run.mode === "daily" ? "Continue daily" : "Continue"}</span><span style="font-weight:800;font-size:19px;line-height:1.15">${esc(fullName(name))} ${esc(run.seasonKey)}</span></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end"><span class="big-n" style="font-size:26px">${run.phase === "setup" ? "Pre" : "GW" + Math.min(run.gw, 38)}</span><span class="muted" style="font-size:12px">of ${run.fixtures ? run.fixtures.length : 38}</span></span></div>
      <div class="track"><i style="width:${Math.max(2, pct)}%"></i></div>
      <span class="soft" style="font-size:14px">${f ? `Next: ${esc(fixtureLine(f))} · ${fdate(f.date)}` : "Pick your XI and start pre-season"}</span></button>`;
  }
  const soon = ["Great Escape", "Title rescue", "Top2Drop", "Relegation race", "Poach", "Blind roll"];
  return `<section class="view">
    <img class="wm-emblem" src="${BRAND.emblem_white}" alt="">
    <div class="hrow"><button class="userpill" data-act="account"><span class="av">G</span>Guest</button>
      <button class="icon-btn" data-act="mute" aria-label="${settings.muted ? "Sound off, tap to turn on" : "Sound on, tap to turn off"}">${settings.muted ? ICON.mute : ICON.sound}</button></div>
    <div class="homelogo">${logo("l")}<p class="soft" style="font-size:16px;font-weight:500">Take a relegated club. Rewrite the season.</p></div>
    <button class="cta arrow" data-act="newrun"><span class="col"><span class="t">Roll your club</span><span class="s">Classic · ${G.catalogue.length} relegated seasons</span></span><span class="circ">${ICON.arrow("var(--btn)")}</span></button>
    ${cont}
    <div class="tiles four">
      <div class="tile"><span class="v">${rec.runs}</span><span class="l">Runs</span></div>
      <div class="tile"><span class="v" style="color:var(--text)">${rec.bestRise == null ? "-" : sign(rec.bestRise)}</span><span class="l">Best Rise</span></div>
      <div class="tile"><span class="v">${rec.stars}</span><span class="l">Stars</span></div>
      <div class="tile"><span class="v">${rec.titles}</span><span class="l">Titles</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="li" data-act="daily" style="width:100%;text-align:left;border-color:var(--text)">${crest(daily.club, 40)}<span class="tx" style="flex:1"><b>Daily challenge</b><span>${dailyDone ? `Today: done, ${ord(dailyDone.finish)} with ${esc(daily.club)}` : `Today: ${esc(fullName(daily.club))} ${esc(daily.season)} · one go`}</span></span><span class="label">${dailyDone ? "Done" : "Play"}</span></button>
      <div class="hrow" style="align-items:baseline"><span style="font-weight:800;font-size:16px">More ways to play</span><span class="muted" style="font-size:12px;font-weight:600">Coming soon</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${soon.map(m => `<button class="mode" data-act="soon" data-mode="${esc(m)}">${esc(m)}</button>`).join("")}</div>
    </div>
    <div class="grow"></div>
    ${nav("home")}
  </section>`;
}
function nav(cur) {
  const tabs = [["home", "Home"], ["record", "Record"], ["leagues", "Leagues"], ["howto", "How to play"]];
  return `<nav class="nav" aria-label="Main">${tabs.map(([id, l]) => `<button data-act="nav" data-to="${id}" ${id === cur ? 'aria-current="page"' : ""}>${l}</button>`).join("")}</nav>`;
}

/* ---------- daily challenge: picks itself from the date, the same for everyone ---------- */
function dailyKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dailyEntry(day) { const i = E.hash32("d2t-daily|" + day) % G.catalogue.length; return G.catalogue[i]; }

/* ---------- club roll ---------- */
function viewClubRoll() {
  const offers = run.clubOffer.map(catEntry);
  const sel = offers[ui.clubSel] || offers[0];
  theme(sel.club);
  return `<section class="view">
    <div class="hrow"><button class="icon-btn" data-act="home" aria-label="Back to home">${ICON.back}</button>${logo("s")}
      <span class="hstat"><span class="big-n">${run.respins}<small>/5</small></span><span class="k" style="color:var(--muted)">Respins</span></span></div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px"><span class="label">New run · Classic</span><h1 class="h1">ROLL YOUR CLUB</h1><p class="soft">Three relegated seasons. Pick one to save.</p></div>
    <div class="list" style="gap:10px">${offers.map((o, i) => {
      const best = record.clubs[o.key];
      return `<button class="clubrow" data-act="selclub" data-i="${i}" aria-pressed="${i === ui.clubSel}">${crest(o.club, 62)}
        <span style="display:flex;flex-direction:column;gap:5px;min-width:0"><span class="nm">${esc(fullName(o.club))}</span><span class="soft" style="font-weight:600">${esc(o.season)}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip opp">History: ${ord(o.pos)} · ${o.pts} pts</span>${best ? `<span class="chip s">Your best: ${ord(best.finish)}</span>` : ""}</span></span><span class="radio"></span></button>`;
    }).join("")}</div>
    <div class="grow"></div>
    <div class="bar"><button class="pill" data-act="clubspin" ${run.respins < 1 ? "disabled" : ""}>Respin<small>uses 1 of ${run.respins}</small></button>
      <button class="cta" data-act="pickclub" style="min-height:60px"><span class="t">Play ${esc(meta(sel.club).name)}</span></button></div>
  </section>`;
}

/* ---------- club hub (the chosen design: black, club accent, big faded crest) ---------- */
function viewHub() {
  const s = S(), name = currentClubName(), cat = catEntry(`${run.seasonKey}:${name}`) || {}, rel = relOf(s, run.club) || {};
  const pre = run.phase === "setup";
  const fx = pre ? E.fixturesOf(s, run.club)[0] : nextFixture();
  const phaseLabel = pre ? "Pre-season" : run.phase === "window" ? windowName() : run.phase === "summary" ? "Season over" : `Gameweek ${run.gw}`;
  const sched = pre ? E.schedule(E.fixturesOf(s, run.club)) : run.rolls;
  const nRolls = sched.reduce((a, w) => a + w.n, 0), done = pre ? 0 : rollsDone();
  const played = run.played.length, games = (run.fixtures || E.fixturesOf(s, run.club)).length;
  let mid = "";
  if (pre) {
    mid = `<div class="panel"><span class="label m">Stars to win with ${esc(meta(name).name.toUpperCase())}</span><div class="stars">${["Survive", "Top half", "Champions"].map((t, i) => `<span>${ICON.star(starEarned(cat.key, i))}${t}</span>`).join("")}</div></div>`;
  } else {
    const T = E.table(s, run, null, s.deductions), me = T.findIndex(r => r.c === run.club);
    const from = Math.max(0, Math.min(T.length - 5, me - 2));
    mid = `<div class="panel" style="padding:10px 12px"><div class="hrow"><span class="label m">League table</span><button class="label" style="background:none;border:0;min-height:36px;padding:0 4px" data-act="table">Full table</button></div>${tableHTML(T.slice(from, from + 5), from, s, true)}</div>`;
  }
  let cta = "", second = "";
  if (pre) { cta = `<button class="cta" data-act="startseason"><span class="t">Start pre-season</span><span class="s">${sched[0].n} rolls before GW1</span></button>`; second = `<button class="btn2" data-act="squad">Pick your XI and formation</button>`; }
  else if (run.phase === "window") { cta = `<button class="cta" data-act="toroll"><span class="t">${esc(windowName())}</span><span class="s">Roll ${run.roll ? run.roll.step : 1} of ${run.roll ? run.roll.of : 1} before GW${run.gw}</span></button>`; second = `<button class="btn2" data-act="table">League table</button>`; }
  else if (run.phase === "prematch") { cta = `<button class="cta" data-act="tomatch"><span class="t">Kick off</span><span class="s">GW${run.gw} · ${esc(fixtureLine(fx))}</span></button>`; second = `<button class="btn2" data-act="table">League table</button>`; }
  else { cta = `<button class="cta" data-act="tosummary"><span class="t">Season summary</span></button>`; }
  return `<section class="view">
    ${crestWM(name)}
    <div class="hrow">${logo("s")}<span style="display:flex;align-items:center;gap:10px"><span class="label">${esc(phaseLabel)}</span><button class="icon-btn" style="width:44px;height:44px" data-act="menu" aria-label="Menu">${ICON.menu}</button></span></div>
    <div class="hrow" style="justify-content:flex-start;gap:14px;margin-top:14px">${crest(name, 96)}
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="h1">${esc(fullName(name))}</span><span class="soft" style="font-size:16px;font-weight:600">${esc(run.seasonKey)} · ${run.mode === "daily" ? "daily challenge" : "your run"}</span>
      <span style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip">History: ${ord(cat.pos || rel.pos)} · ${cat.pts != null ? cat.pts : rel.pts} pts</span>${rel.w != null ? `<span class="chip s">W${rel.w} D${rel.d} L${rel.l}</span>` : ""}</span></div></div>
    ${fx ? `<div class="panel"><span class="label">Gameweek ${pre ? 1 : run.gw}</span><div class="hrow" style="justify-content:flex-start;gap:12px">${crest(name, 40)}<span class="big-n muted" style="font-size:16px">v</span>${crest(s.clubs[fx.opp].name, 40)}
      <span style="display:flex;flex-direction:column;margin-left:4px;min-width:0"><span style="font-weight:800;font-size:18px">${esc(fixtureLine(fx))}</span><span class="soft" style="font-size:13px">${fdate(fx.date)}</span></span></div></div>` : ""}
    <div class="tiles">
      <div class="tile"><span class="v">${done}<small>/${nRolls}</small></span><span class="l">Rolls</span></div>
      <div class="tile"><span class="v">${run.respins}<small>/5</small></span><span class="l">Respins</span></div>
      <div class="tile"><span class="v">${played}<small>/${games}</small></span><span class="l">Played</span></div>
    </div>
    ${mid}
    <div class="grow"></div>
    <div class="track"><i style="width:${Math.max(3, Math.round(100 * played / games))}%"></i></div>
    ${cta}${second}
  </section>`;
}
function crestWM(name) {
  const c = CRESTS[name];
  return c ? `<img class="wm-crest" src="${c["128"] || c["72"]}" alt="">` : "";
}
function starEarned(key, i) { const r = key && record.clubs[key]; return !!(r && r.stars && r.stars[i]); }

/* ---------- squad (pre-season: formation and XI from the real squad) ---------- */
function viewSquad() {
  const s = S(), name = currentClubName();
  const str = E.userStrength(s, run);
  const editable = run.phase === "setup";
  return `<section class="view game"><div class="pitchlines"></div>
    <div class="ghead"><button class="icon-btn" data-act="hub" aria-label="Back">${ICON.back}</button>${logo("s")}<span class="hstat"><span class="k">${editable ? "Pre-season" : "Your XI"}</span><span class="v">${esc(meta(name).name)}</span></span></div>
    <div class="gline"></div>
    <div class="gbody">
      ${editable ? `<div class="form-chips" role="group" aria-label="Formation">${E.FORMATION_NAMES.map(f => `<button data-act="formation" data-f="${f}" aria-pressed="${run.formation === f}">${f}</button>`).join("")}</div>
      <p class="hint" style="text-align:left">Tap a shirt to swap in anyone from the ${esc(run.seasonKey)} squad.</p>` : `<p class="hint" style="text-align:left">${esc(run.formation)} · signings are made in the transfer windows.</p>`}
      ${pitchHTML(null)}
      ${strengthTiles(str)}
      <div class="grow"></div>
      <button class="cta" data-act="hub"><span class="t">Done</span></button>
    </div></section>`;
}
function strengthTiles(st) {
  return `<div class="tiles four">${[["DEF", st.def], ["MID", st.mid], ["ATT", st.att], ["Team", st.ovr]].map(([l, v]) => `<div class="tile"><span class="v">${Math.round(v)}</span><span class="l">${l}</span></div>`).join("")}</div>`;
}
function pitchHTML(preview) {
  const s = S(), F = E.FORMATIONS[run.formation];
  let best = -1;
  if (preview) { let bd = -1e9; preview.forEach(o => { if (o.delta > bd) { bd = o.delta; best = o.slot; } }); }
  return `<div class="pitch" role="group" aria-label="Your team">${F.map(([pos, x, y], i) => {
    const p = E.playerOf(s, run.xi[i]);
    const o = preview ? preview[i] : null;
    const fit = o ? o.fit : E.fitOf(p, pos);
    const cls = ["slot", "f-" + fit, o && i === best ? "best" : "", ui.slot === i ? "chosen" : ""].join(" ");
    const d = o ? `<span class="d" style="color:${o.delta > 0.05 ? "var(--natural)" : o.delta < -0.05 ? "var(--wrong)" : "var(--muted)"}">${o.delta > 0.05 ? "+" : ""}${o.delta.toFixed(1)}</span>` : `<span class="d">${p ? Math.round(E.effRating(p, pos)) : "-"}</span>`;
    const label = p ? `${pos}, ${p.n}, rated ${p.r}${o ? `, ${o.delta >= 0 ? "plus" : "minus"} ${Math.abs(o.delta).toFixed(1)} if replaced` : ""}` : pos;
    return `<button class="${cls}" style="left:${x}%;top:${92 - y * 0.86}%" data-act="slot" data-i="${i}" aria-label="${esc(label)}"><span class="p"><i></i>${pos}</span><span class="n">${esc(surname(p))}</span>${d}</button>`;
  }).join("")}</div>`;
}

/* ---------- the roll ---------- */
function cardHTML(s, id, i) {
  const p = E.playerOf(s, id);
  if (!p) return "";
  const lv = p.lv || 0;
  const clubLine = p.cn ? `${p.cn} ${p.sk.slice(2, 4)}/${p.sk.slice(5)}` : pclubName(s, p);
  const crestName = p.cn || (s.clubs[p.c] && s.clubs[p.c].name);
  const stats = p.b === "GK" ? `${p.a} games${p.cs != null ? ` · ${p.cs} clean sheets` : ""}` : `${p.a} games · ${p.g} goals`;
  return `<button class="pcard t-${TIER[lv]}" data-act="card" data-i="${i}" aria-pressed="${ui.sel === id}" aria-label="${esc(`${p.n}, ${POS_NAME[p.b] || ""}, rated ${p.r}, ${TIER_LABEL[lv]}, ${clubLine}, ${stats}`)}">
    <span class="in"><span class="hrow" style="align-items:flex-start;gap:4px"><span class="r">${p.r}</span><span class="tag">${TIER_LABEL[lv]}</span></span>
    <span class="pos">${POS_NAME[p.b] || ""}</span><span class="nm">${esc(p.n)}</span><span class="grow"></span>
    <span class="club">${crest(crestName, 18)}<span>${esc(clubLine)}</span></span><span class="st">${esc(stats)}</span></span></button>`;
}
function viewRoll() {
  const s = S();
  if (run.phase !== "window" || !run.roll) { ui.view = "match"; return viewMatch(); }
  const f = nextFixture(), pos = curPos(), row = run.played.length ? curRow() : null;
  const preview = ui.sel != null ? E.signPreview(run, s, ui.sel) : null;
  if (preview && ui.slot == null) { let bd = -1e9; preview.forEach(o => { if (o.delta > bd) { bd = o.delta; ui.slot = o.slot; } }); }
  const now = E.userStrength(s, run).ovr;
  const after = preview && ui.slot != null ? now + preview[ui.slot].delta : null;
  const selP = ui.sel != null ? E.playerOf(s, ui.sel) : null, outP = ui.slot != null ? E.playerOf(s, run.xi[ui.slot]) : null;
  const hint = selP ? `${selP.n} into ${E.FORMATIONS[run.formation][ui.slot][0]} for ${surname(outP)}. Tap another shirt to change, or the card again for stats.` : "Tap a card to see where he fits.";
  return `<section class="view game"><div class="pitchlines"></div>
    <div class="ghead">${logo("s")}<span style="display:flex;align-items:center;gap:14px">
      <span class="hstat"><span class="k">${esc(windowName())}</span><span class="v">Roll ${run.roll.step} of ${run.roll.of}</span></span>
      <span class="hstat"><span class="big-n">${run.respins}<small>/5</small></span><span class="k" style="color:var(--muted)">Respins</span></span>
      <button class="icon-btn" data-act="menu" aria-label="Menu">${ICON.menu}</button></span></div>
    <div class="gline"></div>
    <div class="gbody">
      <p class="soft" style="font-size:13px;font-weight:600">Before GW${run.gw} · ${esc(fixtureLine(f))}${pos ? ` · you're ${ord(pos)}, ${row.pts} pts` : ""}</p>
      <div class="cards ${ui.reveal ? "reveal" : ""}">${run.roll.cards.map((id, i) => cardHTML(s, id, i)).join("")}</div>
      <p class="hint">${esc(hint)}</p>
      ${pitchHTML(preview)}
      <div class="legend"><span class="k"><span><i style="background:var(--natural);border-radius:4px"></i>Natural</span><span><i style="background:var(--near);border-radius:2px"></i>Near 90%</span><span><i style="background:var(--wrong)"></i>Wrong 70%</span></span>
        <span style="font-weight:800">Team ${now.toFixed(1)}${after != null ? ` <span style="color:var(--text)">→ ${after.toFixed(1)}</span>` : ""}</span></div>
      <div class="grow"></div>
      <div class="bar"><button class="pill" data-act="respin" ${run.respins < 1 ? "disabled" : ""}>Respin<small>${run.respins} left</small></button>
        <button class="pill" data-act="pass">Pass<small>keep XI</small></button>
        <button class="cta" data-act="sign" ${selP && ui.slot != null ? "" : "disabled"} style="min-height:58px">${selP ? `<span class="t" style="font-size:19px">Sign ${esc(surname(selP))}</span><span class="s">${esc(surname(outP))} leaves</span>` : `<span class="t" style="font-size:19px">Pick a card</span>`}</button></div>
    </div></section>`;
}
function cardSheet(id) {
  const s = S(), p = E.playerOf(s, id);
  if (!p) return;
  const lv = p.lv || 0;
  const two = p.c2 != null ? `<p>${esc(s.clubs[p.c].name)}: ${p.a1} games, ${p.g1} goals · ${esc(s.clubs[p.c2].name)}: ${p.a2} games, ${p.g2} goals</p>` : "";
  const nums = [["Games", p.a], ["Goals", p.g]];
  if (p.as != null) nums.push(["Assists", p.as]);
  if (p.cs != null) nums.push(["Clean sheets", p.cs]);
  if (p.mi != null) nums.push(["Minutes", p.mi]);
  const face = p.st ? Object.entries(p.st).map(([k, v]) => `<div class="tile"><span class="v">${v}</span><span class="l">${esc(k)}</span></div>`).join("") : "";
  openSheet(p.n, `<div class="hrow" style="justify-content:flex-start;gap:14px">${crest(p.cn || s.clubs[p.c].name, 56)}<div style="display:flex;flex-direction:column;gap:4px"><span class="big-n t-${TIER[lv]}" style="font-size:40px;color:var(--tierc)">${p.r}</span><span class="label m">${TIER_LABEL[lv]} · ${POS_NAME[p.b] || ""}</span></div></div>
    <p>${esc(p.cn ? `${p.cn}, ${p.sk}: one of the Premier League's all-time great seasons.` : `${pclubName(s, p)}, ${run.seasonKey}.`)}${p.nat ? ` ${esc(p.nat)}.` : ""}</p>${two}
    <div class="statgrid">${nums.map(([l, v]) => `<div class="tile"><span class="v">${v}</span><span class="l">${l}</span></div>`).join("")}</div>
    ${face ? `<h3>Card stats</h3><div class="statgrid">${face}</div>` : ""}
    <p class="muted" style="font-size:12.5px">${p.src === "f" ? "Provisional rating: this season hasn't been through the full rating method yet." : "Rating worked out from his verified season numbers, compared with every other player that season."}</p>`);
}

/* ---------- match ---------- */
function viewMatch() {
  const s = S(), name = currentClubName();
  const a = ui.anim;
  const res = a ? a.res : (ui.ft ? run.lastResult : null);
  const pre = !res;
  const f = pre ? nextFixture() : run.fixtures[res.gw - 1];
  if (!f) { ui.view = "summary"; return viewSummary(); }
  const opp = s.clubs[f.opp].name;
  const min = a ? a.min : (res ? 90 : 0);
  const shown = res ? res.events.filter(e => e.min <= min) : [];
  const us = shown.filter(e => e.us).length, them = shown.length - us;
  const home = f.home;
  const L = home ? { n: name, g: us, me: true } : { n: opp, g: them, me: false };
  const R = home ? { n: opp, g: them, me: false } : { n: name, g: us, me: true };
  const gw = pre ? run.gw : res.gw;
  const ours = E.userStrength(s, run), theirs = E.clubStrength(s, f.opp, new Set(run.signed.filter(x => x.date <= f.date).map(x => x.id)));
  const strRows = [["DEF", "def"], ["MID", "mid"], ["ATT", "att"], ["OVR", "ovr"]].map(([l, k]) => {
    const lv = home ? ours[k] : theirs[k], rv = home ? theirs[k] : ours[k];
    const w = v => Math.max(4, Math.min(100, (v - 45) * 2));
    return `<span class="vl">${Math.round(lv)}</span><span class="lab">${l}</span><span>${Math.round(rv)}</span>
      <span class="b l"><i style="width:${w(lv)}%;background:${home ? "var(--btn)" : "var(--opp)"}"></i></span><span></span><span class="b r"><i style="width:${w(rv)}%;background:${home ? "var(--opp)" : "var(--btn)"}"></i></span>`;
  }).join("");
  const evHTML = shown.map(e => `<div class="ev ${e.us ? "us" : ""}"><span class="m">${e.min}'</span>${e.us ? "" : crest(opp, 22)}<span>${esc(e.name)}</span>${e.us ? `<span class="grow"></span><span class="label">Goal</span>` : ""}</div>`);
  if (res && min >= 45) {
    const at = shown.findIndex(e => e.min > 45);
    evHTML.splice(at < 0 ? evHTML.length : at, 0, `<div class="ev ht">HALF TIME · ${res.events.filter(e => e.min <= 45 && e.us).length}–${res.events.filter(e => e.min <= 45 && !e.us).length}</div>`);
  }
  let bottom = "";
  if (pre) bottom = `<button class="cta" data-act="kickoff"><span class="t">Kick off</span><span class="s">${settings.fastMatches ? "Instant result" : "About 15 seconds, skippable"}</span></button>`;
  else if (a) bottom = `<button class="btn2" data-act="skipmatch" style="width:100%">SKIP TO FULL TIME »</button>`;
  else {
    const before = ui.ftPos ? ui.ftPos[0] : null, after = ui.ftPos ? ui.ftPos[1] : null;
    const moved = before && after ? (before > after ? `<span class="mv up">▲${before - after}</span>` : before < after ? `<span class="mv dn">▼${after - before}</span>` : "") : "";
    const next = run.phase === "summary" ? ["Season summary", "See how far you took them"] : run.phase === "window" ? [windowName(), `Before GW${run.gw}`] : [`Kick off GW${run.gw}`, fixtureLine(nextFixture())];
    bottom = `<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px 16px"><span style="font-weight:800">Table: ${before ? ord(before) + " → " : ""}${ord(after)} ${moved}</span><button class="label" style="background:none;border:0;min-height:40px" data-act="table">Full table</button></div>
      <button class="cta" data-act="afterft"><span class="t">${esc(next[0])}</span><span class="s">${esc(next[1])}</span></button>`;
  }
  return `<section class="view game"><div class="pitchlines"></div>
    <div class="ghead">${logo("s")}<span style="display:flex;align-items:center;gap:10px">${a ? `<span class="live"><i></i>LIVE</span>` : `<span class="label">${pre ? "Matchday" : "Full time"}</span>`}<button class="icon-btn" data-act="menu" aria-label="Menu">${ICON.menu}</button></span></div>
    <div class="gline"></div>
    <div class="gbody">
      <span class="label m">Gameweek ${gw} · ${home ? "Home" : "Away"} · ${fdate(f.date)}</span>
      <div class="score"><span class="side">${crest(L.n, 54)}<span>${esc(meta(L.n).name)}</span></span>
        <span style="display:flex;flex-direction:column;align-items:center"><span class="sc" aria-live="polite">${L.g}<b>–</b>${R.g}</span><span class="min">${pre ? "KO" : a ? (min >= 45 && min < 46 && a.ht ? "HT" : min + "'") : "FT"}</span></span>
        <span class="side">${crest(R.n, 54)}<span>${esc(meta(R.n).name)}</span></span></div>
      <div><div class="clock"><i style="width:${(min / 90) * 100}%"></i>${shown.map(e => `<span class="mk" style="left:${(e.min / 90) * 100}%;background:${e.us ? "var(--btn)" : "var(--opp)"}"></span>`).join("")}</div>
        <div class="clocklab" style="margin-top:6px"><span>0'</span><span>HT</span><span>90'</span></div></div>
      ${evHTML.length ? `<div class="events">${evHTML.join("")}</div>` : ""}
      ${pre || a ? `<div class="panel"><span class="label m">Strength</span><div class="str">${strRows}</div></div>` : ""}
      <div class="grow"></div>
      ${bottom}
    </div></section>`;
}
function kickoff() {
  const s = S();
  const before = run.played.length ? curPos() : null;
  const res = E.playMatch(run, s);
  if (!res) return;
  saveRun();
  ui.ftPos = [before, E.table(s, run, null, s.deductions).findIndex(r => r.c === run.club) + 1];
  ui.ft = true;
  if (settings.fastMatches || RM) { finishMatch(res, true); return; }
  ui.anim = { res, t0: Date.now(), dur: 15000, min: 0, ht: false, played: 0 };
  SND.play("kickoff"); SND.crowd(true);
  tick();
}
function tick() {
  const a = ui.anim; if (!a) return;
  const el = Date.now() - a.t0;
  // 0 to 45 in 6.5s, a 1.6s half-time pause, 45 to 90 in 6.5s
  let min;
  if (el < 6500) min = Math.floor(el / 6500 * 45);
  else if (el < 8100) { min = 45; if (!a.ht) { a.ht = true; SND.play("halftime"); } }
  else min = 45 + Math.floor((el - 8100) / 6500 * 45);
  min = Math.min(90, min);
  const newGoals = a.res.events.filter(e => e.min <= min).length;
  for (let k = a.played; k < newGoals; k++) SND.play(a.res.events[k].us ? "goal" : "conceded");
  a.played = newGoals;
  if (min !== a.min || el < 50) { a.min = min; render(); }
  if (min >= 90) { finishMatch(a.res, false); return; }
  requestAnimationFrame(() => setTimeout(tick, 120));
}
function finishMatch(res, instant) {
  ui.anim = null; SND.crowd(false);
  SND.play("fulltime");
  render();
}

/* ---------- table ---------- */
function tableHTML(rows, offset, s, compact) {
  const n = s.clubs.length, rel = s.relegationPlaces || 3;
  return `<table class="tbl"><thead><tr><th class="c">#</th><th class="c">Club</th>${compact ? "" : "<th>P</th><th>W</th><th>D</th><th>L</th>"}<th>GD</th><th>Pts</th></tr></thead><tbody>${rows.map((r, i) => {
    const pos = offset + i + 1, nm = s.clubs[r.c].name;
    const cls = [r.c === run.club ? "me" : "", pos === n - rel + 1 ? "zone" : "", pos > n - rel ? "drop" : ""].join(" ");
    return `<tr class="${cls}"><td class="c" style="display:table-cell;width:22px">${pos}</td><td class="c">${crest(nm, 20)}<span>${esc(meta(nm).name)}</span></td>${compact ? "" : `<td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>`}<td>${sign(r.gf - r.ga).replace("±", "")}</td><td class="pts">${r.pts}</td></tr>`;
  }).join("")}</tbody></table>`;
}
function tableSheet() {
  const s = S();
  const body = () => {
    const T = ui.tableTab === "hist" ? E.historyTable(s, s.deductions) : E.table(s, run, null, s.deductions);
    return `<div class="tabs" role="group"><button data-act="ttab" data-t="now" aria-pressed="${ui.tableTab === "now"}">Your season</button><button data-act="ttab" data-t="hist" aria-pressed="${ui.tableTab === "hist"}">History</button></div>
      <p class="muted" style="font-size:12.5px">${ui.tableTab === "hist" ? `How ${run.seasonKey} really finished.` : `After ${run.played.length} of ${run.fixtures ? run.fixtures.length : 38}. Other clubs' games are played on their real dates.`}</p>${tableHTML(T, 0, s, false)}`;
  };
  openSheet("League table", body());
  ui.tableBody = body;
}

/* ---------- end of season ---------- */
function viewSummary() {
  const s = S(), name = currentClubName(), F = run.final;
  if (!F) { ui.view = "hub"; return viewHub(); }
  const champs = F.finish === 1, survived = F.stars.survive;
  const head = champs ? "Champions" : survived ? (F.stars.tophalf ? "Top half" : "Survived") : "Relegated";
  const cl = c => s.clubs[c].name;
  const changes = F.changes.map(c => c.kind === "champion" ? `<div class="li">${crest(cl(c.club), 32)}<span class="tx"><b>${esc(meta(cl(c.club)).name)} are champions</b><span>History: ${esc(meta(cl(c.was)).name)}</span></span></div>`
    : c.kind === "down" ? `<div class="li">${crest(cl(c.club), 32)}<span class="tx"><b>${esc(meta(cl(c.club)).name)} go down</b><span>History: they stayed up</span></span></div>`
    : `<div class="li">${crest(cl(c.club), 32)}<span class="tx"><b>${esc(meta(cl(c.club)).name)} stay up</b><span>History: they went down</span></span></div>`).join("");
  const P = id => E.playerOf(s, id);
  const awards = [];
  if (F.playerOfSeason != null) { const p = P(F.playerOfSeason); if (p) awards.push(["Player of the season", `${p.n} · ${p.r}`]); }
  if (F.topScorer) { const p = P(F.topScorer.id); if (p) awards.push(["Top scorer", `${p.n} · ${F.topScorer.goals} goals`]); }
  if (F.bestSigning) { const p = P(F.bestSigning.id); if (p) awards.push(["Best signing", `${p.n} · signed before GW${F.bestSigning.gw}`]); }
  return `<section class="view">${crestWM(name)}
    <div class="hrow">${logo("s")}<span style="display:flex;align-items:center;gap:10px"><span class="label">Season over</span><button class="icon-btn" data-act="menu" aria-label="Menu">${ICON.menu}</button></span></div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><span class="label">${esc(head)}</span><span class="h1">${esc(fullName(name))} ${esc(run.seasonKey)}</span></div>
    <div class="finish"><span class="pos">${ord(F.finish)}</span><span style="display:flex;flex-direction:column;gap:2px;padding-bottom:6px"><span style="font-weight:800">${F.pts} pts · W${F.w} D${F.d} L${F.l}</span><span class="soft">History: ${ord(F.histFinish)}, ${F.histPts} pts</span></span></div>
    <div class="tiles"><div class="tile"><span class="v" style="color:var(--text)">${sign(F.rise)}</span><span class="l">The Rise</span></div><div class="tile"><span class="v">${sign(F.gained)}</span><span class="l">Points on history</span></div><div class="tile"><span class="v">${sign(F.gf - F.ga)}</span><span class="l">Goal difference</span></div></div>
    <div class="panel ghost"><span class="label m">Your season against history</span>${ghostSVG(F.positions, F.history, s.clubs.length)}</div>
    ${changes ? `<div style="display:flex;flex-direction:column;gap:8px"><span class="label m">How you changed ${esc(run.seasonKey)}</span><div class="list">${changes}</div></div>` : ""}
    ${awards.length ? `<div class="list">${awards.map(([k, v]) => `<div class="li"><span class="tx"><span>${esc(k)}</span><b>${esc(v)}</b></span></div>`).join("")}</div>` : ""}
    <div class="panel"><span class="label m">Stars</span><div class="stars">${[["Survive", F.stars.survive], ["Top half", F.stars.tophalf], ["Champions", F.stars.champions]].map(([t, on]) => `<span>${ICON.star(on)}${t}</span>`).join("")}</div></div>
    <p class="soft" style="font-style:italic;text-align:center">${esc(banter(F))}</p>
    <button class="btn2" data-act="table">Final table</button>
    <button class="cta" data-act="share"><span class="t">Share result</span><span class="s">${run.mode === "daily" ? "Daily challenge" : "Can your mates beat it?"}</span></button>
    <div class="bar"><button class="btn2 grow" data-act="home">Home</button><button class="btn2 grow" data-act="newrun">Play again</button></div>
  </section>`;
}
function ghostSVG(mine, hist, n) {
  const W = 340, H = 180, L = 28, R = 10, T = 12, B = 22, w = W - L - R, h = H - T - B, len = Math.max(hist.length, mine.length);
  const x = i => L + i * (w / Math.max(1, len - 1)), y = p => T + (p - 1) * (h / (n - 1));
  const pts = a => a.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const rel = n - 2;
  let g = "";
  [1, Math.round(n / 2), n].forEach(p => { g += `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="#222226" stroke-dasharray="3 4"/><text x="${L - 6}" y="${y(p) + 4}" font-size="10" text-anchor="end" fill="#8E8E99">${p}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your league position each week against history's">
    <rect x="${L}" y="${y(rel) - 5}" width="${w}" height="${y(n) - y(rel) + 10}" fill="rgba(255,40,130,0.08)"/>${g}
    <polyline points="${pts(hist)}" fill="none" stroke="#8E8E99" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${pts(mine)}" fill="none" stroke="var(--text)" stroke-width="3" stroke-linejoin="round"/>
    <text x="${L}" y="${H - 6}" font-size="10" fill="#8E8E99">GW1</text><text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="#8E8E99">GW${len}</text>
    <text x="${W - R}" y="${T + 10}" font-size="11" text-anchor="end" fill="var(--text)" font-weight="700">You: ${ord(mine[mine.length - 1])}</text>
    <text x="${W - R}" y="${T + 24}" font-size="11" text-anchor="end" fill="#8E8E99">History: ${ord(hist[hist.length - 1])}</text></svg>`;
}
const BANTER = {
  champions: ["From the drop to the top. Somebody print the t-shirts.", "Champions. History has asked for a recount.", "They went down. You took them to the title. Absolute scenes."],
  top4: ["Champions League football for a side that went down. Bit greedy, isn't it?", "Top four with a relegated squad. The pundits are furious."],
  tophalf: ["Top half. Not bad for a side history wrote off.", "Mid-table respectability. Your nan would be proud."],
  survived: ["Safe. Ugly, but safe. Nobody remembers how.", "Survival. The Great Escape, director's cut."],
  better: ["Still down, but you made them look like a football team at least.", "Relegated, but with dignity. Well, some."],
  same: ["Relegated anyway. History was right about this lot.", "You had the whole league to pick from and still went down. Impressive, in its own way."]
};
function banter(F) {
  const k = F.stars.champions ? "champions" : F.finish <= 4 ? "top4" : F.stars.tophalf ? "tophalf" : F.stars.survive ? "survived" : F.rise > 0 || F.gained > 0 ? "better" : "same";
  const list = BANTER[k];
  return list[E.hash32(run.seed + "|banter") % list.length];
}
function afterSummary() {
  if (!run || !run.final || run.recorded) return;
  run.recorded = true;
  const F = run.final, name = currentClubName(), key = `${run.seasonKey}:${name}`;
  record.runs.push({ key, season: run.seasonKey, club: name, finish: F.finish, rise: F.rise, pts: F.pts, gained: F.gained, champions: F.stars.champions, mode: run.mode, at: dailyKey() });
  const c = record.clubs[key] || { runs: 0, finish: 99, rise: -99, stars: [false, false, false] };
  c.runs++; c.finish = Math.min(c.finish, F.finish); c.rise = Math.max(c.rise, F.rise);
  c.stars = [c.stars[0] || F.stars.survive, c.stars[1] || F.stars.tophalf, c.stars[2] || F.stars.champions];
  record.clubs[key] = c;
  if (run.mode === "daily") { record.daily = record.daily || {}; record.daily[run.dailyDay] = { finish: F.finish, rise: F.rise, club: name }; }
  save(KEY.record, record); saveRun();
  SND.play(F.stars.champions ? "champions" : F.stars.survive ? "survived" : "relegated");
  prepareShare();
}

/* ---------- sharing: the text and card image are built ahead, so Share opens at once ---------- */
let shareCache = null;
function shareText() {
  const F = run.final, name = currentClubName();
  return `DROP2TOP${run.mode === "daily" ? " Daily " + run.dailyDay : ""}\n${fullName(name)} ${run.seasonKey}\nHistory: ${ord(F.histFinish)}, ${F.histPts} pts\nMine: ${ord(F.finish)}, ${F.pts} pts\nTHE RISE ${sign(F.rise)}\n${banter(F)}`;
}
function prepareShare() {
  shareCache = { text: shareText(), file: null };
  try {
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), F = run.final, name = currentClubName(), m = meta(name);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const imgs = [CRESTS[name] && (CRESTS[name]["128"] || CRESTS[name]["72"]), BRAND.logo_long_base, BRAND.logo_long_two].map(src => { const i = new Image(); if (src) i.src = src; return i; });
    const draw = () => {
      const [cr, lb, lt] = imgs;
      if (cr.naturalWidth) { g.globalAlpha = 0.16; g.drawImage(cr, W / 2 - 520, 120, 1040, 1040); g.globalAlpha = 1; }
      if (lb.naturalWidth) {
        const lw = 760, lh = lw * lb.naturalHeight / lb.naturalWidth;
        g.drawImage(lb, (W - lw) / 2, 90, lw, lh);
        const tmp = document.createElement("canvas"); tmp.width = lw; tmp.height = lh; const tg = tmp.getContext("2d");
        tg.drawImage(lt, 0, 0, lw, lh); tg.globalCompositeOperation = "source-in"; tg.fillStyle = m.text || NEUTRAL.text; tg.fillRect(0, 0, lw, lh);
        g.drawImage(tmp, (W - lw) / 2, 90);
      }
      if (cr.naturalWidth) g.drawImage(cr, W / 2 - 110, 300, 220, 220);
      g.textAlign = "center"; g.fillStyle = "#fff";
      g.font = "italic 900 78px 'Exo 2', sans-serif"; g.fillText(fullName(name), W / 2, 610);
      g.font = "600 44px 'Exo 2', sans-serif"; g.fillStyle = "#BDBDC6"; g.fillText(run.seasonKey + (run.mode === "daily" ? " · Daily challenge" : ""), W / 2, 670);
      g.fillStyle = "#0E0E10"; g.fillRect(90, 730, 900, 300); g.strokeStyle = "#222226"; g.lineWidth = 3; g.strokeRect(90, 730, 900, 300);
      g.font = "800 40px 'Exo 2', sans-serif"; g.fillStyle = "#8E8E99"; g.fillText("HISTORY", 315, 800); g.fillText("MINE", 765, 800);
      g.font = "italic 900 120px 'Exo 2', sans-serif"; g.fillStyle = "#fff"; g.fillText(ord(F.histFinish), 315, 925); g.fillStyle = m.text || NEUTRAL.text; g.fillText(ord(F.finish), 765, 925);
      g.font = "600 38px 'Exo 2', sans-serif"; g.fillStyle = "#BDBDC6"; g.fillText(F.histPts + " pts", 315, 990); g.fillText(F.pts + " pts", 765, 990);
      g.font = "italic 900 110px 'Exo 2', sans-serif"; g.fillStyle = m.text || NEUTRAL.text; g.fillText("THE RISE " + sign(F.rise), W / 2, 1160);
      g.font = "500 36px 'Exo 2', sans-serif"; g.fillStyle = "#BDBDC6"; wrap(g, banter(F), W / 2, 1240, 900, 44);
      c.toBlob(b => { if (b && shareCache) shareCache.file = new File([b], "drop2top.png", { type: "image/png" }); }, "image/png");
    };
    let left = imgs.filter(i => i.src).length;
    if (!left) draw(); else imgs.forEach(i => { if (!i.src) return; if (i.complete) { if (--left === 0) draw(); } else { i.onload = i.onerror = () => { if (--left === 0) draw(); }; } });
  } catch (e) {}
}
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t; }
  if (line) g.fillText(line, x, y);
}
async function share() {
  if (!shareCache) prepareShare();
  const { text, file } = shareCache;
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Result copied. Paste it into the group chat."); }
  catch (e) { openSheet("Your result", `<p style="white-space:pre-line;user-select:text;-webkit-user-select:text">${esc(text)}</p>`); }
}

/* ---------- record, how to play, latest updates ---------- */
function recordTotals() {
  let stars = 0; for (const c of Object.values(record.clubs)) stars += c.stars.filter(Boolean).length;
  return { runs: record.runs.length, bestRise: record.runs.length ? Math.max(...record.runs.map(r => r.rise)) : null, stars, titles: record.runs.filter(r => r.champions).length };
}
function viewRecord() {
  const t = recordTotals();
  const clubs = Object.entries(record.clubs).sort((a, b) => a[1].finish - b[1].finish);
  return `<section class="view"><img class="wm-emblem" src="${BRAND.emblem_white}" alt="">
    <div class="hrow">${logo("s")}<span class="label">Your record</span></div>
    <h1 class="h1" style="margin-top:8px">RECORD</h1>
    <div class="tiles four"><div class="tile"><span class="v">${t.runs}</span><span class="l">Runs</span></div><div class="tile"><span class="v" style="color:var(--text)">${t.bestRise == null ? "-" : sign(t.bestRise)}</span><span class="l">Best Rise</span></div><div class="tile"><span class="v">${t.stars}</span><span class="l">Stars</span></div><div class="tile"><span class="v">${t.titles}</span><span class="l">Titles</span></div></div>
    ${clubs.length ? `<div class="list">${clubs.map(([key, c]) => { const [season, club] = key.split(":"); return `<div class="li">${crest(club, 36)}<span class="tx" style="flex:1"><b>${esc(fullName(club))} ${esc(season)}</b><span>Best ${ord(c.finish)} · Rise ${sign(c.rise)} · ${c.runs} run${c.runs === 1 ? "" : "s"}</span></span><span style="display:flex">${c.stars.map(on => ICON.star(on)).join("")}</span></div>`; }).join("")}</div>`
      : `<div class="panel"><p class="soft">No finished seasons yet. Roll a club and see how far you can take them.</p></div>`}
    <p class="muted" style="font-size:12.5px">Your record is saved on this phone. Accounts, friends and leagues are coming next.</p>
    <div class="grow"></div>${nav("record")}</section>`;
}
function viewHowTo() {
  return `<section class="view"><div class="hrow">${logo("s")}<span class="label">How to play</span></div>
    <h1 class="h1" style="margin-top:8px">HOW TO PLAY</h1>
    <div class="panel"><p class="soft">${HOWTO}</p></div>
    <button class="btn2" data-act="nav" data-to="updates">Latest updates</button>
    <div class="grow"></div>${nav("howto")}</section>`;
}
const HOWTO = [
  "<b style='color:#fff'>They went down. How high can you take them?</b>",
  "Roll three relegated club-seasons and pick one. Set your formation and starting XI from the real squad, then the rest of the squad is gone: it's just your 11.",
  "You get 17 rolls a season: 3 in pre-season, 1 every 3 games, 3 in the January window, then 1 every 3 games again. Each roll shows three players from that same Premier League season. Sign one and pick the shirt he takes, or pass.",
  "Cards come in bronze, silver, gold, club's best (purple) and the rare legend. Shirts light up green for a natural position, amber for a near one (90%) and red for a wrong one (70%).",
  "You have 5 respins a season. A respin throws away all three cards for three new ones, and respinning the club roll at the start uses one too. A player you pass on never comes back.",
  "Every match is simulated from your team's strength in defence, midfield and attack against the real opponent. The other clubs' real results stay as they were, unless you sign their players: then they get weaker from that week on.",
  "Your score is the Rise: places climbed against where the club really finished. Earn a star for surviving, for the top half and for winning the league."
].map(p => `<span style="display:block;margin-bottom:12px">${p}</span>`).join("");
const UPDATES = [["10 October 2026", [["2", "Every slide-up panel can be swept away: drag the bar or the title down, or tap the bar."], ["1", "The first playable DROP2TOP: roll a club, pick your XI, 17 transfer rolls, live matches, the rewritten table and an end-of-season summary to share."]]]];
function viewUpdates() {
  return `<section class="view"><div class="hrow"><button class="icon-btn" data-act="nav" data-to="howto" aria-label="Back">${ICON.back}</button>${logo("s")}<span class="label">Build ${esc(window.D2T_BUILD)}</span></div>
    <h1 class="h1" style="margin-top:8px">LATEST UPDATES</h1>
    ${UPDATES.map(([d, items]) => `<div class="panel"><span class="label m">${esc(d)}</span>${items.map(([n, t]) => `<p class="soft"><b style="color:var(--text)">${esc(n)}</b> ${esc(t)}</p>`).join("")}</div>`).join("")}
    <div class="grow"></div>${nav("howto")}</section>`;
}
function menuSheet() {
  const inRun = run && run.seasonKey;
  openSheet("Menu", `${inRun ? `<button class="btn2" data-act="hub">Club hub</button><button class="btn2" data-act="table">League table</button><button class="btn2" data-act="squad">Your XI</button>` : ""}
    <button class="btn2" data-act="mute">${settings.muted ? "Turn sound on" : "Turn sound off"}</button>
    <button class="btn2" data-act="fast">${settings.fastMatches ? "Watch matches play out" : "Instant match results"}</button>
    <button class="btn2" data-act="nav" data-to="howto">How to play</button>
    <button class="btn2" data-act="home">Home</button>`);
}

/* ========================== ACTIONS ========================== */
async function act(a, el) {
  const s = S();
  switch (a) {
    case "sheet-close": closeSheet(); return;
    case "ask-yes": ui.askResolve && ui.askResolve(true); return;
    case "ask-no": ui.askResolve && ui.askResolve(false); return;
    case "home": closeSheet(true); go("home"); return;
    case "nav": {
      closeSheet(true); const to = el.dataset.to;
      if (to === "leagues") { openSheet("Leagues", `<p>Make a league with your mates and every daily challenge you all play moves the table.</p><p>Leagues need accounts, which are coming next. Until then your record is saved on this phone.</p>`); return; }
      go(to); return;
    }
    case "account": openSheet("Guest", `<p>You're playing as a guest. Everything is saved on this phone.</p><p>Accounts, so your record follows you and you can join leagues, are coming next.</p>`); return;
    case "soon": openSheet(el.dataset.mode, `<p>${esc(MODES[el.dataset.mode] || "Coming soon.")}</p><p class="muted">Coming soon. Classic comes first.</p>`); return;
    case "mute": settings.muted = !settings.muted; SND.setMuted(settings.muted); save(KEY.settings, settings); if ($layer.innerHTML) closeSheet(true); render(); toast(settings.muted ? "Sound off" : "Sound on"); return;
    case "fast": settings.fastMatches = !settings.fastMatches; save(KEY.settings, settings); closeSheet(true); toast(settings.fastMatches ? "Matches now show the result straight away" : "Matches play out live again"); render(); return;
    case "menu": menuSheet(); return;
    case "newrun": {
      if (busy("newrun")) return;
      if (run && run.seasonKey && run.phase !== "summary" && !(await ask(`Start a new run? Your ${fullName(currentClubName())} ${run.seasonKey} run will be lost.`, { ok: "New run" }))) return;
      closeSheet(true);
      run = E.newRun({ seed: "r" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), catalogue: G.catalogue });
      ui.clubSel = 0; saveRun(); SND.play("roll3"); go("clubroll"); return;
    }
    case "daily": {
      if (busy("daily")) return;
      const day = dailyKey(), d = dailyEntry(day);
      if (record.daily && record.daily[day]) { openSheet("Daily challenge", `<p>You've played today's: ${esc(fullName(d.club))} ${esc(d.season)}, finished ${ord(record.daily[day].finish)} (Rise ${sign(record.daily[day].rise)}).</p><p class="muted">A new club every day at midnight.</p>`); return; }
      if (run && run.mode === "daily" && run.dailyDay === day && run.phase !== "summary") { go(run.phase === "setup" ? "hub" : resumeView()); return; }
      if (run && run.seasonKey && run.phase !== "summary" && !(await ask(`Play today's daily challenge? Your ${fullName(currentClubName())} ${run.seasonKey} run will be lost.`, { ok: "Play daily" }))) return;
      closeSheet(true);
      run = E.newRun({ seed: "daily-" + day, mode: "daily", catalogue: G.catalogue, fixedClub: d.key });
      run.dailyDay = day;
      const S2 = seasonOf(d.season), club = S2.clubs.findIndex(c => c.name === d.club);
      E.chooseClub(run, S2, relOf(S2, club));
      saveRun(); go("hub"); return;
    }
    case "continue": go(resumeView()); return;
    case "selclub": ui.clubSel = +el.dataset.i; SND.play("tap"); render(); return;
    case "clubspin": if (busy("clubspin")) return; if (E.respinClubs(run, G.catalogue)) { ui.clubSel = 0; saveRun(); SND.play("roll3"); render(); } else SND.play("buzzer"); return;
    case "pickclub": {
      if (busy("pickclub")) return;
      const o = catEntry(run.clubOffer[ui.clubSel]), S2 = seasonOf(o.season), club = S2.clubs.findIndex(c => c.name === o.club);
      E.chooseClub(run, S2, relOf(S2, club)); saveRun(); SND.play("lockin"); go("hub"); return;
    }
    case "squad": closeSheet(true); go("squad"); return;
    case "hub": closeSheet(true); go("hub"); return;
    case "formation": E.setFormation(run, s, el.dataset.f); saveRun(); SND.play("tap"); render(); return;
    case "slot": {
      const i = +el.dataset.i;
      if (ui.view === "squad") { if (run.phase === "setup") squadPicker(i); return; }
      if (ui.view === "roll" && ui.sel != null) { ui.slot = i; SND.play("tap"); render(); }
      return;
    }
    case "pickplayer": {
      const slot = +el.dataset.slot, id = +el.dataset.id;
      E.swapSetup(run, slot, id); saveRun(); closeSheet(true); SND.play("subIn"); render(); return;
    }
    case "startseason": if (busy("startseason")) return; if (E.startSeason(run, s)) { saveRun(); SND.play("lockin"); setTimeout(() => SND.play("roll3"), 300); ui.reveal = true; go("roll"); ui.reveal = false; } return;
    case "toroll": ui.reveal = true; go("roll"); return;
    case "tomatch": ui.ft = false; go("match"); return;
    case "tosummary": go("summary"); return;
    case "card": {
      const id = run.roll.cards[+el.dataset.i];
      if (ui.sel === id) { cardSheet(id); return; }
      ui.sel = id; ui.slot = null; SND.play("pick"); render(); return;
    }
    case "respin": if (busy("respin", 700)) return; if (E.respinCards(run, s)) { ui.sel = null; ui.slot = null; saveRun(); SND.play("roll3"); ui.reveal = true; render(); } else SND.play("buzzer"); return;
    case "pass": {
      if (busy("pass", 700)) return;
      E.pass(run, s); saveRun(); SND.play("tap"); afterRoll(); return;
    }
    case "sign": {
      if (busy("sign", 700) || ui.sel == null || ui.slot == null) return;
      const p = E.playerOf(s, ui.sel), out = E.playerOf(s, run.xi[ui.slot]);
      if (!E.sign(run, s, ui.sel, ui.slot)) return;
      saveRun(); SND.play("subIn"); toast(`${p.n} signed. ${out ? out.n + " leaves." : ""}`); afterRoll(); return;
    }
    case "kickoff": if (busy("kickoff", 900)) return; kickoff(); return;
    case "skipmatch": if (ui.anim) { const r = ui.anim.res; finishMatch(r, true); } return;
    case "afterft": {
      if (busy("afterft")) return;
      ui.ft = false;
      if (run.phase === "summary") { go("summary"); return; }
      if (run.phase === "window") { ui.reveal = true; SND.play("roll3"); go("roll"); return; }
      go("match"); kickoff(); return;
    }
    case "table": closeSheet(true); ui.tableTab = "now"; tableSheet(); return;
    case "ttab": ui.tableTab = el.dataset.t; $layer.querySelector(".sb").innerHTML = ui.tableBody(); return;
    case "share": share(); return;
  }
}
const MODES = {
  "Great Escape": "Start late in a doomed season with about ten games left to stay up.",
  "Title rescue": "Clubs that just missed the title, such as Liverpool 2013/14 and Arsenal 2022/23.",
  "Top2Drop": "Take the champions and try to get them relegated.",
  "Relegation race": "Two players, two clubs from the same season, sharing each roll.",
  "Poach": "Every card comes from the club you play next.",
  "Blind roll": "Player names stay hidden until you sign."
};
function afterRoll() {
  ui.sel = null; ui.slot = null;
  if (run.phase === "window") { ui.reveal = true; setTimeout(() => SND.play("roll3"), 150); render(); return; }
  ui.ft = false; go("match");
}
function resumeView() {
  if (!run) return "home";
  return run.phase === "clubroll" ? "clubroll" : run.phase === "setup" ? "hub" : run.phase === "window" ? "roll" : run.phase === "prematch" ? "match" : "summary";
}
function squadPicker(slot) {
  const s = S(), pos = E.FORMATIONS[run.formation][slot][0];
  const squad = E.squadOf(s, run.club);
  const order = { green: 0, amber: 1, red: 2 };
  squad.sort((a, b) => order[E.fitOf(a, pos)] - order[E.fitOf(b, pos)] || b.r - a.r);
  openSheet(`${pos}: pick a player`, squad.map(p => {
    const fit = E.fitOf(p, pos), inXI = run.xi.indexOf(p.id);
    return `<button class="sqrow" data-act="pickplayer" data-slot="${slot}" data-id="${p.id}" aria-current="${run.xi[slot] === p.id}"><span class="r" style="color:var(--${fit === "green" ? "natural" : fit === "amber" ? "near" : "wrong"})">${Math.round(E.effRating(p, pos))}</span><span class="tx"><b>${esc(p.n)}</b><span>${POS_NAME[p.b]} · rated ${p.r} · ${p.a} games, ${p.g} goals${inXI >= 0 ? ` · in your XI at ${E.FORMATIONS[run.formation][inXI][0]}` : ""}</span></span></button>`;
  }).join(""));
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  if (el.closest(".sheet") && el.closest(".sheet").dataset.dragged) return;
  try { act(el.dataset.act, el); } catch (err) { console.error(err); closeSheet(true); render(); }
});

/* ---------- start ---------- */
function intro(then) {
  if (RM) { then(); return; }
  const el = document.createElement("div");
  el.className = "intro"; el.innerHTML = `<img class="em" src="${BRAND.emblem_white}" alt="">${logo("l")}<p>Take a relegated club. Rewrite the season.</p>`;
  document.body.appendChild(el);
  let gone = false;
  const end = () => { if (gone) return; gone = true; el.classList.add("out"); setTimeout(() => el.remove(), 350); then(); };
  el.addEventListener("click", end);
  setTimeout(end, 2300);
}
history.replaceState({ v: "home" }, "");
if (run && run.v !== 1) run = null;
theme(null);
render();
intro(() => { settings.seenIntro = true; save(KEY.settings, settings); });
checkVersion();
window.D2T_UI = { get run() { return run; }, get ui() { return ui; }, act, render, go };
})();
