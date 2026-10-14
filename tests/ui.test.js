// Plays a run through the real page on a 390x844 phone screen: intro, home, club spin, the historic table,
// pre-season squad, three pre-season rolls (sign, place, pass), fixtures and a live match, then fast-forwards
// the rest of the season through the game adapter and checks the summary, the record and a refresh.
// node tests/ui.test.js   (screenshots go to tests/output/)
const path = require("path"), fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const OUT = path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_NAME|net::/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", (d) => { errors.push("native dialog used: " + d.message()); d.dismiss(); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + ".png") });
  // every game's share card (Craig, 13 Oct): built ahead, its message starts as it should and ends with the link
  const card = async (name, starts) => {
    await page.waitForFunction(() => window.D2T.share && window.D2T.share.last && window.D2T.share.last.done, null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => { const l = window.D2T.share.last; return { text: l.text, png: l.canvas ? l.canvas.toDataURL("image/png") : "", file: !!l.file }; });
    check(r.file && r.text.startsWith(starts) && r.text.trim().endsWith("404craig.github.io/D2T"), `the ${name} share card is missing or its message is wrong: ${JSON.stringify(r.text)}`);
    if (process.env.SHARE_DIR && r.png) fs.writeFileSync(path.join(process.env.SHARE_DIR, name + ".png"), Buffer.from(r.png.split(",")[1], "base64"));
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const screen = () => page.evaluate(() => window.D2T.currentScreen());
  const expectScreen = async (name, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if ((await screen()) === name) return; await wait(100); }
    throw new Error(`expected screen ${name}, on ${await screen()}`);
  };
  const check = (ok, msg) => { if (!ok) errors.push(msg); };
  // real touches through the devtools protocol (pointer events with touch-action and no click after a drag, as a phone)
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const centre = async (sel) => { const el = await page.$(sel), b = el && await el.boundingBox(); return b && b.width ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
  // a finger drag from a point to a point, or to a selector that may only show up once the drag is under way
  const touchDrag = async (from, to, { steps = 8, stepMs = 16 } = {}) => {
    await touch("touchStart", from.x, from.y);
    let cur = { x: from.x, y: from.y - 12 };
    await touch("touchMove", cur.x, cur.y); await wait(stepMs);
    for (let i = 1; i <= steps; i++) {
      const dest = (typeof to === "string" ? await centre(to) : to) || { x: 195, y: 300 }, left = steps - i + 1;
      cur = { x: cur.x + (dest.x - cur.x) / left, y: cur.y + (dest.y - cur.y) / left };
      await touch("touchMove", cur.x, cur.y); await wait(stepMs);
    }
    await touch("touchEnd", cur.x, cur.y);
  };
  // a roll has settled: a purple or legend card's reveal (screens/reveal.js) counts the roll as spun as it starts, so also
  // wait for the reels to stop (is-rolling); a reveal takes about 16 s, two in one roll about 33 s
  const spunNow = () => { const e = window.D2T.game.eng(); return e.roll && window.D2T.state.run.spun === `${e.roll.key}.${e.roll.spin}` && !document.querySelector(".sp-screen.is-rolling"); };
  const ROLL_MS = 45000;
  const smallButtons = async (where) => {
    const small = await page.$$eval("button", (bs) => bs.filter((b) => b.offsetParent && getComputedStyle(b).visibility !== "hidden" && b.getBoundingClientRect().height < 40 && b.getBoundingClientRect().width < 40).map((b) => (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 30)));
    if (small.length) errors.push(`tap targets under 40px on ${where}: ${small.join(", ")}`);
  };

  // every in-game bar (Craig, 13 Oct): home first, the round middle button, the main button last; every bar is a game-bar
  const barOrder = async (where) => {
    const bad = await page.$$eval(".actionbar, .sp-bar", (bars) => bars.filter((b) => b.offsetParent).map((b) => {
      const bs = [...b.children].filter((el) => el.tagName === "BUTTON");
      if (!b.classList.contains("game-bar")) return "not a game-bar";
      if (bs.length < 3) return "fewer than 3 buttons";
      if (!bs[0].classList.contains("bar-home") || !/home/i.test(bs[0].getAttribute("aria-label") || "")) return "home is not first";
      if (!bs[1].classList.contains("bar-mid") || getComputedStyle(bs[1]).borderRadius !== "50%" && !/^(28|29|30)px$/.test(getComputedStyle(bs[1]).borderRadius)) return "the middle button is not the round one";
      if (!bs[bs.length - 1].classList.contains("bar-main")) return "the main button is not last";
      const r = bs[0].getBoundingClientRect(), m = bs[bs.length - 1].getBoundingClientRect();
      const mainW = bs.filter((x) => x.classList.contains("bar-main")).reduce((t, x) => t + x.getBoundingClientRect().width, 0);   // Unbeaten splits it between Lower and Higher
      if (Math.round(r.width) !== 56 || Math.round(r.height) !== 56 || m.height < 56 || mainW < r.width * 2) return `sizes off: home ${Math.round(r.width)}x${Math.round(r.height)}, main ${Math.round(mainW)}x${Math.round(m.height)}`;
      return "";
    }).filter(Boolean));
    if (bad.length) errors.push(`bar order on ${where}: ${bad.join("; ")}`);
    if (!(await page.$(".actionbar, .sp-bar"))) errors.push(`no bottom bar on ${where}`);
  };

  await page.goto(process.env.D2T_URL || "file://" + path.join(__dirname, "..", "index.html"));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("d2t-v2", JSON.stringify({ settings: { muted: true } })); });
  await page.reload();
  await expectScreen("intro");
  await wait(700); await shot("01-intro");
  await page.click(".fr-skip", { force: true });
  await expectScreen("home");
  await wait(900); await shot("02-home"); await smallButtons("home");

  // ---------- new run: the club spin ----------
  await page.click('[data-act="pick"]');
  await expectScreen("spin");
  await wait(900); await shot("03-spin"); await barOrder("club spin");
  check(!!(await page.$(".sp-tip")), "no respins note on a new run's club spin");
  await page.click(".sp-main");
  await wait(600);
  check(!(await page.$(".sp-tip")), "the respins note did not go after the first spin");
  await page.waitForFunction(() => window.D2T.state.run.spun === true, null, { timeout: 8000 });
  await wait(400); await shot("04-spin-landed");
  await page.click(".sp-slot >> nth=1"); await wait(300);
  await page.click(".sp-main");
  await expectScreen("table");
  await wait(1200); await shot("05-table-reveal"); await barOrder("table");
  await page.click(".actionbar .bar-main"); await wait(500);
  await shot("06-table-reset");
  await page.click(".actionbar .bar-main");
  await expectScreen("squad");
  await wait(800); await shot("07-squad-preseason"); await smallButtons("squad");
  // the home button sits bottom left in a run and opens the run menu (Craig, 13 Oct)
  check(await page.evaluate(() => { const b = document.querySelector(".actionbar"); return b && b.firstElementChild.classList.contains("se-home") && b.lastElementChild.classList.contains("bar-main"); }), "squad: the home button is not bottom left with the main button last");
  await barOrder("squad");
  await page.click(".actionbar .se-home"); await wait(500);
  check(!!(await page.$('.sheet [data-k="restart"]')) && !!(await page.$('.sheet [data-k="quit"]')) && !!(await page.$('.sheet [data-k="home"]')), "the run menu does not offer Restart, Home and Quit");
  await page.click('.sheet [data-k="keep"]'); await wait(500);
  check((await screen()) === "squad" && !(await page.$(".sheet")), "Keep playing did not stay on the squad");

  // formation change before the season
  await page.click(".se-formlink"); await wait(500); await shot("08-formations");
  await page.click('.se-formcard[data-f="4-3-3"]'); await wait(200);
  await page.click(".se-done"); await wait(700);
  check(await page.evaluate(() => window.D2T.game.eng().formation === "4-3-3"), "formation did not change to 4-3-3");
  check(await page.evaluate(() => window.D2T.game.eng().xi.length === 11), "XI is not 11 players");

  // ---------- pre-season rolls: sign twice, pass once ----------
  await page.click(".se-play");
  await expectScreen("transfer");
  for (let r = 0; r < 3; r++) {
    await page.waitForSelector(".sp-main:not([disabled])", { timeout: 6000 });
    await wait(300);
    // the roll header (Craig, 14 Oct): one track segment per roll, "Transfer N of M", the Summer window banner
    if (r === 0) check(await page.evaluate(() => { const t = window.D2T.game.rollTrack(), segs = document.querySelectorAll(".tr-track .tr-seg"); return segs.length === t.length && t.length === window.D2T.game.eng().rolls.reduce((a, x) => a + x.n, 0) && document.querySelectorAll(".tr-seg.is-current").length === 1 && /^Transfer 1 of \d+$/.test(document.querySelector(".sp-kicker").textContent) && /Summer window/i.test(document.querySelector(".tr-banner").textContent) && document.querySelectorAll(".tr-dots i.is-on").length === 1 && /Sign one or pass\.$/.test(document.querySelector(".sp-sub").textContent) && !/Roll/.test(document.querySelector(".sp-sub").textContent); }), "the transfer roll header (track, kicker, Summer banner, sub) is wrong");
    const before = await page.evaluate(() => window.D2T.game.eng().signed.length);
    // the last roll carries a legend in the middle (the roll's own cards, swapped in the engine state for the test):
    // his reel never lands on its own, the reveal plays over the screen, then he drops into his slot (Craig, 13 Oct)
    // the other two slots are made plain cards too, so a purple drawn by the seed can't add a second reveal
    if (r === 2) await page.evaluate(() => { const G = window.D2T.game, S = G.S(), e = G.eng(), used = new Set([...e.seen, ...e.roll.cards, ...e.xi]); e.roll.cards[1] = G.legends.find((l) => !used.has(l.id)).id; for (const i of [0, 2]) { if (!/purple|legend/.test(G.card(S, e.roll.cards[i]).level)) continue; const p = S.players.find((q) => !used.has(q.id) && !/purple|legend/.test(G.card(S, q.id).level)); used.add(p.id); e.roll.cards[i] = p.id; } });
    await page.click(".sp-main");
    if (r === 2) {
      check(!!(await page.waitForSelector(".rr-ov", { timeout: 6000 }).catch(() => null)), "no rare reveal for a legend in the roll");
      await wait(9000); await shot("10d-rare-reveal");
    }
    await page.waitForFunction(spunNow, null, { timeout: ROLL_MS });
    if (r === 2) await page.waitForFunction(() => !document.querySelector(".rr-ov"), null, { timeout: 15000 }).catch(() => {});
    if (r === 2) check(await page.evaluate(() => !document.querySelector(".rr-ov") && document.querySelectorAll(".sp-slot")[1].querySelector(".sp-node.is-hit .d2c").dataset.level === "legend"), "the legend did not land in his slot after the reveal");
    if (r === 1) {
      // a finger on a card the instant the last reel lands, before the tray has dropped, must still pick him up
      // and drag him onto a shirt once the pitch is up (Craig, 12 Oct: "at times dragging doesn't select the player")
      check(!(await page.$(".sp-screen.is-placing")), "the tray was already up when the roll settled, so the early drag is not tested");
      await touchDrag(await centre(".sp-slot >> nth=1"), '.tr-field .se-cardwrap[data-i="5"]', { steps: 30, stepMs: 40 });
    }
    await wait(400);
    if (r === 0) { await shot("09-roll-landed"); await barOrder("transfer roll"); }
    if (r !== 1) { await page.waitForSelector(".sp-screen.is-placing", { timeout: 4000 }); await wait(700); }
    if (r === 0) await shot("10-placing");
    if (r === 2) {
      check((await page.textContent(".sp-main")).trim() === "Pass", "main button is not Pass after the roll lands");
      await page.click(".sp-main");
      await wait(600);
      check(await page.evaluate((b) => window.D2T.game.eng().signed.length === b, before), "pass signed a player");
      break;
    }
    if (r === 0) {
      // a touch drag dropped on nothing ends with no click, and must not eat the tap that follows
      await touchDrag(await centre(".sp-slot >> nth=1"), { x: 40, y: 780 }); await wait(400);
      // tap a card, then a shirt (the best one pulses)
      await page.click(".sp-slot >> nth=0"); await wait(400);
      check(await page.evaluate(() => document.querySelector(".sp-slot.is-sel") === document.querySelector(".sp-slot")), "a tap after a drag dropped on nothing did not select the card");
      await shot("10b-selected");
      check((await page.$$('.tr-field .se-slot[class*="se-pf-"]')).length === 11, "selecting a card did not colour all 11 shirts by fit");
      // the transfer pitch's cards are 57.5 x 75 where the pitch has the height (Craig, 14 Oct), 50 x 65 where it has not
      const trSize = await page.evaluate(() => { const f = document.querySelector(".tr-field"), c = getComputedStyle(f.querySelector(".se-slot .d2c")); return { h: f.clientHeight, big: f.classList.contains("tr-big"), w: parseFloat(c.width), ch: parseFloat(c.height) }; });
      check(trSize.big === trSize.h >= 400 && (trSize.big ? trSize.w === 57.5 && trSize.ch === 75 : trSize.w === 50 && trSize.ch === 65), "transfer pitch cards are the wrong size: " + JSON.stringify(trSize));
      await page.click(".tr-field .se-slot.se-best .se-cardwrap", { force: true });
    }
    await wait(500);
    if (r === 0) await shot("10c-signed");
    check(await page.evaluate((b) => window.D2T.game.eng().signed.length === b + 1, before), `roll ${r + 1}: signing did not go through`);
    await wait(900);
    if (r < 2) await expectScreen("transfer");
  }
  // the window over: straight to the fixtures (Craig, 14 Oct); the squad is reached by the fixtures' back arrow
  await expectScreen("fixtures");
  await wait(700); await shot("11-fixtures-gw1"); await barOrder("fixtures");
  check(await page.evaluate(() => window.D2T.game.lineup().subs.length === 0), "squad players still on the bench after the season started");
  check((await page.textContent(".actionbar .bar-main")).trim() === "Kick off", "the fixtures' main button should read Kick off");
  check(!!(await page.$(".actionbar .se-back:not([disabled])")), "fixtures: no live back button in the middle of the bar");
  await page.click(".actionbar .se-back"); await expectScreen("squad"); await wait(600); await shot("12-squad-gw1"); await barOrder("squad mid-season");
  check(/Gameweek 1/.test(await page.textContent(".se-sqsub")) && (await page.textContent(".actionbar .bar-main")).trim() === "Fixtures", "the mid-season squad (by back) should show Gameweek 1 and lead back to the fixtures");
  // a refresh on the squad keeps you there; a run screen out of turn goes to the fixtures
  await page.reload(); await expectScreen("intro"); await page.click(".fr-skip", { force: true }); await expectScreen("home"); await wait(700);
  await page.click('[data-act="continue"]'); await expectScreen("squad"); await wait(500);
  await page.click(".actionbar .bar-main"); await expectScreen("fixtures"); await wait(500);
  await page.evaluate(() => window.D2T.go("match")); await wait(400);
  check((await screen()) === "fixtures", "the match screen opened before Kick off, on " + (await screen()));

  // ---------- gameweek 1: Kick off from the fixtures, the live match, the results, the table ----------
  await page.click(".actionbar .bar-main");
  await expectScreen("match");
  await wait(2500); await shot("13-match-live"); await barOrder("match live");
  check(await page.evaluate(() => window.D2T.game.eng().played.length === 1 && window.D2T.state.run.match === 1 && !window.D2T.state.run.watch), "Kick off did not decide the match in the engine");
  check(!!(await page.$(".actionbar .se-off")) && (await page.textContent(".se-main")).trim() === "Skip to end", "match live: the middle button should be greyed and the main button Skip to end");
  // the info panel and the scorers panel sit under the score while the match plays out (Craig, 14 Oct)
  check((await page.$$(".se-match .se-pv")).length === 3 && /played out by the game/.test(await page.textContent(".se-match .se-preview")), "the ratings panel is not on the match screen");
  check(!!(await page.$(".se-match .se-scorers")) && (await page.$$(".se-match .se-scorers ul")).length === 2 && !!(await page.$(".se-match .se-scorers .se-ball")), "the scorers panel is not on the match screen");
  // refresh mid-match: the result is already decided and must not replay or change; Continue goes on to the results
  const res1 = await page.evaluate(() => JSON.stringify(window.D2T.game.eng().played[0]));
  await page.reload(); await expectScreen("intro");
  await page.click(".fr-skip", { force: true }); await expectScreen("home"); await wait(700);
  check(await page.evaluate((r) => JSON.stringify(window.D2T.game.eng().played[0]) === r, res1), "refresh changed the GW1 result");
  await page.click('[data-act="continue"]'); await wait(1600);
  check((await screen()) === "results", "Continue after a refresh mid-match should go on to the results, on " + (await screen()));
  // back shows the match settled at full time with every goal and the chip
  await page.click(".actionbar .se-back"); await expectScreen("match"); await wait(600);
  check((await page.textContent(".se-main")).trim() === "See results" && (await page.textContent(".se-clock")).trim() === "FT", "back from the results should show the match settled at full time with See results");
  const goals1 = await page.evaluate(() => { const r = window.D2T.game.eng().played[0]; return r.us + r.them; });
  check((await page.$$(".se-match .se-scorers li:not(.se-none)")).length === goals1, "the settled match's scorers panel does not list every goal");
  check(!!(await page.$(".se-match .se-result:not([hidden])")), "no result chip at full time");
  await wait(3600);
  check((await screen()) === "match", "the settled match (back from the results) should not move on by itself");
  await shot("14-match-ft");
  // See results: the gameweek's scores, mine on top, then the table after the gameweek, then on
  await page.click(".se-main"); await expectScreen("results"); await wait(800); await shot("15-results"); await barOrder("results");
  check(!!(await page.$(".se-results .se-myres .se-myfx-score")) && !!(await page.$(".se-results .se-myres .se-scorers")), "the results screen has no highlighted match of mine with its score and scorers");
  check((await page.$$(".se-results .se-fx-res")).length > 0 && (await page.$$(".se-results .se-fx-date")).length > 0, "the results screen lists no other scores by date");
  check((await page.textContent(".actionbar .bar-main")).trim() === "League table", "the results' main button should read League table");
  // a refresh on the results lands back on them
  await page.reload(); await expectScreen("intro"); await page.click(".fr-skip", { force: true }); await expectScreen("home"); await wait(700);
  await page.click('[data-act="continue"]'); await expectScreen("results"); await wait(600);
  // back to the settled match and forward again
  await page.click(".actionbar .se-back"); await expectScreen("match"); await wait(400);
  check((await page.textContent(".se-main")).trim() === "See results", "back from the results should show the settled match");
  await page.click(".se-main"); await expectScreen("results"); await wait(400);
  await page.click(".actionbar .bar-main"); await expectScreen("standings"); await wait(1800); await shot("15b-standings"); await barOrder("standings");
  // the season's own club count: 22 up to 1994/95, and the club-season is random now
  const nClubs = await page.evaluate(() => window.D2T.game.S().clubs.length), nRows = (await page.$$(".se-aftertable .se-tr:not(.se-th)")).length;
  check(nRows === nClubs, "the table after the gameweek has " + nRows + " rows, not " + nClubs);
  await page.click(".actionbar .bar-main"); await wait(800);
  const after = await screen();
  check(["fixtures", "transfer"].includes(after), "after GW1 expected fixtures or transfer, got " + after);
  check(await page.evaluate(() => window.D2T.state.run.match == null), "run.match was not cleared after the table");
  // gameweek 2 played live: Skip to end, then the finished match moves on to the results by itself (Craig, 14 Oct)
  if (after === "transfer") { await page.evaluate(() => { const G = window.D2T.game; while (G.eng().phase === "window") G.pass(); window.D2T.go("fixtures"); }); await expectScreen("fixtures"); await wait(500); }
  await page.click(".actionbar .bar-main"); await expectScreen("match"); await wait(1200);
  await page.click(".se-main"); await wait(600);
  check((await screen()) === "match" && (await page.textContent(".se-clock")).trim() === "FT", "Skip to end did not show full time first");
  await page.waitForFunction(() => window.D2T.currentScreen() === "results", null, { timeout: 6000 }).catch(() => {});
  check((await screen()) === "results", "the finished match did not move on to the results by itself, on " + (await screen()));
  await page.click(".actionbar .bar-main"); await expectScreen("standings"); await wait(600);
  await page.click(".actionbar .bar-main"); await wait(800);

  // ---------- the rest of the season through the adapter ----------
  const seasonOver = await page.evaluate(() => {
    const G = window.D2T.game;
    for (let i = 0; i < 400; i++) {
      const e = G.eng();
      if (e.phase === "summary") return true;
      if (e.phase === "window") G.pass();
      else { G.play(); G.afterMatch(); }
    }
    return false;
  });
  check(seasonOver, "season did not finish");
  await page.evaluate(() => window.D2T.go("summary"));
  await expectScreen("summary");
  await wait(1600); await shot("16-summary"); await smallButtons("summary");
  // the end sheet (Craig, 14 Oct): no bottom bar; Share, Play again and Home on one sheet, the summary behind it
  check(!(await page.$(".actionbar")), "the summary should have no bottom bar");
  const endKeys = async () => page.$$eval(".end-sheet [data-k]", (bs) => bs.map((b) => b.dataset.k + ":" + b.textContent.trim()));
  check((await endKeys()).join("|") === "share:Share result|again:Play again|home:Home", "the Classic end sheet should offer Share, Play again and Home, got " + (await endKeys()).join("|"));
  // dragged closed: a peek bar brings it back, and the summary scrolls behind
  { const bar = await page.$(".end-sheet .sheet-bar"); const bb = await bar.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + 220, { steps: 6 }); await page.mouse.up(); await wait(500); }
  check(!(await page.$(".end-sheet")) && !!(await page.$(".end-peek")) && /Season over/.test(await page.textContent(".end-peek")), "closing the end sheet should leave a Season over peek bar");
  await page.evaluate(() => document.querySelector(".screen-body").scrollTo(0, 99999)); await wait(400); await shot("17-summary-bottom");
  await page.click(".end-peek"); await wait(500);
  check(!!(await page.$(".end-sheet")) && !(await page.$(".end-peek")), "the peek bar did not bring the end sheet back");
  // the run is over: Home goes straight home, no menu
  await page.click('.end-sheet [data-k="home"]'); await expectScreen("home"); await wait(500);
  check(!(await page.$(".sheet")), "summary: Home should go straight home once the run is over");
  await page.evaluate(() => window.D2T.go("summary")); await expectScreen("summary"); await wait(1200);
  await card("classic", "DROP2TOP\nI took ");
  await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(500);
  const scored = await page.evaluate(() => window.D2T.game.eng().played.some((r) => r.us > 0));
  check(!scored || (await page.$$eval(".sm-award span", (els) => els.some((e) => /Top scorer/.test(e.textContent)))), "no top scorer award although the club scored");
  await page.evaluate(() => document.querySelector(".screen-body").scrollTo(0, 99999)); await wait(300);
  await page.click('[data-act="table"]'); await wait(600); await shot("18-final-table");
  // the sheet closes by dragging its bar down
  const bar = await page.$(".sheet-bar"); const bb = await bar.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + 220, { steps: 6 }); await page.mouse.up(); await wait(500);
  check((await page.$$(".sheet")).length === 0, "final table sheet did not close on drag");

  const rec = await page.evaluate(() => window.D2T.state.record.runs.length);
  check(rec === 1, "expected 1 recorded run, got " + rec);
  await page.reload(); await expectScreen("intro");
  await page.click(".fr-skip", { force: true }); await expectScreen("home");
  await page.evaluate(() => window.D2T.go("summary")); await wait(800);
  check((await screen()) === "summary", "the finished season's summary did not reopen after a refresh");
  check((await page.evaluate(() => window.D2T.state.record.runs.length)) === 1, "refresh recorded the run twice");
  await wait(1000); check(!!(await page.$(".end-sheet")), "the end sheet did not reopen with the summary after a refresh");

  // ---------- other screens ----------
  for (const s of ["home", "howto", "league", "account", "stats"]) {
    await page.evaluate((n) => window.D2T.go(n), s); await wait(900);
    check((await screen()) === s, `could not open ${s}`);
    await shot("20-" + s);
  }
  // back arrow on a secondary page returns where you came from
  await page.evaluate(() => window.D2T.go("stats")); await wait(500);
  await page.click(".back-btn"); await wait(500);
  check((await screen()) === "account", "back from stats did not return to account, on " + (await screen()));

  // account: sign in against a stand-in for the Tenaball server (no real accounts touched)
  await page.route("**/api/signin", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ token: "a".repeat(64), user: { id: "x", name: "Craig", email: "craig@example.com" }, stats: {} }) }));
  await page.route("**/api/signout", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  await page.route("**/api/me", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ user: { id: "x", name: "Craig", email: "craig@example.com" } }) }));
  await page.fill('input[name="email"]', "craig@example.com"); await page.fill('input[name="pin"]', "1234");
  await page.click('.fr-form [type="submit"]'); await wait(600);
  check(/Craig/.test(await page.textContent(".fr-who-name").catch(() => "")), "sign in did not show the account");
  await shot("21-account-signed-in");
  await page.click('[data-act="out"]'); await wait(500);
  check(!!(await page.$('input[name="email"]')), "sign out did not return to the sign-in form");

  // a run screen out of turn sends you to where the run is
  await page.evaluate(() => window.D2T.go("squad")); await wait(400);
  check((await screen()) === "summary", "squad opened after the season ended");

  // play again from the summary's end sheet
  await page.evaluate(() => window.D2T.go("summary")); await wait(600);
  await page.waitForSelector('.end-sheet [data-k="again"]', { timeout: 4000 }); await page.click('.end-sheet [data-k="again"]');
  await expectScreen("spin");
  check(await page.evaluate(() => window.D2T.game.eng().phase === "clubroll"), "play again did not start a new run");

  // ---------- Dare2Dream: any club, beat their real finish ----------
  const classicBefore = await page.evaluate(() => JSON.stringify(window.D2T.game.record()));
  // Dare2Dream is locked for repair (Craig, 13 Oct): its card on home doesn't open; unlocked here to keep testing the mode
  await page.evaluate(() => window.D2T.go("home")); await wait(900);
  check(!!(await page.$('.fr-gm.fr-locked[aria-disabled="true"]')) && !(await page.$('[data-act="pick"][data-mode="dare2dream"]')) && /LOCKED FOR REPAIR/.test(await page.textContent(".fr-gm.fr-locked")), "the Dare2Dream card should be locked for repair");
  await page.evaluate(() => { window.D2T.game.dreamLocked = false; window.D2T.go("league"); }); await wait(400);
  await page.evaluate(() => window.D2T.go("home")); await wait(900);
  await page.click('[data-act="pick"][data-mode="dare2dream"]');
  await page.waitForSelector(".sheet [data-k='yes']", { timeout: 2000 }).then(() => page.click(".sheet [data-k='yes']")).catch(() => {});
  await expectScreen("spin");
  check(await page.evaluate(() => window.D2T.game.mode() === "dare2dream"), "Dare2Dream run did not start in its mode");
  await wait(700); await page.click(".sp-main");
  await page.waitForFunction(() => window.D2T.state.run.spun === true, null, { timeout: 8000 });
  await wait(400); await shot("30-d2d-spin");
  check(await page.evaluate(() => window.D2T.game.offer().every((c) => c && c.key && window.D2T_GAME.clubSeasons.some((x) => x.key === c.key))), "Dare2Dream offer not from every club-season");
  await page.click(".sp-slot >> nth=0"); await wait(300); await page.click(".sp-main");
  await expectScreen("table"); await page.click(".actionbar .bar-main"); await wait(400);
  check(/dream|Beat it|Do it again/i.test(await page.textContent(".se-fin")), "table does not show the Dare2Dream target");
  await page.click(".actionbar .bar-main"); await expectScreen("squad"); await wait(600);
  check(/Draft your XI/.test(await page.textContent(".se-sqsub")), "squad shows Draft your XI before the draft");
  check(await page.evaluate(() => window.D2T.game.eng().phase === "draft" && window.D2T.game.eng().xi.every((x) => x == null)), "Dare2Dream should start with no players");
  await shot("31-d2d-empty");
  // the draft: one spin per shirt, tap then Sign for the first, drag for the second, the rest through the adapter
  await page.click(".se-play"); await expectScreen("transfer");
  await page.waitForSelector(".sp-bar", { timeout: 8000 }).catch(() => {});   // the window's emblem burst comes first
  check(!!(await page.$(".sp-round.is-reload[disabled][aria-hidden='true']")), "the draft's respin should be greyed (disabled, hidden from assistive tech)");
  await barOrder("draft");
  for (let k = 0; k < 2; k++) {
    await page.waitForSelector(".sp-main:not([disabled])", { timeout: 8000 }); await wait(250);
    await page.click(".sp-main");
    if (k === 1) {
      // the draft too: a finger on a card as the roll settles, dragged onto the lit shirt once the pitch is up
      await page.waitForFunction(spunNow, null, { timeout: ROLL_MS });
      await touchDrag(await centre(".sp-slot >> nth=1"), ".tr-field .se-slot.se-best .se-cardwrap", { steps: 30, stepMs: 40 });
    }
    else { await page.waitForSelector(".sp-screen.is-placing", { timeout: ROLL_MS }); await wait(600); }
    if (k === 0) { await shot("31b-d2d-draft"); await page.click(".sp-slot >> nth=0"); await wait(300); await page.click(".sp-main"); }
    await wait(1200);
    check(await page.evaluate((n) => window.D2T.game.eng().xi.filter((x) => x != null).length === n, k + 1), `draft pick ${k + 1} did not land`);
  }
  await page.evaluate(() => { const G = window.D2T.game; while (G.inDraft()) G.draftPick(G.rollCards()[0].id); window.D2T.go("squad"); });
  await expectScreen("squad"); await wait(500);
  check(await page.evaluate(() => window.D2T.game.eng().phase === "setup" && window.D2T.game.eng().xi.every((x) => x != null)), "the draft did not fill 11 shirts");
  await page.click(".se-play"); await wait(800);
  check((await screen()) === "fixtures", "Dare2Dream should go straight to GW1 (no pre-season rolls), on " + (await screen()));
  await page.evaluate(() => { const G = window.D2T.game; for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } window.D2T.go("summary"); });
  await expectScreen("summary"); await wait(1200); await shot("32-d2d-summary");
  check(/Dream achieved|Fell short/.test(await page.textContent(".sm-head")), "Dare2Dream summary has no dream result");
  check(!!(await page.$('.end-sheet [data-k="again"]')) && !!(await page.$('.end-sheet [data-k="home"]')), "the Dare2Dream end sheet should offer Play again and Home");
  await card("dare2dream", "DROP2TOP Dare2Dream\n");
  check(await page.evaluate(() => window.D2T.game.dreamRecord().runs === 1), "Dare2Dream run not recorded");
  check(await page.evaluate((b) => JSON.stringify(window.D2T.game.record()) === b, classicBefore), "Dare2Dream run changed Classic's record");

  // locked again: a saved Dare2Dream run is kept, and its screens send you home
  check(await page.evaluate(() => { const G = window.D2T.game; G.dreamLocked = true; const r = { eng: { mode: "dare2dream", seasonKey: "2004/05", phase: "prematch" } }; return G.locked(r) && G.stepFor() !== undefined; }), "the Dare2Dream lock should cover a saved run");
  // ---------- Club X: name your club, one season spins in, its crest bursts into the badge, draft 11 in a random order ----------
  await page.evaluate(() => window.D2T.go("home")); await wait(900);
  await page.click('[data-act="pick"][data-mode="clubx"]');
  await page.waitForSelector(".sheet [data-k='yes']", { timeout: 2000 }).then(() => page.click(".sheet [data-k='yes']")).catch(() => {});
  await expectScreen("spin");
  check(await page.evaluate(() => window.D2T.game.mode() === "clubx"), "Club X run did not start in its mode");
  await page.waitForSelector(".x-name-in", { timeout: 3000 }).catch(() => {});
  check(!!(await page.$(".x-name-in")), "Club X did not ask for your club's name first");
  await shot("33a-clx-name");
  await page.fill(".x-name-in", "Man Utd"); await page.click(".x-name-go"); await wait(300);
  check(/real club/i.test(await page.textContent(".x-name-err")), "a real club's name was not refused");
  await page.fill(".x-name-in", "southside rovers"); await page.click(".x-name-go"); await wait(700);
  check(!(await page.$(".sheet")) && await page.evaluate(() => window.D2T.state.run.xName === "Southside Rovers" && window.D2T.game.tidyXName("kilsyth athletic of the FC") === "Kilsyth Athletic of the FC"), "the name was not kept with proper capitals");
  check((await page.$$(".sp-slot")).length === 1 && await page.evaluate(() => window.D2T.game.offer().length === 1), "Club X should spin one season in one central reel");
  await page.click(".sp-main");
  await page.waitForFunction(() => window.D2T.state.run.spun === true, null, { timeout: 8000 });
  check(await page.evaluate(() => { const c = window.D2T.game.offer()[0], cs = window.D2T_GAME.clubSeasons; return c.pos === Math.max(...cs.filter((x) => x.season === c.season).map((x) => x.pos)); }), "Club X did not land on a season's bottom club");
  await page.waitForFunction(() => window.D2T.state.run.xShown === true, null, { timeout: 5000 }).catch(() => {});
  await wait(900); await shot("33-clx-spin");
  check(await page.evaluate(() => { const n = document.querySelector(".sp-node.is-hit .d2c-cname"); return n && n.textContent === "Southside Rovers"; }), "the landed card did not turn into your club");
  check(await page.evaluate(() => /Play/.test(document.querySelector(".sp-main").textContent) && !document.querySelector(".sp-main").disabled), "Play was not ready after the badge");
  await page.click(".sp-main");
  await expectScreen("table"); await page.click(".actionbar .bar-main"); await wait(400);
  check(/Southside Rovers/.test(await page.textContent(".screen")), "table does not show your club's name");
  await shot("34-clx-table"); await barOrder("Club X table");
  await page.click(".actionbar .bar-main"); await expectScreen("squad"); await wait(600);
  check(await page.evaluate(() => window.D2T.game.eng().phase === "draft" && window.D2T.game.clubName() === "Southside Rovers"), "Club X should start in the draft under your name");
  check(await page.evaluate(() => { const G = window.D2T.game, i = G.draftInfo(); return i.open && G.rollCards().length === 3 && G.rollCards().every((c) => G.draftFits(c.id).length > 0); }), "Club X draft should serve three cards for its open shirts");
  // the open draft on the pitch: a picked card shows green, amber or red on every shirt; the shape can change mid-draft
  await page.evaluate(() => { const G = window.D2T.game; for (let k = 0; k < 3; k++) G.draftPick(G.rollCards()[0].id); window.D2T.go("transfer"); });
  await expectScreen("transfer");
  await page.waitForSelector(".sp-main:not([disabled])", { timeout: 8000 }); await wait(250);
  await page.click(".sp-main"); await page.waitForSelector(".sp-screen.is-placing", { timeout: ROLL_MS }); await wait(600);
  await page.click(".sp-slot >> nth=0"); await wait(300);
  check((await page.$$('.tr-field .se-slot[class*="se-pf-"]')).length === 11, "a picked Club X draft card should tint every shirt by fit");
  check(await page.evaluate(() => { const G = window.D2T.game, c = G.rollCards()[0]; return G.draftFits(c.id).some((i) => G.fit(c.id, i) === "green"); }), "a Club X draft card should be green in an open shirt");
  check(!!(await page.$(".tr-field .se-formlink")), "the Club X draft has no Formation button");
  await barOrder("Club X draft");
  check(!!(await page.$(".sp-round.is-reload[disabled][aria-hidden='true']")), "the Club X draft's respin should be greyed");
  await shot("34b-clx-draft-chips");
  await page.evaluate(() => { const G = window.D2T.game, f = G.eng().formation === "3-5-2" ? "4-4-2" : "3-5-2"; G.setFormation(f); window.__f = f; });
  check(await page.evaluate(() => { const e = window.D2T.game.eng(); return e.formation === window.__f && e.xi.filter((x) => x != null).length === 3 && e.phase === "draft"; }), "changing the shape mid-draft lost a drafted player");
  await page.evaluate(() => { const G = window.D2T.game; while (G.inDraft()) G.draftPick(G.rollCards()[0].id); if (G.eng().phase === "setup") G.startSeason(); for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } window.D2T.go("summary"); });
  await expectScreen("summary"); await wait(1200); await shot("35-clx-summary");
  await card("clubx", "DROP2TOP Club X\n");
  check(/Champions|Fell short/.test(await page.textContent(".sm-head")), "Club X summary has no result");
  check(await page.evaluate(() => window.D2T.game.xRecord().runs === 1), "Club X run not recorded");
  check(await page.evaluate((b) => window.D2T.game.record().runs === JSON.parse(b).runs + 1, classicBefore), "Club X season did not count in the home record");
  // career mode (Craig, 13 Oct): Next season carries the XI on, with pre-season rolls; after 2025/26 the season is a forecast
  await page.evaluate(() => { const G = window.D2T.game; if (!G.careerNext()) { G.eng().final.finish = 1; window.D2T.save(); } window.D2T.go("home"); }); await wait(700);
  // the career must go on (Craig, 13 Oct: Aiden's restarted): home keeps a Continue card for the finished season, the
  // Club X card asks before replacing it, a refresh keeps it, and Continue leads back to the summary and Next season
  check(!!(await page.$('[data-act="continue"]')) && /Next season waiting/.test(await page.textContent('[data-act="continue"]')), "home has no Continue card for a finished Club X season with the career open");
  await page.click('[data-act="pick"][data-mode="clubx"]'); await wait(500);
  check(!!(await page.$('.sheet [data-k="no"]')) && /new career/i.test(await page.textContent(".sheet")), "the Club X card should ask before replacing a career waiting for its next season");
  await page.click('.sheet [data-k="no"]'); await wait(400);
  check(await page.evaluate(() => window.D2T.game.careerOpen(window.D2T.state.run) && window.D2T.game.eng().phase === "summary"), "Keep playing did not keep the career");
  await page.reload(); await expectScreen("intro"); await page.click(".fr-skip", { force: true }); await expectScreen("home"); await page.waitForSelector('[data-act="continue"]', { timeout: 5000 }).catch(() => {}); await wait(900);
  check(!!(await page.$('[data-act="continue"]')), "a refresh lost the finished Club X season's Continue card");
  await page.click('[data-act="continue"]'); await expectScreen("summary"); await wait(1500);
  check(!!(await page.$('.end-sheet [data-k="next"]')), "Club X end sheet has no Next season");
  check(/New career/.test(await page.textContent('.end-sheet [data-k="again"]')) && !!(await page.$('.end-sheet [data-k="home"]')) && !!(await page.$('.end-sheet [data-k="share"]')), "the Club X end sheet should offer Share, Next season, New career and Home");
  await page.click('.end-sheet [data-k="next"]'); await expectScreen("table"); await wait(600);
  check(await page.evaluate(() => { const G = window.D2T.game, e = G.eng(); return e.career === 2 && e.phase === "setup" && G.lineup().xi.every(Boolean) && G.clubName() === "Southside Rovers"; }), "Next season did not carry the XI into season 2");
  check(await page.evaluate(() => window.D2T.game.xRecord().runs === 1), "Next season recorded the first season twice");
  check(await page.evaluate(() => { const G = window.D2T.game; G.startSeason(); return G.eng().rolls[0].kind === "pre" && G.eng().phase === "window"; }), "a career's second season should open with pre-season rolls");
  check(await page.evaluate(() => {
    const G = window.D2T.game; G.newRun("clubx"); G.setXName("Southside Rovers");
    const k = G.xPool.find((x) => x.season === "2025/26").key; G.eng().clubOffer = [k]; G.chooseClub(k); window.D2T.state.run.tableSeen = true;
    while (G.inDraft()) G.draftPick(G.rollCards()[0].id);
    G.startSeason(); for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } }
    G.finish(); if (!G.careerNext()) G.eng().final.finish = 1;
    if (!G.nextSeason() || !G.isSim()) return false;
    const S = G.S(); return S.season === "2026/27" && S.clubs.length === 20 && S.matches.length === 380 && G.lineup().xi.every(Boolean) && G.historyTable().length === 20;
  }), "after 2025/26 the career should go on into a forecast 2026/27");
  await page.evaluate(() => window.D2T.go("table")); await wait(800);
  check(/Forecast table/.test(await page.textContent(".se-tl-a")), "a forecast season's table should say it is a forecast");

  // ---------- Daily challenge: today's club for everyone, its own save, as many goes as you like ----------
  await page.evaluate(() => { const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true; window.D2T.save(); window.D2T.go("home"); }); await wait(900);
  const dEntry = await page.evaluate(() => { const d = window.D2T.game.dailyEntry(window.D2T.game.today()); return { key: d.key, mode: d.mode }; });
  // every day of a year is a bottom-10 side and plays Classic
  check(await page.evaluate(() => { const G = window.D2T.game, cat = window.D2T_GAME.catalogue, L = cat.length, seen = new Set(); for (let i = 0; i < 2 * L; i++) { const t = new Date(Date.UTC(2026, 9, 11 + i)).toISOString().slice(0, 10), d = G.dailyEntry(t); if (d.mode !== "classic" || !cat.some((c) => c.key === d.key) || d.n !== i + 1) return false; if (i < L) seen.add(d.key); else if (d.key !== G.dailyEntry(new Date(Date.UTC(2026, 9, 11 + i - L)).toISOString().slice(0, 10)).key) return false; } return seen.size === L; }), "the Daily did not cycle through every relegated club-season once, then start again");
  await page.click('[data-act="daily"]'); await wait(1500);
  check((await screen()) === "table", "the daily did not open on the table, on " + (await screen()));
  check(await page.evaluate((d) => { const r = window.D2T.state.run; return r.daily === window.D2T.game.today() && window.D2T.game.mode() === "classic" && d.mode === "classic" && r.eng.respins === window.D2TE.RULES.respins && r.eng.phase !== "draft" && r.eng.xi.every((id) => id != null); }, dEntry), "the daily did not start with today's club, its mode and no respins");
  check(await page.evaluate(() => !!window.D2T.state.parked), "the run in progress was not kept aside for the daily");
  // only the club is shared (Craig, 13 Oct): every go gets a random seed of its own, prefixed daily-<date>-
  const dailySeed1 = await page.evaluate(() => window.D2T.state.run.eng.seed);
  check(dailySeed1.startsWith("daily-" + (await page.evaluate(() => window.D2T.game.today())) + "-r") && dailySeed1.length > 24, "the Daily's seed is not a random one prefixed with the date: " + dailySeed1);
  await page.click(".actionbar .se-home"); await wait(500);
  check(!!(await page.$('.sheet [data-k="home"]')) && !!(await page.$('.sheet [data-k="restart"]')) && !(await page.$('.sheet [data-k="quit"]')), "the Daily's run menu should offer Keep playing, Restart and Home");
  await page.click('.sheet [data-k="keep"]'); await wait(500);
  await page.evaluate(() => { const G = window.D2T.game; window.D2T.state.run.tableSeen = true; while (G.inDraft()) G.draftPick(G.rollCards()[0].id); if (G.eng().phase === "setup") G.startSeason(); for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } window.D2T.go("summary"); });
  await expectScreen("summary"); await wait(900); await shot("40-daily-summary");
  await card("daily", "DROP2TOP Daily #");
  check(await page.evaluate(() => !!window.D2T.game.dailyResult()), "the daily result was not recorded");
  await page.waitForSelector('.end-sheet [data-k="share"]', { timeout: 4000 }).catch(() => {});
  check(!!(await page.$(".sm-daily .sm-dv")) && !!(await page.$('.end-sheet [data-k="share"]')), "the daily summary has no today-against-best panel or Share button");
  check(/Go again/.test(await page.textContent('.end-sheet [data-k="again"]')) && !!(await page.$('.end-sheet [data-k="home"]')), "the Daily end sheet should offer Go again and Home");
  // as many goes as you like (Craig, 13 Oct): Go again starts a fresh go, and the day's best go stays recorded
  const firstOffered = await page.evaluate(() => window.D2T.game.eng().offered.slice());
  await page.click('.end-sheet [data-k="again"]'); await expectScreen("table"); await wait(600);
  check(await page.evaluate(() => { const G = window.D2T.game, r = window.D2T.state.run; return !!G.dailyResult() && r.daily === G.today() && !r.recorded && G.eng().phase !== "summary"; }), "Go again did not start a fresh go at today's Daily");
  // every go has a random seed of its own, so the second go never replays the first, and the first go's cards are remembered so they come up less
  check(await page.evaluate((s1) => { const G = window.D2T.game, r = window.D2T.state.run, t = G.today(); return r.eng.seed !== s1 && r.eng.seed.startsWith("daily-" + t + "-r") && !window.D2T.state.dailyGoes; }, dailySeed1), "the second go of the Daily did not get its own random seed");
  // compared with the first go's own cards, so an earlier run of the same club-season (random seeds) can't upset it
  check(await page.evaluate((first) => { const G = window.D2T.game, S = G.S(), e = G.eng(), key = S.season + ":" + S.clubs[e.club].name, rec = (window.D2T.state.recent || {})[key]; return !!(first.length && rec && rec[0] && rec[0].length === first.length && first.every((id) => rec[0].includes(id)) && e.recent && first.every((id) => e.recent[id] === window.D2TE.RULES.recent[0])); }, firstOffered), "the first go's cards were not remembered as recent for the second go");
  await page.evaluate(() => window.D2T.go("home")); await expectScreen("home"); await wait(800);
  check(/Your best today/.test(await page.textContent(".fr-gm-daily .fr-sub")), "home does not show today's best go");
  check(/TODAY'S DAILY/.test(await page.textContent(".fr-dtiles")) && (await page.$$(".fr-dtile")).length === 2, "home has no best and today tiles under the daily card");
  check(await page.evaluate(() => !window.D2T.game.dailyResult() || !/None yet/.test(document.querySelector(".fr-dtile").textContent)), "home says no best Daily beside a Daily already played");
  check(!!(await page.$('[data-act="continue-other"]')), "the parked run has no Continue card after the daily");
  // the Daily closes at midnight: an unfinished one from yesterday is dropped (no result), the parked run comes back, home says so
  await page.evaluate(() => {
    const G = window.D2T.game, st = window.D2T.state;
    if (st.run && st.run.daily) { st.run = st.parked; st.parked = null; }   // today's fresh go from Go again makes way
    const y = new Date(Date.parse(G.today() + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
    const e = G.dailyEntry(y); st.parked = st.run; st.run = { step: "fixtures", eng: Object.assign({}, st.parked.eng, { phase: "prematch" }), spun: true, daily: y };
    window.__y = y; window.D2T.save(); window.D2T.go("home");
  }); await wait(1600);
  check(await page.evaluate(() => { const st = window.D2T.state; return !(st.run && st.run.daily) && !st.dailyClosed && !(st.record.daily || {})[window.__y]; }), "yesterday's unfinished Daily did not close at midnight");
  check(/closed/i.test((await page.textContent(".sheet").catch(() => "")) || ""), "home did not say yesterday's Daily closed");
  await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(500);

  // ---------- Goal Rush (was 433 Goals): a random formation and target, the reveal, refresh keeps it, any-order shirts ----------
  const recBefore = await page.evaluate(() => JSON.stringify(window.D2T.game.record()));
  await page.evaluate(() => { delete window.D2T.state.g433; window.D2T.save(); window.D2T.go("home"); }); await wait(900);
  await page.click('[data-act="g433"]'); await expectScreen("goals433"); await wait(500);
  const form = await page.evaluate(() => window.D2T.state.g433.formation);
  check(["442", "433", "451", "352", "343", "424", "532", "541"].includes(form), "Goal Rush: no random formation, got " + form);
  check(!!(await page.$(".g4-reveal")) && /THIS GAME'S TARGET/i.test(await page.textContent(".g4-reveal")), "Goal Rush: no target reveal at the start");
  await shot("50-goalrush-reveal");
  await page.click(".g4-reveal"); await wait(700);
  check(!(await page.$(".g4-reveal")), "Goal Rush: tapping did not skip the reveal");
  check(await page.evaluate((f) => document.querySelector(".g4 .modename").textContent === f + " GOALS" && document.querySelector(".g4 .g4-shape").textContent === f.split("").join("-") && document.querySelector(".g4 .ttarget").textContent === "/" + f, form), "Goal Rush: the pitch or tally does not show the target");
  // the pitch takes the shape: 11 slots, the right labels per line
  const LBL = { DEF: { 3: "CB CB CB", 4: "LB CB CB RB", 5: "LWB CB CB CB RWB" }, MID: { 2: "CM CM", 3: "CM CM CM", 4: "LM CM CM RM", 5: "LM CM CM CM RM" }, FWD: { 1: "ST", 2: "ST ST", 3: "LW ST RW", 4: "LW ST ST RW" } };
  const want = (f) => { const [d, m, a] = f.split("").map(Number); return ["GK", LBL.DEF[d], LBL.MID[m], LBL.FWD[a]].join(" "); };
  check(await page.evaluate((w) => [...document.querySelectorAll(".g4 .slotp")].length === 11 && [...document.querySelectorAll(".g4 .slotp text")].map((t) => t.textContent).join(" ") === w, want(form)), "Goal Rush: the pitch slots do not match " + form);
  await page.click(".g4 .sp-main"); await wait(4800);
  const cands = await page.evaluate(() => window.D2T.state.g433.cands.map((p) => p.name).join());
  await page.reload(); await wait(6500); await page.evaluate(() => window.D2T.go("goals433")); await wait(900);
  check(await page.evaluate((c) => window.D2T.state.g433.cands.map((p) => p.name).join() === c, cands), "Goal Rush: a refresh changed the three shirts");
  check(await page.evaluate((f) => window.D2T.state.g433.formation === f, form) && !(await page.$(".g4-reveal")), "Goal Rush: a refresh changed the formation or replayed the reveal");
  check(await page.evaluate(() => document.querySelectorAll(".g4 .slotp.open .g4-shirt.next").length === 11), "Goal Rush: the open shirts are not all highlighted");
  check(await page.evaluate(() => { const s = window.D2T.state.g433; return s.cands.length === 3 && s.cands.every((c) => ["GK", "DEF", "MID", "FWD"].includes(c.pos)); }), "Goal Rush: a spin did not bring three players with positions");
  check(await page.evaluate(() => { const r = window.D2T.state.g4recent, s = window.D2T.state.g433; return Array.isArray(r) && r.length >= 1 && s.cands.every((c) => r[0].includes(c.name)); }), "Goal Rush: the players offered are not remembered for the next games");
  for (let i = 0; i < 11; i++) {
    if (!(await page.$(".g4 [data-c]"))) { await page.click(".g4 .sp-main"); await wait(4800); }
    await page.click('.g4 [data-c="0"]'); await wait(250);
    if (i === 0) {
      check(await page.evaluate(() => { const fit = [...document.querySelectorAll(".g4 .slotp.fit")]; return fit.length > 0 && document.querySelectorAll(".g4 .slotp.nofit").length + fit.length === 11; }), "Goal Rush: picking a player did not light his open shirts");
      await page.click(".g4 .slotp.fit >> nth=-1"); await wait(1800);   // place him by tapping one of his shirts
    } else { await page.click('.g4 [data-c="0"]'); await wait(1800); }
  }
  check(await page.evaluate((f) => { const S = window.D2T.state.g433, [d, m, a] = f.split("").map(Number), SL = ["GK", ...Array(d).fill("DEF"), ...Array(m).fill("MID"), ...Array(a).fill("FWD")]; return new Set(S.filled.map((p) => p.slot)).size === 11 && S.filled.every((p) => SL[p.slot] === p.pos); }, form), "Goal Rush: a player sits in the wrong position or two share a shirt");
  check(await page.evaluate(() => { const G4 = window.D2T.game.g433, need = G4.list("FWD")[40].goals; return ["433", "541"].every((f) => G4.canGift("FWD", need, [], f) && [0, 1, 2, 3, 4].every(() => G4.drawOpen({ FWD: 1 }, [], need, f).some((p) => p.goals === need))); }), "Goal Rush: the last-shot gift did not offer the exact player");
  check(await page.evaluate(() => ["442", "433", "451", "352", "343", "424", "532", "541"].every((f) => { const G4 = window.D2T.game.g433, sh = G4.shape(f); return sh.GK + sh.DEF + sh.MID + sh.FWD === 11 && G4.depth(f) > 0 && G4.gift(f) > 0; })), "Goal Rush: a formation has no shape, depth or gift");
  // the back fives come up about half as often as the other shapes (Craig, 13 Oct)
  check(await page.evaluate(() => { const n = {}, N = 14000; for (let i = 0; i < N; i++) { const f = window.D2T.game.g433.pickFormation(); n[f] = (n[f] || 0) + 1; } const back5 = (n["532"] + n["541"]) / 2, rest = ["442", "433", "451", "352", "343", "424"].reduce((t, f) => t + n[f], 0) / 6; return Object.keys(n).length === 8 && back5 / rest > 0.4 && back5 / rest < 0.6; }), "Goal Rush: 5-3-2 and 5-4-1 do not come up about half as often");
  // the sheet opens only after the ending (longer when the total breaks through the target), so wait for it
  await page.waitForSelector(".sheet", { timeout: 15000 }).catch(() => {}); await wait(400); await shot("51-goalrush-end");
  await card("goalrush", "DROP2TOP Goal Rush · ");
  check(await page.evaluate(() => window.D2T.state.g433.filled.length === 11 && window.D2T.game.g433.record().games === 1), "Goal Rush: the game did not fill 11 shirts and record a result");
  check(await page.evaluate((f) => window.D2T.game.g433.record().lastTarget === +f, form), "Goal Rush: the result was not recorded against this game's target");
  check(await page.evaluate(() => window.D2T.state.g433.filled.every((p) => window.D2T.state.g433.filled.filter((q) => q.name === p.name).length === 1)), "Goal Rush: the same player appeared twice");
  check(await page.evaluate((b) => JSON.stringify(window.D2T.game.record()) === b, recBefore), "Goal Rush changed Classic's record");
  check(!!(await page.waitForSelector(".sheet", { timeout: 12000 }).catch(() => null)), "Goal Rush: no result sheet at the end");
  // the shared end sheet (Craig, 14 Oct): Share, Play again, Home; closed, a Game over peek bar above the bar brings it back
  check((await page.$$eval(".end-sheet [data-k]", (bs) => bs.map((b) => b.dataset.k).join("|"))) === "share|again|home", "Goal Rush: the end sheet should offer Share, Play again and Home");
  await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(600);
  check(!(await page.$(".end-sheet")) && !!(await page.$(".g4 .end-peek")) && /Game over/.test(await page.textContent(".g4 .end-peek")), "Goal Rush: closing the end sheet should leave a Game over peek bar");
  await barOrder("Goal Rush over");
  await page.click(".g4 .end-peek"); await wait(600);
  check(!!(await page.$(".end-sheet")), "Goal Rush: the peek bar did not bring the end sheet back");
  // Play again: a new game picks a formation again and opens with the reveal
  await page.evaluate(() => { const b = document.querySelector('.sheet [data-k="again"]'); if (b) b.click(); }); await wait(700);
  check(!(await page.$(".g4 .end-peek")), "Goal Rush: the peek bar should go with a new game");
  check(await page.evaluate(() => window.D2T.state.g433.filled.length === 0 && !!window.D2T.state.g433.formation && window.D2T.state.g433.revealed === false) && !!(await page.$(".g4-reveal")), "Goal Rush: Play again did not start a new game with a reveal");
  await page.click(".g4-reveal"); await wait(600);   // the reveal counts as seen once it finishes or is skipped
  check(await page.evaluate(() => window.D2T.state.g433.revealed === true) && !(await page.$(".g4-reveal")), "Goal Rush: skipping the reveal did not mark it seen");
  // the home button (Craig, 13 Oct): before the first spin it goes straight home (the game is kept); with a game under
  // way it opens the shared menu, Home keeps the game, Quit throws it away
  await barOrder("Goal Rush");
  await page.click(".g4 .is-home"); await expectScreen("home"); await wait(600);
  check(!(await page.$(".sheet")) && await page.evaluate(() => !!window.D2T.state.g433 && window.D2T.state.g433.filled.length === 0), "Goal Rush: home before the first spin should go straight home and keep the game");
  await page.click('[data-act="g433"]'); await expectScreen("goals433"); await wait(900);
  await page.click(".g4 .sp-main"); await wait(4800); await page.click('.g4 [data-c="0"]'); await wait(250); await page.click(".g4 .slotp.fit >> nth=-1"); await wait(1800);
  await page.click(".g4 .is-home"); await wait(500);
  check(!!(await page.$('.sheet [data-k="quit"]')) && /Leave the game/.test(await page.textContent(".sheet")), "Goal Rush: home with a game under way did not ask");
  await shot("52-goalrush-leave");
  // Restart wipes the game and starts a new one from the beginning, nothing recorded
  const g4Games = await page.evaluate(() => window.D2T.game.g433.record().games);
  await page.click('.sheet [data-k="restart"]'); await wait(900);
  check(await page.evaluate((n) => window.D2T.state.g433.filled.length === 0 && !window.D2T.state.g433.cands && window.D2T.state.g433.revealed === false && window.D2T.game.g433.record().games === n, g4Games) && !!(await page.$(".g4-reveal")), "Goal Rush: Restart did not start a new game from the beginning");
  await page.click(".g4-reveal"); await wait(600);
  await page.click(".g4 .sp-main"); await wait(4800); await page.click('.g4 [data-c="0"]'); await wait(250); await page.click(".g4 .slotp.fit >> nth=-1"); await wait(1800);
  await page.click(".g4 .is-home"); await wait(500);
  await page.click('.sheet [data-k="home"]'); await expectScreen("home"); await wait(600);
  check(await page.evaluate(() => window.D2T.state.g433 && window.D2T.state.g433.filled.length === 1), "Goal Rush: Home did not keep the game");
  await page.click('[data-act="g433"]'); await expectScreen("goals433"); await wait(900);
  await page.click(".g4 .is-home"); await wait(500); await page.click('.sheet [data-k="quit"]'); await expectScreen("home"); await wait(600);
  check(await page.evaluate(() => !window.D2T.state.g433 && window.D2T.game.g433.record().games === 1), "Goal Rush: Quit did not throw the game away, or recorded it");

  // ---------- Unbeaten Run: spin for a stat, two cards reel in (left shows, right hides), answer, the run records apart ----------
  const ubRecBefore = await page.evaluate(() => JSON.stringify([window.D2T.game.record(), window.D2T.game.g433.record()]));
  await page.evaluate(() => { window.D2T.state.ub = null; window.D2T.save(); window.D2T.go("home"); }); await wait(900);
  await page.click('[data-act="unbeaten"]'); await expectScreen("unbeaten"); await wait(700); await barOrder("Unbeaten start");
  check(!!(await page.$(".ub-spin")) && /Higher or lower/i.test(await page.textContent(".ub-title")) && /New run/.test(await page.textContent(".ub-spin")) && (await page.$$(".ub-grid .ub-fr")).length === 9, "Unbeaten Run: the start page is not Higher or lower with nine best runs and New run");
  for (const st of ["pts", "cg"]) {
    await page.evaluate((st) => { window.D2T_UB_STAT = st; }, st);
    await page.click(".ub-spin");
    // wait until both cards have landed and the answers are live, not a fixed time (the reels' length varies)
    await page.waitForFunction(() => { const l = document.querySelector(".ub-l .sp-node.is-hit .ub-num"), r = document.querySelector(".ub-r .sp-node.is-hit .ub-num"); return l && /^\d+$/.test(l.textContent) && r && r.textContent === "?" && document.querySelectorAll(".ub-ans:not([disabled])").length === 2; }, null, { timeout: 15000 }).catch(() => {});
    await wait(300);
    const got = await page.evaluate(() => { const l = document.querySelector(".ub-l .sp-node.is-hit .ub-num"), r = document.querySelector(".ub-r .sp-node.is-hit .ub-num"); return { l: l && l.textContent, r: r && r.textContent, title: document.querySelector(".ub-title").textContent, club: !!document.querySelector(".ub-l .ub-cc"), shirt: !!document.querySelector(".ub-l .ub-shirt"), crest: !!document.querySelector(".ub-l .ub-crest, .ub-l .ub-cc-crest"), btn: document.querySelectorAll(".ub-ans:not([disabled])").length }; });
    check(got.l && /^\d+$/.test(got.l) && got.r === "?" && got.btn === 2, "Unbeaten Run (" + st + "): the cards did not land with a number on the left and ? on the right");
    check(st === "pts" ? got.club && /Points in a season/i.test(got.title) : got.shirt && /Career goals/i.test(got.title), "Unbeaten Run (" + st + "): wrong card type or stat");
    check(got.crest, "Unbeaten Run (" + st + "): no crest on the card");
    // 3 refreshes a run: one swaps the hidden card, the streak untouched (Craig, 13 Oct)
    check(await page.textContent(".ub-reload .sp-count") === "3", "Unbeaten Run (" + st + "): no 3 refreshes on the left of the bar");
    const whoBefore = await page.textContent(".ub-who-r"), keyBefore = await page.evaluate(() => document.querySelector(".ub-r .sp-node.is-hit").innerHTML.length);
    await page.click(".ub-reload"); await wait(3200);
    check(await page.textContent(".ub-reload .sp-count") === "2" && await page.textContent(".ub-n") === "0" && (await page.textContent(".ub-who-r") !== whoBefore || await page.evaluate((k) => document.querySelector(".ub-r .sp-node.is-hit").innerHTML.length !== k, keyBefore)), "Unbeaten Run (" + st + "): a refresh did not swap the hidden card");
    if (st === "pts") { await shot("53-unbeaten-clubs"); await barOrder("Unbeaten round"); }
    // answer: either the run goes on (+1) or it is over (the sheet); both record nothing until the end
    const runsBefore = await page.evaluate(() => (window.D2T.state.ub || {}).runs || 0);
    await page.click(".ub-higher"); await wait(1600);
    const r1 = await page.evaluate(() => ({ ok: !!document.querySelector(".ub-r.ok"), bad: !!document.querySelector(".ub-r.bad"), n: document.querySelector(".ub-n").textContent }));
    check(r1.ok || r1.bad, "Unbeaten Run (" + st + "): the answer did not resolve");
    await wait(2500);
    if (r1.ok) {
      check(r1.n === "1" || await page.evaluate(() => document.querySelector(".ub-n").textContent === "1"), "Unbeaten Run (" + st + "): a right answer did not count 1");
      // Restart ends the run with nothing recorded and goes back to the stat spin
      await page.click(".ub-bar .is-home"); await wait(500);
      await page.click('.sheet [data-k="restart"]'); await wait(800);
      check(!!(await page.$(".ub-spin")) && await page.evaluate((n) => ((window.D2T.state.ub || {}).runs || 0) === n, runsBefore), "Unbeaten Run (" + st + "): Restart did not go back to the stat spin, or recorded a run");
      await page.click(".ub-spin");
    // wait until both cards have landed and the answers are live, not a fixed time (the reels' length varies)
    await page.waitForFunction(() => { const l = document.querySelector(".ub-l .sp-node.is-hit .ub-num"), r = document.querySelector(".ub-r .sp-node.is-hit .ub-num"); return l && /^\d+$/.test(l.textContent) && r && r.textContent === "?" && document.querySelectorAll(".ub-ans:not([disabled])").length === 2; }, null, { timeout: 15000 }).catch(() => {});
    await wait(300);
      // Home keeps the run (Craig, 13 Oct): back from home it picks up where it was, the same cards and streak
      const kept = await page.evaluate(() => ({ l: document.querySelector(".ub-l .sp-node.is-hit").innerHTML, n: document.querySelector(".ub-n").textContent }));
      await page.click(".ub-bar .is-home"); await wait(500);
      await page.click('.sheet [data-k="home"]'); await expectScreen("home"); await wait(600);
      check(await page.evaluate(() => !!(window.D2T.state.ub.run && window.D2T.state.ub.run.stat)), "Unbeaten Run (" + st + "): Home did not keep the run");
      await page.click('[data-act="unbeaten"]'); await expectScreen("unbeaten"); await wait(900);
      check(await page.evaluate((k) => { const l = document.querySelector(".ub-l .sp-node.is-hit"), r = document.querySelector(".ub-r .sp-node.is-hit .ub-num"); return !!l && l.innerHTML === k.l && document.querySelector(".ub-n").textContent === k.n && r && r.textContent === "?" && document.querySelectorAll(".ub-ans:not([disabled])").length === 2 && !window.D2T.state.ub.run; }, kept), "Unbeaten Run (" + st + "): the kept run did not pick up where it was");
      // leaving mid-run asks, and quitting records nothing
      await page.click(".ub-bar .is-home"); await wait(500);
      check(!!(await page.$('.sheet [data-k="quit"]')), "Unbeaten Run (" + st + "): home mid-run did not ask");
      await page.click('.sheet [data-k="quit"]'); await expectScreen("home"); await wait(600);
      check(await page.evaluate((n) => ((window.D2T.state.ub || {}).runs || 0) === n, runsBefore), "Unbeaten Run (" + st + "): quitting recorded a run");
      await page.click('[data-act="unbeaten"]'); await expectScreen("unbeaten"); await wait(700);
    } else {
      check(!!(await page.$(".sheet")) && /Beaten first time/i.test(await page.textContent(".sheet")), "Unbeaten Run (" + st + "): no end sheet after a wrong answer");
      await card("unbeaten", "DROP2TOP Unbeaten Run · ");
      check(/New run/.test(await page.textContent('.sheet [data-k="again"]')) && !!(await page.$('.end-sheet [data-k="home"]')) && !!(await page.$('.end-sheet [data-k="share"]')), "Unbeaten Run (" + st + "): the end sheet should offer Share, New run and Home");
      check(await page.evaluate((n) => ((window.D2T.state.ub || {}).runs || 0) === n + 1, runsBefore), "Unbeaten Run (" + st + "): a finished run was not recorded");
      await shot("54-unbeaten-end");
      await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(700);
      check(!!(await page.$(".ub-spin")), "Unbeaten Run (" + st + "): closing the end sheet did not go back to the stat spin");
    }
  }
  check(await page.evaluate((b) => JSON.stringify([window.D2T.game.record(), window.D2T.game.g433.record()]) === b, ubRecBefore), "Unbeaten Run changed another game's record");
  await page.evaluate(() => { delete window.D2T_UB_STAT; });

  await browser.close();
  if (errors.length) { console.log("FAIL\n" + errors.join("\n")); process.exit(1); }
  console.log("ok: intro, home, spin, table, squad, formations, 3 rolls (tap, drag, pass), fixtures, kick off, live match, refresh, results, table, season, summary, end sheet, record, back, account, other screens, Dare2Dream draft, Club X, Daily, Goal Rush, Unbeaten Run");
})().catch((e) => { console.error(e); process.exit(1); });
