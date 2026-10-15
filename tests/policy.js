// Signing policies for the calibration scripts (tests/calibrate.js, tests/calibrate-all.js).
// none: pass every roll. greedy: sign the card and shirt with the biggest gain in team rating, pass if none gains.
// average (Craig, 15 Oct 2026: the title target is for an average player, not the best picks): a typical player,
// decided by a stream of the run's own seed so a seed replays the same: half the time the best option, 3 times in 10
// a card he fancies (any card that gains, at its best shirt), 2 times in 10 a pass; a roll with nothing that gains is
// passed. Respins (5 a season, which Craig counts in the cards a game shows): an average player respins a roll whose
// best gain is under 0.75 rating points, a greedy one under 1.5; none never respins.
const D = require("../src/engine.js");
const RESPIN_UNDER = { average: 0.75, greedy: 1.5 };
function options(st, S) {
  const out = [];
  for (const id of st.roll.cards) {
    let best = null;
    for (const o of D.signPreview(st, S, id)) if (!best || o.delta > best.delta) best = { id, slot: o.slot, delta: o.delta };
    if (best && best.delta > 0) out.push(best);
  }
  return out.sort((a, b) => b.delta - a.delta);
}
function decide(st, S, strategy, r) {
  if (strategy === "none") return D.pass(st, S);
  const opts = options(st, S);
  const best = opts.length ? opts[0].delta : 0;
  if (best < (strategy === "greedy" ? RESPIN_UNDER.greedy : RESPIN_UNDER.average) && st.respins > 0 && D.respinCards(st, S)) return;
  if (!opts.length) return D.pass(st, S);
  if (strategy === "greedy") return D.sign(st, S, opts[0].id, opts[0].slot);
  const x = r();
  if (x < 0.5) return D.sign(st, S, opts[0].id, opts[0].slot);
  if (x < 0.8) { const o = opts[Math.floor(r() * opts.length)]; return D.sign(st, S, o.id, o.slot); }
  return D.pass(st, S);
}
const POLICIES = ["none", "average", "greedy"];
module.exports = { decide, POLICIES };
