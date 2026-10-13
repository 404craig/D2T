// Start-up: sound follows the saved setting and wakes on the first tap (phones refuse sound before one), then the router starts.
(function () {
  const D2T = window.D2T, SND = window.D2TSound;
  if (SND) {
    SND.setMuted(!!(D2T.state.settings && D2T.state.settings.muted));
    const wake = () => { if (D2T.loadClips) D2T.loadClips(); SND.unlock(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('touchend', wake, true); };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('touchend', wake, true);
    // button sounds (Craig's picks, 13 Oct): a soft felt press for the big buttons, a muted one for the small ones
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
      if (b.closest('.sp-main, .se-btn, .fr-card-btn, .fr-gm, .x-name-go') || (b.classList.contains('btn') && !b.classList.contains('btn-ghost'))) SND.play('tap');
      else if (b.closest('.topbar, .fr-tabbar, .sp-round, .sheet, .btn-ghost, .fr-soon-t')) SND.play('tapSmall');
    }, true);
  }
  // a Daily left unfinished before midnight closes on the next load, and while the game is open
  if (D2T.game && D2T.game.closeOldDaily) {
    D2T.game.closeOldDaily();
    const IN_RUN = ['spin', 'table', 'squad', 'transfer', 'fixtures', 'match'];
    setInterval(() => { const onDaily = !!(D2T.state.run && D2T.state.run.daily); if (D2T.game.closeOldDaily() && onDaily && IN_RUN.includes(D2T.currentScreen())) D2T.go('home'); }, 30000);
  }
  if (!D2T.started) D2T.start();          // normally the shell started the intro already, before the data arrived
  D2T.ready();
  // the sound clips sit at the end of the page as plain JSON: read them once the intro has handed over (or on the first tap)
  let clipsRead = false;
  D2T.loadClips = () => {
    if (clipsRead) return; const el = document.getElementById('d2t-sounds'); if (!el) return; clipsRead = true;
    try { window.D2T_SOUNDS = JSON.parse(el.textContent || '{}'); } catch (e) { window.D2T_SOUNDS = {}; }
    el.remove(); if (SND && SND.clipsLoaded) SND.clipsLoaded();
  };
  // the rare reveal's clips are files (audio/reveal), fetched in the background a few seconds after home is up
  let revealQueued = false;
  D2T.loadReveal = () => {
    if (revealQueued || !SND || !SND.loadReveal) return; revealQueued = true;
    setTimeout(() => { if (window.requestIdleCallback) window.requestIdleCallback(() => SND.loadReveal(), { timeout: 4000 }); else SND.loadReveal(); }, 2500);
  };
})();
