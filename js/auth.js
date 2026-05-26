async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let _authSpravciCache = null;

async function _nactiAuthSpravce() {
  if (_authSpravciCache) return _authSpravciCache;
  const res = await fetch('data/spravci.json');
  if (!res.ok) throw new Error('Nelze načíst data správců');
  _authSpravciCache = await res.json();
  return _authSpravciCache;
}

async function _overitPrihlaseni(id, heslo) {
  const spravci = await _nactiAuthSpravce();
  const hash = await sha256hex(heslo);
  return spravci[id] && spravci[id] === hash;
}

function _zobrazAdminPanel(loginId) {
  const cislo = parseInt(loginId.slice(0, 3), 10);

  const existujici = document.getElementById('adminBanner');
  if (existujici) existujici.remove();

  const banner = document.createElement('div');
  banner.id = 'adminBanner';
  banner.className = 'admin-banner';
  banner.innerHTML = `
    <span>Přihlášen jako správce &nbsp;<strong>Budka č. ${cislo}</strong></span>
    <button id="btnOdhlasit">Odhlásit se</button>
  `;
  document.body.appendChild(banner);

  if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(true);

  document.getElementById('btnOdhlasit').addEventListener('click', () => {
    banner.remove();
    _authSpravciCache = null;
    if (typeof window._presenceSetAdmin === 'function') window._presenceSetAdmin(false);
    const btn = document.getElementById('btnPrihlasit');
    if (btn) btn.textContent = 'Vstup pro správce';
  });

  const btn = document.getElementById('btnPrihlasit');
  if (btn) btn.textContent = `Budka ${cislo} ✓`;
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

    if (!/^\d{6}$/.test(id)) {
      loginError.textContent = 'ID musí mít přesně 6 číslic.';
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
