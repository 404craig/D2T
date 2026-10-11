// Account (black). Signed out: sign in with email, then a 4-digit PIN (as in Tenaball). Prototype: any PIN works, no network.
// Signed in: name, email, PIN, runs, achievements, sign out, delete data.
(function () {
  const nameFromEmail = (email) => {
    const local = String(email).split('@')[0].replace(/[0-9]+/g, ' ');
    const n = local.split(/[._\-+\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return n || 'Player';
  };
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function pinBoxes() {
    return `<div class="fr-pin" role="group" aria-label="4-digit PIN"><span></span><span></span><span></span><span></span>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" aria-label="4-digit PIN"></div>`;
  }
  function wirePin(box, onDone) {
    const input = box.querySelector('input'), cells = [...box.querySelectorAll('span')];
    const draw = () => { const v = input.value; cells.forEach((c, i) => { c.classList.toggle('fill', i < v.length); c.classList.toggle('on', i === Math.min(v.length, 3) && document.activeElement === input); }); };
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); draw(); if (input.value.length === 4) onDone(input.value); });
    input.addEventListener('focus', draw); input.addEventListener('blur', draw);
    draw();
    return input;
  }

  function signedOut(body, rerender) {
    let email = '';
    try { email = localStorage.getItem('d2t-last-email') || ''; } catch (e) { /* storage blocked */ }
    const stepEmail = () => {
      body.innerHTML = `<h1 class="fr-title">Sign in</h1>
        <p class="fr-lead">Keep your runs and achievements on your account, and play friends in the league.</p>
        <form class="fr-form" novalidate>
          <input class="fr-input" type="email" placeholder="Email" autocomplete="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Email" value="${D2T.esc(email)}">
          <p class="fr-msg" aria-live="polite"></p>
          <button class="btn btn-lime fr-btn-wide" type="submit">Continue</button>
        </form>
        <p class="fr-small">New here? We'll set up your account with the PIN you choose next.</p>`;
      const f = body.querySelector('form'), inp = f.querySelector('input'), msg = f.querySelector('.fr-msg');
      f.onsubmit = (e) => {
        e.preventDefault();
        const v = inp.value.trim();
        if (!validEmail(v)) { msg.textContent = 'Enter your email address.'; inp.focus(); return; }
        email = v; stepPin();
      };
    };
    const stepPin = () => {
      body.innerHTML = `<h1 class="fr-title">Your PIN</h1>
        <p class="fr-lead">Enter the 4 digits for <b style="color:#fff">${D2T.esc(email)}</b>. <button class="fr-linkbtn" type="button" data-act="change" style="padding:0 2px;min-height:0">Change</button></p>
        ${pinBoxes()}
        <p class="fr-msg" aria-live="polite" style="text-align:center"></p>
        <button class="btn btn-lime fr-btn-wide" type="button" data-act="go">Sign in</button>
        <p class="fr-small" style="text-align:center">Prototype: any 4 digits work. Nothing is sent anywhere.</p>`;
      const box = body.querySelector('.fr-pin'), msg = body.querySelector('.fr-msg');
      const go = (pin) => {
        if (!/^\d{4}$/.test(pin)) { msg.textContent = 'Your PIN is 4 digits.'; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); input.focus(); return; }
        D2T.state.account = { signedIn: true, email, name: nameFromEmail(email) };
        try { localStorage.setItem('d2t-last-email', email); } catch (e) { /* storage blocked */ }
        D2T.save(); rerender();
      };
      const input = wirePin(box, (v) => setTimeout(() => go(v), 150));
      body.querySelector('[data-act="go"]').onclick = () => go(input.value);
      body.querySelector('[data-act="change"]').onclick = stepEmail;
      setTimeout(() => input.focus(), 50);
    };
    stepEmail();
  }

  function signedIn(body, rerender) {
    const a = D2T.state.account, r = D2T.state.record;
    const initial = (a.name || '?').trim()[0].toUpperCase();
    body.innerHTML = `<h1 class="fr-title">Account</h1>
      <div class="fr-who"><div class="fr-avatar" aria-hidden="true">${D2T.esc(initial)}</div>
        <div style="min-width:0"><div class="fr-who-name">${D2T.esc(a.name)}</div><div class="fr-who-mail">${D2T.esc(a.email)}</div></div></div>
      <div class="fr-panel">
        <button class="fr-row" data-act="name"><span>Name</span><span>${D2T.esc(a.name)} ›</span></button>
        <div class="fr-row"><span>Email</span><span>${D2T.esc(a.email)}</span></div>
        <button class="fr-row" data-act="pin"><span>PIN</span><span>Change ›</span></button>
        <div class="fr-row"><span>Runs played</span><span>${r.runs}</span></div>
        <div class="fr-row"><span>Stats</span><span>Saved to your account</span></div>
      </div>
      <h2 class="fr-h2" style="margin-top:24px">Achievements</h2>
      ${D2T.frRecord(r, 'dark')}
      <p class="fr-small">Runs and achievements are example numbers for the prototype.</p>
      <div class="fr-stack">
        <button class="btn btn-ghost fr-btn-wide" data-act="out">Sign out</button>
        <button class="btn btn-ghost fr-btn-wide fr-danger" data-act="del">Delete my data</button>
      </div>`;
    body.querySelector('[data-act="out"]').onclick = () => { D2T.state.account = { signedIn: false, name: '', email: '' }; D2T.save(); rerender(); };
    body.querySelector('[data-act="name"]').onclick = () => {
      const s = D2T.sheet({ title: 'Your name', body: `<div class="fr-form"><input class="fr-input" maxlength="20" aria-label="Your name" value="${D2T.esc(a.name)}"><button class="btn btn-lime fr-btn-wide">Save</button></div>` });
      const inp = s.body.querySelector('input');
      s.body.querySelector('button').onclick = () => { const v = inp.value.trim().slice(0, 20); if (v) { D2T.state.account.name = v; D2T.save(); } s.close(); rerender(); };
    };
    body.querySelector('[data-act="pin"]').onclick = () => {
      const s = D2T.sheet({ title: 'Change your PIN', body: `<div class="fr-form">
        <input class="fr-input" type="password" inputmode="numeric" maxlength="4" placeholder="Current PIN" aria-label="Current PIN">
        <input class="fr-input" type="password" inputmode="numeric" maxlength="4" placeholder="New PIN" aria-label="New PIN">
        <p class="fr-msg" aria-live="polite"></p><button class="btn btn-lime fr-btn-wide">Save the new PIN</button>
        <p class="fr-small" style="margin-top:0">Prototype: nothing is saved.</p></div>` });
      const [o, n] = s.body.querySelectorAll('input'), msg = s.body.querySelector('.fr-msg');
      [o, n].forEach((i) => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
      s.body.querySelector('button').onclick = () => { if (!/^\d{4}$/.test(o.value) || !/^\d{4}$/.test(n.value)) { msg.textContent = 'PINs are 4 digits.'; return; } s.close(); };
    };
    body.querySelector('[data-act="del"]').onclick = () => {
      const s = D2T.sheet({ title: 'Delete your data?', body: `<p class="fr-lead">This clears your saved run, achievements and account on this phone. It can't be undone.</p>
        <div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep it</button><button class="btn btn-ghost fr-danger" data-k="yes">Delete</button></div>` });
      s.body.querySelector('[data-k="no"]').onclick = s.close;
      s.body.querySelector('[data-k="yes"]').onclick = () => { D2T.resetState(); D2T.state.seenIntro = true; D2T.save(); s.close(); rerender(); };
    };
  }

  D2T.screen('account', {
    title: 'Account', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const body = D2T.h('<div class="screen-body fr-page"></div>');
      root.appendChild(body);
      const rerender = () => { body.innerHTML = ''; (D2T.state.account && D2T.state.account.signedIn ? signedIn : signedOut)(body, rerender); };
      rerender();
    }
  });
})();
