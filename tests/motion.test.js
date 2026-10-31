// Small motions (Craig, 31 Oct, build 196; core/motion.js): the home shields roll in and end on their values, the
// season summary's finish lands on the right place with its suffix, both graph lines end fully drawn, a tap during any
// of them jumps it to the end and leaves nothing hidden, and with reduced motion the final values are there at once.
// Needs Playwright's Chromium and the page served at http://localhost:8765 (or BASE).
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL: " + msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// a finished Classic season, recorded, on the summary
const finishSeason = (p) => p.evaluate(() => {
  const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true;
  if (G.eng().phase === "setup") G.startSeason();
  for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } }
  window.D2T.save(); window.D2T.go("summary");
});
const finishWord = (p) => p.evaluate(() => { const r = window.D2T.state.record.runs; return window.D2T.ordinal(r[r.length - 1].finish); });
const homeReady = (p) => p.waitForFunction(() => location.hash.includes("home") && document.querySelector(".stg-sh"), null, { timeout: 30000 });
// the shown slide's shields: what they show and what they should end on
const shown = (p) => p.evaluate(() => {
  const sl = [...document.querySelectorAll(".stg-sl")].find((s) => s.style.visibility !== "hidden" && parseFloat(s.style.opacity || "1") > 0.95);
  return [...sl.querySelectorAll(".stg-st .stg-sh b")].map((b) => ({ t: b.textContent, v: b.dataset.v, odo: !!b.querySelector(".mo-odo") }));
});

(async () => {
  const browser = await chromium.launch();
  for (const rm of ["no-preference", "reduce"]) {
    const moving = rm === "no-preference";
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, reducedMotion: rm });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + "?v=test"); await homeReady(p);
    // a season on the record first, so the shields have numbers to roll to
    await finishSeason(p); await wait(moving ? 300 : 100);
    if (moving) {
      // a tap during the finish's roll jumps it to the end: the place and suffix, the tag shown, the tiles final
      const before = await p.evaluate(() => ({ pos: document.querySelector(".sm-pos").textContent, hold: !!document.querySelector(".sm-head.sm-hold") }));
      check(before.hold, "the verdict tag should be held hidden until its stamp");
      await p.mouse.click(200, 300); await wait(60);
      const at = await p.evaluate(() => ({ pos: document.querySelector(".sm-pos").textContent, head: getComputedStyle(document.querySelector(".sm-head")).opacity, hold: !!document.querySelector(".sm-hold"), odo: document.querySelectorAll(".sm .mo-odo").length, clip: document.querySelector(".sm-ps").style.clipPath }));
      check(at.pos === (await finishWord(p)) && at.head === "1" && !at.hold && !at.odo && !at.clip, `a tap did not jump the finish to its end: ${JSON.stringify(at)}`);
      await p.evaluate(() => window.D2T.go("summary")); await wait(100);
    }
    await wait(moving ? 3600 : 200);
    const want = await finishWord(p);
    const sum = await p.evaluate(() => ({ pos: document.querySelector(".sm-pos").textContent, parts: [...document.querySelectorAll(".sm-pos span")].map((s) => s.textContent), head: getComputedStyle(document.querySelector(".sm-head")).opacity, tiles: [...document.querySelectorAll(".sm-tile b")].map((b) => b.textContent) }));
    check(sum.pos === want && sum.parts.join("") === want && sum.parts.length === 2, `${rm}: the finish should land on ${want}, got ${JSON.stringify(sum)}`);
    check(sum.head === "1" && sum.tiles.every((t) => /^[+\-]?\d+$/.test(t)), `${rm}: the tag or tiles did not end shown: ${JSON.stringify(sum)}`);
    // both graph lines end fully drawn once the panel is in view; the targets end filled
    await p.evaluate(() => document.querySelector(".sm-ghost").scrollIntoView()); await wait(moving ? 2400 : 100);
    const g = await p.evaluate(() => { const r = document.querySelector(".sm-rev"), s = document.querySelector(".sm-ghost"); return { w: +r.getAttribute("width"), full: +s.viewBox.baseVal.width, lines: s.querySelectorAll('g[clip-path] polyline').length }; });
    check(g.lines === 2 && g.w === g.full, `${rm}: both graph lines should end fully drawn: ${JSON.stringify(g)}`);
    await p.evaluate(() => document.querySelector(".sm-ach").scrollIntoView()); await wait(moving ? 2400 : 100);
    check(await p.evaluate(() => !document.querySelector(".sm-wait, .sm-achf")), `${rm}: a target was left unfilled`);
    // home: the shown slide's shields end on their values (and roll there with motion on)
    await p.evaluate(() => { window.D2T.state.stageAt = "classic"; window.D2T.save(); window.D2T.go("home"); }); await homeReady(p);
    if (moving) {
      await wait(500);
      const mid = await shown(p);
      check(mid.some((x) => x.odo || x.t !== x.v), `the shields did not roll: ${JSON.stringify(mid)}`);
      await wait(2600);
      const end = await shown(p);
      check(end.every((x) => x.t === x.v && !x.odo), `the shields did not end on their values: ${JSON.stringify(end)}`);
      // once per slide per visit: back on it, no roll again
      await p.keyboard.press("ArrowRight"); await wait(900); await p.keyboard.press("ArrowLeft"); await wait(700);
      check((await shown(p)).every((x) => x.t === x.v && !x.odo), "the shields rolled a second time in one visit");
      // a tap during a roll jumps it to the end
      await p.evaluate(() => window.D2T.go("account")); await wait(200); await p.evaluate(() => window.D2T.go("home")); await homeReady(p); await wait(500);
      await p.mouse.click(196, 120); await wait(60);
      check((await shown(p)).every((x) => x.t === x.v && !x.odo), "a tap did not jump the shields to their values");
    } else {
      await wait(300);
      check((await shown(p)).every((x) => x.v === undefined && !x.odo), "reduced motion: the shields should show their values at once");
      check(await p.evaluate(() => !document.querySelector(".mo-odo, .mo-glint")), "reduced motion: something rolled or glinted");
    }
    check(!errs.length, `${rm}: page errors: ${errs.join(" | ")}`);
    await ctx.close();
  }
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: motion (the finish lands with its suffix, the tag and tiles end shown, both graph lines drawn, the targets filled, the home shields end on their values once a visit, a tap jumps each to its end, reduced motion at once)");
})();
