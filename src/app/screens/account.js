// Account (black). Accounts (email and a 4-digit PIN, as in Tenaball) need the D2T server, which isn't switched on yet,
// so for now everyone plays as a guest and everything is saved on this phone. Sound and data controls live here too.
(function () {
  const D2T = window.D2T;
  D2T.screen('account', {
    title: 'Account', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const body = D2T.h('<div class="screen-body fr-page"></div>');
      root.appendChild(body);
      const draw = () => {
        const r = D2T.game.record(), set = D2T.state.settings || (D2T.state.settings = { muted: false });
        body.innerHTML = `<h1 class="fr-title">Account</h1>
          <div class="fr-who"><div class="fr-avatar" aria-hidden="true">G</div>
            <div style="min-width:0"><div class="fr-who-name">Guest</div><div class="fr-who-mail">Saved on this phone</div></div></div>
          <div class="fr-panel">
            <div class="fr-row"><span>Sign in</span><span>Coming soon</span></div>
            <div class="fr-row"><span>Runs played</span><span>${r.runs}</span></div>
            <button class="fr-row" data-act="sound"><span>Sound</span><span>${set.muted ? 'Off' : 'On'} ›</span></button>
          </div>
          <p class="fr-small">Signing in with your email and a 4-digit PIN (like Tenaball) is coming, so your runs follow you to any phone and you can join a friends league.</p>
          <h2 class="fr-h2" style="margin-top:24px">Achievements</h2>
          ${D2T.frRecord(r, 'dark')}
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide fr-danger" data-act="del">Delete my data</button></div>`;
        body.querySelector('[data-act="sound"]').onclick = () => {
          set.muted = !set.muted; D2T.save(); window.D2TSound && window.D2TSound.setMuted(set.muted); draw();
        };
        body.querySelector('[data-act="del"]').onclick = () => {
          const s = D2T.sheet({ title: 'Delete your data?', body: `<p class="fr-lead">This clears your saved run and your achievements on this phone. It can't be undone.</p>
            <div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep it</button><button class="btn btn-ghost fr-danger" data-k="yes">Delete</button></div>` });
          s.body.querySelector('[data-k="no"]').onclick = s.close;
          s.body.querySelector('[data-k="yes"]').onclick = () => { D2T.resetState(); D2T.state.seenIntro = true; D2T.save(); s.close(); draw(); };
        };
      };
      draw();
    }
  });
})();
