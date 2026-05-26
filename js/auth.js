async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let spravciData = null;
let spravciInfo = null;

async function nactiSpravce() {
  if (spravciData) return spravciData;
  const res = await fetch('data/spravci.json');
  if (!res.ok) throw new Error('Nelze načíst data správců');
  spravciData = await res.json();
  return spravciData;
}

async function nactiSpravciInfo() {
  if (spravciInfo) return spravciInfo;
  try {
    const res = await fetch('data/spravci_info.json');
    if (res.ok) spravciInfo = await res.json();
  } catch {}
  return spravciInfo || {};
}

async function overitPrihlaseni(id, heslo) {
  const spravci = await nactiSpravce();
  const hash = await sha256hex(heslo);
  return spravci[id] && spravci[id] === hash;
}

document.addEventListener('DOMContentLoaded', () => {
  let prihlaseneId = null;
  const btnPrihlasit = document.getElementById('btnPrihlasit');
  const modal        = document.getElementById('modalPrihlaseni');
  const modalZavrit  = document.getElementById('modalZavrit');
  const loginBtn     = document.getElementById('loginBtn');
  const inputId      = document.getElementById('loginId');
  const inputHeslo   = document.getElementById('loginHeslo');
  const loginError   = document.getElementById('loginError');
  const loginLoading = document.getElementById('loginLoading');

  function otevritModal() {
    if (prihlaseneId !== null) return;
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

  function odhlasit() {
    const banner = document.getElementById('adminBanner');
    if (banner) banner.remove();
    spravciData = null;
    spravciInfo = null;
    prihlaseneId = null;
    btnPrihlasit.textContent = 'Vstup pro správce';
    btnPrihlasit.classList.remove('prihlaseny');
    btnPrihlasit.onclick = null;
    btnPrihlasit.addEventListener('click', otevritModal);
  }

  async function zobrazAdminPanel(loginId) {
    prihlaseneId = loginId;

    const info = await nactiSpravciInfo();
    const zaznam = info[loginId] || {};
    const jmeno      = zaznam.jmeno || zaznam.spravce || loginId;
    const bCislo     = zaznam.budka_cislo ?? parseInt(loginId.slice(0, 3), 10);
    const bNazev     = zaznam.budka_nazev || '';
    const bLabel     = bNazev ? `č. ${bCislo} – ${bNazev}` : `č. ${bCislo}`;

    // Navbar tlačítko
    btnPrihlasit.textContent = `Přihlášen ${jmeno}`;
    btnPrihlasit.classList.add('prihlaseny');
    btnPrihlasit.removeEventListener('click', otevritModal);
    btnPrihlasit.onclick = null;

    // Admin banner
    const existujici = document.getElementById('adminBanner');
    if (existujici) existujici.remove();

    const banner = document.createElement('div');
    banner.id = 'adminBanner';
    banner.className = 'admin-banner';
    banner.innerHTML = `
      <span class="admin-budka-link">Administrace budky ${bLabel}</span>
      <button id="btnOdhlasit">Odhlásit se</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('btnOdhlasit').addEventListener('click', odhlasit);
  }

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
      loginError.textContent = 'ID musí být číslo (1–6 číslic).';
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
      const ok = await overitPrihlaseni(id, heslo);
      if (ok) {
        zavritModal();
        await zobrazAdminPanel(id);
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
});
