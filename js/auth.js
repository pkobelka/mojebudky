// ── PUSH NOTIFIKACE ──────────────────────────────────────────────────────────
// VAPID klíč: Firebase Console → Project Settings → Cloud Messaging
//             → Web Push certificates → Generate key pair → zkopírovat klíč
const _PUSH_VAPID_KEY = 'BCn3YD9DqB2ejEGoqAxpnUpKuo6oG3TPBrGhjgXtLuQl4kbEee_hghSKE6nJ8ttffH-RIMjtyPNY-PPflKiCSho';

let _pushForegroundNastazen = false;

function _nastavPushForeground() {
  if (_pushForegroundNastazen) return;
  const db = _getFirebaseDB();
  if (!db) return;
  let _posledniPushTs = 0;
  db.ref('push_broadcast').on('value', snap => {
    const d = snap.val();
    if (!d || !d.ts) return;
    if (d.ts <= _posledniPushTs) return;
    if (Date.now() - d.ts > 30000) { _posledniPushTs = d.ts; return; }
    const myId = window._aktualniSpravce?.loginId || '';
    if (d.target && myId && d.target !== myId) { _posledniPushTs = d.ts; return; }
    _posledniPushTs = d.ts;
    _zobrazPushBanner(d.title || 'MojeBudky.cz', d.body || '', d.push_id || '');
  });
  _pushForegroundNastazen = true;
}

function _zobrazPushBanner(title, body, pushId) {
  const existujici = document.getElementById('pushBanner');
  if (existujici) existujici.remove();
  const banner = document.createElement('div');
  banner.id = 'pushBanner';
  banner.className = 'push-banner';
  banner.innerHTML = `<div class="push-banner-inner">
    <span class="push-banner-ico">🔔</span>
    <div class="push-banner-text"><strong>${title}</strong><br>${body}</div>
    <button class="push-banner-zavrit" onclick="this.closest('#pushBanner').remove()">×</button>
  </div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add('push-banner--show'), 50);
  if (pushId && window._aktualniSpravce?.loginId) {
    const db = _getFirebaseDB();
    if (db) db.ref(`push_history/${pushId}/read/${window._aktualniSpravce.loginId}`).set(Date.now());
  }
}

async function _prihlasitPush(loginId) {
  if (!_PUSH_VAPID_KEY) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const reg = window._swReg || await navigator.serviceWorker.ready;
    const msg = typeof firebase !== 'undefined' ? firebase.messaging() : null;
    if (!msg) return;
    const token = await msg.getToken({ vapidKey: _PUSH_VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;
    const db = _getFirebaseDB();
    if (db) db.ref(`push_tokens/${loginId}`).set({ token, ts: Date.now(), ua: navigator.userAgent.slice(0,80) });
    _nastavPushForeground();
    console.log('Push token uložen:', token.slice(0, 20) + '…');
  } catch (err) {
    console.warn('Push subscription:', err);
  }
}

function _czToIso(s) {
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}
function _isoToCz(s) {
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${parseInt(m[3])}.${parseInt(m[2])}.${m[1]}`;
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let _authSpravciCache = null;
let _spravciInfoCache = null;

function _getFirebaseDB() {
  try { return typeof firebase !== 'undefined' ? firebase.database() : null; } catch { return null; }
}

async function _nacistProfilFirebase(loginId) {
  const db = _getFirebaseDB();
  if (!db) return null;
  try {
    const snap = await db.ref(`spravci/${loginId}/profil`).once('value');
    return snap.val();
  } catch { return null; }
}

async function _ulozitProfilFirebase(loginId, data) {
  const db = _getFirebaseDB();
  if (!db) return false;
  try {
    const { foto, ...bezFota } = data;
    await db.ref(`spravci/${loginId}/profil`).set(bezFota);
    return true;
  } catch { return false; }
}

async function _logAktivita(loginId, jmeno, budkaCislo, budkaNazev, zprava) {
  const db = _getFirebaseDB();
  if (!db) return;
  try {
    await db.ref('aktivita').push({
      ts: firebase.database.ServerValue.TIMESTAMP,
      loginId, jmeno,
      budka_cislo: budkaCislo,
      budka_nazev: budkaNazev || '',
      zprava
    });
  } catch {}
}

async function _nactiAuthSpravce() {
  if (_authSpravciCache) return _authSpravciCache;
  const res = await fetch('data/spravci.json?v=20260605n', { cache: 'reload' });
  if (!res.ok) throw new Error('Nelze načíst data správců');
  _authSpravciCache = await res.json();
  return _authSpravciCache;
}

async function _nactiSpravciInfo() {
  if (_spravciInfoCache) return _spravciInfoCache;
  try {
    const res = await fetch('data/spravci_info.json?v=20260605n', { cache: 'reload' });
    if (res.ok) _spravciInfoCache = await res.json();
  } catch {}
  return _spravciInfoCache;
}

async function _overitPrihlaseni(id, heslo) {
  const hash = await sha256hex(heslo);

  // Firebase hesla mají přednost (umožňuje změnu hesla správcem)
  const db = _getFirebaseDB();
  if (db) {
    try {
      const snap = await db.ref(`hesla/${id}`).once('value');
      const fbHash = snap.val();
      if (fbHash) return fbHash === hash;
    } catch {}
  }

  // Fallback na statický JSON
  const spravci = await _nactiAuthSpravce();
  return spravci[id] && spravci[id] === hash;
}

async function _zobrazAdminPanel(loginId) {
  const info = await _nactiSpravciInfo();
  const spravceInfo = info && info[loginId];

  const jmeno = spravceInfo ? spravceInfo.jmeno : loginId;

  // Normalizace: budky[] (budoucí) nebo single budka_cislo
  const budkyList = (spravceInfo && spravceInfo.budky && spravceInfo.budky.length)
    ? spravceInfo.budky
    : [{ cislo: spravceInfo ? spravceInfo.budka_cislo : parseInt(loginId, 10),
         nazev: spravceInfo ? (spravceInfo.budka_nazev || '') : '' }];

  const _budkaText = (b) => (b.nazev && b.nazev !== String(b.cislo))
    ? `Budka č. ${b.cislo} – ${b.nazev}` : `Budka č. ${b.cislo}`;

  // Pro zpětnou kompatibilitu (profil, log…)
  const budkaCislo = budkyList[0].cislo;
  const budkaNazev = budkyList[0].nazev;
  const budkaText  = _budkaText(budkyList[0]);

  const existujici = document.getElementById('adminBanner');
  if (existujici) existujici.remove();

  const profilFirebase = await _nacistProfilFirebase(loginId);
  const profilLocal = _nacistProfilLocal(loginId);
  const profil = profilFirebase ? Object.assign({}, profilLocal, profilFirebase) : profilLocal;
  const osloveni = (profil && profil.osloveni) ? profil.osloveni
    : (spravceInfo && spravceInfo.osloveni) ? spravceInfo.osloveni : _vokativ(jmeno);

  const jePoprve = !localStorage.getItem('mb_firstlogin_' + loginId);
  const jeSlib   = !!localStorage.getItem('mb_slib_' + loginId);
  const _lsKlicLogin = 'mb_last_login_' + loginId;
  const posledniLoginTs = parseInt(localStorage.getItem(_lsKlicLogin) || '0', 10);
  localStorage.setItem(_lsKlicLogin, Date.now());

  // Narozeniny / svátek
  const dnes = new Date();
  const dnesDen = dnes.getDate(), dnesMes = dnes.getMonth() + 1;
  const datNar = profil && profil.datum_narozeni;
  const mNar = datNar && datNar.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const jeNarozeniny = mNar && parseInt(mNar[2]) === dnesDen && parseInt(mNar[1]) === dnesMes;
  const svatekDnes = typeof SVATKY !== 'undefined' && SVATKY[`${dnesDen}.${dnesMes}`];
  const jeSvatek = svatekDnes && jmeno && jmeno.toLowerCase() === svatekDnes.toLowerCase();
  const lsPraniKlic = `mb_prani_${loginId}_${dnes.toISOString().slice(0,10)}`;
  const praniUkazano = !!localStorage.getItem(lsPraniKlic);

  if (!jeSlib) {
    setTimeout(() => _zobrazSlibSpravce(loginId, spravceInfo, budkaText, osloveni), 1500);
  } else {
    const posledniText = posledniLoginTs
      ? `<small class="toast-posledni">Poslední přihlášení: ${new Date(posledniLoginTs).toLocaleString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>`
      : '';
    _zobrazToast(`Ahoj ${osloveni}! 🌿${posledniText}`, 6000, true);
    if (jePoprve) {
      localStorage.setItem('mb_firstlogin_' + loginId, '1');
      setTimeout(() => _zobrazProfilSpravce(loginId, spravceInfo, budkaText), 7000);
    }
  }

  if ((jeNarozeniny || jeSvatek) && !praniUkazano) {
    localStorage.setItem(lsPraniKlic, '1');
    setTimeout(() => _zobrazPrani(jeNarozeniny ? 'narozeniny' : 'svatek', osloveni), 2500);
  }

  if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(true);
  _nastavPushForeground();
  _prihlasitPush(loginId);

  // Zaznamenat aktivitu správce (pro indikátor aktivity na mapě)
  const dbAkt = _getFirebaseDB();
  if (dbAkt) {
    const ts = firebase.database.ServerValue.TIMESTAMP;
    budkyList.forEach(b => {
      dbAkt.ref(`spravce_aktivita/${b.cislo}`).set(ts);
    });
  }

  const jeAdmin = !!(spravceInfo && spravceInfo.spravce === 'admin');
  window._aktualniSpravce = { loginId, spravceInfo, budkyList, jeAdmin };
  window._editBudku = _zobrazEditBudky;
  if (!jeAdmin) _sledujZpravySpravce(loginId);

  const btn = document.getElementById('btnPrihlasit');
  if (btn) { btn.innerHTML = `Přihlášen ${jmeno} ▾ <span class="zpravy-nav-badge" id="zpravyNavBadge" hidden>0</span>`; btn.classList.add('prihlaseny'); }

  const existujiciDropdown = document.getElementById('adminDropdown');
  if (existujiciDropdown) existujiciDropdown.remove();

  // HTML pro budky v menu
  const budkyMenuHTML = jeAdmin
    ? `<div class="admin-dropdown-sec">🔑 Přístup ke všem budkám</div>`
    : (budkyList.length === 1
        ? `<button class="admin-dropdown-item admin-dropdown-budka admin-budka-aktivni" data-akce="editBudky" data-cislo="${budkyList[0].cislo}" data-nazev="${budkyList[0].nazev || ''}">🏠 Editovat budku</button>`
        : `<div class="admin-dropdown-sec">🏠 Moje budky</div>
           ${budkyList.map((b, i) => `<button class="admin-dropdown-item admin-dropdown-budka${i === 0 ? ' admin-budka-aktivni' : ''}" data-akce="editBudky" data-cislo="${b.cislo}" data-nazev="${b.nazev || ''}">🏠 Budka č. ${b.cislo}${b.nazev ? ' – ' + b.nazev : ''}</button>`).join('')}`);

  const hlavickaText = jeAdmin ? 'Administrátor' : (budkyList.length === 1 ? budkaText : budkyList.length + ' budky');

  const dropdown = document.createElement('div');
  dropdown.id = 'adminDropdown';
  dropdown.className = 'admin-dropdown';
  dropdown.innerHTML = `
    <div class="admin-dropdown-hlavicka">👤 ${jmeno} &nbsp;·&nbsp; ${hlavickaText}</div>
    <button class="admin-dropdown-item" data-akce="karta">🪪 Karta správce / Editovat</button>
    <button class="admin-dropdown-item" data-akce="vizitka">🎴 Vizitka správce</button>
    <button class="admin-dropdown-item" data-akce="resetUvitani" title="Karta se při příštím přihlášení ukáže automaticky">🔄 Zobrazit kartu při příštím přihlášení</button>
    ${budkyMenuHTML}

    <button class="admin-dropdown-item" data-akce="zmenitHeslo">🔑 Změnit heslo</button>
    ${!jeAdmin ? `<button class="admin-dropdown-item" data-akce="napisAdminovi">✉️ Napsat adminovi</button>
    <button class="admin-dropdown-item" data-akce="zpravyOdAdmina">📨 Zprávy od admina <span class="admin-badge" id="zpravyOdAdminaBadge" hidden>0</span></button>` : ''}
    ${jeAdmin ? `<div class="admin-dropdown-oddelovac"></div><button class="admin-dropdown-item admin-item-zadosti" data-akce="zadosti">📬 Žádosti správců <span class="admin-badge" id="adminBadge" hidden>0</span></button><button class="admin-dropdown-item" data-akce="prehledSpravcu">👥 Přehled správců</button><button class="admin-dropdown-item" data-akce="aktivitaSpravcu">🏆 Aktivita správců</button><button class="admin-dropdown-item" data-akce="pushHistorie">📩 Push notifikace</button>` : ''}
    <div class="admin-dropdown-oddelovac"></div>
    <button class="admin-dropdown-item odhlasit" data-akce="odhlasit">🚪 Odhlásit se</button>
  `;
  document.getElementById('authNavArea').appendChild(dropdown);

  if (jeAdmin) {
    _sledujZadosti();
    const btnAkt = document.getElementById('btnAktivitaSpravcu');
    if (btnAkt) { btnAkt.hidden = false; btnAkt.onclick = () => _zobrazAktivitaSpravcu(); }
  }

  if (btn) {
    btn.removeEventListener('click', btn._loginHandler);
    btn._dropdownHandler = (e) => { e.stopPropagation(); dropdown.classList.toggle('open'); };
    btn.addEventListener('click', btn._dropdownHandler);
  }

  document.addEventListener('click', function zavriDropdown(e) {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
    }
  });

  dropdown.addEventListener('click', e => {
    const item = e.target.closest('[data-akce]');
    if (!item) return;
    const akce = item.dataset.akce;

    if (akce === 'odhlasit') {
      dropdown.remove();
      const b = document.getElementById('adminBanner');
      if (b) b.remove();
      _authSpravciCache = null;
      _spravciInfoCache = null;
      if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(false);
      window._aktualniSpravce = null;
      if (_zpravySpravceRef) { _zpravySpravceRef.off(); _zpravySpravceRef = null; }
      if (_zadostiRef) { _zadostiRef.off(); _zadostiRef = null; }
      _navBadgePocty.zadosti = 0; _navBadgePocty.zpravy = 0;
      if (btn) {
        btn.textContent = 'Vstup pro správce';
        btn.classList.remove('prihlaseny');
        btn.removeEventListener('click', btn._dropdownHandler);
      }
      _nastavFaviconBadge(0);
      return;
    }

    if (akce === 'karta' || akce === 'editSpravce') {
      _zobrazProfilSpravce(loginId, spravceInfo, budkaText);
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'vizitka') {
      _zobrazVizitku(loginId, spravceInfo, profil);
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'resetUvitani') {
      localStorage.removeItem('mb_firstlogin_' + loginId);
      dropdown.classList.remove('open');
      _zobrazToast('✅ Při příštím přihlášení se karta ukáže automaticky');
      return;
    }

    if (akce === 'resetSlib') {
      localStorage.removeItem('mb_slib_' + loginId);
      localStorage.removeItem('mb_firstlogin_' + loginId);
      dropdown.classList.remove('open');
      _zobrazToast('🧪 Slib resetován — při příštím přihlášení se celý tok ukáže znovu');
      return;
    }

    if (akce === 'editBudky') {
      const cislo = parseInt(item.dataset.cislo, 10);
      const nazev = item.dataset.nazev || '';
      const text  = _budkaText({ cislo, nazev });
      dropdown.querySelectorAll('.admin-dropdown-budka').forEach(b => b.classList.remove('admin-budka-aktivni'));
      item.classList.add('admin-budka-aktivni');
      _zobrazEditBudky(loginId, spravceInfo, text, cislo, nazev);
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'zadosti') {
      _zobrazZadosti();
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'napisAdminovi') {
      _zobrazNapisAdminovi(loginId, jmeno);
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'zpravyOdAdmina') {
      _zobrazZpravySpravce(loginId);
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'prehledSpravcu') {
      _zobrazPrehledSpravcu();
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'aktivitaSpravcu') {
      _zobrazAktivitaSpravcu();
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'pushHistorie') {
      _zobrazPushHistorie();
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'zmenitHeslo') {
      _zobrazZmenitHeslo(loginId);
      dropdown.classList.remove('open');
      return;
    }

    if (item.classList.contains('pripravujeme')) {
      item.textContent = item.textContent.replace(' – Připravujeme…', '') + ' – Připravujeme…';
      setTimeout(() => { item.textContent = item.textContent.replace(' – Připravujeme…', ''); }, 2000);
    }
  });
}

function _nastavFaviconBadge(count) {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32);
    if (count > 0) {
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(25, 7, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 25, 7);
    }
    let link = document.querySelector("link[rel='icon'][type='image/svg+xml']") || document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  };
  img.src = document.querySelector("link[rel='icon'][type='image/svg+xml']")?.href || '/mojebudky/img/favicon.svg';
}

// Kombinovaný čítač pro navbar badge (admin žádosti + zprávy správci)
const _navBadgePocty = { zadosti: 0, zpravy: 0 };
function _aktualizujNavBadge() {
  const total = _navBadgePocty.zadosti + _navBadgePocty.zpravy;
  const navBadge = document.getElementById('zpravyNavBadge');
  if (!navBadge) return;
  if (total > 0) {
    navBadge.textContent = total;
    navBadge.hidden = false;
    navBadge.classList.remove('zpravy-nav-badge--prazdny');
  } else {
    navBadge.textContent = '📨';
    navBadge.hidden = false;
    navBadge.classList.add('zpravy-nav-badge--prazdny');
  }
  _nastavFaviconBadge(total);
}

function _sledujZadosti() {
  const db = _getFirebaseDB();
  if (!db) return;
  if (_zadostiRef) { _zadostiRef.off(); _zadostiRef = null; }
  _zadostiRef = db.ref('admin_requests');
  _zadostiRef.on('value', snap => {
    const data = snap.val() || {};
    let pocet = 0;
    ['zmeny', 'zpravy', 'gps', 'druhy'].forEach(typ => {
      const kat = data[typ];
      if (kat && typeof kat === 'object') {
        Object.values(kat).forEach(z => { if (z && !z.vyrizeno) pocet++; });
      }
    });
    const badge = document.getElementById('adminBadge');
    if (badge) { if (pocet > 0) { badge.textContent = pocet; badge.hidden = false; } else badge.hidden = true; }
    _navBadgePocty.zadosti = pocet;
    _aktualizujNavBadge();
  });
}

// ── ZPRÁVY SPRÁVCI (admin → správce) ─────────────────────────────────────────
let _zpravySpravceRef = null;
let _zadostiRef = null;
let _pushHistorieRef = null;

function _sledujZpravySpravce(loginId) {
  const db = _getFirebaseDB();
  if (!db) return;
  if (_zpravySpravceRef) { _zpravySpravceRef.off(); _zpravySpravceRef = null; }
  _zpravySpravceRef = db.ref(`zpravy_spravci/${loginId}`);
  _zpravySpravceRef.on('value', snap => {
    const data = snap.val() || {};
    const pocet = Object.values(data).filter(z => z && !z.precteno).length;
    const ddBadge = document.getElementById('zpravyOdAdminaBadge');
    if (ddBadge) { if (pocet > 0) { ddBadge.textContent = pocet; ddBadge.hidden = false; } else ddBadge.hidden = true; }
    _navBadgePocty.zpravy = pocet;
    _aktualizujNavBadge();
  });
}

function _zobrazZpravySpravce(loginId) {
  const existujici = document.getElementById('modalZpravySpravce');
  if (existujici) existujici.remove();
  const db = _getFirebaseDB();
  if (!db) return;
  db.ref(`zpravy_spravci/${loginId}`).once('value', snap => {
    const data = snap.val() || {};
    const zpravy = Object.entries(data).filter(([, z]) => z).sort(([, a], [, b]) => (b.ts || 0) - (a.ts || 0));
    const html = zpravy.length ? zpravy.map(([klic, z]) => {
      const cas = z.ts ? new Date(z.ts).toLocaleString('cs-CZ') : '';
      return `<div class="zadost-item ${!z.precteno ? 'zprava-neprectena' : ''}" data-klic="${klic}">
        <span class="zadost-cas">📨 Admin &nbsp;·&nbsp; ${cas}${!z.precteno ? ' <span class="zpravy-nova-bublina">NOVÉ</span>' : ''}</span><br>
        <span class="zadost-zprava-text">${(z.text || '').replace(/</g, '&lt;')}</span>
        ${!z.precteno ? `<br><button class="zadost-btn-ok zprava-precist-btn" data-klic="${klic}" data-push-id="${z.push_id || ''}" style="margin-top:6px">✓ Přečteno</button>` : ''}
      </div>`;
    }).join('') : '<div style="color:var(--text-muted);padding:16px">Žádné zprávy 🎉</div>';
    const modal = document.createElement('div');
    modal.id = 'modalZpravySpravce';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box profil-box">
      <button class="modal-zavrit" id="zpravySpravceZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text"><div class="profil-nadpis">📨 Zprávy od admina</div></div></div>
      <div class="profil-form" id="zpravySpravceObsah">${html}</div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('zpravySpravceZavrit').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#zpravySpravceObsah').addEventListener('click', async e => {
      const btn = e.target.closest('.zprava-precist-btn');
      if (!btn) return;
      const klic = btn.dataset.klic;
      const pushId = btn.dataset.pushId;
      await db.ref(`zpravy_spravci/${loginId}/${klic}/precteno`).set(true);
      if (pushId) db.ref(`push_history/${pushId}/read/${loginId}`).set(Date.now());
      btn.closest('.zadost-item')?.classList.remove('zprava-neprectena');
      btn.closest('.zadost-item')?.querySelector('.zpravy-nova-bublina')?.remove();
      btn.remove();
    });
  });
}

window._napisSpravci = function(loginId, jmeno) {
  const existujici = document.getElementById('modalNapisSpravci');
  if (existujici) existujici.remove();
  const db = _getFirebaseDB();
  if (!db) { alert('Firebase není dostupná'); return; }
  const modal = document.createElement('div');
  modal.id = 'modalNapisSpravci';
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-box" style="max-width:480px;width:94%">
    <button class="modal-zavrit" id="napisSpravciZavrit">×</button>
    <div class="profil-header"><div class="profil-header-text">
      <div class="profil-nadpis">✉️ Napsat správci</div>
      <div class="profil-budka">Příjemce: ${jmeno || loginId}</div>
    </div></div>
    <div class="profil-form">
      <div class="profil-field profil-field--wide">
        <label>Zpráva</label>
        <textarea id="napisSpravciText" rows="5" placeholder="Sem napiš zprávu…" style="width:100%;box-sizing:border-box;background:var(--panel-bg);color:var(--text-light);border:1px solid var(--panel-border);border-radius:8px;padding:10px;font-size:1rem;resize:vertical"></textarea>
      </div>
    </div>
    <div class="profil-actions">
      <button class="profil-btn-ulozit" id="napisSpravciOdeslat">📨 Odeslat</button>
      <span class="profil-ulozeno" id="napisSpravciMsg" hidden></span>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('napisSpravciZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('napisSpravciText')?.focus(), 80);
  document.getElementById('napisSpravciOdeslat').addEventListener('click', async () => {
    const text = document.getElementById('napisSpravciText').value.trim();
    const msg = document.getElementById('napisSpravciMsg');
    if (!text) { msg.textContent = '⚠ Napiš něco…'; msg.hidden = false; return; }
    document.getElementById('napisSpravciOdeslat').disabled = true;
    try {
      await db.ref(`zpravy_spravci/${loginId}`).push({ text, ts: firebase.database.ServerValue.TIMESTAMP, precteno: false });
      msg.textContent = '✓ Odesláno!'; msg.style.color = '#4caf50'; msg.hidden = false;
      setTimeout(() => modal.remove(), 1500);
    } catch {
      msg.textContent = '⚠ Nepodařilo se odeslat'; msg.hidden = false;
      document.getElementById('napisSpravciOdeslat').disabled = false;
    }
  });
};

window._napisSpravciByBudka = async function(cislo) {
  const info = await _nactiSpravciInfo();
  if (!info) { alert('Nepodařilo se načíst správce'); return; }
  const entry = Object.entries(info).find(([, s]) => {
    const budky = s.budky || [{ cislo: s.budka_cislo }];
    return budky.some(b => Number(b.cislo) === Number(cislo));
  });
  if (!entry) { alert(`Budka č. ${cislo} nemá přiřazeného správce v systému`); return; }
  const [loginId, s] = entry;
  window._napisSpravci(loginId, s.jmeno ? `${s.jmeno} (ID: ${loginId})` : loginId);
};

window._poslatPushSpravciByBudka = async function(cislo) {
  const info = await _nactiSpravciInfo();
  if (!info) { alert('Nepodařilo se načíst správce'); return; }
  const entry = Object.entries(info).find(([, s]) => {
    const budky = s.budky || [{ cislo: s.budka_cislo }];
    return budky.some(b => Number(b.cislo) === Number(cislo));
  });
  if (!entry) { alert(`Budka č. ${cislo} nemá přiřazeného správce v systému`); return; }
  const [loginId, s] = entry;
  const jmeno = s.jmeno || loginId;

  const existujici = document.getElementById('modalPoslatPush');
  if (existujici) existujici.remove();

  const GH_REPO   = 'pkobelka/mojebudky';
  const GH_WF     = 'send-push.yml';
  const LS_PAT    = 'mb_github_pat';
  const pat       = localStorage.getItem(LS_PAT) || '';
  const patStatus = pat
    ? `<span style="color:#7ed957">✓ GitHub token nastaven — posílá FCM i offline</span>`
    : `<span style="color:#e5a050">⚠ GitHub token není nastaven — pošle jen banner (online)</span>`;

  const modal = document.createElement('div');
  modal.id = 'modalPoslatPush';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px;width:96%">
      <button class="modal-zavrit" id="poslatPushZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">📩 Poslat push</div>
        <div class="profil-budka" style="font-size:1rem">Příjemce: ${jmeno}</div>
      </div></div>
      <div class="profil-form" style="padding:20px 24px 24px">
        <div class="profil-field">
          <label class="profil-label" style="font-size:1rem">Titulek</label>
          <input type="text" id="pushTitulek" class="profil-input" value="MojeBudky.cz" maxlength="60" style="font-size:1rem">
        </div>
        <div class="profil-field">
          <label class="profil-label" style="font-size:1rem">Zpráva</label>
          <textarea id="pushZprava" class="profil-input" rows="4" maxlength="200" placeholder="Text zprávy…" style="resize:vertical;font-size:1rem"></textarea>
        </div>
        <div style="font-size:0.95rem;margin-bottom:14px;padding:10px 12px;background:rgba(255,255,255,0.05);border-radius:8px;line-height:1.6">
          ${patStatus}
          <button id="pushNastavitPAT" style="display:block;margin-top:6px;background:none;border:none;color:var(--text-muted);font-size:0.88rem;cursor:pointer;padding:0;text-decoration:underline">
            ${pat ? '⚙ Změnit GitHub token' : '⚙ Nastavit GitHub token'}
          </button>
          <div id="pushPATWrap" hidden style="margin-top:10px">
            <input type="password" id="pushPATInput" class="profil-input" placeholder="ghp_xxxxxxxxxxxx" style="font-size:0.9rem;margin-bottom:4px">
            <div style="font-size:0.82rem;color:var(--text-muted)">Token se uloží jen v tomto prohlížeči.</div>
            <button id="pushUlozitPAT" style="margin-top:8px;background:rgba(80,160,80,0.15);border:1px solid rgba(80,180,80,0.3);color:#7ed957;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:0.9rem">Uložit token</button>
          </div>
        </div>
        <div id="pushMsg" style="font-size:0.95rem;margin-bottom:10px;min-height:22px"></div>
        <button id="pushOdeslat" class="btn-primary" style="width:100%;font-size:1.05rem;padding:14px">📩 Odeslat</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.hidden = false;
  document.getElementById('poslatPushZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('pushZprava').focus(), 80);

  document.getElementById('pushNastavitPAT').addEventListener('click', () => {
    const wrap = document.getElementById('pushPATWrap');
    wrap.hidden = !wrap.hidden;
    if (!wrap.hidden) document.getElementById('pushPATInput').focus();
  });

  document.getElementById('pushUlozitPAT').addEventListener('click', () => {
    const val = document.getElementById('pushPATInput').value.trim();
    if (val) { localStorage.setItem(LS_PAT, val); _zobrazToast('✓ GitHub token uložen'); }
    else      { localStorage.removeItem(LS_PAT); _zobrazToast('Token odstraněn'); }
    modal.remove();
  });

  document.getElementById('pushOdeslat').addEventListener('click', async () => {
    const title   = document.getElementById('pushTitulek').value.trim();
    const body    = document.getElementById('pushZprava').value.trim();
    const msg     = document.getElementById('pushMsg');
    const curPat  = localStorage.getItem(LS_PAT) || '';
    if (!body) { msg.style.color = '#e57373'; msg.textContent = '⚠ Vyplň text zprávy.'; return; }
    const db = _getFirebaseDB();
    if (!db) { msg.style.color = '#e57373'; msg.textContent = '⚠ Firebase nedostupný.'; return; }
    document.getElementById('pushOdeslat').disabled = true;
    msg.style.color = 'var(--text-muted)'; msg.textContent = 'Odesílám…';
    try {
      const pushId  = String(Date.now());
      const myJmeno = window._aktualniSpravce?.spravceInfo?.jmeno || window._aktualniSpravce?.loginId || 'admin';

      // Foreground banner (vždy)
      await db.ref('push_broadcast').set({ title, body, ts: Date.now(), push_id: pushId, target: loginId });

      let ghOk = false;
      if (curPat) {
        try {
          const ghResp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WF}/dispatches`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${curPat}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
            body: JSON.stringify({ ref: 'main', inputs: { title, body, target_id: loginId } }),
          });
          ghOk = ghResp.status === 204;
          if (!ghOk) { msg.style.color = '#e5a050'; msg.textContent = `⚠ GitHub API chyba ${ghResp.status} — zkontroluj token.`; }
        } catch { msg.style.color = '#e5a050'; msg.textContent = '⚠ GitHub API nedostupné.'; }
      }

      await db.ref(`push_history/${pushId}`).set({
        title, body, ts: parseInt(pushId), target: loginId,
        sent: { [loginId]: Date.now() },
        sent_by: myJmeno,
        source: ghOk ? 'app+fcm' : 'app',
      });

      // Uložit do schránky zpráv správce, aby viděl historii v "Zprávy od admina"
      const zpravyText = title !== 'MojeBudky.cz' ? `${title}: ${body}` : body;
      await db.ref(`zpravy_spravci/${loginId}`).push({ text: zpravyText, ts: parseInt(pushId), precteno: false, push_id: pushId });

      if (ghOk) {
        msg.style.color = '#7ed957';
        msg.textContent = `✓ Odesláno přes FCM! Správce ${jmeno} dostane notifikaci i offline.`;
      } else if (!curPat) {
        msg.style.color = '#7ed957';
        msg.textContent = `✓ Banner odeslán. Pro offline notifikaci nastav GitHub token.`;
      }
      setTimeout(() => modal.remove(), 2500);
    } catch(e) {
      msg.style.color = '#e57373';
      msg.textContent = '⚠ Nepodařilo se odeslat.';
      document.getElementById('pushOdeslat').disabled = false;
    }
  });
};

function _zobrazZmenitHeslo(loginId) {
  const existujici = document.getElementById('modalZmenitHeslo');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalZmenitHeslo';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;width:94%">
      <button class="modal-zavrit" id="zmenitHesloZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">🔑 Změnit heslo</div>
        <div class="profil-budka">ID: ${loginId}</div>
      </div></div>
      <div class="profil-form" style="padding:20px 24px">
        <div class="zh-pravidla">
          <div class="zh-pravidla-nadpis">Pravidla pro heslo:</div>
          <ul class="zh-pravidla-seznam">
            <li>Délka: <strong>4–8 znaků</strong></li>
            <li>Nepoužívej snadno zaměnitelné znaky: <strong>0</strong> (nula), <strong>O</strong> (velké O), <strong>1</strong> (jednička), <strong>l</strong> (malé L)</li>
          </ul>
        </div>
        <div class="profil-field profil-field--wide" style="margin-bottom:14px">
          <label>Současné heslo</label>
          <input type="password" id="zhStare" maxlength="8" autocomplete="current-password">
        </div>
        <div class="profil-field profil-field--wide" style="margin-bottom:14px">
          <label>Nové heslo</label>
          <input type="password" id="zhNove" maxlength="8" autocomplete="new-password">
        </div>
        <div class="profil-field profil-field--wide">
          <label>Nové heslo znovu</label>
          <input type="password" id="zhNove2" maxlength="8" autocomplete="new-password">
        </div>
        <div class="zh-error" id="zhError" hidden></div>
      </div>
      <div class="profil-actions">
        <button class="profil-btn-ulozit" id="zhUlozit">🔑 Uložit nové heslo</button>
        <span class="profil-ulozeno" id="zhMsg" hidden></span>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('zmenitHesloZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('zhStare').focus(), 80);

  document.getElementById('zhUlozit').addEventListener('click', async () => {
    const stare  = document.getElementById('zhStare').value;
    const nove   = document.getElementById('zhNove').value;
    const nove2  = document.getElementById('zhNove2').value;
    const errEl  = document.getElementById('zhError');
    const msgEl  = document.getElementById('zhMsg');

    errEl.hidden = true;
    function chyba(t) { errEl.textContent = t; errEl.hidden = false; }

    const ZAKAZANE = /[0O1l]/;
    if (!stare)                    return chyba('Zadej současné heslo.');
    if (nove.length < 4)           return chyba('Nové heslo musí mít alespoň 4 znaky.');
    if (ZAKAZANE.test(nove))       return chyba('Heslo obsahuje zakázaný znak (0, O, 1 nebo l).');
    if (nove !== nove2)            return chyba('Nová hesla se neshodují.');
    if (nove === stare)            return chyba('Nové heslo musí být jiné než současné.');

    const ok = await _overitPrihlaseni(loginId, stare);
    if (!ok) return chyba('Současné heslo není správné.');

    const db = _getFirebaseDB();
    if (!db) return chyba('Firebase není dostupná.');
    try {
      const novyHash = await sha256hex(nove);
      await db.ref(`hesla/${loginId}`).set(novyHash);
      msgEl.textContent = '✓ Heslo bylo změněno!';
      msgEl.hidden = false;
      document.getElementById('zhUlozit').disabled = true;
      setTimeout(() => modal.remove(), 2000);
    } catch {
      chyba('Nepodařilo se uložit. Zkus to znovu.');
    }
  });

  [document.getElementById('zhStare'), document.getElementById('zhNove'), document.getElementById('zhNove2')]
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('zhUlozit').click(); }));
}

async function _zobrazPrehledSpravcu() {
  const existujici = document.getElementById('modalPrehled');
  if (existujici) existujici.remove();

  const info = await _nactiSpravciInfo() || {};

  // Sestavit seznam pouze ze spravci_info.json (bez Firebase — fotky by způsobily zaseknutí)
  const vsichniSpravci = Object.entries(info).map(([id, s]) => {
    const budkyList = s.budky ? s.budky : [{ cislo: s.budka_cislo, nazev: s.budka_nazev || '' }];
    return {
      id,
      jmeno:    s.jmeno    || '—',
      prijmeni: s.prijmeni || '',
      telefon:  s.telefon  || '',
      email:    s.email    || '',
      budkaCisla: budkyList.map(b => String(b.cislo)),
      budkaNazvy: budkyList.map(b => (b.nazev || '').toLowerCase()),
      budkyText:  budkyList.map(b => b.cislo + (b.nazev ? ' – ' + b.nazev : '')).join(', '),
    };
  }).sort((a, b) => (a.jmeno + a.prijmeni).localeCompare(b.jmeno + b.prijmeni, 'cs'));

  const modal = document.createElement('div');
  modal.id = 'modalPrehled';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box prehled-box">
      <button class="modal-zavrit" id="prehledZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">👥 Přehled správců <span class="prehled-pocet" id="prehledPocet"></span></div>
      </div></div>
      <div class="prehled-hledat-wrap">
        <input type="search" id="prehledHledat" class="prehled-hledat" placeholder="🔍 Hledat jméno, č. budky, název budky…">
      </div>
      <div class="prehled-filtry">
        <button class="prehled-filtr prehled-filtr--aktivni" data-filtr="vse">Všichni (${vsichniSpravci.length})</button>
        <button class="prehled-filtr" data-filtr="telefon">📞 S telefonem</button>
        <button class="prehled-filtr" data-filtr="email">📧 S e-mailem</button>
      </div>
      <div class="prehled-kopirovat">
        <button class="prehled-kopir-btn" id="prehledKopirTel">📋 Kopírovat telefony</button>
        <button class="prehled-kopir-btn" id="prehledKopirEmail">📋 Kopírovat e-maily</button>
      </div>
      <div class="prehled-seznam" id="prehledObsah"></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('prehledZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  let aktFiltr = 'vse';
  let hledany  = '';

  function renderSeznam() {
    const q = hledany.trim().toLowerCase();
    const filtered = vsichniSpravci.filter(s => {
      if (aktFiltr === 'telefon' && !s.telefon) return false;
      if (aktFiltr === 'email'   && !s.email)   return false;
      if (!q) return true;
      return (s.jmeno + ' ' + s.prijmeni).toLowerCase().includes(q)
        || s.budkaCisla.some(c => c.startsWith(q))
        || s.budkaNazvy.some(n => n.includes(q));
    });
    const pocetEl = document.getElementById('prehledPocet');
    if (pocetEl) pocetEl.textContent = `· ${filtered.length}`;
    const container = document.getElementById('prehledObsah');
    if (!container) return;
    if (!filtered.length) { container.innerHTML = '<div style="color:var(--text-muted);padding:16px">Žádný výsledek</div>'; return; }
    container.innerHTML = filtered.map(s => `
      <div class="prehled-radek">
        <div class="prehled-jmeno">${s.jmeno} ${s.prijmeni} <span class="prehled-id">· ID ${s.id} · 🏠 ${s.budkyText}</span></div>
        ${s.telefon ? `<a class="prehled-kontakt" href="tel:${s.telefon}">📞 ${s.telefon}</a>` : '<span class="prehled-prazdny">bez telefonu</span>'}
        ${s.email   ? `<a class="prehled-kontakt" href="mailto:${s.email}">📧 ${s.email}</a>` : '<span class="prehled-prazdny">bez e-mailu</span>'}
      </div>`).join('');
  }

  renderSeznam();

  document.getElementById('prehledHledat').addEventListener('input', e => {
    hledany = e.target.value;
    renderSeznam();
  });

  modal.querySelectorAll('.prehled-filtr').forEach(btn => {
    btn.addEventListener('click', () => {
      aktFiltr = btn.dataset.filtr;
      modal.querySelectorAll('.prehled-filtr').forEach(b => b.classList.remove('prehled-filtr--aktivni'));
      btn.classList.add('prehled-filtr--aktivni');
      renderSeznam();
    });
  });

  document.getElementById('prehledKopirTel').addEventListener('click', () => {
    const cisla = vsichniSpravci.filter(s => s.telefon).map(s => s.telefon).join('\n');
    navigator.clipboard.writeText(cisla).then(() => _zobrazToast('📋 Telefony zkopírovány!', 2500));
  });
  document.getElementById('prehledKopirEmail').addEventListener('click', () => {
    const emaily = vsichniSpravci.filter(s => s.email).map(s => s.email).join('\n');
    navigator.clipboard.writeText(emaily).then(() => _zobrazToast('📋 E-maily zkopírovány!', 2500));
  });
}

async function _zobrazAktivitaSpravcu() {
  const existujici = document.getElementById('modalAktivita');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalAktivita';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box prehled-box">
      <button class="modal-zavrit" id="aktivitaZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">🏆 Nejaktivnější správci</div>
      </div></div>
      <div class="prehled-filtry" style="padding:0 16px 8px">
        <button class="prehled-filtr prehled-filtr--aktivni" data-period="7">7 dní</button>
        <button class="prehled-filtr" data-period="30">30 dní</button>
        <button class="prehled-filtr" data-period="365">Rok</button>
        <button class="prehled-filtr" data-period="0">Vše</button>
      </div>
      <div class="prehled-seznam" id="aktivitaObsah"><div style="color:var(--text-muted);padding:20px 16px">Načítám…</div></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('aktivitaZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const db = _getFirebaseDB();
  if (!db) {
    document.getElementById('aktivitaObsah').innerHTML = '<div style="color:var(--text-muted);padding:20px 16px">Firebase není dostupná</div>';
    return;
  }

  let aktData = {}, prihlData = {};
  try {
    const [aktSnap, prihlSnap] = await Promise.all([
      db.ref('aktivita').once('value'),
      db.ref('prihlaseni').once('value')
    ]);
    aktData   = aktSnap.val()   || {};
    prihlData = prihlSnap.val() || {};
  } catch {
    document.getElementById('aktivitaObsah').innerHTML = '<div style="color:var(--text-muted);padding:20px 16px">Nepodařilo se načíst data</div>';
    return;
  }

  const info = await _nactiSpravciInfo() || {};

  const vsechnyUdalosti = [];
  Object.values(aktData).forEach(e => {
    if (e && e.loginId && e.ts) vsechnyUdalosti.push({ loginId: String(e.loginId), ts: e.ts, typ: 'edit', jmeno: e.jmeno || '' });
  });
  Object.values(prihlData).forEach(e => {
    if (e && e.loginId && e.ts) vsechnyUdalosti.push({ loginId: String(e.loginId), ts: e.ts, typ: 'login', jmeno: e.jmeno || '' });
  });

  let aktPeriod = 7;

  function _fmtDatumAkt(ts) {
    if (!ts) return '';
    const dny = (Date.now() - ts) / 86400000;
    if (dny < 1)   return 'dnes';
    if (dny < 2)   return 'včera';
    if (dny < 7)   return `před ${Math.floor(dny)} dny`;
    const d = new Date(ts);
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  }

  function renderLeaderboard() {
    const container = document.getElementById('aktivitaObsah');
    if (!container) return;
    const now    = Date.now();
    const cutoff = aktPeriod === 0 ? 0 : now - aktPeriod * 86400000;

    const agg = {};
    vsechnyUdalosti.forEach(u => {
      if (u.ts < cutoff) return;
      if (!agg[u.loginId]) agg[u.loginId] = { edity: 0, prihlaseni: 0, posledni: 0, jmeno: u.jmeno };
      if (u.typ === 'edit') agg[u.loginId].edity++;
      else                  agg[u.loginId].prihlaseni++;
      if (u.ts > agg[u.loginId].posledni) agg[u.loginId].posledni = u.ts;
    });

    Object.entries(agg).forEach(([id, a]) => {
      const si = info[id];
      if (si && (si.jmeno || si.prijmeni)) a.jmeno = ((si.jmeno || '') + ' ' + (si.prijmeni || '')).trim();
    });

    const sorted = Object.entries(agg)
      .map(([id, a]) => ({ id, ...a, celkem: a.edity + a.prihlaseni }))
      .filter(a => a.celkem > 0)
      .sort((a, b) => b.celkem !== a.celkem ? b.celkem - a.celkem : b.posledni - a.posledni);

    if (!sorted.length) {
      container.innerHTML = '<div style="color:var(--text-muted);padding:20px 16px">Žádná aktivita v tomto období</div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((a, i) => {
      const rank    = i < 3 ? `<span class="akt-medal">${medals[i]}</span>` : `<span class="akt-rank">${i + 1}.</span>`;
      const detaily = [a.edity ? `${a.edity} editací` : '', a.prihlaseni ? `${a.prihlaseni} přihlášení` : ''].filter(Boolean).join(' · ');
      return `<div class="akt-radek">
        ${rank}
        <div class="akt-info">
          <div class="akt-jmeno">${a.jmeno || '— ID ' + a.id}</div>
          <div class="akt-detail">${detaily}</div>
        </div>
        <div class="akt-prave">
          <div class="akt-celkem">${a.celkem}</div>
          <div class="akt-datum">${_fmtDatumAkt(a.posledni)}</div>
        </div>
      </div>`;
    }).join('');
  }

  renderLeaderboard();

  modal.querySelectorAll('.prehled-filtr[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      aktPeriod = parseInt(btn.dataset.period, 10);
      modal.querySelectorAll('.prehled-filtr[data-period]').forEach(b => b.classList.remove('prehled-filtr--aktivni'));
      btn.classList.add('prehled-filtr--aktivni');
      renderLeaderboard();
    });
  });
}

async function _zobrazPushHistorie() {
  const existujici = document.getElementById('modalPushHistorie');
  if (existujici) {
    if (_pushHistorieRef) { _pushHistorieRef.off(); _pushHistorieRef = null; }
    existujici.remove();
  }

  const db = _getFirebaseDB();
  const modal = document.createElement('div');
  modal.id = 'modalPushHistorie';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box prehled-box">
      <button class="modal-zavrit" id="pushHistorieZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">📩 Push notifikace</div>
      </div></div>
      <div id="pushHistorieObsah" class="prehled-seznam" style="padding:0 12px">
        <div style="text-align:center;color:var(--text-muted);padding:32px 0">Načítám…</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.hidden = false;
  const _zastavitPushHistorii = () => {
    if (_pushHistorieRef) { _pushHistorieRef.off(); _pushHistorieRef = null; }
    modal.remove();
  };
  document.getElementById('pushHistorieZavrit').addEventListener('click', _zastavitPushHistorii);
  modal.addEventListener('click', e => { if (e.target === modal) _zastavitPushHistorii(); });

  if (!db) {
    document.getElementById('pushHistorieObsah').innerHTML = '<p style="color:var(--text-muted);text-align:center">Firebase nedostupný.</p>';
    return;
  }

  const info = await _nactiSpravciInfo().catch(() => ({})) || {};
  const jmenoSpravce = id => (info[id] && (info[id].jmeno || id)) || id;

  const renderHistorie = (data) => {
    if (!data) {
      document.getElementById('pushHistorieObsah').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:32px 0">Žádné odeslané push notifikace.</p>';
      return;
    }
    const zaznamy = Object.entries(data).sort(([a], [b]) => b.localeCompare(a)).slice(0, 15);
    const html = zaznamy.map(([pushId, z]) => {
      const cas = new Date(z.ts).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const sentIds  = z.sent ? Object.keys(z.sent) : [];
      const readIds  = z.read ? Object.keys(z.read) : [];
      const prijemciIds = z.target ? [z.target] : sentIds;
      const prijemciText = prijemciIds.length ? prijemciIds.map(jmenoSpravce).join(', ') : (sentIds.length ? sentIds.map(jmenoSpravce).join(', ') : '— všichni');
      const readText = readIds.length ? readIds.map(jmenoSpravce).join(', ') : '—';
      const sentBy = z.sent_by ? `<span style="font-size:0.78rem;color:var(--text-muted)"> · odesílatel: ${z.sent_by}</span>` : '';
      return `<div style="border-bottom:1px solid rgba(255,255,255,0.07);padding:12px 0">
        <div style="font-weight:600;margin-bottom:3px">${z.title || ''}</div>
        <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:4px">${z.body || ''}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">🕐 ${cas}${sentBy}</div>
        <div style="font-size:0.9rem;margin-bottom:2px">
          <span style="font-size:1.1rem;font-weight:700;color:#e0e0e0">✓</span>
          <span style="color:var(--text-muted)"> Příjemce: </span><span style="color:var(--text-light)">${prijemciText}</span>
        </div>
        <div style="font-size:0.9rem">
          <span style="font-size:1.1rem;font-weight:700;color:${readIds.length ? '#7ed957' : '#555'}">✓✓</span>
          <span style="color:var(--text-muted)"> Zobrazeno: </span><span style="color:${readIds.length ? '#7ed957' : 'var(--text-muted)'}">${readText}</span>
        </div>
      </div>`;
    }).join('');
    const obsah = document.getElementById('pushHistorieObsah');
    if (obsah) obsah.innerHTML = html || '<p style="color:var(--text-muted);text-align:center">Žádné záznamy.</p>';
  };

  _pushHistorieRef = db.ref('push_history').orderByKey().limitToLast(20);
  _pushHistorieRef.on('value', snap => renderHistorie(snap.val()));
}

function _zobrazNapisAdminovi(loginId, jmeno) {
  const existujici = document.getElementById('modalNapisAdmin');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalNapisAdmin';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:640px;width:96%">
      <button class="modal-zavrit" id="napisAdminZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">✉️ Napsat adminovi</div>
        <div class="profil-budka">Zpráva pro Petra Kobelku</div>
      </div></div>
      <div class="profil-form">
        <div class="profil-field profil-field--wide">
          <label>Zpráva</label>
          <textarea id="napisAdminText" rows="8" placeholder="Sem napiš svůj dotaz nebo připomínku…" style="width:100%;box-sizing:border-box;background:var(--panel-bg);color:var(--text-light);border:1px solid var(--panel-border);border-radius:8px;padding:10px;font-size:1rem;resize:vertical"></textarea>
        </div>
      </div>
      <div class="profil-actions">
        <button class="profil-btn-ulozit" id="napisAdminOdeslat">📨 Odeslat zprávu</button>
        <span class="profil-ulozeno" id="napisAdminMsg" hidden></span>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('napisAdminZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  setTimeout(() => document.getElementById('napisAdminText').focus(), 100);

  document.getElementById('napisAdminOdeslat').addEventListener('click', async () => {
    const text = document.getElementById('napisAdminText').value.trim();
    const msg  = document.getElementById('napisAdminMsg');
    if (!text) { msg.textContent = '⚠ Napiš něco…'; msg.hidden = false; return; }
    const db = _getFirebaseDB();
    if (!db) { msg.textContent = '⚠ Firebase není dostupná'; msg.hidden = false; return; }
    try {
      await db.ref('admin_requests/zpravy').push({
        loginId, jmeno, text,
        ts: firebase.database.ServerValue.TIMESTAMP,
        vyrizeno: false
      });
      msg.textContent = '✓ Zpráva odeslána!';
      msg.hidden = false;
      document.getElementById('napisAdminOdeslat').disabled = true;
      setTimeout(() => modal.remove(), 2000);
    } catch {
      msg.textContent = '⚠ Nepodařilo se odeslat';
      msg.hidden = false;
    }
  });
}

function _zobrazZadosti() {
  const existujici = document.getElementById('modalZadosti');
  if (existujici) existujici.remove();
  const db = _getFirebaseDB();
  if (!db) { alert('Firebase není dostupná'); return; }

  const modal = document.createElement('div');
  modal.id = 'modalZadosti';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box">
      <button class="modal-zavrit" id="zadostiZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">📬 Žádosti správců</div>
      </div></div>
      <div class="profil-form" id="zadostiObsah"><div style="color:var(--text-muted)">Načítám…</div></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('zadostiZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  db.ref('admin_requests').once('value', snap => {
    const data = snap.val() || {};
    const container = document.getElementById('zadostiObsah');
    let html = '';

    const renderZprava = (klic, z, vyrizena, typ = 'zpravy') => {
      const cas = z.ts ? new Date(z.ts).toLocaleString('cs-CZ') : '';
      const emailInfo = z.email && z.email !== '(neuvedeno)' ? ` · ${z.email}` : '';
      const mozeOdpovedet = !vyrizena && z.loginId && z.loginId !== 'navstevnik';
      return `<div class="zadost-item${vyrizena ? ' zadost-item--vyrizena' : ''}" data-typ="${typ}" data-klic="${klic}">
        <strong>${z.jmeno || z.loginId}</strong>${emailInfo} <span class="zadost-cas">${cas}</span>${vyrizena ? ' <span style="color:#6dcc6d;font-size:0.82rem">✓ vyřízeno</span>' : ''}<br>
        <span class="zadost-detail zadost-zprava-text">${z.text ? z.text.replace(/</g,'&lt;') : ''}</span><br>
        ${!vyrizena ? `<div class="zadost-btn-row">
          ${mozeOdpovedet ? `<button class="zadost-btn-odpovedet" data-loginid="${z.loginId}" data-jmeno="${z.jmeno || z.loginId}" data-klic="${klic}">💬 Odpovědět</button>` : ''}
          <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✓ Vyřízeno</button>
        </div>
        <div class="zadost-odpoved-wrap" id="odpov-${klic}" hidden>
          <textarea class="zadost-odpoved-ta" rows="3" placeholder="Tvoje odpověď…"></textarea>
          <button class="zadost-btn-odeslat-odpoved" data-loginid="${z.loginId}" data-jmeno="${z.jmeno || z.loginId}" data-klic="${klic}">📨 Odeslat</button>
        </div>` : ''}
      </div>`;
    };

    ['zmeny', 'zpravy', 'gps', 'druhy'].forEach(typ => {
      const kat = data[typ] || {};
      const polozky = Object.entries(kat).filter(([,v]) => v && !v.vyrizeno);
      if (!polozky.length) return;
      const typLabel = typ === 'gps' ? '📍 Opravy GPS' : typ === 'druhy' ? '🐦 Nové druhy'
        : typ === 'zpravy' ? '✉️ Zprávy správců' : '🔄 Změny profilu';
      html += `<div class="zadosti-skupina"><div class="zadosti-typ">${typLabel}</div>`;
      polozky.sort(([,a],[,b]) => (b.ts||0)-(a.ts||0)).forEach(([klic, z]) => {
        const cas = z.ts ? new Date(z.ts).toLocaleString('cs-CZ') : '';
        if (typ === 'zmeny') {
          const zmenHtml = Object.entries(z.zmeny || {}).map(([,v]) =>
            `<span class="zadost-detail">${v.label}: <s style="color:var(--text-muted)">${v.stara || '—'}</s> → <strong>${v.nova}</strong></span>`
          ).join('<br>');
          html += `<div class="zadost-item" data-typ="${typ}" data-klic="${klic}" data-loginid="${z.loginId}">
            <strong>${z.jmeno_spravce || z.loginId}</strong> (ID: ${z.loginId}) <span class="zadost-cas">${cas}</span><br>
            ${zmenHtml}<br>
            <div class="zadost-btn-row">
              <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✅ Schválit</button>
              <button class="zadost-btn-zamit" data-typ="${typ}" data-klic="${klic}">✗ Zamítnout</button>
            </div>
          </div>`;
        } else if (typ === 'gps') {
          html += `<div class="zadost-item" data-typ="${typ}" data-klic="${klic}">
            <strong>Budka č. ${z.budka_cislo}</strong> – správce ${z.jmeno || z.spravce}<br>
            <span class="zadost-detail">Nové souřadnice: ${z.nova_lat}, ${z.nova_lng}</span><br>
            <span class="zadost-cas">${cas}</span>
            <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✓ Vyřízeno</button>
          </div>`;
        } else if (typ === 'druhy') {
          html += `<div class="zadost-item" data-typ="${typ}" data-klic="${klic}">
            <strong>Druh: ${z.druh}</strong> – správce ${z.spravce}<br>
            <span class="zadost-cas">${cas}</span>
            <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✓ Vyřízeno</button>
          </div>`;
        } else {
          html += renderZprava(klic, z, false, typ);
        }
      });
      html += '</div>';
    });

    // Historie vyřízených zpráv správců
    const vyrizeneZpravy = Object.entries(data.zpravy || {}).filter(([,v]) => v && v.vyrizeno)
      .sort(([,a],[,b]) => (b.ts||0)-(a.ts||0));
    if (vyrizeneZpravy.length) {
      html += `<div class="zadosti-skupina zadosti-skupina--historie">
        <div class="zadosti-typ" style="opacity:0.55">📁 Historie zpráv (vyřízené)</div>
        ${vyrizeneZpravy.map(([k,z]) => renderZprava(k, z, true)).join('')}
      </div>`;
    }

    container.innerHTML = html || '<div style="color:var(--text-muted)">Žádné čekající žádosti 🎉</div>';

    container.addEventListener('click', async e => {
      // Odpovědět — toggle textarea
      const btnOdpovedet = e.target.closest('.zadost-btn-odpovedet');
      if (btnOdpovedet) {
        const wrap = document.getElementById('odpov-' + btnOdpovedet.dataset.klic);
        if (wrap) { wrap.hidden = !wrap.hidden; if (!wrap.hidden) wrap.querySelector('textarea')?.focus(); }
        return;
      }
      // Odeslat odpověď
      const btnOdeslatOdpoved = e.target.closest('.zadost-btn-odeslat-odpoved');
      if (btnOdeslatOdpoved) {
        const wrap = document.getElementById('odpov-' + btnOdeslatOdpoved.dataset.klic);
        const text = wrap?.querySelector('textarea')?.value.trim();
        if (!text) return;
        btnOdeslatOdpoved.disabled = true;
        try {
          await db.ref(`zpravy_spravci/${btnOdeslatOdpoved.dataset.loginid}`).push({ text, ts: firebase.database.ServerValue.TIMESTAMP, precteno: false });
          await db.ref(`admin_requests/zpravy/${btnOdeslatOdpoved.dataset.klic}/vyrizeno`).set(true);
          wrap.innerHTML = '<span style="color:#4caf50">✓ Odpověď odeslána!</span>';
          btnOdeslatOdpoved.closest('.zadost-item')?.querySelectorAll('.zadost-btn-odpovedet,.zadost-btn-ok').forEach(b => b.disabled = true);
        } catch { btnOdeslatOdpoved.disabled = false; }
        return;
      }

      const btnOk    = e.target.closest('.zadost-btn-ok');
      const btnZamit = e.target.closest('.zadost-btn-zamit');
      const btn = btnOk || btnZamit;
      if (!btn) return;

      const typ  = btn.dataset.typ;
      const klic = btn.dataset.klic;
      const item = btn.closest('.zadost-item');

      if (btnOk && typ === 'zmeny') {
        // Schválit změnu profilu → uložit nové hodnoty do Firebase
        try {
          const snap = await db.ref(`admin_requests/zmeny/${klic}`).once('value');
          const z = snap.val();
          if (z && z.zmeny && z.loginId) {
            const updates = {};
            Object.entries(z.zmeny).forEach(([pole, v]) => { updates[pole] = v.nova; });
            await db.ref(`spravci/${z.loginId}/profil`).update(updates);
          }
        } catch {}
      }

      await db.ref(`admin_requests/${typ}/${klic}/vyrizeno`).set(true);
      item.style.opacity = '0.4';
      item.querySelectorAll('button').forEach(b => { b.disabled = true; });
      btn.textContent = btnOk ? '✓ Hotovo' : '✗ Zamítnuto';
    });
  });
}

function _nacistProfilLocal(loginId) {
  try { return JSON.parse(localStorage.getItem('mb_profil_' + loginId) || 'null'); } catch { return null; }
}

function _ulozitProfilLocal(loginId, data) {
  localStorage.setItem('mb_profil_' + loginId, JSON.stringify(data));
}

function _zobrazSlibSpravce(loginId, spravceInfo, budkaText, osloveni) {
  const existujici = document.getElementById('modalSlib');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalSlib';
  modal.className = 'modal-overlay profil-overlay';
  modal.innerHTML = `
    <div class="modal-box slib-box">
      <div class="slib-header">
        <div class="slib-header-nadpis">🌿 Desatero odpovědného správce budky</div>
        <div class="slib-header-sub">Přečtěte si závazky a potvrďte je níže · ${budkaText}</div>
      </div>
      <div class="slib-body">
        <ol class="slib-desatero">
          <li><strong>Bezpečí ptáků je na prvním místě</strong>Při umisťování, kontrole i čištění budky vždy dbám na to, aby nebyli ohroženi její obyvatelé ani já sám. Respektuji přírodu a do hnízdění zasahuji jen v nejnutnějších případech.</li>
          <li><strong>Správné umístění je základ úspěchu</strong>Budku instaluji na bezpečné místo – dostatečně vysoko před predátory (kočky, kuny), stabilně a s vletovým otvorem ideálně na jihovýchod až východ, aby do ní nefoukalo a nepršelo.</li>
          <li><strong>Pravidelný podzimní úklid je povinnost</strong>Před zimou budku pečlivě vyčistím a odstraním staré hnízdo. Tím chráním budoucí generace ptáčat před parazity a připravuji jim čistý domov na další jaro. Na jaře provedu kontrolu před hnízděním.</li>
          <li><strong>V době hnízdění neruším</strong>Když ptáci sedí na vejcích nebo krmí malá ptáčata, budku neotvírám a pozoruji ji jen z bezpečné vzdálenosti. Klid na hnízdění je klíčem k úspěšnému vyvedení mladých.</li>
          <li><strong>Data v aplikaci udržuji aktuální</strong>Pravidelně a poctivě zapisuji všechna pozorování, kontroly a stav budky do naší webové aplikace MojeBudky. Každý záznam a nahraná fotka pomáhají celému projektu.</li>
          <li><strong>Jsem očima a ušima své budky</strong>Sleduji technický stav budky. Pokud je poškozená, opravím ji, nebo včas nahlásím potřebu opravy, aby byla pro ptáky stále bezpečným útočištěm.</li>
          <li><strong>Šířím osvětu a radost z přírody</strong>O své zážitky a znalosti se dělím s rodinou, přáteli nebo sousedy. Pomáhám ostatním pochopit, proč je ochrana ptactva důležitá a jak jim správně pomáhat.</li>
          <li><strong>Respektuji pravidla komunity MojeBudky</strong>Jsem hrdým členem naší komunity. Jednám fér, pomáhám ostatním správcům, sdílím své zkušenosti a táhnu za jeden provaz pro dobrou věc.</li>
          <li><strong>Pomáhám ptákům po celý rok</strong>V zimě přikrmuji kvalitní stravou v krmítkách, v létě nabízím ptákům na zahradě bezpečné napajedlo s čistou vodou. Budka je jen začátek péče.</li>
          <li><strong>Chráním přírodu jako celek</strong>Uvědomuji si, že ptáci potřebují k životu zdravé prostředí. Nepoužívám na zahradě zbytečnou chemii a podporuji rozmanitost přírody v okolí své budky.</li>
        </ol>
        <p class="slib-podpis">Za komunitu MojeBudky děkuji!<br><strong>Petr Kobelka</strong></p>
      </div>
      <div class="slib-footer">
        <label class="slib-souhlas-label">
          <input type="checkbox" id="slibSouhlas">
          <span>Přečetl/a jsem si Desatero a slibuji tato pravidla dodržovat</span>
        </label>
        <div class="slib-souhlas-error" id="slibSouhlasError" hidden>⚠️ Nejprve zaškrtni políčko</div>
        <button class="slib-btn-prijimam" id="slibPrijimam">✅ Potvrdit slib</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => { const b = modal.querySelector('.slib-box'); if (b) b.scrollTop = 0; }, 80);

  document.getElementById('slibPrijimam').addEventListener('click', () => {
    const souhlas = document.getElementById('slibSouhlas');
    const errEl   = document.getElementById('slibSouhlasError');
    if (!souhlas.checked) {
      errEl.hidden = false;
      souhlas.closest('.slib-souhlas-label').classList.add('slib-souhlas--chyba');
      return;
    }
    localStorage.setItem('mb_slib_' + loginId, '1');
    localStorage.setItem('mb_firstlogin_' + loginId, '1');
    modal.remove();
    _zobrazToast(`🙏 Děkujeme za složení slibu, ${osloveni}! Vítej mezi správci MojeBudky! 🌿`);
    setTimeout(() => _zobrazProfilSpravce(loginId, spravceInfo, budkaText), 6000);
  });
}

function _zobrazProfilSpravce(loginId, info, budkaText) {
  const ulozeny = _nacistProfilLocal(loginId);
  const d = Object.assign({}, info, ulozeny);

  const existujici = document.getElementById('modalProfil');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalProfil';
  modal.className = 'modal-overlay profil-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box">
      <button class="modal-zavrit" id="profilZavrit">×</button>

      <div class="profil-header">
        <div class="profil-foto-wrap">
          <img id="profilFotoNahled" src="${d.foto || 'img/Favikon.png'}" class="profil-foto profil-foto--klikatelna" alt="Foto správce" title="Kliknout pro změnu fotky">
          <button type="button" class="profil-foto-btn" id="profilFotoBtn" title="Nahrát nebo vyfotit">📷</button>
          <input type="file" id="profilFotoInputGalerie" accept="image/*" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
          <input type="file" id="profilFotoInputKamera" accept="image/*" capture="environment" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
        </div>
        <div class="profil-header-text">
          <div class="profil-nadpis">🪪 Karta správce</div>
          <div class="profil-budka">${budkaText}</div>
          <div class="profil-id-wrap">ID: <span class="profil-id">${loginId}</span></div>
        </div>
      </div>

      <div class="profil-form">
        <div class="profil-row">
          <div class="profil-field">
            <label>Titul před</label>
            <input type="text" id="pTitulPred" value="${d.titul_pred || ''}" placeholder="Ing., Mgr., …">
          </div>
          <div class="profil-field profil-field--wide">
            <label>Jméno</label>
            <input type="text" id="pJmeno" value="${d.jmeno || ''}">
          </div>
          <div class="profil-field profil-field--wide">
            <label>Příjmení</label>
            <input type="text" id="pPrijmeni" value="${d.prijmeni || ''}">
          </div>
          <div class="profil-field">
            <label>Titul za</label>
            <input type="text" id="pTitulZa" value="${d.titul_za || ''}" placeholder="Ph.D., …">
          </div>
        </div>
        <div class="profil-row">
          <div class="profil-field profil-field--wide">
            <label>Oslovení <span class="profil-hint">— použijeme při přihlášení</span></label>
            <input type="text" id="pOsloveni" value="${d.osloveni || ''}" placeholder="Ahoj …">
          </div>
          <div class="profil-field profil-field--wide">
            <label>Datum narození
              <span class="profil-hint profil-narozeniny" title="Popřejeme Ti k narozeninám! 🎂">🎂 popřejeme!</span>
            </label>
            <input type="date" id="pDatum" value="${d.datum_narozeni || ''}">
          </div>
        </div>
        <div class="profil-row">
          <div class="profil-field profil-field--wide">
            <label>Telefon</label>
            <input type="tel" id="pTelefon" value="${d.telefon || ''}">
          </div>
          <div class="profil-field profil-field--wide">
            <label>E-mail <span class="profil-hint">— potřebný pro reset hesla</span></label>
            <input type="email" id="pEmail" value="${d.email || ''}" placeholder="váš@email.cz">
          </div>
        </div>
      </div>

      <div class="profil-actions">
        <label class="profil-vzdy-label">
          <input type="checkbox" id="profilVzdy" ${localStorage.getItem('mb_firstlogin_' + loginId) ? 'checked' : ''}> Nezobrazovat kartu automaticky po přihlášení
        </label>
        <button class="profil-btn-ulozit" id="profilUlozit">💾 Uložit změny</button>
        <span class="profil-ulozeno" id="profilUlozeno" hidden>✓ Uloženo!</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Scroll na začátek – setTimeout nutný, rAF se spustí dřív než browser auto-scroll na první input
  setTimeout(() => {
    const box = modal.querySelector('.profil-box');
    if (box) { box.scrollTop = 0; box.scrollLeft = 0; }
  }, 80);

  // Silently update fields from Firebase (may be more recent than localStorage)
  _nacistProfilFirebase(loginId).then(profilFB => {
    if (!profilFB || !document.getElementById('modalProfil')) return;
    const merged = Object.assign({}, d, profilFB);
    const ef = id => document.getElementById(id);
    if (ef('pTitulPred')) ef('pTitulPred').value = merged.titul_pred || '';
    if (ef('pJmeno'))     ef('pJmeno').value     = merged.jmeno || '';
    if (ef('pPrijmeni'))  ef('pPrijmeni').value  = merged.prijmeni || '';
    if (ef('pTitulZa'))   ef('pTitulZa').value   = merged.titul_za || '';
    if (ef('pOsloveni'))  ef('pOsloveni').value  = merged.osloveni || '';
    if (ef('pDatum'))     ef('pDatum').value      = merged.datum_narozeni || '';
    if (ef('pTelefon'))   ef('pTelefon').value   = merged.telefon || '';
    if (ef('pEmail'))     ef('pEmail').value      = merged.email || '';
  });

  document.getElementById('profilZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  function _otevritFotoSheet() {
    const existSheet = document.getElementById('fotoSheet');
    if (existSheet) { existSheet.remove(); return; }
    const sheet = document.createElement('div');
    sheet.id = 'fotoSheet';
    sheet.className = 'foto-sheet-overlay';
    sheet.innerHTML = `
      <div class="foto-sheet">
        <button class="foto-sheet-btn" id="fotoSheetKamera">📷 Vyfotit</button>
        <button class="foto-sheet-btn" id="fotoSheetGalerie">🖼️ Vybrat z galerie</button>
        <button class="foto-sheet-btn foto-sheet-zrusit" id="fotoSheetZrusit">Zrušit</button>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
    document.getElementById('fotoSheetZrusit').addEventListener('click', () => sheet.remove());
    document.getElementById('fotoSheetKamera').addEventListener('click', () => {
      sheet.remove();
      document.getElementById('profilFotoInputKamera').click();
    });
    document.getElementById('fotoSheetGalerie').addEventListener('click', () => {
      sheet.remove();
      document.getElementById('profilFotoInputGalerie').click();
    });
  }

  document.getElementById('profilFotoBtn').addEventListener('click', _otevritFotoSheet);
  document.getElementById('profilFotoNahled').addEventListener('click', _otevritFotoSheet);

  function _zpracujFoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 600;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        document.getElementById('profilFotoNahled').src = canvas.toDataURL('image/jpeg', 0.82);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
  document.getElementById('profilFotoInputGalerie').addEventListener('change', e => _zpracujFoto(e.target.files[0]));
  document.getElementById('profilFotoInputKamera').addEventListener('change',  e => _zpracujFoto(e.target.files[0]));

  document.getElementById('profilUlozit').addEventListener('click', async () => {
    const foto = document.getElementById('profilFotoNahled').src;
    const CITLIVA = ['jmeno', 'prijmeni', 'telefon'];
    const CITLIVA_LABELY = { jmeno: 'Jméno', prijmeni: 'Příjmení', telefon: 'Telefon' };

    const noveCitlive = {
      jmeno:    document.getElementById('pJmeno').value.trim(),
      prijmeni: document.getElementById('pPrijmeni').value.trim(),
      telefon:  document.getElementById('pTelefon').value.trim(),
    };
    const volnaData = {
      titul_pred:     document.getElementById('pTitulPred').value.trim(),
      titul_za:       document.getElementById('pTitulZa').value.trim(),
      osloveni:       document.getElementById('pOsloveni').value.trim(),
      datum_narozeni: document.getElementById('pDatum').value,
      email:          document.getElementById('pEmail').value.trim(),
      foto:           foto.startsWith('data:') ? foto : null,
    };

    // Porovnej citlivá pole se současnými hodnotami
    const zmeny = {};
    CITLIVA.forEach(k => {
      const stara = (d[k] || '').trim();
      const nova  = noveCitlive[k];
      if (nova !== stara) zmeny[k] = { stara, nova, label: CITLIVA_LABELY[k] };
    });

    // Validace
    const emailInput = document.getElementById('pEmail');
    const emailVal = emailInput.value.trim();
    if (emailVal && !emailInput.validity.valid) {
      const errEl = document.getElementById('profilUlozeno');
      errEl.textContent = '⚠ Neplatný formát e-mailu (příklad: jmeno@domena.cz)';
      errEl.style.color = '#e07070';
      errEl.hidden = false;
      emailInput.focus();
      setTimeout(() => { errEl.hidden = true; errEl.style.color = ''; }, 5000);
      return;
    }
    if (!noveCitlive.jmeno || !noveCitlive.prijmeni) {
      const errEl = document.getElementById('profilUlozeno');
      errEl.textContent = '⚠ Jméno a příjmení jsou povinná pole';
      errEl.style.color = '#e07070';
      errEl.hidden = false;
      document.getElementById(!noveCitlive.jmeno ? 'pJmeno' : 'pPrijmeni').focus();
      setTimeout(() => { errEl.hidden = true; errEl.style.color = ''; }, 5000);
      return;
    }

    // Ulož volná pole + beze-změny citlivá pole přímo
    const dataKUlozeni = { ...volnaData };
    CITLIVA.forEach(k => { if (!zmeny[k]) dataKUlozeni[k] = noveCitlive[k]; });

    const fbOK = await _ulozitProfilFirebase(loginId, dataKUlozeni);
    _ulozitProfilLocal(loginId, { ...dataKUlozeni, ...Object.fromEntries(CITLIVA.map(k => [k, d[k] || ''])) });

    // Pošli žádost adminovi pro změněná citlivá pole
    const db = _getFirebaseDB();
    const zmenPocet = Object.keys(zmeny).length;
    if (zmenPocet > 0 && db) {
      try {
        await db.ref('admin_requests/zmeny').push({
          loginId,
          jmeno_spravce: d.jmeno || info.jmeno || loginId,
          zmeny,
          ts: firebase.database.ServerValue.TIMESTAMP,
          vyrizeno: false
        });
      } catch {}
    }

    const vzdy = document.getElementById('profilVzdy');
    if (vzdy && vzdy.checked) {
      localStorage.setItem('mb_firstlogin_' + loginId, '1');
    } else {
      localStorage.removeItem('mb_firstlogin_' + loginId);
    }

    const msg = document.getElementById('profilUlozeno');
    if (zmenPocet > 0) {
      msg.textContent = '✓ Uloženo · změna jméno/kontakt čeká na schválení admina';
    } else {
      msg.textContent = fbOK ? '✓ Uloženo do cloudu!' : '✓ Uloženo lokálně';
    }
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 3500);
  });
}

const _EB_DRUHY = [
  { id: 'konadra',   nazev: 'Sýk. koňadra' },
  { id: 'modrinka',  nazev: 'Sýk. modřinka' },
  { id: 'uhelnicek', nazev: 'Sýk. úhelníček' },
  { id: 'babka',     nazev: 'Sýk. babka' },
  { id: 'parukarka', nazev: 'Sýk. parukářka' },
  { id: 'vrabec',    nazev: 'Vrabec domácí' },
  { id: 'slavik',    nazev: 'Slavík obecný' },
  { id: 'neznam',    nazev: 'Osídlena – nevím kdo' },
];

async function _zobrazEditBudky(loginId, spravceInfo, budkaText, budkaCislo, budkaNazev) {
  const existujici = document.getElementById('modalEditBudky');
  if (existujici) existujici.remove();

  const db = _getFirebaseDB();
  let ulozeno = {};
  if (db) {
    try {
      const snap = await db.ref(`budky_edit/${budkaCislo}`).once('value');
      ulozeno = snap.val() || {};
    } catch {}
  }

  const budkaObj = (window._budkyData || []).find(b => b.cislo === budkaCislo) || {};
  const jmeno = spravceInfo ? spravceInfo.jmeno : loginId;
  const gpsText = budkaObj.lat && budkaObj.lng
    ? `${budkaObj.lat.toFixed(5)}, ${budkaObj.lng.toFixed(5)}`
    : '—';
  const otvorText = budkaObj.typ || '—';
  const vybranyDruh = ulozeno.kdo_hnizdi || '';
  const naposledy = ulozeno.ts
    ? `<div class="eb-naposledy">Naposledy editováno: ${new Date(ulozeno.ts).toLocaleString('cs-CZ')}</div>` : '';

  const chipyHTML = _EB_DRUHY.map(d =>
    `<button type="button" class="eb-chip${vybranyDruh === d.nazev ? ' eb-chip--sel' : ''}" data-druh="${d.nazev}">${d.nazev}</button>`
  ).join('') +
  `<button type="button" class="eb-chip eb-chip--jiny" data-druh="__jiny">+ Jiný druh</button>`;

  const modal = document.createElement('div');
  modal.id = 'modalEditBudky';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box eb-modal">
      <button class="modal-zavrit" id="editBudkyZavrit">×</button>
      <div class="profil-header">
        <div class="profil-header-text">
          <div class="profil-nadpis">🏠 Editovat budku</div>
          <div class="profil-budka">${budkaText}</div>
        </div>
        <div class="eb-readonly-info">
          <span title="GPS souřadnice">📍 ${gpsText} <button type="button" class="eb-gps-hlasit-btn" id="ebGpsHlasitBtn" title="Nahlásit špatné souřadnice">⚠</button></span>
          <span title="Průměr vletového otvoru">🕳 ${otvorText}</span>
        </div>
      </div>
      <div class="profil-form">
        <div class="profil-row">
          <div class="profil-field profil-field--wide">
            <label>Název budky</label>
            <input type="text" id="ebNazev" value="${ulozeno.nazev !== undefined ? ulozeno.nazev : (budkaObj.nazev || '')}" placeholder="Název budky">
          </div>
          <div class="profil-field">
            <label>Datum instalace</label>
            <input type="text" id="ebInstalace" value="${ulozeno.instalace !== undefined ? ulozeno.instalace : (budkaObj.instalace || '')}" placeholder="např. 3/2022">
          </div>
        </div>
        <div class="profil-row">
          <div class="profil-field" style="flex:0 0 auto">
            <label>Rok kontroly</label>
            <div class="eb-rok-ctrl">
              <button type="button" class="eb-rok-btn" id="ebRokMinus">◀</button>
              <span class="eb-rok-val" id="ebRokVal">${ulozeno.rok || new Date().getFullYear()}</span>
              <button type="button" class="eb-rok-btn" id="ebRokPlus">▶</button>
            </div>
            <input type="hidden" id="ebRok" value="${ulozeno.rok || new Date().getFullYear()}">
          </div>
          <div class="profil-field">
            <label>Datum kontroly</label>
            <input type="date" id="ebKontrola" value="${_czToIso(ulozeno.kontrola) || new Date().toISOString().slice(0,10)}">
          </div>
          <div class="profil-field">
            <label>Datum čištění</label>
            <input type="date" id="ebCisteni" value="${_czToIso(ulozeno.cisteni) || ''}">
          </div>
        </div>
        <div class="profil-field profil-field--wide">
          <label>Kdo nyní sídlí</label>
          <div class="eb-chipy" id="ebChipy">${chipyHTML}</div>
          <div class="eb-jiny-wrap" id="ebJinyWrap" style="display:none">
            <input type="text" id="ebJinyText" placeholder="Název druhu (pošleme žádost adminovi)">
          </div>
        </div>
        <div class="profil-row">
          <div class="profil-field">
            <label>Foto budky</label>
            <div class="eb-foto-wrap">
              ${ulozeno.foto ? `<img src="${ulozeno.foto}" class="eb-foto-nahled" id="ebFotoNahled" alt="Foto budky">` : `<div class="eb-foto-placeholder" id="ebFotoNahled">📷<span>Bez fotky</span></div>`}
              <label class="eb-foto-btn" for="ebFotoInput">📷 ${ulozeno.foto ? 'Změnit foto' : 'Přidat foto'}</label>
              <input type="file" id="ebFotoInput" accept="image/*" style="display:none">
            </div>
          </div>
          <div class="profil-field profil-field--wide">
            <label>Poznámka k budce</label>
            <textarea id="ebPoznamka" rows="3" placeholder="Aktuální stav budky, zajímavosti…">${ulozeno.poznamka || ''}</textarea>
          </div>
        </div>
        ${naposledy}
      </div>
      <div class="profil-actions">
        <button class="profil-btn-ulozit" id="editBudkyUlozit">💾 Uložit</button>
        <button class="profil-btn-ulozit eb-btn-zobrazit" id="editBudkyUlozitZobrazit" style="background:var(--nav-hover)">💾🗺 Uložit a zobrazit</button>
        <span class="profil-ulozeno" id="editBudkyUlozeno" hidden></span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('editBudkyZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Foto upload + resize
  let _fotoBase64 = ulozeno.foto || null;
  document.getElementById('ebFotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 900;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        _fotoBase64 = canvas.toDataURL('image/jpeg', 0.75);
        const nahled = document.getElementById('ebFotoNahled');
        nahled.outerHTML = `<img src="${_fotoBase64}" class="eb-foto-nahled" id="ebFotoNahled" alt="Foto budky">`;
        document.querySelector('label[for="ebFotoInput"]').textContent = '📷 Změnit foto';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Rok ±
  const rokInput = document.getElementById('ebRok');
  const rokVal   = document.getElementById('ebRokVal');
  document.getElementById('ebRokMinus').addEventListener('click', () => {
    const v = Math.max(2000, parseInt(rokInput.value) - 1);
    rokInput.value = rokVal.textContent = v;
  });
  document.getElementById('ebRokPlus').addEventListener('click', () => {
    const v = Math.min(2099, parseInt(rokInput.value) + 1);
    rokInput.value = rokVal.textContent = v;
  });

  document.getElementById('ebGpsHlasitBtn').addEventListener('click', () => {
    const existGps = document.getElementById('ebGpsFormWrap');
    if (existGps) { existGps.remove(); return; }
    const jmeno2 = spravceInfo ? spravceInfo.jmeno : loginId;
    const wrap = document.createElement('div');
    wrap.id = 'ebGpsFormWrap';
    wrap.className = 'eb-gps-form-wrap';
    wrap.innerHTML = `
      <div class="eb-gps-form-title">📍 Nahlásit správné souřadnice</div>
      <div class="eb-gps-radek">
        <input class="eb-gps-input" id="ebGpsLat" placeholder="Zeměpisná šířka (lat)" type="number" step="0.00001" value="${budkaObj.lat || ''}">
        <input class="eb-gps-input" id="ebGpsLng" placeholder="Zeměpisná délka (lng)" type="number" step="0.00001" value="${budkaObj.lng || ''}">
      </div>
      <div class="eb-gps-hint">Souřadnice najdete v Google Maps – klikněte pravým tlačítkem na místo → zkopírujte první číslo (lat) a druhé (lng).</div>
      <div class="eb-gps-radek">
        <button class="profil-btn-ulozit eb-gps-odeslat" id="ebGpsOdeslat">📨 Odeslat žádost adminovi</button>
        <span id="ebGpsMsg" class="profil-ulozeno" hidden></span>
      </div>`;
    document.querySelector('#modalEditBudky .profil-form').appendChild(wrap);

    document.getElementById('ebGpsOdeslat').addEventListener('click', async () => {
      const novaLat = parseFloat(document.getElementById('ebGpsLat').value);
      const novaLng = parseFloat(document.getElementById('ebGpsLng').value);
      const msg = document.getElementById('ebGpsMsg');
      if (!novaLat || !novaLng) { msg.textContent = '⚠ Zadejte obě souřadnice'; msg.hidden = false; return; }
      if (db) {
        try {
          await db.ref('admin_requests/gps').push({
            budka_cislo: budkaCislo,
            budka_nazev: budkaNazev,
            stara_lat: budkaObj.lat || null,
            stara_lng: budkaObj.lng || null,
            nova_lat: novaLat,
            nova_lng: novaLng,
            spravce: loginId,
            jmeno: jmeno2,
            ts: firebase.database.ServerValue.TIMESTAMP,
            vyrizeno: false
          });
          msg.textContent = '✓ Žádost odeslána adminovi!';
          msg.hidden = false;
          document.getElementById('ebGpsOdeslat').disabled = true;
        } catch { msg.textContent = '⚠ Nepodařilo se odeslat'; msg.hidden = false; }
      }
    });
  });

  let aktualniDruh = vybranyDruh;
  document.getElementById('ebChipy').addEventListener('click', e => {
    const chip = e.target.closest('.eb-chip');
    if (!chip) return;
    if (chip.dataset.druh === '__jiny') {
      document.getElementById('ebJinyWrap').style.display = 'block';
      chip.classList.add('eb-chip--sel');
      document.querySelectorAll('#ebChipy .eb-chip:not(.eb-chip--jiny)').forEach(c => c.classList.remove('eb-chip--sel'));
      aktualniDruh = '__jiny';
    } else {
      document.getElementById('ebJinyWrap').style.display = 'none';
      const bylVybran = chip.classList.contains('eb-chip--sel');
      document.querySelectorAll('#ebChipy .eb-chip').forEach(c => c.classList.remove('eb-chip--sel'));
      if (!bylVybran) { chip.classList.add('eb-chip--sel'); aktualniDruh = chip.dataset.druh; }
      else aktualniDruh = '';
    }
  });

  async function _ulozitBudku() {
    const nazev     = document.getElementById('ebNazev').value.trim();
    const instalace = document.getElementById('ebInstalace').value.trim();
    const rok       = document.getElementById('ebRok').value.trim();
    const kontrola  = _isoToCz(document.getElementById('ebKontrola').value.trim());
    const cisteni   = _isoToCz(document.getElementById('ebCisteni').value.trim());
    const poznamka  = document.getElementById('ebPoznamka').value.trim();
    let kdoHnizdi   = aktualniDruh === '__jiny'
      ? (document.getElementById('ebJinyText').value.trim() || '')
      : aktualniDruh;

    if (aktualniDruh === '__jiny' && kdoHnizdi) {
      if (db) {
        try { await db.ref('admin_requests/druhy').push({ druh: kdoHnizdi, spravce: loginId, ts: firebase.database.ServerValue.TIMESTAMP }); } catch {}
      }
    }

    let ok = false;
    if (db) {
      try {
        const data = {
          nazev, instalace, rok, kontrola, cisteni,
          kdo_hnizdi: kdoHnizdi, poznamka,
          ts: firebase.database.ServerValue.TIMESTAMP,
          spravce_id: loginId, jmeno
        };
        if (_fotoBase64) data.foto = _fotoBase64;
        await db.ref(`budky_edit/${budkaCislo}`).set(data);
        ok = true;
      } catch {}
    }

    if (ok) {
      const casti = [];
      if (kdoHnizdi) casti.push(`sídlí ${kdoHnizdi}`);
      if (kontrola) casti.push(`kontrola ${kontrola}`);
      if (cisteni) casti.push(`čištění ${cisteni}`);
      if (casti.length) await _logAktivita(loginId, jmeno, budkaCislo, nazev || budkaNazev, casti.join(' · '));
    }
    return ok;
  }

  document.getElementById('editBudkyUlozit').addEventListener('click', async () => {
    const ok = await _ulozitBudku();
    const msg = document.getElementById('editBudkyUlozeno');
    msg.textContent = ok ? '✓ Uloženo!' : '⚠ Nepodařilo se uložit';
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 2500);
  });

  document.getElementById('editBudkyUlozitZobrazit').addEventListener('click', async () => {
    const msg = document.getElementById('editBudkyUlozeno');
    msg.textContent = '⏳ Ukládám…';
    msg.hidden = false;
    const ok = await _ulozitBudku();
    if (!ok) {
      msg.textContent = '⚠ Nepodařilo se uložit';
      return;
    }
    modal.remove();
    const marker = window._markersByCislo && window._markersByCislo[budkaCislo];
    if (marker) {
      const mc = document.querySelector('.main-content');
      if (mc && !mc.classList.contains('mapa-fullscreen')) {
        const navMapa = document.getElementById('nav-mapa');
        if (navMapa) navMapa.click();
      }
      const map = window._getMapInstance && window._getMapInstance();
      setTimeout(() => {
        if (map) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
        marker.openPopup();
      }, 300);
    }
  });
}

function _vokativ(jmeno) {
  const prvni = jmeno.trim().split(/\s+/)[0];
  const normalized = prvni.charAt(0).toUpperCase() + prvni.slice(1).toLowerCase();

  const tabulka = {
    'Aleš':'Aleši','Tomáš':'Tomáši','Lukáš':'Lukáši','Luboš':'Luboši','Miloš':'Miloši',
    'Ondřej':'Ondřeji','Dobroš':'Dobroši',
    'Jan':'Jane','Martin':'Martine','David':'Davide','Jakub':'Jakube','Filip':'Filipe',
    'Adam':'Adame','Milan':'Milane','Roman':'Romane','Lubor':'Lubore','Viktor':'Viktore',
    'Stanislav':'Stanislave','Miroslav':'Miroslave','Antonín':'Antoníne','Vladimír':'Vladimíre',
    'Ladislav':'Ladislave','Václav':'Václave','František':'Františku','Jindřich':'Jindřichu',
    'Libor':'Libore','Jaroslav':'Jaroslave','Ivan':'Ivane','Kamil':'Kamile','Radim':'Radime',
    'Petr':'Petře','Pavel':'Pavle','Karel':'Karle','Michal':'Michale','Daniel':'Daniele',
    'Radek':'Radku','Marek':'Marku','Zdeněk':'Zdeňku','Patrik':'Patriku','Dominik':'Dominiku',
    'Jiří':'Jiří','Josef':'Pepo','Dušan':'Dušane','Oldřich':'Oldo','Erwin':'Erwine',
    'Honza':'Honzo','Ondra':'Ondro','Míra':'Míro','Pepa':'Pepo','Tom':'Tome',
    'Jarda':'Jardo','Jirka':'Jirko','Vašek':'Vašku','Tomášek':'Tomášku',
    'Miro':'Miro','Radko':'Radko','Sláva':'Slávo','Víťa':'Víťo',
    'Rafan':'Jardo','Peťa':'Peťo','Dianka':'Dianko',
    'Jana':'Jano','Eva':'Evo','Petra':'Petro','Alena':'Aleno','Lenka':'Lenko',
    'Monika':'Moniko','Tereza':'Terezo','Kateřina':'Kateřino','Ivana':'Ivano',
    'Hana':'Hano','Zuzana':'Zuzano','Lucie':'Lucie','Marie':'Marie','Alice':'Alice',
    'Martina':'Martino','Markéta':'Markéto','Veronika':'Veroniko','Jitka':'Jitko',
    'Irena':'Ireno','Renata':'Renato','Dana':'Dano','Romana':'Romano','Gábi':'Gábi',
    'Gabriela':'Gabrielo','Michaela':'Michaelo','Marcela':'Marcelo','Simona':'Simono',
    'Sylva':'Sylvo','Vlasta':'Vlasto','Vlaďka':'Vlaďko','Věra':'Věro','Iva':'Ivo',
    'Ludmila':'Ludmilo','Miroslava':'Miroslavo','Květoslava':'Květoslavo',
    'Milena':'Mileno','Vlastimil':'Vlastimile','Anička':'Aničko','Katka':'Katko',
  };

  if (tabulka[normalized]) return tabulka[normalized];
  if (/[šžč]$/.test(normalized)) return normalized + 'i';
  if (normalized.endsWith('ej')) return normalized + 'i';
  if (normalized.endsWith('í')) return normalized;
  if (normalized.endsWith('ek')) return normalized.slice(0, -2) + 'ku';
  if (normalized.endsWith('a')) return normalized.slice(0, -1) + 'o';
  return normalized + 'e';
}

function _loadImg(src, useCors) {
  return new Promise(resolve => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function _vizitkaNaCanvas({ loginId, celJmeno, jmeno, prijmeni, telefon, email, foto, budkyText, budkyLabel = 'Budka', qrSrc }) {
  const W = 850, H = 540, S = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0e2706');
  bg.addColorStop(0.5, '#1c4210');
  bg.addColorStop(1, '#2a5c18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Gold border
  ctx.strokeStyle = 'rgba(212,160,64,0.6)'; ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = 'rgba(212,160,64,0.2)'; ctx.lineWidth = 1;
  ctx.strokeRect(15, 15, W - 30, H - 30);

  // Header strip
  const hdr = ctx.createLinearGradient(0, 0, 0, 75);
  hdr.addColorStop(0, 'rgba(0,0,0,0.4)'); hdr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hdr; ctx.fillRect(0, 0, W, 75);

  // Logo
  const logo = await _loadImg('img/logo.svg', false);
  if (logo) ctx.drawImage(logo, 26, 14, 42, 42);

  // Brand
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 23px "Segoe UI",Arial,sans-serif';
  ctx.fillStyle = '#d4a040';
  ctx.fillText('MojeBudky', 76, 40);
  const bw = ctx.measureText('MojeBudky').width;
  ctx.fillStyle = '#9dc44a';
  ctx.fillText('.cz', 76 + bw, 40);
  ctx.fillStyle = 'rgba(200,225,155,0.65)';
  ctx.font = '11px "Segoe UI",Arial,sans-serif';
  ctx.fillText('Síť ptačích budek', 76, 62);

  // Header divider
  ctx.strokeStyle = 'rgba(212,160,64,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(26, 74); ctx.lineTo(W - 26, 74); ctx.stroke();

  // Photo circle
  const px = 72, py = 295, pr = 72;
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
  const fotoImg = foto ? await _loadImg(foto, true) : null;
  if (fotoImg) {
    ctx.drawImage(fotoImg, px - pr, py - pr, pr * 2, pr * 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.fillStyle = 'rgba(200,225,155,0.45)';
    ctx.font = `${pr}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👤', px, py + 4);
  }
  ctx.restore();
  ctx.strokeStyle = '#d4a040'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(px, py, pr + 4, 0, Math.PI * 2); ctx.stroke();

  // Name & role
  const nx = 168, ny = 220;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f0e8c0';
  ctx.font = 'bold 29px "Segoe UI",Arial,sans-serif';
  ctx.fillText(celJmeno || loginId || '', nx, ny);
  ctx.fillStyle = '#9dc44a';
  ctx.font = '11px "Segoe UI",Arial,sans-serif';
  ctx.fillText('SPRÁVCE PTAČÍCH BUDEK', nx, ny + 22);
  ctx.strokeStyle = 'rgba(212,160,64,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(nx, ny + 34); ctx.lineTo(nx + 370, ny + 34); ctx.stroke();

  // Budky
  ctx.fillStyle = '#c8dca0'; ctx.font = '14px "Segoe UI",Arial,sans-serif';
  ctx.fillText('🏠 ' + budkyLabel + ' ' + budkyText, nx, ny + 58);

  // Contacts
  let cy = ny + 100;
  ctx.font = '14px "Segoe UI",Arial,sans-serif';
  if (telefon) {
    ctx.fillStyle = '#d4a040'; ctx.fillText('📞', nx, cy);
    ctx.fillStyle = '#e0eecc'; ctx.fillText(' ' + telefon, nx + 22, cy);
    cy += 28;
  }
  if (email) {
    ctx.fillStyle = '#d4a040'; ctx.fillText('✉', nx, cy);
    ctx.fillStyle = '#e0eecc'; ctx.fillText(' ' + email, nx + 20, cy);
    cy += 28;
  }
  ctx.fillStyle = 'rgba(157,196,74,0.8)'; ctx.font = '12px "Segoe UI",Arial,sans-serif';
  ctx.fillText('🌿 mojebudky.cz', nx, cy + 8);

  // QR code
  const qrImg = await _loadImg(qrSrc, true);
  const qrSize = 112, qrX = W - qrSize - 28, qrY = H - qrSize - 28;
  if (qrImg) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    _roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // Bottom bar
  const bar = ctx.createLinearGradient(0, H - 38, 0, H);
  bar.addColorStop(0, 'rgba(0,0,0,0)'); bar.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = bar; ctx.fillRect(0, H - 38, W, 38);
  ctx.fillStyle = 'rgba(212,160,64,0.6)';
  ctx.font = 'bold 10px "Segoe UI",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('MojeBudky.cz – síť ptačích budek', 26, H - 12);

  return canvas;
}

function _zobrazVizitku(loginId, spravceInfo, profil) {
  const existujici = document.getElementById('modalVizitka');
  if (existujici) existujici.remove();

  const d = profil || {};
  const si = spravceInfo || {};
  const titulPred  = (d.titul_pred  || '').trim();
  const titulZa    = (d.titul_za    || '').trim();
  const jmeno      = (d.jmeno      || si.jmeno      || '').trim();
  const prijmeni   = (d.prijmeni   || si.prijmeni   || '').trim();
  const telefon    = (d.telefon    || si.telefon    || '').trim();
  const email      = (d.email      || si.email      || '').trim();
  const foto       = d.foto || null;

  const budkyList  = (si.budky && si.budky.length)
    ? si.budky
    : (si.budka_cislo ? [{ cislo: si.budka_cislo, nazev: si.budka_nazev || '' }] : []);
  const budkyText  = budkyList.length ? budkyList.map(b => `č. ${b.cislo}${b.nazev ? ' – ' + b.nazev : ''}`).join(', ') : '—';
  const budkyLabel = budkyList.length > 1 ? 'Budky' : 'Budka';

  const celJmeno = [titulPred, jmeno, prijmeni].filter(Boolean).join(' ') + (titulZa ? `, ${titulZa}` : '');
  const fotoHtml = foto
    ? `<img src="${foto}" class="vizitka-foto" alt="Foto správce">`
    : `<div class="vizitka-foto vizitka-foto--placeholder">👤</div>`;

  const qrUrl = 'https://pkobelka.github.io/mojebudky/';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=88x88&color=eef4e8&bgcolor=1c4210&data=${encodeURIComponent(qrUrl)}`;

  const modal = document.createElement('div');
  modal.id = 'modalVizitka';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box vizitka-modal">
      <button class="modal-zavrit" id="vizitkaZavrit">×</button>
      <div class="profil-header" style="padding:20px 56px 20px 28px">
        <div class="profil-header-text">
          <div class="profil-nadpis">🎴 Vizitka správce</div>
        </div>
      </div>
      <div class="vizitka-wrap">
        <div class="vizitka-karta" id="vizitkaTisk">
          <div class="vizitka-top">
            <img src="img/logo.svg" class="vizitka-logo" alt="MojeBudky">
            <span class="vizitka-brand">MojeBudky<span class="vizitka-brand-cz">.cz</span></span>
          </div>
          <div class="vizitka-telo">
            ${fotoHtml}
            <div class="vizitka-info">
              <div class="vizitka-jmeno">${celJmeno || loginId}</div>
              <div class="vizitka-role">Správce ptačích budek</div>
              <div class="vizitka-budky">🏠 ${budkyLabel} ${budkyText}</div>
            </div>
            <img src="${qrSrc}" class="vizitka-qr" alt="QR mojebudky.cz">
          </div>
          <div class="vizitka-kontakt">
            ${telefon ? `<span>📞 ${telefon}</span>` : ''}
            ${email    ? `<span>✉ ${email}</span>`    : ''}
            <span class="vizitka-web">mojebudky.cz</span>
          </div>
        </div>
        <div class="vizitka-akce">
          <button class="profil-btn-ulozit" id="vizitkaTisknout">🖨 Vytisknout</button>
          <button class="profil-btn-ulozit" id="vizitkaOdeslat" style="background:var(--accent-gold);color:#1a3a00">📤 Odeslat</button>
          <button class="profil-btn-ulozit" id="vizitkaObrazek" style="background:#2a6018;color:#eef4e8;border:1.5px solid var(--accent-gold)">🖼 Obrázek</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('vizitkaZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('vizitkaTisknout').addEventListener('click', () => window.print());

  document.getElementById('vizitkaOdeslat').addEventListener('click', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${celJmeno || [jmeno, prijmeni].filter(Boolean).join(' ')}`,
      `N:${prijmeni};${jmeno};;${titulPred};${titulZa || ''}`,
      titulZa ? `TITLE:${titulZa}` : '',
      `ORG:MojeBudky.cz`,
      `NOTE:Správce ptačích budek – ${budkyText}`,
      telefon ? `TEL;TYPE=CELL:${telefon}` : '',
      email   ? `EMAIL:${email}` : '',
      `URL:https://pkobelka.github.io/mojebudky/`,
    ].filter(Boolean).join('\r\n') + '\r\nEND:VCARD';

    const blob = new Blob([vcf], { type: 'text/vcard' });
    const soubor = `${[jmeno, prijmeni].filter(Boolean).join('_') || 'vizitka'}_MojeBudky.vcf`;

    if (navigator.share) {
      const file = new File([blob], soubor, { type: 'text/vcard' });
      navigator.share({ files: [file], title: celJmeno, text: `Vizitka správce – MojeBudky.cz` })
        .catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = soubor; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });

  document.getElementById('vizitkaObrazek').addEventListener('click', async () => {
    const btn = document.getElementById('vizitkaObrazek');
    btn.disabled = true; btn.textContent = '⏳ Generuji…';
    try {
      const canvas = await _vizitkaNaCanvas({ loginId, celJmeno, jmeno, prijmeni, telefon, email, foto, budkyText, budkyLabel, qrSrc });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('toBlob selhalo');
      const soubor = `${[jmeno, prijmeni].filter(Boolean).join('_') || 'vizitka'}_MojeBudky.png`;
      const pngFile = new File([blob], soubor, { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pngFile] })) {
        await navigator.share({ files: [pngFile], title: celJmeno });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = soubor; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch {
      // uživatel zrušil sdílení nebo selhal canvas
    } finally {
      btn.disabled = false; btn.textContent = '🖼 Obrázek';
    }
  });
}

function _zobrazPrani(typ, osloveni) {
  const existujici = document.getElementById('praniOverlay');
  if (existujici) existujici.remove();

  const jeNar = typ === 'narozeniny';
  const overlay = document.createElement('div');
  overlay.id = 'praniOverlay';
  overlay.className = 'prani-overlay';
  overlay.innerHTML = `
    <div class="prani-box prani-box--${typ}">
      <div class="prani-ikona">${jeNar ? '🎂' : '🎉'}</div>
      <div class="prani-nadpis">${jeNar ? 'Všechno nejlepší!' : 'Dnes máš svátek!'}</div>
      <div class="prani-text">${jeNar
        ? `Přejeme Ti, ${osloveni}, krásný den plný zpěvu ptáků a radosti z přírody. 🐦`
        : `Přejeme Ti, ${osloveni}, krásný den. Ať Ti to dnes v budkách i v životě klape! 🌿`
      }</div>
      <button class="prani-btn" id="praniZavrit">Díky! 😊</button>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('prani-overlay--show'), 50);
  document.getElementById('praniZavrit').addEventListener('click', () => {
    overlay.classList.remove('prani-overlay--show');
    setTimeout(() => overlay.remove(), 500);
  });
}

function _zobrazToast(text, ms, isHtml) {
  const existujici = document.getElementById('adminToast');
  if (existujici) existujici.remove();

  const toast = document.createElement('div');
  toast.id = 'adminToast';
  toast.className = 'admin-toast';
  if (isHtml) toast.innerHTML = text; else toast.textContent = text;
  document.body.appendChild(toast);

  const doba = ms || 6000;
  setTimeout(() => toast.classList.add('admin-toast--show'), 50);
  setTimeout(() => {
    toast.classList.remove('admin-toast--show');
    setTimeout(() => toast.remove(), 500);
  }, doba);
}

function _zobrazToastDlouhy(text) {
  _zobrazToast(text, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  // Foreground push handler — aktivuj hned pokud je oprávnění už uděleno
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    setTimeout(_nastavPushForeground, 2000);
  }

  // Potvrzenka z kliknutí na background notifikaci (?pr=pushId&u=loginId)
  (function() {
    const p = new URLSearchParams(location.search);
    const pr = p.get('pr');
    const u  = p.get('u');
    if (pr && u) {
      history.replaceState({}, '', location.pathname);
      setTimeout(() => {
        const db = _getFirebaseDB();
        if (db) db.ref(`push_history/${pr}/read/${u}`).set(Date.now());
      }, 3000);
    }
  })();

  const btnPrihlasit = document.getElementById('btnPrihlasit');
  const modal        = document.getElementById('modalPrihlaseni');
  const modalZavrit  = document.getElementById('modalZavrit');
  const loginBtn     = document.getElementById('loginBtn');
  const inputId      = document.getElementById('loginId');
  const inputHeslo   = document.getElementById('loginHeslo');
  const loginError   = document.getElementById('loginError');
  const loginLoading = document.getElementById('loginLoading');

  if (!btnPrihlasit || !modal) return;

  function otevritModal() {
    modal.hidden = false;
    const savedId = localStorage.getItem('mb_saved_loginId') || '';
    inputId.value = savedId;
    inputHeslo.value = '';
    loginError.hidden = true;
    loginLoading.hidden = true;
    loginBtn.disabled = false;
    const cbZapamatovat = document.getElementById('cbZapamatovat');
    if (cbZapamatovat) cbZapamatovat.checked = !!savedId;
    setTimeout(() => (savedId ? inputHeslo : inputId).focus(), 50);
  }

  function zavritModal() {
    modal.hidden = true;
  }

  btnPrihlasit._loginHandler = otevritModal;
  btnPrihlasit.addEventListener('click', otevritModal);
  modalZavrit.addEventListener('click', zavritModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) zavritModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) zavritModal();
  });

  async function pokusOPrihlaseni() {
    const id    = inputId.value.trim();
    const heslo = inputHeslo.value;

    if (!/^\d{1,6}$/.test(id)) {
      loginError.textContent = 'ID musí být 1–6 číslic.';
      loginError.hidden = false;
      return;
    }
    if (!heslo) {
      loginError.textContent = 'Zadejte heslo.';
      loginError.hidden = false;
      return;
    }

    loginError.hidden = true;
    loginLoading.hidden = false;
    loginBtn.disabled = true;

    try {
      const ok = await _overitPrihlaseni(id, heslo);
      if (ok) {
        const cbZapamatovat = document.getElementById('cbZapamatovat');
        if (cbZapamatovat && cbZapamatovat.checked) {
          localStorage.setItem('mb_saved_loginId', id);
        } else {
          localStorage.removeItem('mb_saved_loginId');
        }
        zavritModal();
        _zobrazAdminPanel(id);
      } else {
        loginError.textContent = 'Neplatné ID nebo heslo.';
        loginError.hidden = false;
        inputHeslo.value = '';
        inputHeslo.focus();
      }
    } catch {
      loginError.textContent = 'Chyba při ověřování. Zkuste to znovu.';
      loginError.hidden = false;
    } finally {
      loginLoading.hidden = true;
      loginBtn.disabled = false;
    }
  }

  loginBtn.addEventListener('click', pokusOPrihlaseni);
  [inputId, inputHeslo].forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') pokusOPrihlaseni(); });
  });

  const btnOko = document.getElementById('btnOko');
  const cbZobrazit = document.getElementById('cbZobrazitHeslo');
  function toggleHeslo(zobrazit) {
    inputHeslo.type = zobrazit ? 'text' : 'password';
    if (btnOko) btnOko.textContent = zobrazit ? '🙈' : '👁';
    if (cbZobrazit) cbZobrazit.checked = zobrazit;
  }
  if (btnOko) btnOko.addEventListener('click', () => toggleHeslo(inputHeslo.type === 'password'));
  if (cbZobrazit) cbZobrazit.addEventListener('change', () => toggleHeslo(cbZobrazit.checked));

  const linkZapomnel = document.getElementById('linkZapomnel');
  const zapomnelMsg  = document.getElementById('zapomnel-msg');
  if (linkZapomnel && zapomnelMsg) {
    linkZapomnel.addEventListener('click', e => {
      e.preventDefault();
      zapomnelMsg.hidden = !zapomnelMsg.hidden;
    });
  }

  // ── Kontaktní formulář (tlačítko "✉ Napište nám") ──
  const btnNapsat      = document.getElementById('btnNapsat');
  const modalKontakt   = document.getElementById('modalKontakt');
  const kontaktZavrit  = document.getElementById('kontaktZavrit');
  const kontaktOdeslat = document.getElementById('kontaktOdeslat');

  if (btnNapsat && modalKontakt) {
    btnNapsat.addEventListener('click', () => { modalKontakt.hidden = false; setTimeout(() => document.getElementById('kontaktJmeno')?.focus(), 80); });
    kontaktZavrit?.addEventListener('click', () => { modalKontakt.hidden = true; });
    modalKontakt.addEventListener('click', e => { if (e.target === modalKontakt) modalKontakt.hidden = true; });

    kontaktOdeslat?.addEventListener('click', async () => {
      const jmeno = document.getElementById('kontaktJmeno').value.trim();
      const email = document.getElementById('kontaktEmail').value.trim();
      const text  = document.getElementById('kontaktText').value.trim();
      const msg   = document.getElementById('kontaktMsg');
      if (!jmeno || !text) { msg.textContent = '⚠ Vyplňte jméno a zprávu.'; msg.hidden = false; return; }
      const db = _getFirebaseDB();
      if (!db) { msg.textContent = '⚠ Nelze odeslat — zkuste info@mojebudky.cz'; msg.hidden = false; return; }
      kontaktOdeslat.disabled = true;
      try {
        await db.ref('admin_requests/zpravy').push({
          loginId: 'navstevnik', jmeno, email: email || '(neuvedeno)', text,
          ts: firebase.database.ServerValue.TIMESTAMP, vyrizeno: false
        });
        msg.style.color = '#4caf50';
        msg.textContent = '✓ Zpráva odeslána, ozve se vám co nejdříve!';
        msg.hidden = false;
        setTimeout(() => { modalKontakt.hidden = true; msg.hidden = true; kontaktOdeslat.disabled = false; document.getElementById('kontaktJmeno').value = ''; document.getElementById('kontaktEmail').value = ''; document.getElementById('kontaktText').value = ''; }, 2500);
      } catch {
        msg.textContent = '⚠ Nepodařilo se odeslat — zkuste info@mojebudky.cz';
        msg.hidden = false;
        kontaktOdeslat.disabled = false;
      }
    });
  }
});
