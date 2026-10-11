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
  const wait = (ms) => page.waitForTimeout(ms);
  const screen = () => page.evaluate(() => window.D2T.currentScreen());
  const expectScreen = async (name, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if ((await screen()) === name) return; await wait(100); }
    throw new Error(`expected screen ${name}, on ${await screen()}`);
  };
  const check = (ok, msg) => { if (!ok) errors.push(msg); };
  const smallButtons = async (where) => {
    const small = await page.$$eval("button", (bs) => bs.filter((b) => b.offsetParent && getComputedStyle(b).visibility !== "hidden" && b.getBoundingClientRect().height < 40 && b.getBoundingClientRect().width < 40).map((b) => (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 30)));
    if (small.length) errors.push(`tap targets under 40px on ${where}: ${small.join(", ")}`);
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
  await wait(900); await shot("03-spin");
  await page.click(".sp-main");
  await page.waitForFunction(() => window.D2T.state.run.spun === true, null, { timeout: 8000 });
  await wait(400); await shot("04-spin-landed");
  await page.click(".sp-slot >> nth=1"); await wait(300);
  await page.click(".sp-main");
  await expectScreen("table");
  await wait(1200); await shot("05-table-reveal");
  await page.click(".actionbar button"); await wait(500);
  await shot("06-table-reset");
  await page.click(".actionbar button");
  await expectScreen("squad");
  await wait(800); await shot("07-squad-preseason"); await smallButtons("squad");

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
    await page.click(".sp-main");
    await page.waitForFunction(() => { const e = window.D2T.game.eng(); return e.roll && window.D2T.state.run.spun === `${e.roll.key}.${e.roll.spin}`; }, null, { timeout: 8000 });
    await wait(400);
    if (r === 0) await shot("09-roll-landed");
    await page.waitForSelector(".sp-screen.is-placing", { timeout: 4000 });
    await wait(700);
    if (r === 0) await shot("10-placing");
    if (r === 2) {
      const before = await page.evaluate(() => window.D2T.game.eng().signed.length);
      check((await page.textContent(".sp-main")).trim() === "Pass", "main button is not Pass after the roll lands");
      await page.click(".sp-main");
      await wait(600);
      check(await page.evaluate((b) => window.D2T.game.eng().signed.length === b, before), "pass signed a player");
      break;
    }
    const before = await page.evaluate(() => window.D2T.game.eng().signed.length);
    if (r === 0) {
      // tap a card, then a shirt (the best one pulses)
      await page.click(".sp-slot >> nth=0"); await wait(400);
      await shot("10b-selected");
      await page.click(".tr-field .se-slot.se-best .se-cardwrap", { force: true });
    } else {
      // drag a card onto a shirt
      const a = await (await page.$(".sp-slot >> nth=1")).boundingBox();
      const t = await (await page.$('.tr-field .se-cardwrap[data-i="5"]')).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2, a.y - 30, { steps: 4 });
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await wait(500);
    if (r === 0) await shot("10c-signed");
    check(await page.evaluate((b) => window.D2T.game.eng().signed.length === b + 1, before), `roll ${r + 1}: signing did not go through`);
    await wait(900);
    if (r < 2) await expectScreen("transfer");
  }
  await expectScreen("squad");
  await wait(600); await shot("11-squad-gw1");
  check(await page.evaluate(() => window.D2T.game.lineup().subs.length === 0), "squad players still on the bench after the season started");

  // ---------- gameweek 1: fixtures and the live match ----------
  await page.click(".se-play");
  await expectScreen("fixtures");
  await wait(700); await shot("12-fixtures");
  await page.click(".actionbar .se-btn");
  await expectScreen("match");
  await wait(500); await shot("13-match-preview");
  await page.click(".se-main"); await wait(2500); await shot("14-match-live");
  // refresh mid-match: the result is already decided and must not replay or change
  const res1 = await page.evaluate(() => JSON.stringify(window.D2T.game.eng().played[0]));
  await page.click(".se-main"); await wait(1800);
  for (let i = 0; i < 6 && (await page.textContent(".se-main")) !== "Continue"; i++) { await page.click(".se-main"); await wait(1500); }
  await shot("15-match-table");
  // a fresh load plays the intro, then home's Continue goes back to the match
  await page.reload(); await expectScreen("intro");
  await page.click(".fr-skip", { force: true }); await expectScreen("home"); await wait(700);
  check(await page.evaluate((r) => JSON.stringify(window.D2T.game.eng().played[0]) === r, res1), "refresh changed the GW1 result");
  await page.click('[data-act="continue"]'); await wait(1600);
  check((await screen()) === "match", "Continue after a refresh did not return to the match screen, on " + (await screen()));
  await page.click(".se-main"); await wait(1500);
  for (let i = 0; i < 6 && (await screen()) === "match"; i++) { await page.click(".se-main"); await wait(1200); }
  const after = await screen();
  check(["fixtures", "transfer"].includes(after), "after GW1 expected fixtures or transfer, got " + after);

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
  await page.evaluate(() => document.querySelector(".screen-body").scrollTo(0, 99999)); await wait(400); await shot("17-summary-bottom");
  const scored = await page.evaluate(() => window.D2T.game.eng().played.some((r) => r.us > 0));
  check(!scored || (await page.$$eval(".sm-award span", (els) => els.some((e) => /Top scorer/.test(e.textContent)))), "no top scorer award although the club scored");
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

  // play again from the summary
  await page.evaluate(() => window.D2T.go("summary")); await wait(600);
  await page.click('[data-act="again"]');
  await expectScreen("spin");
  check(await page.evaluate(() => window.D2T.game.eng().phase === "clubroll"), "play again did not start a new run");

  await browser.close();
  if (errors.length) { console.log("FAIL\n" + errors.join("\n")); process.exit(1); }
  console.log("ok: intro, home, spin, table, squad, formations, 3 rolls (tap, drag, pass), fixtures, live match, refresh, season, summary, record, back, account, other screens");
})().catch((e) => { console.error(e); process.exit(1); });
