// Start-up: sound follows the saved setting and wakes on the first tap (phones refuse sound before one), then the router starts.
(function () {
  const D2T = window.D2T, SND = window.D2TSound;
  if (SND) {
    SND.setMuted(!!(D2T.state.settings && D2T.state.settings.muted));
    const wake = () => { SND.unlock(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('touchend', wake, true); };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('touchend', wake, true);
  }
  // a Daily left unfinished before midnight closes on the next load, and while the game is open
  if (D2T.game && D2T.game.closeOldDaily) {
    D2T.game.closeOldDaily();
    const IN_RUN = ['spin', 'table', 'squad', 'transfer', 'fixtures', 'match'];
    setInterval(() => { const onDaily = !!(D2T.state.run && D2T.state.run.daily); if (D2T.game.closeOldDaily() && onDaily && IN_RUN.includes(D2T.currentScreen())) D2T.go('home'); }, 30000);
  }
  if (!D2T.started) D2T.start();          // normally the shell started the intro already, before the data arrived
  D2T.ready();
})();
