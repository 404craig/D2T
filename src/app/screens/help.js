// Each game's rules, for the ? on the home stage (Craig, 30 Oct: "more and better info ... precise and not faff"): titled
// sections, small drawings where they help (card levels, fit colours, the transfer windows, the gestures), and a fixed
// Done button under text that scrolls. They say what the player can do and see, never how the game works it out.
// D2T.gameHelp(id, colour, ink) opens the sheet.
(function () {
  const D2T = window.D2T;
  const sec = (title, html) => `<section class="hp-s"><h3>${title}</h3>${html}</section>`;
  const p = (t) => `<p>${t}</p>`;
  const list = (items) => `<ul class="hp-l">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

  // the card levels, drawn in the cards' own colours
  const levels = () => {
    const LV = D2T.LV || {};
    return `<div class="hp-lv">${['bronze', 'silver', 'gold', 'baller', 'legend'].map((k) => { const L = LV[k] || {}; return `<span style="background:${L.face || '#333'};color:${L.ink || '#fff'}">${L.name || k}</span>`; }).join('')}</div>`;
  };
  // the ring colours round a shirt while a player is picked
  const fits = () => `<div class="hp-fit"><span><i style="background:#12F06C"></i>His position</span><span><i style="background:#FFB020"></i>Next to it</span><span><i style="background:#FF4D52"></i>Out of position</span></div>`;
  // the 17 transfer rolls of a season: Summer, then one every three games, January
  const windows = () => {
    const cell = (t) => `<i class="${t}"></i>`;
    const row = [cell('su'), cell('su'), cell('su'), cell(''), cell(''), cell(''), cell(''), cell(''), cell('ja'), cell('ja'), cell('ja'), cell(''), cell(''), cell(''), cell(''), cell(''), cell('')].join('');
    return `<div class="hp-win"><div class="hp-win-row">${row}</div><div class="hp-win-k"><span><i class="su"></i>Summer window</span><span><i class="ja"></i>January window</span><span><i></i>Every three games</span></div></div>`;
  };
  // how to handle cards
  const ICON = {
    drag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4.6 14a1.6 1.6 0 0 1 2.4-2l2 2"/></svg>',
    tap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3"/><path d="M12 2v1.5M5 9H3.5M20.5 9H19M7 4l1 1M17 4l-1 1"/><path d="M12 12v8"/></svg>',
    two: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    swipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/></svg>'
  };
  const moves = (rows) => `<div class="hp-mv">${rows.map(([ic, t]) => `<div><span class="hp-ic">${ICON[ic]}</span><span>${t}</span></div>`).join('')}</div>`;

  // shared by Classic and the Daily, and most of it by Club X
  const squad = sec('Your squad', p('You start with the club\'s real squad and their best XI in your chosen shape. Change the shape with the chip at the bottom left of the pitch.') + moves([
    ['tap', '<b>Tap a player</b> to see where he plays: every shirt rings in his colours, and his positions show under him.'],
    ['two', '<b>Tap him again</b> for his big card: this season\'s and his Premier League career numbers, his positions and clubs.'],
    ['drag', '<b>Drag a player</b> onto another shirt to swap them. Before the season, drag one on from the bench.']]) + fits() + p('A player out of position plays below his rating, so put players where they are green when you can.'));
  const transfers = sec('Transfers', p('You get <b>17 transfer rolls</b> a season. Each one spins three real players from that season. Sign one onto a shirt, or pass.') + windows() + list([
    'Three rolls in the <b>Summer window</b>, before the first game.',
    'Then a roll <b>every three games</b>, with three more when the <b>January window</b> opens.',
    '<b>Drag</b> a card onto a shirt to sign him there, or tap the card and then the shirt. Tap a picked card again for his big card.',
    'The shirt that suits him best pulses. The player he replaces leaves your XI.',
    'Signing a player takes him from his real club for the rest of the season, so they are weaker from then on.',
    'New signings can take a game or two to settle: dots under his rating show the games to go.']));
  const respins = (club) => sec('Respins and scouting', p(`You have <b>5 respins</b> for the whole run${club ? ', the club spin included' : ''}. The round button beside Spin opens your choices:`) + list([
    '<b>Respin</b> (1): three fresh players.',
    '<b>Scout a position</b> (2): pick a shirt and see three players who would be better in it.',
    '<b>Scout a club</b> (2): pick a club and see three of its players.']));
  const cards = sec('Card levels', levels() + p('Bronze, Silver and Gold go by rating. <b>Baller</b> cards are a season\'s very best players, and <b>Legends</b> the all-time greats at their peak. Both are rare; when one comes up the roll stops to show it off.'));
  const season = sec('The season', list([
    '<b>Kick off</b> plays your next match. Your 38 games are played out on the day; everyone else\'s results follow what really happened, unless your signings change them.',
    'Pick a <b>tactic</b> with the chip at the bottom right of the pitch. Each one leans on a different part of your team.',
    'When the January window opens, a top club comes in for one of your players. His shirt is yours to fill in the window.',
    'The fixtures\' back arrow takes you to your squad between games to rearrange it.']));
  const leaving = sec('Leaving and coming back', p('Home saves your game, and Continue on home picks it up where you left it. Restart throws it away.'));

  const HELP = {
    daily: (g) => [
      sec('The challenge', p(`One club for everyone today: <b>${D2T.esc(g.hl || '')}</b>, a side that really went down. Take them as high as you can. It plays exactly like Classic.`)),
      sec('Goes and your best', list(['Have <b>as many goes as you like</b>. Your best go of the day counts.', 'Every go deals its own cards, so no two are the same.', 'It closes at <b>midnight</b> (UK time). A go you haven\'t finished by then is dropped.', 'Daily results are kept apart from your Classic record. Share your result with Share on home or at the end.'])),
      squad, transfers, respins(false), cards, season, leaving],
    classic: () => [
      sec('The aim', p('Take a club that <b>really went down</b> and rewrite their season. Beat the drop, finish in the top half, the top three, or win the league. Your record counts each.')),
      sec('Pick your club', p('Spin for three clubs that went down. Pick one, or respin for three more.')),
      squad, transfers, respins(true), cards, season, leaving],
    clubx: () => [
      sec('The aim', p('Build a club from nothing and <b>win the league</b>. Name your club, spin a real season and take the bottom side\'s place.')),
      sec('The draft', list(['Each spin brings three players for the shirts you still have to fill. Pick one and put him on any open shirt.', 'Every shirt rings in his colours: green fits him, amber is next to his position, red is out of position.', 'You can change the shape after any spin, and move your players about.', 'No respins in the draft. Fill all 11, then the season starts.'])),
      sec('The season', p('Then it plays like Classic: transfer rolls, respins and scouting, tactics and Kick off.') + list(['Your first season has <b>14 transfer rolls</b>: one every three games and three when the January window opens.', 'From your second season, the <b>Summer window</b> adds three before the first game.', '<b>Drag</b> a card onto a shirt to sign him, or tap the card then the shirt. Tap a picked card again for his big card.', 'You have <b>5 respins</b> a season for respinning and scouting.'])),
      cards,
      sec('Career mode', list(['Stay up and your career goes on to the next season with your players, each on his real card for that season.', 'Before each new season, other clubs come in for <b>three of your players</b>. Fill their shirts in the Summer window, or free agents step in.', 'Players with no real season left get older and slowly lose rating.', 'After 2025/26 the seasons are a forecast, played out from scratch.', 'Go down and the career ends. Club history on the season summary shows every season.'])),
      leaving],
    goal: () => [
      sec('The target', `<div class="hp-gr"><b>3-5-2</b><span>=</span><b>352 goals</b></div>` + p('Each game picks a formation, and its number is your target. Fill the XI so their <b>career Premier League goals</b> add up to it <b>exactly</b>.')),
      sec('Picking your XI', list(['Spin for three real players for the shirts still open. Pick one.', '<b>Drag</b> him onto a yellow shirt, tap him then the shirt, or tap him twice.', 'His goals roll up on his shirt and into your total. You can spin again while they count.', 'You have <b>3 respins</b> a game.'])),
      sec('Scoring', list(['Land exactly on the target and it\'s <b>Spot on</b>.', 'Go over and you\'re bust: over is over.', 'Your best is how close you got, whatever the formation.'])),
      leaving],
    ub: () => [
      sec('How it works', p('Spin to pick a stat: career goals, appearances, assists, a season\'s goals, a club\'s points, and more. Two real numbers come up side by side. The left one shows; is the right one <b>higher or lower</b>?')),
      sec('Making your call', moves([['swipe', '<b>Swipe up</b> for higher or <b>down</b> for lower, anywhere on the cards, or tap Higher or Lower.']]) + list(['Get it right and your run goes up by one; the next card rolls in.', 'One wrong call ends your run.', 'You have <b>3 refreshes</b> a run to swap a card you don\'t fancy, without losing your run.'])),
      sec('Your bests', p('Your best run is kept for every stat. Home saves a run in progress.'))],
    ten: () => [
      sec('Tenaball', p('Our football quiz: <b>name the top ten</b> in a Premier League list, like the all-time top scorers. It opens in its own tab, and your Tenaball scores stay there.'))]
  };

  D2T.gameHelp = (g) => {
    const make = HELP[g.id]; if (!make) return null;
    return D2T.sheet({ title: D2T.esc(g.name), cls: 'hp-sheet', body: `<div class="hp" style="--hc:${g.kt || g.k}">${make(g).join('')}</div>`,
      foot: `<button class="btn hp-done" data-done style="background:${g.k};color:${g.ink || '#0A0A0A'}">Done</button>` });
  };
})();
