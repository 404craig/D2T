// Balance across every relegated club-season: node tests/calibrate-all.js [runs per club] [game.json path]
// Strategies: none (pass every roll) and greedy (sign the card and shirt with the biggest gain, no respins).
// HIST=1 plays each club's runs one after another with the anti-repeat memory (the last three runs' cards drawn less,
// as the app does per phone), to check the balance holds with it.
const D = require("../src/engine.js");
const G = require(process.argv[3] || "../data/game/game.json");
const per = +(process.argv[2] || 6);
if (process.env.ODDS) D.RULES.levelOdds = JSON.parse(process.env.ODDS);
const HIST = !!process.env.HIST, recent = {};
function run(entry, seed, strategy) {
  const S = G.seasons[entry.season];
  const club = S.clubs.find(c => c.name === entry.club).id;
  const rel = S.relegated.find(r => r.c === club) || { c: club, f: "4-4-2", xi: [] };
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: entry.key, recent: HIST ? D.recentWeights(recent[entry.key]) : null });
  D.chooseClub(st, S, rel); D.startSeason(st, S);
  let guard = 0;
  while (st.phase !== "summary" && guard++ < 500) {
    if (st.phase === "window") {
      if (strategy === "none") D.pass(st, S);
      else {
        let best = null;
        for (const id of st.roll.cards) for (const o of D.signPreview(st, S, id)) if (!best || o.delta > best.delta) best = { id, slot: o.slot, delta: o.delta };
        if (best && best.delta > 0) D.sign(st, S, best.id, best.slot); else D.pass(st, S);
      }
    } else if (st.phase === "prematch") D.playMatch(st, S);
  }
  if (HIST) recent[entry.key] = [st.offered].concat(recent[entry.key] || []).slice(0, D.RULES.recent.length);
  return { f: st.final, n: S.clubs.length };
}
for (const strat of ["none", "greedy"]) {
  let n = 0, title = 0, top4 = 0, half = 0, up = 0, pts = 0;
  for (const e of G.catalogue) for (let i = 0; i < per; i++) {
    const { f, n: k } = run(e, "all" + i + e.key, strat);
    n++; title += f.finish === 1; top4 += f.finish <= 4; half += f.finish <= k / 2; up += f.finish <= k - 3; pts += f.pts;
  }
  const pc = x => (100 * x / n).toFixed(1) + "%";
  console.log(`${strat.padEnd(6)} ${n} runs: title ${pc(title)}, top 4 ${pc(top4)}, top half ${pc(half)}, stay up ${pc(up)}, avg ${(pts / n).toFixed(0)} pts`);
}
