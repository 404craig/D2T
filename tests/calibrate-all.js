// Balance across every relegated club-season: node tests/calibrate-all.js [runs per club] [game.json path]
// Strategies (tests/policy.js): none (pass every roll), average (a typical player's picks) and greedy (the biggest gain).
// ODDS='[b,s,g,p,l]' overrides RULES.levelOdds; POLICIES=greedy,average picks the policies.
// HIST=1 plays each club's runs one after another with the anti-repeat memory (the last three runs' cards drawn less,
// as the app does per phone), to check the balance holds with it.
const D = require("../src/engine.js");
const { decide, POLICIES } = require("./policy.js");
const G = require(process.argv[3] || "../data/game/game.json");
require("./legends.js")(G);   // the legend cards, as the phone plays them
const per = +(process.argv[2] || 6);
if (process.env.ODDS) D.RULES.levelOdds = JSON.parse(process.env.ODDS);
if (process.env.ELITE) D.RULES.elite = JSON.parse(process.env.ELITE);
// tuning knobs for the 18 Oct rethink: STAR='[1,1,1.5,1.75,2]' the star slopes, TACT='{"low":{...}}' merged into the tactics,
// HALF=0.5 the half-shape factor, NOTACT=1 leaves every test player on the mid block
if (process.env.STAR) D.RULES.star.slope = JSON.parse(process.env.STAR);
if (process.env.TACT) { const t = JSON.parse(process.env.TACT); for (const k of Object.keys(t)) Object.assign(D.RULES.tactics[k], t[k]); }
if (process.env.HALF) D.RULES.halfShape = +process.env.HALF;
const HIST = !!process.env.HIST, recent = {};
function run(entry, seed, strategy) {
  const S = G.seasons[entry.season];
  const club = S.clubs.find(c => c.name === entry.club).id;
  const rel = S.relegated.find(r => r.c === club) || { c: club, f: "4-4-2", xi: [] };
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: entry.key, recent: HIST ? D.recentWeights(recent[entry.key]) : null });
  D.chooseClub(st, S, rel); D.startSeason(st, S);
  let guard = 0;
  const r = D.stream(seed, "policy");
  while (st.phase !== "summary" && guard++ < 500) {
    if (st.phase === "window") decide(st, S, strategy, r);
    else if (st.phase === "prematch") D.playMatch(st, S);
  }
  if (HIST) recent[entry.key] = [st.offered].concat(recent[entry.key] || []).slice(0, D.RULES.recent.length);
  return { f: st.final, n: S.clubs.length };
}
for (const strat of (process.env.POLICIES ? process.env.POLICIES.split(",") : POLICIES)) {
  let n = 0, title = 0, top4 = 0, half = 0, up = 0, pts = 0;
  for (const e of G.catalogue) for (let i = 0; i < per; i++) {
    const { f, n: k } = run(e, "all" + i + e.key, strat);
    n++; title += f.finish === 1; top4 += f.finish <= 4; half += f.finish <= k / 2; up += f.finish <= k - 3; pts += f.pts;
  }
  const pc = x => (100 * x / n).toFixed(1) + "%";
  console.log(`${strat.padEnd(6)} ${n} runs: title ${pc(title)}, top 4 ${pc(top4)}, top half ${pc(half)}, stay up ${pc(up)}, avg ${(pts / n).toFixed(0)} pts`);
}
