// League (black): one friends table with the four achievement counts and a rating to rank by. Also registers 'stats'.
// Rating: each run scores by its best finish (beat the drop 1, top half 2, top 3 3, title 5), averaged out of 5 as a %.
// The counts are cumulative (a title is also a top 3, top half and beat the drop finish), so
// rating = (drop + half + top3 + 2 x titles) / (runs x 5) x 100, which is the same as the per-run best-finish average.
(function () {
  const EXAMPLE_FRIENDS = [
    { name: 'Phil', runs: 12, drop: 9, half: 5, top3: 2, titles: 1 },
    { name: 'Aiden', runs: 9, drop: 7, half: 4, top3: 2, titles: 0 },
    { name: 'Jess', runs: 15, drop: 10, half: 4, top3: 1, titles: 1 },
    { name: 'Sam', runs: 6, drop: 3, half: 1, top3: 0, titles: 0 }
  ];
  const rating = (p) => (p.runs ? Math.round(((p.drop + p.half + p.top3 + 2 * p.titles) / (p.runs * 5)) * 100) : 0);
  const added = []; // friends added by code in this session (prototype only)
  const myCode = () => {
    const s = (D2T.state.account && D2T.state.account.email) || 'guest';
    let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, (_, i) => A[(h >> (i * 5)) % A.length]).join('');
  };

  function table(body) {
    const me = Object.assign({ name: (D2T.state.account.signedIn && D2T.state.account.name) || 'You', me: true }, D2T.state.record);
    const rows = EXAMPLE_FRIENDS.concat(added, [me]).map((p) => Object.assign({ r: rating(p) }, p))
      .sort((a, b) => b.r - a.r || b.titles - a.titles || b.runs - a.runs);
    body.querySelector('tbody').innerHTML = rows.map((p, i) => `<tr class="${p.me ? 'me' : ''}">
      <td class="k">${i + 1}</td><td class="n">${D2T.esc(p.name)}${p.me ? ' (you)' : ''}<small>${p.runs} run${p.runs === 1 ? '' : 's'}${p.isNew ? ' · just added' : ''}</small></td>
      <td>${p.drop}</td><td>${p.half}</td><td>${p.top3}</td><td>${p.titles}</td><td class="r">${p.r}%</td></tr>`).join('');
  }

  function addFriendSheet(onAdd) {
    const code = myCode();
    const s = D2T.sheet({ title: 'Add a friend', body: `
      <p class="fr-lead" style="margin-bottom:10px">Send a friend your code. When they add it, you both join the same table.</p>
      <div class="fr-code" aria-label="Your code ${code.split('').join(' ')}">D2T-${code}</div>
      <div class="fr-two"><button class="btn btn-ghost" data-k="copy">Copy code</button><button class="btn btn-lime" data-k="share" style="font-size:16px">Share invite</button></div>
      <p class="fr-msg" aria-live="polite" style="color:var(--lime);text-align:center;margin-top:8px"></p>
      <div class="fr-sep">or enter a friend's code</div>
      <div class="fr-joinrow"><input class="fr-input" maxlength="8" placeholder="D2T-CODE" aria-label="Friend's code" autocomplete="off" autocapitalize="characters"><button class="btn btn-lime" data-k="add" style="min-width:88px;font-size:16px">Add</button></div>
      <p class="fr-small">Prototype: no network. Adding a code puts a blank example friend in the table.</p>` });
    const msg = s.body.querySelector('.fr-msg'), inp = s.body.querySelector('input');
    const text = `Join my DROP2TOP league. My code is D2T-${code}`;
    s.body.querySelector('[data-k="copy"]').onclick = async () => {
      try { await navigator.clipboard.writeText('D2T-' + code); msg.textContent = 'Code copied.'; } catch (e) { msg.textContent = 'Your code is D2T-' + code; }
    };
    s.body.querySelector('[data-k="share"]').onclick = async () => {
      if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* cancelled */ } } else { try { await navigator.clipboard.writeText(text); msg.textContent = 'Invite copied. Paste it into a message.'; } catch (e) { msg.textContent = text; } }
    };
    inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); });
    s.body.querySelector('[data-k="add"]').onclick = () => {
      const c = inp.value.replace(/^D2T-?/, '');
      if (c.length !== 4) { msg.style.color = '#FF8A8A'; msg.textContent = 'Codes are D2T and 4 letters or numbers.'; return; }
      onAdd({ name: 'Friend ' + c, runs: 0, drop: 0, half: 0, top3: 0, titles: 0, isNew: true });
      s.close();
    };
  }

  D2T.screen('league', {
    title: 'League', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const body = D2T.h(`<div class="screen-body fr-page">
        <h1 class="fr-title">League</h1>
        <p class="fr-lead" style="margin-bottom:14px">You and your friends in one table. <span class="fr-ex">Example friends</span></p>
        <table class="fr-lg"><thead><tr><th>#</th><th>Player</th><th>Drop</th><th>Half</th><th>Top 3</th><th>Title</th><th style="text-align:right">Rating</th></tr></thead><tbody></tbody></table>
        <div class="fr-rate"><span><b>Rating:</b> each run scores its best finish (beat the drop = 1, top half = 2, top 3 = 3, title = 5). Your average out of 5, as a percentage.</span></div>
        <div class="fr-stack"><button class="btn btn-lime fr-btn-wide" data-act="add">Add friend</button></div>
      </div>`);
      root.appendChild(body);
      table(body);
      body.querySelector('[data-act="add"]').onclick = () => addFriendSheet((f) => { added.push(f); table(body); });
    }
  });

  // ---------- my stats ----------
  D2T.screen('stats', {
    title: 'Stats', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const rec = D2T.state.record;
      const ex = D2T.data.runs; // example clubs played: the three demo runs
      const clubs = Object.keys(ex).map((k) => ex[k]);
      const cur = D2T.run();
      const body = D2T.h(`<div class="screen-body fr-page">
        <h1 class="fr-title">My stats</h1>
        <p class="fr-lead" style="margin-bottom:14px">Your record across every run. <span class="fr-ex">Example numbers</span></p>
        ${D2T.frRecord(rec, 'dark')}
        <h2 class="fr-h2">Runs</h2>
        <div class="fr-panel">
          <div class="fr-row"><span>Runs played</span><span>${rec.runs}</span></div>
          <div class="fr-row"><span>Rating</span><span class="fr-lime">${rating(rec)}%</span></div>
          <div class="fr-row"><span>Best finish</span><span>${rec.best ? D2T.ordinal(rec.best) : '9th'}</span></div>
          <div class="fr-row"><span>Relegated</span><span>${Math.max(0, rec.runs - rec.drop)}</span></div>
          ${cur ? `<div class="fr-row"><span>Current run</span><span>${D2T.esc(cur.club.name)} ${cur.season}, GW ${D2T.state.run.gw || 1}</span></div>` : ''}
        </div>
        <h2 class="fr-h2">Clubs played</h2>
        <div class="fr-clubs">${clubs.map((r) => `<div class="fr-club"><img src="${r.club.crest}" alt=""><span>${D2T.esc(r.club.name)}<small>${r.season}</small></span></div>`).join('')}</div>
        <p class="fr-small">Best finish and clubs played are examples for the prototype.</p>
      </div>`);
      root.appendChild(body);
    }
  });
})();
