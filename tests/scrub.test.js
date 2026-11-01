// The season-over graph's scrub (Craig, 1 Nov, build 219, style B "Bubble on the graph"): a sideways drag shows the week's
// bubble with the right numbers (GW1 and the last week checked against the engine's table and history), a mostly upright
// drag leaves the page to scroll, release keeps the week, a tap outside goes back to the whole season, and the reveal
// still ends fully drawn. Needs Playwright's Chromium and the page served at http://localhost:8765 (or BASE).
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL: " + msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ord = (n) => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "?v=test");
  await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.game, null, { timeout: 30000 });
  await p.evaluate(() => {
    const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true;
    if (G.eng().phase === "setup") G.startSeason();
    for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } }
    window.D2T.save(); window.D2T.go("summary");
  });
  await p.waitForSelector(".sm-chart");
  await p.evaluate(() => document.querySelector(".sm-chart").scrollIntoView({ block: "center" })); await wait(2600);
  // what the engine says for GW1 and the last week
  const truth = await p.evaluate(() => {
    const st = window.D2T.game.eng(), F = st.final, N = st.played.length, tab = window.D2TE.table(window.D2T.game.S(), st, 1, window.D2T.game.S().deductions);
    const m1 = st.played[0], mN = st.played[N - 1], r1 = m1.real;
    return { N, pos1: F.positions[0], pts1: tab.find((r) => r.c === st.club).pts, h1: F.history[0], hpts1: r1[0] > r1[1] ? 3 : r1[0] === r1[1] ? 1 : 0,
      opp1: window.D2T.game.S().clubs[m1.opp].name, us1: m1.us, them1: m1.them, posN: F.finish, ptsN: F.pts, hN: F.history[N - 1], hptsN: F.histPts };
  });
  const box = await p.evaluate(() => { const r = document.querySelector(".sm-ghost").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const xOf = (i) => box.l + (28 + i * ((340 - 38) / (truth.N - 1))) / 340 * box.w, yMid = box.t + box.h * 0.5;
  const bub = () => p.evaluate(() => { const b = document.querySelector(".sm-bub"); return { on: b.classList.contains("on"), text: b.innerText.replace(/\s+/g, " ").trim() }; });
  const state = () => p.evaluate(() => ({ past: +document.querySelector(".sm-pastr").getAttribute("width"), scrub: getComputedStyle(document.querySelector(".sm-scrub")).opacity, y: (() => { let e = document.querySelector(".sm-chart"); while (e && e !== document.body) { if (e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e.scrollTop; e = e.parentElement; } return window.scrollY; })() }));
  // a touch drag through CDP: start, moves, end
  const cdp = await ctx.newCDPSession(p);
  const touch = async (pts) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const q of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: q[0], y: q[1] }] }); await wait(30); }
    return async () => { await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await wait(250); };
  };

  // the reveal ends fully drawn and nothing is scrubbed yet
  let s = await state();
  check(s.past === 340 && s.scrub === "0", "before a scrub the lines should be whole and the guide hidden: " + JSON.stringify(s));
  // a sideways drag to GW1: the bubble with GW1's numbers
  let up = await touch([[xOf(6), yMid], [xOf(4), yMid], [xOf(1), yMid], [xOf(0), yMid]]);
  let b = await bub();
  check(b.on, "the bubble did not show during a sideways drag");
  const want1 = `GW1 · ${truth.opp1}`;
  check(b.text.toUpperCase().startsWith(want1.toUpperCase()) && b.text.includes(`${ord(truth.pos1)} · ${truth.pts1} pts`) && b.text.includes(`${ord(truth.h1)} · ${truth.hpts1} pts · real`), `GW1's bubble is wrong: "${b.text}" want ${JSON.stringify(truth)}`);
  s = await state();
  check(s.past < 60 && s.scrub === "1", "past the scrub point the lines should dim: " + JSON.stringify(s));
  await up();
  b = await bub(); s = await state();
  check(!b.on && s.scrub === "1" && s.past < 60, "release should hide the bubble and keep the week: " + JSON.stringify({ b, s }));
  // the last week matches the final table and history
  up = await touch([[xOf(truth.N - 6), yMid], [xOf(truth.N - 3), yMid], [xOf(truth.N - 1), yMid], [box.l + box.w - 2, yMid]]);
  b = await bub();
  check(b.text.toUpperCase().startsWith(`GW${truth.N} ·`) && b.text.includes(`${ord(truth.posN)} · ${truth.ptsN} pts`) && b.text.includes(`${ord(truth.hN)} · ${truth.hptsN} pts`), `GW${truth.N}'s bubble is wrong: "${b.text}" want ${JSON.stringify(truth)}`);
  await up();
  // a tap outside the graph goes back to the whole season
  await p.mouse.click(30, 120); await wait(200);
  s = await state();
  check(s.past === 340 && s.scrub === "0", "a tap outside did not go back to the whole season: " + JSON.stringify(s));
  // a mostly upright drag scrolls the page and never scrubs
  const y0 = (await state()).y;
  up = await touch([[xOf(10), yMid], [xOf(10) + 2, yMid - 30], [xOf(10) + 3, yMid - 90], [xOf(10) + 3, yMid - 160]]);
  b = await bub(); await up(); s = await state();
  check(!b.on && s.scrub === "0", "an upright drag scrubbed: " + JSON.stringify(s));
  check(s.y > y0 + 40, `an upright drag on the graph did not scroll the page (${y0} -> ${s.y})`);
  check(!errs.length, "page errors: " + errs.join(" | "));
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: scrub (a sideways drag shows the bubble with GW1's and the last week's numbers from the engine, the rest dims, release keeps the week, a tap outside resets, an upright drag scrolls)");
})();
