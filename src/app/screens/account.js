// Account (black). Optional sign-in with the same email and 4-digit PIN account as Tenaball, on Tenaball's server
// (it already answers pages on 404craig.github.io). Playing never needs an account: runs and achievements stay on the phone.
// Sound and data controls live here too. Stats have their own page.
(function () {
  const D2T = window.D2T;
  const SERVER = String(('D2T_SERVER_URL' in window ? window.D2T_SERVER_URL : 'https://tenaball.crw84.workers.dev') || '').replace(/\/+$/, '');
  const EMAIL_KEY = 'd2t-email';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const acct = () => D2T.state.account || (D2T.state.account = {});

  async function api(path, body) {
    const token = acct().token;
    try {
      const r = await fetch(SERVER + '/api' + path, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body || {}) });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: { error: "Can't reach the server. Check your connection and try again." } }; }
  }
  const setUser = (user, token) => { const a = acct(); a.user = user; if (token) a.token = token; a.signedIn = true; D2T.save(); };
  const clearUser = () => { D2T.state.account = {}; D2T.save(); };
  D2T.accountName = () => (acct().user ? acct().user.name : '');

  D2T.screen('account', {
    title: 'Account', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar({ back: true, noAccount: true }));
      const body = D2T.h('<div class="screen-body fr-page"></div>');
      root.appendChild(body);
      let mode = 'in', alive = true;
      this._kill = () => { alive = false; };

      const settings = () => {
        const set = D2T.state.settings || (D2T.state.settings = { muted: false });
        return `<h2 class="fr-h2" style="margin-top:26px">Settings</h2>
          <div class="fr-panel"><button class="fr-row" data-act="sound"><span>Sound</span><span>${set.muted ? 'Off' : 'On'} ›</span></button>
          <div class="fr-row"><span>Runs saved on this phone</span><span>${D2T.state.record.runs.length}</span></div></div>
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide fr-danger" data-act="del">Delete my data on this phone</button></div>`;
      };
      const wireSettings = () => {
        body.querySelector('[data-act="sound"]').onclick = () => {
          const set = D2T.state.settings; set.muted = !set.muted; D2T.save(); window.D2TSound && window.D2TSound.setMuted(set.muted); draw();
        };
        body.querySelector('[data-act="del"]').onclick = () => {
          const s = D2T.sheet({ title: 'Delete your data?', body: `<p class="fr-lead">This clears your saved run and your achievements on this phone. It can't be undone.</p>
            <div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep it</button><button class="btn btn-ghost fr-danger" data-k="yes">Delete</button></div>` });
          s.body.querySelector('[data-k="no"]').onclick = s.close;
          s.body.querySelector('[data-k="yes"]').onclick = () => { const a = D2T.state.account; D2T.resetState(); D2T.state.account = a || {}; D2T.save(); s.close(); draw(); };
        };
      };

      function draw() {
        const a = acct();
        if (a.user) {
          const u = a.user;
          body.innerHTML = `<h1 class="fr-title">Account</h1>
            <div class="fr-who"><div class="fr-avatar" aria-hidden="true">${D2T.esc((u.name || '?').charAt(0).toUpperCase())}</div>
              <div style="min-width:0"><div class="fr-who-name">${D2T.esc(u.name)}</div><div class="fr-who-mail">${D2T.esc(u.email)}</div></div></div>
            <p class="fr-small">Signed in with your Tenaball account. Friends leagues for DROP2TOP are coming next; your runs are saved on this phone for now.</p>
            <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-act="out">Sign out</button></div>
            ${settings()}`;
          body.querySelector('[data-act="out"]').onclick = async () => { await api('/signout'); clearUser(); draw(); };
          wireSettings();
          return;
        }
        const up = mode === 'up';
        const email = ls(EMAIL_KEY) || ls('tenaball-email') || '';
        body.innerHTML = `<h1 class="fr-title">Account</h1>
          <p class="fr-lead">Sign in with the same email and PIN as Tenaball, or create an account. You can always play without one.</p>
          <div class="fr-tabs" role="tablist"><button role="tab" data-m="in" aria-selected="${!up}">Sign in</button><button role="tab" data-m="up" aria-selected="${up}">Create account</button></div>
          <form class="fr-form" novalidate>
            ${up ? '<label class="fr-field"><span>Your name</span><input class="fr-input" name="name" autocomplete="nickname" maxlength="20" placeholder="What friends call you"></label>' : ''}
            <label class="fr-field"><span>Email</span><input class="fr-input" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${D2T.esc(email)}" placeholder="you@example.com"></label>
            <label class="fr-field"><span>${up ? 'Choose a 4-digit PIN' : '4-digit PIN'}</span><input class="fr-input fr-pin-in" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="••••"></label>
            ${up ? '<label class="fr-field"><span>Type the PIN again</span><input class="fr-input fr-pin-in" name="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••"></label>' : ''}
            <p class="fr-msg" aria-live="polite"></p>
            <button class="btn btn-green fr-btn-wide" type="submit">${up ? 'Create account' : 'Sign in'}</button>
          </form>
          ${settings()}`;
        body.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { mode = b.dataset.m; draw(); }; });
        body.querySelectorAll('.fr-pin-in').forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
        const form = body.querySelector('form'), msg = body.querySelector('.fr-msg'), btn = form.querySelector('[type="submit"]');
        const say = (t, ok) => { msg.textContent = t || ''; msg.classList.toggle('ok', !!ok); };
        form.onsubmit = async (e) => {
          e.preventDefault();
          const f = form.elements, em = f.email.value.trim(), pin = f.pin.value, name = up ? f.name.value.replace(/\s+/g, ' ').trim().slice(0, 20) : '';
          if (up && !name) return say('Enter your name so friends know who you are.');
          if (!em) return say('Enter your email.');
          if (!/^\d{4}$/.test(pin)) return say('Your PIN is 4 digits.');
          if (up && f.pin2.value !== pin) return say("Those PINs don't match. Type the same 4 digits twice.");
          btn.disabled = true; say(up ? 'Creating your account…' : 'Signing in…', true);
          const r = await api(up ? '/signup' : '/signin', up ? { name, email: em, pin } : { email: em, pin });
          if (!alive) return;
          btn.disabled = false;
          if (!r.ok) return say(r.data.error || "That didn't work. Try again.");
          ls(EMAIL_KEY, em);
          setUser(r.data.user, r.data.token);
          draw();
        };
        wireSettings();
      }
      draw();
      // a saved session may have ended elsewhere (PIN changed, signed out): check quietly
      if (acct().token) api('/me').then((r) => { if (!alive) return; if (r.status === 401) { clearUser(); draw(); } else if (r.ok && r.data.user) { setUser(r.data.user); draw(); } });
    },
    unmount() { this._kill && this._kill(); }
  });
})();
