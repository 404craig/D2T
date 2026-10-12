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
  check(!!(await page.$(".sp-tip")), "no respins note on a new run's club spin");
  await page.click(".sp-main");
  await wait(600);
  check(!(await page.$(".sp-tip")), "the respins note did not go after the first spin");
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
      check((await page.$$(".tr-field .se-pfchip")).length === 11, "selecting a card did not colour all 11 shirts by fit");
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

  // ---------- Dare2Dream: any club, beat their real finish ----------
  const classicBefore = await page.evaluate(() => JSON.stringify(window.D2T.game.record()));
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
  await expectScreen("table"); await page.click(".actionbar button"); await wait(400);
  check(/dream|Beat it|Do it again/i.test(await page.textContent(".se-fin")), "table does not show the Dare2Dream target");
  await page.click(".actionbar button"); await expectScreen("squad"); await wait(600);
  check(/Target/.test(await page.textContent(".se-sqsub")), "squad does not show the target");
  check(await page.evaluate(() => window.D2T.game.eng().phase === "draft" && window.D2T.game.eng().xi.every((x) => x == null)), "Dare2Dream should start with no players");
  await shot("31-d2d-empty");
  // the draft: one spin per shirt, tap then Sign for the first, drag for the second, the rest through the adapter
  await page.click(".se-play"); await expectScreen("transfer");
  check(!(await page.$(".sp-round.is-reload:not([style*='none'])")), "the draft should have no respin button");
  for (let k = 0; k < 2; k++) {
    await page.waitForSelector(".sp-main:not([disabled])", { timeout: 8000 }); await wait(250);
    await page.click(".sp-main");
    await page.waitForSelector(".sp-screen.is-placing", { timeout: 9000 }); await wait(600);
    if (k === 0) { await shot("31b-d2d-draft"); await page.click(".sp-slot >> nth=0"); await wait(300); await page.click(".sp-main"); }
    else {
      const a = await (await page.$(".sp-slot >> nth=1")).boundingBox(), t = await (await page.$(".tr-field .se-slot.se-best .se-cardwrap")).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(a.x + 40, a.y - 30, { steps: 4 }); await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 }); await page.mouse.up();
    }
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
  check(await page.evaluate(() => window.D2T.game.dreamRecord().runs === 1), "Dare2Dream run not recorded");
  check(await page.evaluate((b) => JSON.stringify(window.D2T.game.record()) === b, classicBefore), "Dare2Dream run changed Classic's record");

  // ---------- Club X: pick a season, replace its bottom club, draft 11, win the league ----------
  await page.evaluate(() => window.D2T.go("home")); await wait(900);
  await page.click('[data-act="pick"][data-mode="clubx"]');
  await page.waitForSelector(".sheet [data-k='yes']", { timeout: 2000 }).then(() => page.click(".sheet [data-k='yes']")).catch(() => {});
  await expectScreen("spin");
  check(await page.evaluate(() => window.D2T.game.mode() === "clubx"), "Club X run did not start in its mode");
  await wait(700); await page.click(".sp-main");
  await page.waitForFunction(() => window.D2T.state.run.spun === true, null, { timeout: 8000 });
  await wait(400); await shot("33-clx-spin");
  check(await page.evaluate(() => { const o = window.D2T.game.offer(), cs = window.D2T_GAME.clubSeasons; return new Set(o.map((c) => c.season)).size === 3 && o.every((c) => c.pos === Math.max(...cs.filter((x) => x.season === c.season).map((x) => x.pos))); }), "Club X offer is not three seasons' bottom clubs");
  await page.click(".sp-slot >> nth=0"); await wait(300); await page.click(".sp-main");
  await expectScreen("table"); await page.click(".actionbar button"); await wait(400);
  check(/Club X/.test(await page.textContent(".screen")), "table does not show Club X");
  await shot("34-clx-table");
  await page.click(".actionbar button"); await expectScreen("squad"); await wait(600);
  check(await page.evaluate(() => window.D2T.game.eng().phase === "draft" && window.D2T.game.clubName() === "Club X"), "Club X should start in the draft as Club X");
  await page.evaluate(() => { const G = window.D2T.game; while (G.inDraft()) G.draftPick(G.rollCards()[0].id); if (G.eng().phase === "setup") G.startSeason(); for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } window.D2T.go("summary"); });
  await expectScreen("summary"); await wait(1200); await shot("35-clx-summary");
  check(/Champions|Fell short/.test(await page.textContent(".sm-head")), "Club X summary has no result");
  check(await page.evaluate(() => window.D2T.game.xRecord().runs === 1), "Club X run not recorded");
  check(await page.evaluate((b) => JSON.stringify(window.D2T.game.record()) === b, classicBefore), "Club X run changed Classic's record");

  // ---------- Daily challenge: today's club for everyone, its own save, one go ----------
  await page.evaluate(() => { const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true; window.D2T.save(); window.D2T.go("home"); }); await wait(900);
  const dEntry = await page.evaluate(() => { const d = window.D2T.game.dailyEntry(window.D2T.game.today()); return { key: d.key, mode: d.mode }; });
  await page.click('[data-act="daily"]'); await wait(1500);
  check((await screen()) === "table", "the daily did not open on the table, on " + (await screen()));
  check(await page.evaluate((d) => { const r = window.D2T.state.run; return r.daily === window.D2T.game.today() && window.D2T.game.mode() === d.mode && r.eng.respins === 0; }, dEntry), "the daily did not start with today's club, its mode and no respins");
  check(await page.evaluate(() => !!window.D2T.state.parked), "the run in progress was not kept aside for the daily");
  await page.evaluate(() => { const G = window.D2T.game; window.D2T.state.run.tableSeen = true; while (G.inDraft()) G.draftPick(G.rollCards()[0].id); if (G.eng().phase === "setup") G.startSeason(); for (let i = 0; i < 400; i++) { const e = G.eng(); if (e.phase === "summary") break; if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } window.D2T.go("summary"); });
  await expectScreen("summary"); await wait(900); await shot("40-daily-summary");
  check(await page.evaluate(() => !!window.D2T.game.dailyResult()), "the daily result was not recorded");
  check(!!(await page.$(".sm-daily .sm-dv")) && !!(await page.$('.actionbar [data-act="share"]')), "the daily summary has no today-against-best panel or Share button");
  await page.click('[data-act="again"]'); await expectScreen("home"); await wait(800);
  check(/Today: .*rise/.test(await page.textContent(".fr-gm-daily .fr-sub")), "home does not show today's daily result");
  check(!!(await page.$('[data-act="continue-other"]')), "the parked run has no Continue card after the daily");
  // the Daily closes at midnight: an unfinished one from yesterday is dropped (no result), the parked run comes back, home says so
  await page.evaluate(() => {
    const G = window.D2T.game, st = window.D2T.state, y = new Date(Date.parse(G.today() + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
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
  await page.click(".g4 .sp-main"); await wait(2900);
  const cands = await page.evaluate(() => window.D2T.state.g433.cands.map((p) => p.name).join());
  await page.reload(); await wait(6500); await page.evaluate(() => window.D2T.go("goals433")); await wait(900);
  check(await page.evaluate((c) => window.D2T.state.g433.cands.map((p) => p.name).join() === c, cands), "Goal Rush: a refresh changed the three shirts");
  check(await page.evaluate((f) => window.D2T.state.g433.formation === f, form) && !(await page.$(".g4-reveal")), "Goal Rush: a refresh changed the formation or replayed the reveal");
  check(await page.evaluate(() => document.querySelectorAll(".g4 .slotp.open .g4-shirt.next").length === 11), "Goal Rush: the open shirts are not all highlighted");
  check(await page.evaluate(() => { const s = window.D2T.state.g433; return s.cands.length === 3 && s.cands.every((c) => ["GK", "DEF", "MID", "FWD"].includes(c.pos)); }), "Goal Rush: a spin did not bring three players with positions");
  for (let i = 0; i < 11; i++) {
    if (!(await page.$(".g4 [data-c]"))) { await page.click(".g4 .sp-main"); await wait(2900); }
    await page.click('.g4 [data-c="0"]'); await wait(250);
    if (i === 0) {
      check(await page.evaluate(() => { const fit = [...document.querySelectorAll(".g4 .slotp.fit")]; return fit.length > 0 && document.querySelectorAll(".g4 .slotp.nofit").length + fit.length === 11; }), "Goal Rush: picking a player did not light his open shirts");
      await page.click(".g4 .slotp.fit >> nth=-1"); await wait(1800);   // place him by tapping one of his shirts
    } else { await page.click('.g4 [data-c="0"]'); await wait(1800); }
  }
  check(await page.evaluate((f) => { const S = window.D2T.state.g433, [d, m, a] = f.split("").map(Number), SL = ["GK", ...Array(d).fill("DEF"), ...Array(m).fill("MID"), ...Array(a).fill("FWD")]; return new Set(S.filled.map((p) => p.slot)).size === 11 && S.filled.every((p) => SL[p.slot] === p.pos); }, form), "Goal Rush: a player sits in the wrong position or two share a shirt");
  check(await page.evaluate(() => { const G4 = window.D2T.game.g433, need = G4.list("FWD")[40].goals; return ["433", "541"].every((f) => G4.canGift("FWD", need, [], f) && [0, 1, 2, 3, 4].every(() => G4.drawOpen({ FWD: 1 }, [], need, f).some((p) => p.goals === need))); }), "Goal Rush: the last-shot gift did not offer the exact player");
  check(await page.evaluate(() => ["442", "433", "451", "352", "343", "424", "532", "541"].every((f) => { const G4 = window.D2T.game.g433, sh = G4.shape(f); return sh.GK + sh.DEF + sh.MID + sh.FWD === 11 && G4.depth(f) > 0 && G4.gift(f) > 0; })), "Goal Rush: a formation has no shape, depth or gift");
  // the sheet opens only after the ending (longer when the total breaks through the target), so wait for it
  await page.waitForSelector(".sheet", { timeout: 15000 }).catch(() => {}); await wait(400); await shot("51-goalrush-end");
  check(await page.evaluate(() => window.D2T.state.g433.filled.length === 11 && window.D2T.game.g433.record().games === 1), "Goal Rush: the game did not fill 11 shirts and record a result");
  check(await page.evaluate((f) => window.D2T.game.g433.record().lastTarget === +f, form), "Goal Rush: the result was not recorded against this game's target");
  check(await page.evaluate(() => window.D2T.state.g433.filled.every((p) => window.D2T.state.g433.filled.filter((q) => q.name === p.name).length === 1)), "Goal Rush: the same player appeared twice");
  check(await page.evaluate((b) => JSON.stringify(window.D2T.game.record()) === b, recBefore), "Goal Rush changed Classic's record");
  check(!!(await page.waitForSelector(".sheet", { timeout: 12000 }).catch(() => null)), "Goal Rush: no result sheet at the end");
  // Play again: a new game picks a formation again and opens with the reveal
  await page.evaluate(() => { const b = document.querySelector('.sheet [data-k="again"]'); if (b) b.click(); }); await wait(700);
  check(await page.evaluate(() => window.D2T.state.g433.filled.length === 0 && !!window.D2T.state.g433.formation && window.D2T.state.g433.revealed === false) && !!(await page.$(".g4-reveal")), "Goal Rush: Play again did not start a new game with a reveal");
  await page.click(".g4-reveal"); await wait(600);   // the reveal counts as seen once it finishes or is skipped
  check(await page.evaluate(() => window.D2T.state.g433.revealed === true) && !(await page.$(".g4-reveal")), "Goal Rush: skipping the reveal did not mark it seen");

  await browser.close();
  if (errors.length) { console.log("FAIL\n" + errors.join("\n")); process.exit(1); }
  console.log("ok: intro, home, spin, table, squad, formations, 3 rolls (tap, drag, pass), fixtures, live match, refresh, season, summary, record, back, account, other screens, Dare2Dream draft, Club X, Daily, Goal Rush");
})().catch((e) => { console.error(e); process.exit(1); });
