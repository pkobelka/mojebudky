(function () {
  'use strict';
  const cfg = {
    apiKey: "AIzaSyBEAhZNxq3REoy1vExIrnNEXlyFXHzP4uI",
    authDomain: "moje-budky.firebaseapp.com",
    databaseURL: "https://moje-budky-default-rtdb.firebaseio.com",
    projectId: "moje-budky",
    storageBucket: "moje-budky.firebasestorage.app",
    messagingSenderId: "325649258561",
    appId: "1:325649258561:web:b5571c3278d98405320ec0"
  };

  if (!firebase.apps.length) firebase.initializeApp(cfg);
  const db = firebase.database();
  let myRef = null;
  let logRef = null;
  let _presenceVals = [];

  db.ref('.info/connected').on('value', snap => {
    if (!snap.val()) return;
    if (myRef) myRef.remove();
    myRef = db.ref('presence').push();
    myRef.onDisconnect().remove();
    myRef.set({ ts: firebase.database.ServerValue.TIMESTAMP, admin: false });

    // Zaloguj návštěvu do historie (anonymně; správce se doplní přihlášením)
    logRef = db.ref('navstevnost_log').push();
    logRef.set({ ts: firebase.database.ServerValue.TIMESTAMP, jmeno: 'Anonym', admin: false });
    logRef.onDisconnect().update({ ts_end: firebase.database.ServerValue.TIMESTAMP });
  });

  db.ref('presence').on('value', snap => {
    _presenceVals = Object.values(snap.val() || {});
    const total  = _presenceVals.length;
    const admins = _presenceVals.filter(v => v.admin).length;
    const el = document.getElementById('onlinePocet');
    if (!el) return;

    let txt = `🟢 ${total} online`;
    if (admins > 0) {
      const aSlovo = admins === 1 ? 'správce' : admins <= 4 ? 'správci' : 'správců';
      txt += `, z toho <span class="online-admins">${admins} ${aSlovo}</span>`;
    }
    el.innerHTML = txt;

    const mob = document.getElementById('onlineMobile');
    if (mob) mob.innerHTML = txt;

    const jeAdmin = window._aktualniSpravce && window._aktualniSpravce.jeAdmin;
    el.style.cursor = jeAdmin ? 'pointer' : '';
    el.title = jeAdmin ? 'Klikni pro seznam online uživatelů' : '';
    if (mob) { mob.style.cursor = jeAdmin ? 'pointer' : ''; mob.title = el.title; }
  });

  document.addEventListener('click', e => {
    const el = document.getElementById('onlinePocet');
    const popup = document.getElementById('onlinePopup');

    const mob = document.getElementById('onlineMobile');
    if ((el && el.contains(e.target)) || (mob && mob.contains(e.target))) {
      const jeAdmin = window._aktualniSpravce && window._aktualniSpravce.jeAdmin;
      if (!jeAdmin) return;

      if (popup) { popup.remove(); return; }

      const seznam = _presenceVals.map(v => {
        if (v.jmeno) {
          const badge = v.admin ? ' <span class="op-badge">správce</span>' : '';
          const budky = v.budky ? ` · 🏠 ${v.budky}` : '';
          return `<div class="op-radek">👤 <strong>${v.jmeno}</strong>${budky}${badge}</div>`;
        }
        return `<div class="op-radek op-navstevnik">🌐 Anonymní návštěvník</div>`;
      }).join('');

      const div = document.createElement('div');
      div.id = 'onlinePopup';
      div.className = 'online-popup';
      div.innerHTML = `<div class="op-nadpis">🟢 Právě online</div>${seznam}`;

      const rect = el.getBoundingClientRect();
      div.style.top  = (rect.bottom + 6) + 'px';
      div.style.left = rect.left + 'px';
      document.body.appendChild(div);
      return;
    }

    if (popup && !popup.contains(e.target)) popup.remove();
  });

  // Volá se z auth.js po přihlášení — přidá jméno, budky a loginId do presence záznamu
  window._presenceSetAdmin = function (isAdmin) {
    if (myRef) myRef.update({ admin: !!isAdmin });
  };

  window._presenceSetSpravce = function (loginId, jmeno, budkyList, jeAdmin) {
    if (!myRef) return;
    const budky = (budkyList || []).map(b => b.cislo).join(', ');
    myRef.update({
      loginId,
      jmeno: jmeno || loginId,
      budky,
      admin: !!jeAdmin,
      prihlaseniTs: firebase.database.ServerValue.TIMESTAMP
    });
    // Zaloguj přihlášení do starší historie správců
    db.ref('prihlaseni').push({
      ts: firebase.database.ServerValue.TIMESTAMP,
      loginId,
      jmeno: jmeno || loginId,
      budky
    });
    // Aktualizuj záznam v navstevnost_log – doplň jméno a admin příznak
    if (logRef) {
      logRef.update({ loginId, jmeno: jmeno || loginId, admin: !!jeAdmin, budky });
    }
  };

  // Načte historii návštěv (posledních 30 dní) – volá se z auth.js pro admin panel
  window._nactiHistoriiNavstev = async function () {
    const limitTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const snap = await db.ref('navstevnost_log')
      .orderByChild('ts')
      .startAt(limitTs)
      .limitToLast(500)
      .once('value');
    const zaznamy = [];
    snap.forEach(child => {
      const v = child.val();
      if (v && v.ts) zaznamy.push(v);
    });
    // Smaž záznamy starší než 30 dní (lazy cleanup)
    const snapAll = await db.ref('navstevnost_log').orderByChild('ts').endAt(limitTs - 1).limitToLast(200).once('value');
    snapAll.forEach(child => child.ref.remove());
    return zaznamy.reverse(); // nejnovější první
  };
})();
