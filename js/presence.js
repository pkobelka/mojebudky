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

  db.ref('.info/connected').on('value', snap => {
    if (!snap.val()) return;
    if (myRef) myRef.remove();
    myRef = db.ref('presence').push();
    myRef.onDisconnect().remove();
    myRef.set({ ts: firebase.database.ServerValue.TIMESTAMP, admin: false });
  });

  db.ref('presence').on('value', snap => {
    const vals = Object.values(snap.val() || {});
    const total = vals.length;
    const admins = vals.filter(v => v.admin).length;
    const el = document.getElementById('onlinePocet');
    if (!el) return;
    let txt = `🟢 Online: <strong>${total}</strong>`;
    if (admins > 0) {
      const slovo = admins === 1 ? 'správce' : admins <= 4 ? 'správci' : 'správců';
      txt += ` <span class="online-admins">(${admins} ${slovo})</span>`;
    }
    el.innerHTML = txt;
  });

  window._presenceSetAdmin = function (isAdmin) {
    if (myRef) myRef.update({ admin: !!isAdmin });
  };
})();
