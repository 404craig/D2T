// The account backup (Craig, 1 Nov, build 218): a signed-in phone backs its records up to the account and gets them back
// on any other phone; two phones' records are joined, never written over; a phone with nothing rebuilds what the
// leaderboard results can give; a phone that is behind merges the newer copy and tries again; a second account on the
// same phone keeps its own records. Against a mocked server. Needs the page at localhost:8765.
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL: " + msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const USERS = { tA: { id: "u1", name: "Aiden", email: "a@example.com" }, tB: { id: "u2", name: "Craig", email: "c@example.com" } };
const server = { backup: {}, results: { u1: [], u2: [] }, puts: 0, conflicts: 0 };

const run = (seed, ms, o = {}) => Object.assign({ key: "2007/08:Derby", mode: "classic", season: "2007/08", club: "Derby", finish: 10, rise: 10, pts: 50, histFinish: 20, histPts: 11, drop: true, half: true, top3: false, title: false, at: "2026-10-20", seed, ms }, o);

(async () => {
  const browser = await chromium.launch();
  async function open(state, ctxIn) {
    const ctx = ctxIn || await browser.newContext({ viewport: { width: 393, height: 852 } });
    if (!ctxIn) await ctx.route("**/api/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname.replace(/^\/api/, ""), auth = (req.headers().authorization || "").replace("Bearer ", "");
      const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      const u = USERS[auth], body = JSON.parse(req.postData() || "{}");
      if (path === "/me") return u ? json({ user: u, stats: {} }) : json({ error: "no" }, 401);
      if (path === "/d2t/backup") {
        if (!u) return json({ error: "no" }, 401);
        const cur = server.backup[u.id] || { v: 0, data: null };
        if (body.op === "put") {
          if (body.base !== cur.v) { server.conflicts++; return json({ conflict: true, v: cur.v, data: cur.data }, 409); }
          server.puts++; server.backup[u.id] = { v: cur.v + 1, data: body.data }; return json({ v: cur.v + 1 });
        }
        return json(Object.assign({ v: cur.v, data: cur.data }, body.results ? { results: server.results[u.id] } : {}));
      }
      if (path.startsWith("/d2t/")) return json({ ok: true, games: {}, signedIn: !!u, pos: {}, added: 0 });
      return json({});
    });
    if (state) await ctx.addInitScript(`try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('d2t-v2', ${JSON.stringify(JSON.stringify(state))}); } } catch (e) {}`);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + "?v=test");
    await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.backup, null, { timeout: 30000 });
    return { ctx, p, errs };
  }
  const signedIn = (token) => ({ account: { signedIn: true, user: USERS[token], token }, migrated: true });
  const rec = (p) => p.evaluate(() => { const s = window.D2T.state; return { runs: s.record.runs.map((r) => r.seed), clubs: s.record.clubs, daily: s.record.daily, g: s.record.g433, ub: s.ub, run: s.run ? s.run.eng.seed : null, xName: s.xName }; });
  const synced = (p) => p.waitForFunction(() => window.D2T.state.backup && window.D2T.state.backup.at, null, { timeout: 15000 });

  // 1. phone A: its records go up on load
  const A = await open(Object.assign(signedIn("tA"), { record: { runs: [run("s1", 1000), run("s2", 2000, { finish: 1, title: true, top3: true, rise: 19, daily: "2026-10-20" })], clubs: { "2007/08:Derby": { runs: 2, finish: 1, rise: 19 } },
    daily: { "2026-10-20": { club: "Derby", season: "2007/08", finish: 1, rise: 19, pts: 80, goes: 1 } }, g433: { games: 5, exact: 1, best: 0, gapSum: 20, gapGames: 5 } }, ub: { runs: 4, best: { cg: 7 }, lastRun: 3 }, xName: "Tenerife Town" }));
  await synced(A.p); await wait(300);
  const up = server.backup.u1 && server.backup.u1.data;
  check(up && up.record.runs.length === 2 && up.record.g433.games === 5 && up.ub.runs === 4 && up.xName === "Tenerife Town", "phone A's records did not go up: " + JSON.stringify(up && up.record.runs));
  check(up && !up.account && !up.lb, "the backup carried the account or the leaderboard queue");

  // 2. phone B (Safari wiped it, or a new phone): signed in with one run of its own, gets A's and keeps its own
  const B = await open(Object.assign(signedIn("tA"), { record: { runs: [run("s3", 3000, { finish: 5, rise: 15 })], clubs: { "2007/08:Derby": { runs: 1, finish: 5, rise: 15 } } }, ub: { runs: 1, best: { cg: 9, sg: 2 }, lastRun: 9 } }));
  await synced(B.p); await wait(500);
  let b = await rec(B.p);
  check(b.runs.join() === "s1,s2,s3", "phone B should hold all three runs in order, has " + b.runs.join());
  check(b.clubs["2007/08:Derby"] && b.clubs["2007/08:Derby"].runs === 3 && b.clubs["2007/08:Derby"].finish === 1, "the club's best was not worked out from both: " + JSON.stringify(b.clubs));
  check(b.daily && b.daily["2026-10-20"] && b.daily["2026-10-20"].finish === 1, "the Daily best did not come down");
  check(b.g && b.g.games === 5, "Goal Rush totals did not come down");
  check(b.ub.runs === 4 && b.ub.best.cg === 9 && b.ub.best.sg === 2, "Unbeaten: more runs and the best per stat: " + JSON.stringify(b.ub));
  check(b.xName === "Tenerife Town", "the club name did not come down");
  check(server.backup.u1.data.record.runs.length === 3, "the joined copy did not go back up");

  // 3. a finished game on B goes up a few seconds later; A picks it up on return to the tab
  await B.p.evaluate(() => { window.D2T.game.g433.finish(350, 352); });
  await wait(5500);
  check(server.backup.u1.data.record.g433.games === 6, "a finished Goal Rush game did not go up: " + JSON.stringify(server.backup.u1.data.record.g433));
  await A.p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await wait(1200);
  check((await rec(A.p)).g.games === 6 && (await rec(A.p)).runs.length === 3, "phone A did not pick up phone B's games on return");

  // 4. a phone that is behind is told and merges: A writes with an old version
  const v0 = server.backup.u1.v;
  server.backup.u1 = { v: v0 + 1, data: Object.assign({}, server.backup.u1.data, { record: Object.assign({}, server.backup.u1.data.record, { runs: server.backup.u1.data.record.runs.concat([run("s9", 9000)]) }) }) };
  await A.p.evaluate(() => { window.D2T.state.record.runs.push({ key: "1997/98:Barnsley", mode: "classic", season: "1997/98", club: "Barnsley", finish: 3, rise: 16, pts: 70, seed: "s4", ms: 4000, at: "2026-10-30", drop: true, half: true, top3: true }); window.D2T.save(); });
  await wait(6000);
  const after = server.backup.u1.data.record.runs.map((r) => r.seed).sort().join();
  check(server.conflicts >= 1 && after === "s1,s2,s3,s4,s9", "a phone behind wrote over the newer copy or lost its own run: " + after);

  // 5. a phone with nothing: no backup, the leaderboard results rebuild what they can
  server.results.u2 = [{ game: "classic", rec: { rid: "r1", club: "Derby", season: "2007/08", finish: 1, histFinish: 20, rise: 19, pts: 85, histPts: 11, at: Date.parse("2026-10-31T12:00:00Z") } },
    { game: "daily", rec: { rid: "r2", date: "2026-10-31", club: "Bolton", season: "1995/96", finish: 4, histFinish: 20, rise: 16, pts: 66, histPts: 29, goes: 3, at: Date.parse("2026-10-31T13:00:00Z") } },
    { game: "goal", rec: { rid: "carry:x", carry: true, games: 10, exact: 1, best: 0 } }, { game: "goal", rec: { rid: "g1", shape: "433", target: 433, total: 440, gap: 7, at: 1 } },
    { game: "ub", rec: { rid: "u1", stat: "cg", run: 12, at: 1 } }];
  const C = await open(signedIn("tB"));
  await synced(C.p); await wait(500);
  const c = await rec(C.p);
  check(c.runs.join() === "r1,r2", "the leaderboard results did not rebuild the runs: " + c.runs.join());
  check(c.daily["2026-10-31"] && c.daily["2026-10-31"].goes === 3, "the Daily from the results lost its goes");
  check(c.g && c.g.games === 11 && c.g.exact === 1 && c.g.gapGames === 1, "Goal Rush from the results: " + JSON.stringify(c.g));
  check(c.ub && c.ub.runs === 1 && c.ub.best.cg === 12, "Unbeaten from the results: " + JSON.stringify(c.ub));
  const shown = await C.p.evaluate(() => window.D2T.game.record("classic").titles);
  check(shown === 1, "the rebuilt title does not count on home");

  // 6. someone else signs in on phone A: A's records put aside, theirs in; signing back brings A's back
  await A.p.evaluate(() => { window.D2T.state.account = { signedIn: true, user: { id: "u2", name: "Craig" }, token: "tB" }; window.D2T.save(); window.D2T.backup.sync(); });
  await wait(1500);
  let a = await rec(A.p);
  check(a.runs.join() === "r1,r2" && !a.xName, "another account on phone A should see only theirs: " + a.runs.join());
  check(!(server.backup.u2.data.record.runs || []).some((r) => r.seed === "s1"), "phone A's account's runs went up to the other account");
  await A.p.evaluate(() => { window.D2T.state.account = { signedIn: true, user: { id: "u1", name: "Aiden" }, token: "tA" }; window.D2T.save(); window.D2T.backup.sync(); });
  await wait(1500);
  a = await rec(A.p);
  check(a.runs.includes("s1") && a.runs.includes("s9") && !a.runs.includes("r1"), "signing back in did not bring A's own back: " + a.runs.join());

  // 7. a game in progress comes down once, into an empty slot only
  server.backup.u1.data.run = { eng: { v: 1, seed: "live-run", seasonKey: "2007/08" }, step: "squad" };
  server.backup.u1.v++;
  const D = await open(signedIn("tA"));
  await synced(D.p); await wait(400);
  check((await rec(D.p)).run === "live-run", "the run in progress did not come down to a new phone");
  await D.p.evaluate(() => { window.D2T.state.run = null; window.D2T.save(); }); await wait(200);
  await D.p.evaluate(() => window.D2T.backup.sync()); await wait(800);
  check((await rec(D.p)).run === null, "a run this phone dropped came back on the next sync");

  [A, B, C, D].forEach((x) => check(!x.errs.length, "page errors: " + x.errs.join(" | ")));
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: backup (records go up, a second phone gets them and keeps its own, games go up after they finish, a phone behind merges, the leaderboard results rebuild an empty phone, accounts on one phone stay apart, a run in progress comes down once)");
})();
