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
  let _presenceVals = [];

  db.ref('.info/connected').on('value', snap => {
    if (!snap.val()) return;
    if (myRef) myRef.remove();
    myRef = db.ref('presence').push();
    myRef.onDisconnect().remove();
    myRef.set({ ts: firebase.database.ServerValue.TIMESTAMP, admin: false });
  });

  db.ref('presence').on('value', snap => {
    _presenceVals = Object.values(snap.val() || {});
    const total  = _presenceVals.length;
    const admins = _presenceVals.filter(v => v.admin).length;
    const el = document.getElementById('onlinePocet');
    if (!el) return;

    let txt = `🟢 <strong>${total}</strong> online`;
    if (admins > 0) {
      const aSlovo = admins === 1 ? 'správce' : admins <= 4 ? 'správci' : 'správců';
      txt += ` <span class="online-admins">(z toho ${admins} ${aSlovo})</span>`;
    }
    el.innerHTML = txt;

    const jeAdmin = window._aktualniSpravce && window._aktualniSpravce.jeAdmin;
    el.style.cursor = jeAdmin ? 'pointer' : '';
    el.title = jeAdmin ? 'Klikni pro seznam online uživatelů' : '';
  });

  document.addEventListener('click', e => {
    const el = document.getElementById('onlinePocet');
    const popup = document.getElementById('onlinePopup');

    if (el && el.contains(e.target)) {
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
    // Zaloguj přihlášení do historie
    db.ref('prihlaseni').push({
      ts: firebase.database.ServerValue.TIMESTAMP,
      loginId,
      jmeno: jmeno || loginId,
      budky
    });
  };
})();
