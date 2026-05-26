async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let spravciData = null;

async function nactiSpravce() {
  if (spravciData) return spravciData;
  const res = await fetch('data/spravci.json');
  if (!res.ok) throw new Error('Nelze načíst data správců');
  spravciData = await res.json();
  return spravciData;
}

async function overitPrihlaseni(id, heslo) {
  const spravci = await nactiSpravce();
  const hash = await sha256hex(heslo);
  return spravci[id] && spravci[id] === hash;
}

function zobrazAdminPanel(loginId) {
  const cislo = parseInt(loginId.slice(0, 3), 10);

  prihlaseneId = loginId;

  const existujici = document.getElementById('adminBanner');
  if (existujici) existujici.remove();

  const banner = document.createElement('div');
  banner.id = 'adminBanner';
  banner.className = 'admin-banner';
  banner.innerHTML = `<button id="btnOdhlasit">Odhlásit se</button>`;
  document.body.appendChild(banner);

  document.getElementById('btnOdhlasit').addEventListener('click', () => {
    banner.remove();
    spravciData = null;
    prihlaseneId = null;
    btnPrihlasit.textContent = 'Vstup pro správce';
  });

  btnPrihlasit.textContent = `Budka č. ${cislo}`;
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
        zobrazAdminPanel(id);
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
