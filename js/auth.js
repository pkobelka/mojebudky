async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let _authSpravciCache = null;
let _spravciInfoCache = null;

async function _nactiAuthSpravce() {
  if (_authSpravciCache) return _authSpravciCache;
  const res = await fetch('data/spravci.json');
  if (!res.ok) throw new Error('Nelze načíst data správců');
  _authSpravciCache = await res.json();
  return _authSpravciCache;
}

async function _nactiSpravciInfo() {
  if (_spravciInfoCache) return _spravciInfoCache;
  try {
    const res = await fetch('data/spravci_info.json');
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
  const budkaCislo = spravceInfo ? spravceInfo.budka_cislo : parseInt(loginId, 10);
  const budkaNazev = spravceInfo ? spravceInfo.budka_nazev : '';
  const budkaText = budkaNazev && budkaNazev !== String(budkaCislo)
    ? `Budka č. ${budkaCislo} – ${budkaNazev}`
    : `Budka č. ${budkaCislo}`;

  const existujici = document.getElementById('adminBanner');
  if (existujici) existujici.remove();

  const profilLocal = _nacistProfilLocal(loginId);
  const osloveni = (profilLocal && profilLocal.osloveni) ? profilLocal.osloveni
    : (spravceInfo && spravceInfo.osloveni) ? spravceInfo.osloveni : _vokativ(jmeno);
  _zobrazToast(`Ahoj ${osloveni}, vítám Tě v komunitě správců mých budek! 🌿 Petr`);

  const jePoprve = !localStorage.getItem('mb_firstlogin_' + loginId);
  if (jePoprve) {
    setTimeout(() => _zobrazProfilSpravce(loginId, spravceInfo, budkaText), 4500);
  }

  if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(true);

  const btn = document.getElementById('btnPrihlasit');
  if (btn) { btn.textContent = `Přihlášen ${jmeno} ▾`; btn.classList.add('prihlaseny'); }

  const existujiciDropdown = document.getElementById('adminDropdown');
  if (existujiciDropdown) existujiciDropdown.remove();

  const dropdown = document.createElement('div');
  dropdown.id = 'adminDropdown';
  dropdown.className = 'admin-dropdown';
  dropdown.innerHTML = `
    <div class="admin-dropdown-hlavicka">👤 ${jmeno} &nbsp;·&nbsp; ${budkaText}</div>
    <button class="admin-dropdown-item" data-akce="karta">🪪 Karta správce / Editovat</button>
    <button class="admin-dropdown-item pripravujeme" data-akce="editBudky">🏠 Editovat budky</button>
    <button class="admin-dropdown-item pripravujeme" data-akce="clanek">📝 Vložit článek</button>
    <div class="admin-dropdown-oddelovac"></div>
    <button class="admin-dropdown-item odhlasit" data-akce="odhlasit">🚪 Odhlásit se</button>
  `;
  document.getElementById('authNavArea').appendChild(dropdown);

  if (btn) {
    btn.removeEventListener('click', btn._loginHandler);
    btn._dropdownHandler = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    };
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

    if (item.classList.contains('pripravujeme')) {
      item.textContent = item.textContent.replace(' – Připravujeme…', '') + ' – Připravujeme…';
      setTimeout(() => { item.textContent = item.textContent.replace(' – Připravujeme…', ''); }, 2000);
    }
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

  document.getElementById('profilZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('profilFotoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('profilFotoNahled').src = ev.target.result; };
    reader.readAsDataURL(file);
  });

  document.getElementById('profilUlozit').addEventListener('click', () => {
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
    _ulozitProfilLocal(loginId, data);
    localStorage.setItem('mb_firstlogin_' + loginId, '1');
    const msg = document.getElementById('profilUlozeno');
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 2500);
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
  }, 4000);
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
