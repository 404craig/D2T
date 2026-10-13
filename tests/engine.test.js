// Engine checks: node tests/engine.test.js
const assert = require("assert");
const D = require("../src/engine.js");
const G = require("../data/game/game.json");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const play = (seed, season, club, strategy = "greedy") => {
  const S = G.seasons[season]; const c = S.clubs.find(x => x.name === club).id;
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: `${season}:${club}` });
  D.chooseClub(st, S, S.relegated.find(r => r.c === c) || { c, f: "4-4-2", xi: [] }); D.startSeason(st, S);
  const offered = [];
  let g = 0;
  while (st.phase !== "summary" && g++ < 600) {
    if (st.phase === "window") {
      offered.push(...st.roll.cards);
      if (strategy === "pass") { D.pass(st, S); continue; }
      let best = null;
      for (const id of st.roll.cards) for (const o of D.signPreview(st, S, id)) if (!best || o.delta > best.delta) best = { id, slot: o.slot, delta: o.delta };
      if (best.delta > 0) D.sign(st, S, best.id, best.slot); else D.pass(st, S);
    } else D.playMatch(st, S);
  }
  return { st, S, offered };
};
t("history tables match the real points for every relegated club", () => {
  for (const [key, S] of Object.entries(G.seasons)) {
    const H = D.historyTable(S, S.deductions);
    for (const r of S.relegated) {
      const pos = H.findIndex(x => x.c === r.c) + 1, row = H[pos - 1];
      assert.strictEqual(row.pts, r.pts, `${key} ${S.clubs[r.c].name} pts`);
      assert.strictEqual(pos, r.pos, `${key} ${S.clubs[r.c].name} pos`);
    }
  }
});
t("Derby 2007/08 history: 11 points, 20 for, 89 against", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const row = D.historyTable(S).find(r => r.c === d);
  assert.deepStrictEqual([row.pts, row.gf, row.ga, row.w], [11, 20, 89, 1]);
});
t("17 rolls in a 38-game season, last roll before GW36", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const sch = D.schedule(D.fixturesOf(S, d));
  assert.strictEqual(sch.reduce((a, w) => a + w.n, 0), 17);
  assert.strictEqual(sch[sch.length - 1].gw, 36);
  assert.strictEqual(sch.find(w => w.kind === "jan").gw, 21);
});
const run1 = play("test-seed", "2007/08", "Derby");
t("a season ends with every club on 38 games", () => {
  const T = D.table(run1.S, run1.st, null, run1.S.deductions);
  assert.strictEqual(T.length, 20);
  for (const r of T) assert.strictEqual(r.p, 38);
  assert.strictEqual(run1.st.played.length, 38);
});
t("the same seed and choices give the same season", () => {
  const again = play("test-seed", "2007/08", "Derby");
  assert.deepStrictEqual(again.st.final.table, run1.st.final.table);
  assert.deepStrictEqual(again.st.played.map(r => [r.us, r.them]), run1.st.played.map(r => [r.us, r.them]));
});
t("no player is offered twice in a run, and never one of your own squad", () => {
  assert.strictEqual(new Set(run1.offered).size, run1.offered.length);
  const own = new Set(D.squadOf(run1.S, run1.st.club).map(p => p.id));
  for (const id of run1.offered) assert.ok(!own.has(id));
});
t("respins: 5 a season, then refused", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const st = D.newRun({ seed: "rs", catalogue: G.catalogue });
  assert.ok(D.respinClubs(st, G.catalogue));
  D.chooseClub(st, S, S.relegated.find(r => r.c === d)); D.startSeason(st, S);
  for (let i = 0; i < 4; i++) assert.ok(D.respinCards(st, S));
  assert.strictEqual(st.respins, 0);
  assert.ok(!D.respinCards(st, S));
});
t("signing a player weakens his club and he never scores against you", () => {
  for (const s of run1.st.signed) {
    if (String(s.id).startsWith("L:")) continue;
    const p = D.playerOf(run1.S, s.id);
    assert.ok(D.strengthLoss(run1.S, p.c, new Set([s.id])) >= 0);
  }
  const signedAt = new Map(run1.st.signed.map(s => [s.id, s.gw]));
  for (const r of run1.st.played) for (const e of r.events) if (!e.us && signedAt.has(e.id)) assert.ok(r.gw < signedAt.get(e.id), "signed player scored against you");
});
t("raids only ever take points off raided clubs", () => {
  const H = D.historyTable(run1.S), T = D.table(run1.S, run1.st, null);
  const raided = new Set(run1.st.signed.map(s => D.playerOf(run1.S, s.id)).filter(p => p && p.c != null).flatMap(p => [p.c, p.c2]));
  const others = D.otherResults(run1.S, run1.st).filter(m => m.changed);
  for (const m of others) assert.ok(raided.has(m.h) || raided.has(m.a));
});
t("passing every roll keeps Derby near history", () => {
  let pts = 0; for (let i = 0; i < 20; i++) pts += play("pass" + i, "2007/08", "Derby", "pass").st.final.pts;
  assert.ok(pts / 20 < 30, "avg " + pts / 20);
});
t("every relegated club-season can be played to the end", () => {
  for (const c of G.catalogue.filter((_, i) => i % 9 === 0)) {
    const r = play("all-" + c.key, c.season, c.club);
    assert.strictEqual(r.st.phase, "summary", c.key);
    assert.strictEqual(r.st.played.length, r.st.fixtures.length);
  }
});
// Dare2Dream: draft 11 (best effective rating each time), then play the season greedily.
const draft = (seed, c, formation, mode) => {
  const S = G.seasons[c.season], id = S.clubs.find(x => x.name === c.club).id;
  const st = D.newRun({ seed, mode: mode || "dare2dream", catalogue: G.clubSeasons });
  D.chooseClub(st, S, { c: id, f: "4-4-2", xi: [] });
  if (formation) assert.ok(D.draftFormation(st, S, formation));
  while (st.phase === "draft") {
    if (D.draftSlot(st) == null) {   // Club X: the best card on the shirt he fits best
      const opts = st.roll.cards.map((cid) => { const s = D.draftFits(st, S, cid)[0]; return { cid, s, r: D.effRating(D.playerOf(S, cid, S.legends), D.FORMATIONS[st.formation][s][0]) }; });
      const b = opts.sort((x, y) => y.r - x.r)[0];
      assert.ok(D.draftPick(st, S, b.cid, b.s)); continue;
    }
    const slot = D.draftSlot(st), pos = D.FORMATIONS[st.formation][slot][0];
    assert.strictEqual(st.roll.cards.length, 3, c.key);
    for (const cid of st.roll.cards) assert.strictEqual(D.broadOf(D.playerOf(S, cid)), D.SLOT_BROAD[pos], c.key + " card out of position");
    const best = st.roll.cards.slice().sort((x, y) => D.effRating(D.playerOf(S, y), pos) - D.effRating(D.playerOf(S, x), pos))[0];
    assert.ok(D.draftPick(st, S, best));
  }
  return { st, S };
};
t("Dare2Dream: the draft fills 11 shirts in position from other clubs, then the season has no pre-season rolls", () => {
  assert.strictEqual(G.clubSeasons.length, 686);
  for (const c of G.clubSeasons.filter((_, i) => i % 7 === 0)) {
    const { st, S } = draft("d2d-" + c.key, c, "4-3-3");
    assert.strictEqual(st.phase, "setup");
    assert.strictEqual(st.xi.filter(x => x != null).length, 11, c.key);
    assert.strictEqual(new Set(st.xi).size, 11, c.key);
    const own = new Set(D.squadOf(S, st.club).map(p => p.id));
    assert.ok(st.xi.every(id => !own.has(id)), c.key + " drafted his own club's player");
    assert.strictEqual(st.signed.filter(x => x.draft).length, 11);
    D.startSeason(st, S);
    assert.ok(st.rolls.every(w => w.kind !== "pre"), "pre-season rolls should be dropped");
    assert.strictEqual(st.rolls.reduce((a, w) => a + w.n, 0), D.schedule(st.fixtures).reduce((a, w) => a + w.n, 0) - 3, c.key + " rolls");
    assert.strictEqual(st.phase, "prematch");
  }
});
t("Club X: each season's bottom club is replaced by a drafted XI that plays the season out", () => {
  const bottom = Object.values(G.clubSeasons.reduce((m, c) => { if (!m[c.season] || c.pos > m[c.season].pos) m[c.season] = c; return m; }, {}));
  assert.strictEqual(bottom.length, Object.keys(G.seasons).length);
  assert.ok(D.DRAFT_MODES.includes("clubx"));
  for (const c of bottom.filter((_, i) => i % 6 === 0)) {
    const { st, S } = draft("clx-" + c.key, c, null, "clubx");
    assert.strictEqual(st.mode, "clubx");
    assert.strictEqual(st.xi.filter(x => x != null).length, 11, c.key);
    D.startSeason(st, S);
    assert.ok(st.rolls.every(w => w.kind !== "pre"));
    let g = 0;
    while (st.phase !== "summary" && g++ < 700) { if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S); }
    assert.strictEqual(st.phase, "summary", c.key);
  }
});
t("Club X spins one season and drafts from every open shirt, each card green in one of them; Dare2Dream stays keeper first", () => {
  const S = G.seasons["2007/08"], derby = S.clubs.find(x => x.name === "Derby").id;
  const xr = D.newRun({ seed: "clx-one", mode: "clubx", catalogue: G.clubSeasons });
  assert.strictEqual(xr.clubOffer.length, 1, "Club X should offer one season");
  assert.ok(D.respinClubs(xr, G.clubSeasons) && xr.clubOffer.length === 1, "a Club X respin should offer one season");
  assert.strictEqual(D.newRun({ seed: "d2d-three", mode: "dare2dream", catalogue: G.clubSeasons }).clubOffer.length, 3);
  const F = D.FORMATIONS["4-4-2"];
  const play = (seed, mode, pickLast) => {
    const st = D.newRun({ seed, mode, catalogue: G.clubSeasons }); D.chooseClub(st, S, { c: derby, f: "4-4-2", xi: [] });
    const out = [], firstPos = [];
    while (st.phase === "draft") {
      assert.strictEqual(st.roll.cards.length, 3, "three cards every spin");
      if (mode === "clubx") {
        const open = st.xi.map((x, i) => (x == null ? F[i][0] : null)).filter(Boolean);
        for (const id of st.roll.cards) {
          const p = D.playerOf(S, id, S.legends), fits = D.draftFits(st, S, id);
          assert.ok(fits.length === open.length && fits.every((i) => st.xi[i] == null), "a card can go on any open shirt");
          assert.ok(open.some((pos) => D.fitOf(p, pos) === "green"), "every card is green in at least one open shirt");
        }
        if (!out.length) st.roll.cards.forEach((id) => firstPos.push(F[D.draftFits(st, S, id)[0]][0]));
        const id = st.roll.cards[pickLast ? 2 : 0], slot = D.draftFits(st, S, id)[0];
        assert.ok(D.draftPick(st, S, id, slot)); out.push(slot);
      } else { out.push(D.draftSlot(st)); assert.ok(D.draftPick(st, S, st.roll.cards[0])); }
    }
    assert.ok(st.xi.every((x) => x != null), "all 11 shirts filled");
    return { out, firstPos };
  };
  const runs = ["a", "b", "c", "d", "e", "f"].map((k) => play("clx-open-" + k, "clubx"));
  assert.ok(runs.some((r) => r.firstPos.some((pos) => pos !== "GK")), "Club X's first spin should not be all keepers");
  assert.ok(runs.some((r) => new Set(r.firstPos).size > 1), "Club X's first spin mixes positions");
  assert.deepStrictEqual(play("clx-open-a", "clubx").out, runs[0].out, "the same seed and picks replay");
  // the shape can change after any spin: drafted players re-seated, the cards on the table kept; any open shirt, even a red one
  {
    const st = D.newRun({ seed: "clx-shape", mode: "clubx", catalogue: G.clubSeasons }); D.chooseClub(st, S, { c: derby, f: "4-4-2", xi: [] });
    for (let k = 0; k < 4; k++) { const id = st.roll.cards[0]; assert.ok(D.draftPick(st, S, id, D.draftFits(st, S, id)[0])); }
    const before = st.xi.filter(Boolean).sort(), cards = st.roll.cards.slice();
    assert.ok(D.draftFormation(st, S, "3-5-2"), "Club X can change shape mid-draft");
    assert.strictEqual(st.formation, "3-5-2");
    assert.deepStrictEqual(st.xi.filter(Boolean).sort(), before, "the drafted players stay");
    assert.deepStrictEqual(st.roll.cards, cards, "the cards on the table stay");
    const id = st.roll.cards[0], p = D.playerOf(S, id, S.legends), F2 = D.FORMATIONS["3-5-2"];
    const red = D.draftFits(st, S, id).find((i) => D.fitOf(p, F2[i][0]) === "red");
    if (red != null) { assert.ok(D.draftPick(st, S, id, red), "a red open shirt can be picked"); assert.strictEqual(st.xi[red], id); }
    const dd = D.newRun({ seed: "d2d-shape", mode: "dare2dream", catalogue: G.clubSeasons }); D.chooseClub(dd, S, { c: derby, f: "4-4-2", xi: [] });
    assert.ok(D.draftPick(dd, S, dd.roll.cards[0]));
    assert.ok(!D.draftFormation(dd, S, "3-5-2"), "Dare2Dream's shape is fixed after the first pick");
  }
  const d = play("d2d-order", "dare2dream").out;
  assert.strictEqual(d[0], 0, "Dare2Dream starts with the keeper");
  assert.deepStrictEqual(d, D.draftOrder("4-4-2"));
});
t("Club X career: carried XI leaves its real clubs, later seasons get pre-season rolls, forecast results replay", () => {
  const S = G.seasons["2024/25"], st = D.newRun({ seed: "car-1", mode: "clubx", catalogue: [] });
  st.seasonKey = S.season; st.club = 19; st.formation = "4-4-2"; st.career = 2;
  const ids = D.autoXI(S, 0, "4-4-2", []);
  D.carryIn(st, S, ids);
  assert.strictEqual(st.phase, "setup");
  assert.ok(st.raids.length >= 1 && st.raids.every((r) => r.club === 0 && r.date === "0000-00-00"), "carried players leave their real club before the season");
  assert.ok(D.startSeason(st, S) && st.rolls[0].kind === "pre", "a career's later season has pre-season rolls");
  const T = G.seasons["2025/26"], copy = () => Object.assign({}, T, { matches: T.matches.map((m) => [m[0], m[1], m[2], 0, 0]), _ix: null, season: "2026/27" });
  const a = D.simResults(copy(), "car-sim", 5, null), b = D.simResults(copy(), "car-sim", 5, null);
  assert.deepStrictEqual(a.matches, b.matches, "the same career gets the same forecast");
  const goals = a.matches.reduce((n, m) => n + m[3] + m[4], 0) / a.matches.length;
  assert.ok(goals > 2 && goals < 3.5, "forecast goals per game look like football: " + goals.toFixed(2));
});
t("Dare2Dream: a sample of drafted seasons plays to the end, and draft picks weaken their clubs", () => {
  for (const c of G.clubSeasons.filter((_, i) => i % 45 === 0)) {
    const { st, S } = draft("d2d-play-" + c.key, c);
    D.startSeason(st, S);
    let g = 0;
    while (st.phase !== "summary" && g++ < 700) {
      if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S);
    }
    assert.strictEqual(st.phase, "summary", c.key);
    assert.ok(!st.final.bestSigning, "draft picks are not signings");
    const gone = new Set(st.signed.map(x => x.id)), clubs = [...new Set(st.signed.map(x => x.from).filter(x => x != null))];
    assert.ok(clubs.some(cl => D.strengthLoss(S, cl, gone) > 0), c.key + ": no drafted player weakened his club");
  }
});
console.log(`${n} checks passed`);
