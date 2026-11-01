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
  const setUser = (user, token) => { const a = acct(); a.user = user; if (token) a.token = token; a.signedIn = true; D2T.save(); if (token) { if (D2T.backup) D2T.backup.onSignIn(); else if (D2T.lb) D2T.lb.onSignIn(); } };   // the backup puts this account's records in place, then the leaderboards send   // a sign-in: the phone's records go on to the leaderboards
  const clearUser = () => { if (D2T.backup) D2T.backup.onSignOut(); D2T.state.account = {}; D2T.save(); if (D2T.lb) D2T.lb.onSignOut(); };
  D2T.accountName = () => (acct().user ? acct().user.name : '');

  // ---------- one sign-in for Tenaball and DROP2TOP (Craig, 1 Nov, build 217, via the design session) ----------
  // Both games live on 404craig.github.io, so a browser shares their storage. Tenaball keeps its sign-in in
  // tenaball-token, tenaball-user ({ user, stats }) and tenaball-email, issued by the same server.
  const TB = { token: 'tenaball-token', user: 'tenaball-user', email: 'tenaball-email' };
  const hashOf = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); };
  let adopting = false;
  // signed out here and signed in to Tenaball: check Tenaball's token with the server and sign in with it; a token
  // turned down with "Not you?" is never taken again; anything that fails is left quietly for the next load
  async function adopt() {
    if (adopting || acct().token) return;
    const t = ls(TB.token); if (!t) return;
    const st = D2T.state; if ((st.notYou || []).includes(hashOf(t))) return;
    adopting = true;
    try {
      const r = await fetch(SERVER + '/api/me', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.user || acct().token) return;
      setUser(d.user, t);
      acct().adopted = hashOf(t); acct().note = true; D2T.save();
      // counted on the server so Craig can see how often it happens (the admin page)
      fetch(SERVER + '/api/d2t/adopted', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' }).catch(() => {});
      D2T.adoptNote();
    } catch (e) { /* offline: next load */ } finally { adopting = false; }
  }
  // the note after an automatic sign-in, on home, once, gone on the next tap: "Signed in as Craig · Not you?"
  // (Craig, 1 Nov: DROP2TOP is the main game, so it never names Tenaball)
  D2T.adoptNote = () => {
    const a = acct(); if (!a.note || !a.user) return;
    const scr = document.querySelector('.screen[data-screen="home"]'); if (!scr || document.querySelector('.d2t-signed')) return;
    a.note = false; D2T.save();
    const n = D2T.h(`<div class="d2t-signed" role="status"><span>Signed in as <b>${D2T.esc(a.user.name)}</b></span><i aria-hidden="true">·</i><button type="button" class="d2t-notyou">Not you?</button></div>`);
    document.getElementById('app').appendChild(n);
    const gone = () => { document.removeEventListener('pointerdown', away, true); n.classList.add('out'); setTimeout(() => n.remove(), 300); };
    const away = (e) => { if (!n.contains(e.target)) gone(); };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    n.querySelector('.d2t-notyou').onclick = () => {
      // signs out of DROP2TOP only (Tenaball's session is left alone) and never takes that token again
      const t = acct().token, st = D2T.state;
      if (t) st.notYou = (st.notYou || []).concat([hashOf(t)]).slice(-10);
      clearUser(); gone(); if (location.hash.slice(1) === 'home') D2T.go('home');
    };
  };
  // The sign-in nudge (Craig, 1 Nov, build 218): signed out with 3 or more finished games, home says once a week
  // "Sign in to back up your records" (records on a phone alone go with Safari's clear-out); Sign in opens the account
  // page, any other tap puts it away until next week. Never with a Tenaball sign-in on the phone (that one is taken
  // automatically), a tip up or the server off.
  D2T.backupNudge = () => {
    const st = D2T.state, a = acct();
    if (a.token || ls(TB.token) || !(D2T.lb && D2T.lb.server)) return;
    const rec = st.record || {}, games = (rec.runs || []).length + ((rec.g433 || {}).games || 0) + ((st.ub || {}).runs || 0);
    const nd = st.signNudge || {};
    if (games < 3 || (nd.at && Date.now() - nd.at < 7 * 864e5)) return;
    const scr = document.querySelector('.screen[data-screen="home"]'); if (!scr || document.querySelector('.d2t-signed, .d2t-tip')) return;
    st.signNudge = { at: Date.now(), n: (nd.n || 0) + 1 }; D2T.save();
    const n = D2T.h(`<div class="d2t-signed d2t-nudge" role="status"><span>Sign in to back up your records</span><button type="button" class="d2t-signin">Sign in</button></div>`);
    document.getElementById('app').appendChild(n);
    const gone = () => { document.removeEventListener('pointerdown', away, true); window.removeEventListener('hashchange', gone); n.classList.add('out'); setTimeout(() => n.remove(), 300); };
    const away = (e) => { if (!n.contains(e.target)) gone(); };
    setTimeout(() => { document.addEventListener('pointerdown', away, true); window.addEventListener('hashchange', gone); }, 0);
    n.querySelector('.d2t-signin').onclick = () => { gone(); D2T.go('account'); };
  };
  // a sign-in here fills in Tenaball's keys only when Tenaball has none, so it is signed in too on its next load
  function share(user, token, stats, email) {
    if (!token || ls(TB.token)) return;
    ls(TB.token, token); ls(TB.user, JSON.stringify({ user, stats: stats || null }));
    if (email && !ls(TB.email)) ls(TB.email, email);
  }
  // signing out signs out of DROP2TOP only: a session Tenaball holds too is not ended on the server
  async function signOut() {
    const t = acct().token, st = D2T.state;
    if (t && t !== ls(TB.token)) await api('/signout');
    // and it stays signed out: the token is never taken back from Tenaball's keys (a later, different one still is)
    if (t) st.notYou = (st.notYou || []).concat([hashOf(t)]).slice(-10);
    clearUser();
  }
  D2T.whenReady(() => { adopt(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) adopt(); });

  D2T.screen('account', {
    title: 'Account', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar({ back: true, noAccount: true }));
      const body = D2T.h('<div class="screen-body fr-page"></div>');
      root.appendChild(body);
      let mode = 'in', alive = true;
      this._kill = () => { alive = false; };

      const backedUp = () => { const t = D2T.backup ? D2T.backup.last() : 0; if (!t) return 'Not yet'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
      const settings = () => {
        const set = D2T.state.settings || (D2T.state.settings = { muted: false });
        return `<h2 class="fr-h2" style="margin-top:26px">Settings</h2>
          <div class="fr-panel"><button class="fr-row" data-act="sound"><span>Sound</span><span>${set.muted ? 'Off' : 'On'} ›</span></button>
          <div class="fr-row"><span>Runs saved on this phone</span><span>${D2T.state.record.runs.length}</span></div>
          ${acct().user ? `<div class="fr-row"><span>Backed up to your account</span><span>${backedUp()}</span></div>` : ''}</div>
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide fr-danger" data-act="del">Delete my data on this phone</button></div>
          ${diagnostics()}`;
      };
      // Diagnostics (20 Oct): the build, and the last errors this phone saw (D2T.errors), with Copy so a player can send them
      const diagnostics = () => {
        const errs = D2T.errors();
        return `<h2 class="fr-h2" style="margin-top:26px">Diagnostics</h2>
          <p class="fr-small">Build ${D2T.esc(String(window.D2T_BUILD || ''))}. ${errs.length ? 'The last errors this phone saw:' : 'No errors recorded on this phone.'}</p>
          ${errs.length ? `<div class="fr-panel">${errs.map((e) => `<div class="fr-row" style="display:block;white-space:normal"><b style="font-size:13px">${D2T.esc(e.m)}</b><br><small style="color:var(--muted)">${D2T.esc(String(e.t).slice(0, 16).replace('T', ' '))} · build ${D2T.esc(String(e.b))} · ${D2T.esc(e.s || '')} ${D2T.esc(e.w || '')}</small></div>`).join('')}</div>` : ''}
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-act="copyerr">Copy diagnostics</button>${errs.length ? '<button class="btn btn-ghost fr-btn-wide" data-act="clrerr">Clear the errors</button>' : ''}</div>`;
      };
      const diagText = () => {
        const r = D2T.state.run, e = r && r.eng;
        const run = e ? { mode: e.mode, season: e.seasonKey, gw: e.gw, phase: e.phase, step: r.step, career: r.career ? r.career.n : 1, formation: e.formation, tactic: e.tactic || 'mid', xi: e.xi, respins: e.respins, rolls: e.rollIx + '.' + e.rollStep, poached: (e.poached || []).length, carry: r.career && r.career.cur ? r.career.cur.carry : null } : null;
        return JSON.stringify({ build: window.D2T_BUILD, ua: navigator.userAgent, when: new Date().toISOString(), errors: D2T.errors(), run }, null, 1);
      };
      const wireSettings = () => {
        body.querySelector('[data-act="sound"]').onclick = () => {
          const set = D2T.state.settings; set.muted = !set.muted; D2T.save(); window.D2TSound && window.D2TSound.setMuted(set.muted); draw();
        };
        const cp = body.querySelector('[data-act="copyerr"]');
        if (cp) cp.onclick = async () => {
          const t = diagText(); let ok = false;
          try { await navigator.clipboard.writeText(t); ok = true; } catch (e) { /* fall back to a sheet */ }
          if (ok) { cp.textContent = 'Copied'; setTimeout(() => { if (cp.isConnected) cp.textContent = 'Copy diagnostics'; }, 1500); return; }
          D2T.sheet({ title: 'Diagnostics', body: `<textarea class="fr-input" readonly style="width:100%;height:220px;font:12px/1.4 ui-monospace,monospace">${D2T.esc(t)}</textarea>` });
        };
        const cl = body.querySelector('[data-act="clrerr"]');
        if (cl) cl.onclick = () => { try { localStorage.removeItem('d2t-errors'); } catch (e) { /* blocked */ } draw(); };
        body.querySelector('[data-act="del"]').onclick = () => {
          const s = D2T.sheet({ title: 'Delete your data?', body: `<p class="fr-lead">This clears your saved run and your achievements on this phone. If you are signed in, your account backup brings them back.</p>
            <div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep it</button><button class="btn btn-ghost fr-danger" data-k="yes">Delete</button></div>` });
          s.body.querySelector('[data-k="no"]').onclick = s.close;
          s.body.querySelector('[data-k="yes"]').onclick = () => { const a = D2T.state.account, ny = D2T.state.notYou; D2T.resetState(); D2T.state.account = a || {}; if (ny) D2T.state.notYou = ny; D2T.save(); s.close(); draw(); };   // a refused sign-in stays refused
        };
      };

      function draw() {
        const a = acct();
        if (a.user) {
          const u = a.user;
          body.innerHTML = `<h1 class="fr-title">Account</h1>
            <div class="fr-who"><div class="fr-avatar" aria-hidden="true">${D2T.esc((u.name || '?').charAt(0).toUpperCase())}</div>
              <div style="min-width:0"><div class="fr-who-name">${D2T.esc(u.name)}</div><div class="fr-who-mail">${D2T.esc(u.email)}</div></div></div>
            <p class="fr-small">Signed in with your Tenaball account. Your finished games go on the leaderboards under this name, and your records and runs are backed up to your account, so signing in on another phone or browser brings them back.</p>
            <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-act="out">Sign out</button></div>
            ${settings()}`;
          body.querySelector('[data-act="out"]').onclick = async () => { await signOut(); draw(); };
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
          share(r.data.user, r.data.token, r.data.stats, em);
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
