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
  const res = await fetch('data/spravci.json?v=20260528k', { cache: 'reload' });
  if (!res.ok) throw new Error('Nelze načíst data správců');
  _authSpravciCache = await res.json();
  return _authSpravciCache;
}

async function _nactiSpravciInfo() {
  if (_spravciInfoCache) return _spravciInfoCache;
  try {
    const res = await fetch('data/spravci_info.json?v=20260528k', { cache: 'reload' });
    if (res.ok) _spravciInfoCache = await res.json();
  } catch {}
  return _spravciInfoCache;
}

async function _overitPrihlaseni(id, heslo) {
  const spravci = await _nactiAuthSpravce();
  const hash = await sha256hex(heslo);
  return spravci[id] && spravci[id] === hash;
}

async function _zobrazAdminPanel(loginId) {
  const info = await _nactiSpravciInfo();
  const spravceInfo = info && info[loginId];

  const jmeno = spravceInfo ? spravceInfo.jmeno : loginId;
  const jeAdmin = !!(spravceInfo && spravceInfo.spravce === 'admin');

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
  if (!jeAdmin && !localStorage.getItem('mb_welcomed_' + loginId)) {
    localStorage.setItem('mb_welcomed_' + loginId, '1');
    setTimeout(() => {
      _zobrazUvitaciModal(loginId, spravceInfo, budkyList, () => {
        _zobrazProfilSpravce(loginId, spravceInfo, budkaText);
      });
    }, 800);
  } else {
    _zobrazToast(`Ahoj ${osloveni}, vítám Tě v komunitě správců mých budek! 🌿 Petr`);
    if (!jeAdmin && !localStorage.getItem('mb_firstlogin_' + loginId)) {
      setTimeout(() => _zobrazProfilSpravce(loginId, spravceInfo, budkaText), 7000);
    }
  }

  if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(true);

  window._aktualniSpravce = { loginId, spravceInfo, budkyList, jeAdmin };
  window._editBudku = _zobrazEditBudky;

  const btn = document.getElementById('btnPrihlasit');
  if (btn) { btn.textContent = `Přihlášen ${jmeno} ▾`; btn.classList.add('prihlaseny'); }

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
    ${budkyMenuHTML}
    ${jeAdmin
      ? `<button class="admin-dropdown-item" data-akce="aktualita">📰 Přidat aktualitu</button>
         <div class="admin-dropdown-oddelovac"></div>
         <button class="admin-dropdown-item" data-akce="aktivita">📊 Aktivita správců</button>
         <button class="admin-dropdown-item admin-item-zadosti" data-akce="zadosti">📬 Žádosti správců <span class="admin-badge" id="adminBadge" hidden>0</span></button>`
      : `<button class="admin-dropdown-item pripravujeme" data-akce="clanek">📝 Vložit článek</button>`}
    <div class="admin-dropdown-oddelovac"></div>
    <button class="admin-dropdown-item odhlasit" data-akce="odhlasit">🚪 Odhlásit se</button>
  `;
  document.getElementById('authNavArea').appendChild(dropdown);

  if (jeAdmin) _sledujZadosti();

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
      if (btn) {
        btn.textContent = 'Vstup pro správce';
        btn.classList.remove('prihlaseny');
        btn.removeEventListener('click', btn._dropdownHandler);
      }
      return;
    }

    if (akce === 'karta' || akce === 'editSpravce') {
      _zobrazProfilSpravce(loginId, spravceInfo, budkaText);
      dropdown.classList.remove('open');
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

    if (akce === 'aktivita') {
      _zobrazAdminAktivitu();
      dropdown.classList.remove('open');
      return;
    }

    if (akce === 'aktualita') {
      _zobrazPridatAktualitu();
      dropdown.classList.remove('open');
      return;
    }

    if (item.classList.contains('pripravujeme')) {
      item.textContent = item.textContent.replace(' – Připravujeme…', '') + ' – Připravujeme…';
      setTimeout(() => { item.textContent = item.textContent.replace(' – Připravujeme…', ''); }, 2000);
    }
  });
}

function _zobrazUvitaciModal(loginId, spravceInfo, budkyList, onContinue) {
  const existujici = document.getElementById('modalUvitani');
  if (existujici) existujici.remove();

  const jmeno = spravceInfo ? spravceInfo.jmeno : loginId;

  const budkyText = budkyList.length === 1
    ? `budku č. ${budkyList[0].cislo}${budkyList[0].nazev ? ' – ' + budkyList[0].nazev : ''}`
    : `budky č. ${budkyList.map(b => b.cislo).join(', ')}`;

  const modal = document.createElement('div');
  modal.id = 'modalUvitani';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box uvitani-box">
      <div class="uvitani-logo-wrap">
        <img src="img/logo.svg" class="uvitani-logo" alt="MojeBudky">
      </div>
      <div class="uvitani-nadpis">Vítej v rodině MojeBudky! 🌿</div>
      <div class="uvitani-zprava">
        „Ahoj ${jmeno}, jsem rád, že ses připojil/a k projektu a že se poctivě staráš
        o ${budkyText}. Záleží mi na tom, aby každá měla svého poctivého správce
        a my všichni ostatní věděli, kdo v ní bydlí. Díky moc! <strong>Petr</strong>"
      </div>
      <div class="uvitani-co">
        <div class="uvitani-co-item">🏠 Edituj svoji budku — kdo v ní sídlí, foto, poznámky</div>
        <div class="uvitani-co-item">📅 Hlásej kontroly a čištění</div>
        <div class="uvitani-co-item">🗺️ Vidíš ji na mapě mezi ostatními budkami</div>
      </div>
      <div class="uvitani-actions">
        <button class="profil-btn-ulozit uvitani-btn" id="uvitaniContinue">🪪 Vyplnit profil správce →</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('uvitaniContinue').addEventListener('click', () => {
    modal.remove();
    if (onContinue) onContinue();
  });
}

function _zobrazAdminAktivitu() {
  const existujici = document.getElementById('modalAktivita');
  if (existujici) existujici.remove();
  const db = _getFirebaseDB();
  if (!db) { alert('Firebase není dostupná'); return; }

  const modal = document.createElement('div');
  modal.id = 'modalAktivita';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box">
      <button class="modal-zavrit" id="aktivitaZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">📊 Aktivita správců</div>
        <div class="profil-budka" style="color:var(--text-muted);font-size:0.9rem">posledních 50 záznamů</div>
      </div></div>
      <div class="profil-form" id="aktivitaObsah"><div style="color:var(--text-muted)">Načítám…</div></div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('aktivitaZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  db.ref('aktivita').orderByChild('ts').limitToLast(50).once('value', snap => {
    const entries = [];
    snap.forEach(child => entries.unshift(child.val()));
    const container = document.getElementById('aktivitaObsah');
    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-muted)">Zatím žádná aktivita 🌿</div>';
      return;
    }
    container.innerHTML = `<div class="aktivita-seznam">${entries.map(v => {
      const datum = v.ts ? new Date(v.ts).toLocaleDateString('cs-CZ') : '—';
      const cas   = v.ts ? new Date(v.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '';
      const budka = v.budka_cislo ? `Budka č. ${v.budka_cislo}${v.budka_nazev ? ' – ' + v.budka_nazev : ''}` : '';
      return `<div class="zadost-item">
        <strong>${v.jmeno || v.loginId}</strong>${budka ? ` · <span class="zadost-detail">${budka}</span>` : ''}<br>
        <span>${v.zprava}</span><br>
        <span class="zadost-cas">${datum} · ${cas}</span>
      </div>`;
    }).join('')}</div>`;
  });
}

function _zobrazPridatAktualitu() {
  const existujici = document.getElementById('modalAktualita');
  if (existujici) existujici.remove();
  const db = _getFirebaseDB();

  const DRUHY = [
    { id: 'konadra',   nazev: 'Sýkora koňadra' },
    { id: 'modrinka',  nazev: 'Sýkora modřinka' },
    { id: 'parukarka', nazev: 'Sýkora parukářka' },
    { id: 'vrabec',    nazev: 'Vrabec domácí' },
    { id: 'babka',     nazev: 'Sýkora babka' },
    { id: 'uhelnicek', nazev: 'Sýkora úhelníček' },
    { id: 'slavik',    nazev: 'Slavík obecný' },
  ];
  const NAZVY = Object.fromEntries(DRUHY.map(d => [d.id, d.nazev]));

  const dnes = new Date();
  const datumDefault = `${dnes.getDate()}. ${dnes.getMonth() + 1}. ${dnes.getFullYear()}`;

  const modal = document.createElement('div');
  modal.id = 'modalAktualita';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box" style="max-width:560px">
      <button class="modal-zavrit" id="aktualitaZavrit">×</button>
      <div class="profil-header"><div class="profil-header-text">
        <div class="profil-nadpis">📰 Přidat aktualitu</div>
      </div></div>
      <div class="profil-form">
        <div class="profil-row">
          <div class="profil-field profil-field--wide">
            <label>Druh ptáka</label>
            <select id="aktPtak" class="profil-select">
              ${DRUHY.map(d => `<option value="${d.id}">${d.nazev}</option>`).join('')}
            </select>
          </div>
          <div class="profil-field">
            <label>Č. budky</label>
            <input type="number" id="aktBudka" min="1" max="999" placeholder="např. 69">
          </div>
        </div>
        <div class="profil-row">
          <div class="profil-field profil-field--wide">
            <label>Datum</label>
            <input type="text" id="aktDatum" value="${datumDefault}" placeholder="14. 10. 2024">
          </div>
          <div class="profil-field">
            <label>Čas</label>
            <input type="text" id="aktCas" placeholder="09:15">
          </div>
        </div>
        <div class="profil-field">
          <label>Text aktuality</label>
          <textarea id="aktText" rows="3" placeholder="Popis aktuality…"></textarea>
        </div>
        <div id="aktMsg" class="profil-ulozeno" hidden></div>
      </div>
      <div class="profil-actions">
        <button class="profil-btn-ulozit" id="aktUlozit">💾 Uložit aktualitu</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('aktualitaZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('aktUlozit').addEventListener('click', async () => {
    const ikona  = document.getElementById('aktPtak').value;
    const budkaId = parseInt(document.getElementById('aktBudka').value) || null;
    const datum  = document.getElementById('aktDatum').value.trim();
    const cas    = document.getElementById('aktCas').value.trim();
    const text   = document.getElementById('aktText').value.trim();
    const msg    = document.getElementById('aktMsg');
    msg.hidden   = true;

    if (!text)  { msg.textContent = '⚠ Zadejte text aktuality'; msg.hidden = false; return; }
    if (!datum) { msg.textContent = '⚠ Zadejte datum'; msg.hidden = false; return; }

    const polozka = {
      ikona, ptak: NAZVY[ikona] || ikona, text, datum,
      cas: cas || null, budka_id: budkaId,
      ts: typeof firebase !== 'undefined' ? firebase.database.ServerValue.TIMESTAMP : Date.now(),
    };

    if (db) {
      try {
        await db.ref('aktuality').push(polozka);
        msg.textContent = '✓ Aktualita uložena!';
        msg.hidden = false;
        setTimeout(() => modal.remove(), 1500);
      } catch { msg.textContent = '⚠ Nepodařilo se uložit'; msg.hidden = false; }
    } else {
      msg.textContent = '⚠ Firebase není dostupná';
      msg.hidden = false;
    }
  });
}

function _sledujZadosti() {
  const db = _getFirebaseDB();
  if (!db) return;
  db.ref('admin_requests').on('value', snap => {
    const data = snap.val() || {};
    let pocet = 0;
    Object.values(data).forEach(kategorie => {
      if (typeof kategorie === 'object') {
        Object.values(kategorie).forEach(z => { if (!z.vyrizeno) pocet++; });
      }
    });
    const badge = document.getElementById('adminBadge');
    if (!badge) return;
    if (pocet > 0) { badge.textContent = pocet; badge.hidden = false; }
    else badge.hidden = true;
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
    ['gps', 'druhy'].forEach(typ => {
      const kat = data[typ] || {};
      const polozky = Object.entries(kat).filter(([,v]) => !v.vyrizeno);
      if (!polozky.length) return;
      html += `<div class="zadosti-skupina"><div class="zadosti-typ">${typ === 'gps' ? '📍 Opravy GPS' : '🐦 Nové druhy'}</div>`;
      polozky.forEach(([klic, z]) => {
        const cas = z.ts ? new Date(z.ts).toLocaleString('cs-CZ') : '';
        if (typ === 'gps') {
          html += `<div class="zadost-item" data-typ="${typ}" data-klic="${klic}">
            <strong>Budka č. ${z.budka_cislo}</strong> – správce ${z.jmeno || z.spravce}<br>
            <span class="zadost-detail">Nové souřadnice: ${z.nova_lat}, ${z.nova_lng}</span><br>
            <span class="zadost-cas">${cas}</span>
            <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✓ Vyřízeno</button>
          </div>`;
        } else {
          html += `<div class="zadost-item" data-typ="${typ}" data-klic="${klic}">
            <strong>Druh: ${z.druh}</strong> – správce ${z.spravce}<br>
            <span class="zadost-cas">${cas}</span>
            <button class="zadost-btn-ok" data-typ="${typ}" data-klic="${klic}">✓ Vyřízeno</button>
          </div>`;
        }
      });
      html += '</div>';
    });
    container.innerHTML = html || '<div style="color:var(--text-muted)">Žádné čekající žádosti 🎉</div>';

    container.addEventListener('click', async e => {
      const btn = e.target.closest('.zadost-btn-ok');
      if (!btn) return;
      await db.ref(`admin_requests/${btn.dataset.typ}/${btn.dataset.klic}/vyrizeno`).set(true);
      btn.closest('.zadost-item').style.opacity = '0.4';
      btn.disabled = true;
      btn.textContent = '✓ Hotovo';
    });
  });
}

function _nacistProfilLocal(loginId) {
  try { return JSON.parse(localStorage.getItem('mb_profil_' + loginId) || 'null'); } catch { return null; }
}

function _ulozitProfilLocal(loginId, data) {
  localStorage.setItem('mb_profil_' + loginId, JSON.stringify(data));
}

function _zobrazProfilSpravce(loginId, info, budkaText) {
  const ulozeny = _nacistProfilLocal(loginId);
  const d = Object.assign({}, info, ulozeny);

  const existujici = document.getElementById('modalProfil');
  if (existujici) existujici.remove();

  const modal = document.createElement('div');
  modal.id = 'modalProfil';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box profil-box">
      <button class="modal-zavrit" id="profilZavrit">×</button>

      <div class="profil-header">
        <div class="profil-foto-wrap">
          <img id="profilFotoNahled" src="${d.foto || 'img/Favikon.png'}" class="profil-foto" alt="Foto správce">
          <label class="profil-foto-btn" title="Nahrát nebo vyfotit">
            📷
            <input type="file" id="profilFotoInput" accept="image/*" capture="environment" style="display:none">
          </label>
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
              <span class="profil-hint profil-narozeniny" title="Popřejeme Vám k narozeninám! 🎂">🎂 popřejeme!</span>
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
            <label>E-mail</label>
            <input type="email" id="pEmail" value="${d.email || ''}">
          </div>
        </div>
      </div>

      <div class="profil-actions">
        <button class="profil-btn-ulozit" id="profilUlozit">💾 Uložit změny</button>
        <span class="profil-ulozeno" id="profilUlozeno" hidden>✓ Uloženo!</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

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

  document.getElementById('profilFotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('profilFotoNahled').src = ev.target.result; };
    reader.readAsDataURL(file);
  });

  document.getElementById('profilUlozit').addEventListener('click', async () => {
    const foto = document.getElementById('profilFotoNahled').src;
    const data = {
      titul_pred:     document.getElementById('pTitulPred').value.trim(),
      jmeno:          document.getElementById('pJmeno').value.trim(),
      prijmeni:       document.getElementById('pPrijmeni').value.trim(),
      titul_za:       document.getElementById('pTitulZa').value.trim(),
      osloveni:       document.getElementById('pOsloveni').value.trim(),
      datum_narozeni: document.getElementById('pDatum').value,
      telefon:        document.getElementById('pTelefon').value.trim(),
      email:          document.getElementById('pEmail').value.trim(),
      foto:           foto.startsWith('data:') ? foto : null,
    };
    const fbOK = await _ulozitProfilFirebase(loginId, data);
    _ulozitProfilLocal(loginId, data);
    localStorage.setItem('mb_firstlogin_' + loginId, '1');
    const msg = document.getElementById('profilUlozeno');
    msg.textContent = fbOK ? '✓ Uloženo do cloudu!' : '✓ Uloženo lokálně';
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 2500);
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
              ${ulozeno.foto ? `<img src="${ulozeno.foto}" class="eb-foto-nahled" id="ebFotoNahled" alt="Foto budky">` : `<div class="eb-foto-placeholder" id="ebFotoNahled">📷</div>`}
              <label class="eb-foto-btn" for="ebFotoInput">📷 ${ulozeno.foto ? 'Změnit foto' : 'Přidat foto'}</label>
              <input type="file" id="ebFotoInput" accept="image/*" capture="environment" style="display:none">
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

function _zobrazToast(text) {
  const existujici = document.getElementById('adminToast');
  if (existujici) existujici.remove();

  const toast = document.createElement('div');
  toast.id = 'adminToast';
  toast.className = 'admin-toast';
  toast.textContent = text;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('admin-toast--show'), 50);
  setTimeout(() => {
    toast.classList.remove('admin-toast--show');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

document.addEventListener('DOMContentLoaded', () => {
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
    inputId.value = '';
    inputHeslo.value = '';
    loginError.hidden = true;
    loginLoading.hidden = true;
    loginBtn.disabled = false;
    setTimeout(() => inputId.focus(), 50);
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
});
