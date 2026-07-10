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

    // Celkový (nikdy nemazaný) počet návštěv – navstevnost_log drží jen posledních 30 dní
    db.ref('navstevnost_celkem').transaction(cur => (cur || 0) + 1);

    // Trvalá denní historie (nikdy nemazaná) – pro přehledy a např. podklady k žádostem o grant
    const ted = new Date();
    const dnesKey = `${ted.getFullYear()}-${String(ted.getMonth()+1).padStart(2,'0')}-${String(ted.getDate()).padStart(2,'0')}`;
    db.ref('navstevnost_denne/' + dnesKey).transaction(cur => (cur || 0) + 1);
  });

  db.ref('presence').on('value', snap => {
    _presenceVals = Object.values(snap.val() || {});
    const total  = _presenceVals.length;
    const admins = _presenceVals.filter(v => v.admin).length;
    let txt = `🟢 ${total} online`;
    if (admins > 0) {
      const aSlovo = admins === 1 ? 'správce' : admins <= 4 ? 'správci' : 'správců';
      txt += `, z toho <span class="online-admins">${admins} ${aSlovo}</span>`;
    }
    // Uložit vždy – aktualizujListu() ho použije při překreslení info-baru
    window._lastOnlineText = txt;

    const el  = document.getElementById('onlinePocet');
    const mob = document.getElementById('onlineMobile');
    const bar = document.getElementById('onlineBar');
    if (el)  el.innerHTML  = txt;
    if (mob) mob.innerHTML = txt;
    if (bar) bar.innerHTML = txt;

    const jeAdmin = window._aktualniSpravce && window._aktualniSpravce.jeAdmin;
    const titulek = jeAdmin ? 'Klikni pro seznam online uživatelů' : '';
    if (el)  { el.style.cursor  = jeAdmin ? 'pointer' : ''; el.title  = titulek; }
    if (mob) { mob.style.cursor = jeAdmin ? 'pointer' : ''; mob.title = titulek; }
    if (bar) { bar.style.cursor = jeAdmin ? 'pointer' : ''; bar.title = titulek; }
  });

  document.addEventListener('click', e => {
    const el  = document.getElementById('onlinePocet');
    const mob = document.getElementById('onlineMobile');
    const bar = document.getElementById('onlineBar');
    const popup = document.getElementById('onlinePopup');

    const kliknutoNaOnline = (el && el.contains(e.target))
      || (mob && mob.contains(e.target))
      || (bar && bar.contains(e.target));

    if (kliknutoNaOnline) {
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
      div.innerHTML = `<div class="op-nadpis">🟢 Právě online</div>${seznam || '<div class="op-radek op-navstevnik">Nikdo jiný není online</div>'}`;

      const anchor = bar || el;
      const rect = anchor.getBoundingClientRect();
      div.style.top  = (rect.bottom + 6) + 'px';
      div.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
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
    // Bez orderByChild – nepotřebuje Firebase index; řazení probíhá na klientovi
    const snap = await db.ref('navstevnost_log').limitToLast(500).once('value');
    const zaznamy = [];
    snap.forEach(child => {
      const v = child.val();
      if (v && v.ts && v.ts >= limitTs) zaznamy.push(v);
    });
    // Smaž záznamy starší než 30 dní (lazy cleanup)
    const snapStare = await db.ref('navstevnost_log').limitToFirst(200).once('value');
    snapStare.forEach(child => {
      const v = child.val();
      if (v && v.ts && v.ts < limitTs) child.ref.remove();
    });
    return zaznamy.reverse(); // nejnovější první
  };

  // Skutečná návštěvnost (celkem / dnes / včera / předevčírem) – volá se z main.js
  window._nactiZivouNavstevnost = async function () {
    const ted = new Date();
    const zacatekDnes = new Date(ted.getFullYear(), ted.getMonth(), ted.getDate()).getTime();
    const zacatekVcera = zacatekDnes - 24 * 60 * 60 * 1000;
    const zacatekPredvcirem = zacatekDnes - 2 * 24 * 60 * 60 * 1000;

    const [logSnap, celkemSnap] = await Promise.all([
      db.ref('navstevnost_log').orderByChild('ts').startAt(zacatekPredvcirem).once('value'),
      db.ref('navstevnost_celkem').once('value')
    ]);

    let dnes = 0, vcera = 0, predvcirem = 0;
    logSnap.forEach(child => {
      const v = child.val();
      if (!v || !v.ts) return;
      if (v.ts >= zacatekDnes) dnes++;
      else if (v.ts >= zacatekVcera) vcera++;
      else if (v.ts >= zacatekPredvcirem) predvcirem++;
    });

    return { celkem: celkemSnap.val() || 0, dnes, vcera, predvcirem };
  };

  // Trvalá denní historie návštěv (od zavedení, nikdy nemazaná) – pro admin přehled
  window._nactiNavstevnostDenne = async function () {
    const snap = await db.ref('navstevnost_denne').once('value');
    const dny = [];
    snap.forEach(child => { dny.push({ datum: child.key, pocet: child.val() || 0 }); });
    dny.sort((a, b) => b.datum.localeCompare(a.datum)); // nejnovější první
    return dny;
  };
})();
