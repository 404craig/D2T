// Start-up: sound follows the saved setting and wakes on the first tap (phones refuse sound before one), then the router starts.
(function () {
  const D2T = window.D2T, SND = window.D2TSound;
  if (SND) {
    SND.setMuted(!!(D2T.state.settings && D2T.state.settings.muted));
    const wake = () => { SND.unlock(); window.removeEventListener('pointerdown', wake, true); window.removeEventListener('touchend', wake, true); };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('touchend', wake, true);
  }
  D2T.start();
})();
