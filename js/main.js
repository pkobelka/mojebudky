const DNY = ['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'];
const MESICE = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];

const PREZDIVKY = {
  'Jiří': ['Jirka'], 'Josef': ['Pepa'], 'Jan': ['Honza'],
  'Tomáš': ['Tomášek'], 'Václav': ['Vašek'], 'Miroslav': ['Miro'],
  'Petra': ['Peťa'], 'Kateřina': ['Katka'], 'Anna': ['Anička'],
  'Vladimíra': ['Vlaďka'], 'Gabriela': ['Gábi'],
  'Dobroslav': ['Dobroš'],
  'Ladislav': ['Laďa'],
  'Vítězslav': ['Víťa'],
  'Jaroslav': ['Rafan'],
  'Lubomír': ['Luboš'],
};
const KANONICKY = {};
for (const [k, arr] of Object.entries(PREZDIVKY)) arr.forEach(p => KANONICKY[p] = k);

let spravciJmena = [];
let _statickeAktuality = [];
let _aktualityListenerSet = false;
let _partneriData = [];
let _podekovaniData = [];
let _narozeniniceDnes = [];  // správci s narozeninami dnes

function pluralSpravcu(n) {
  if (n === 1) return '1 správce';
  if (n >= 2 && n <= 4) return `${n} správci`;
  return `${n} správců`;
}

function najdiSvatekSpravce(svarekJmeno) {
  if (!svarekJmeno || !spravciJmena.length) return [];
  const kanon = KANONICKY[svarekJmeno] || svarekJmeno;
  const hledej = new Set([kanon, svarekJmeno, ...(PREZDIVKY[kanon] || [])]);
  return spravciJmena.filter(s => hledej.has(s.jmeno));
}

async function nactiSpravce() {
  try {
    const res = await fetch('data/spravci_jmena.json?v=20260527k');
    spravciJmena = await res.json();
  } catch(e) {
    console.error('Chyba načítání správce:', e);
  }
  await nactiNarozeniny();
  aktualizujListu();
}

async function nactiNarozeniny() {
  try {
    const res = await fetch('data/narozeniny.json?v=20260601');
    if (!res.ok) return;
    const data = await res.json();
    const d = new Date();
    const klic = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    _narozeniniceDnes = data[klic] || [];
  } catch {}
}

function formatDatum(d) {
  return `${d.getDate()}. ${MESICE[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCas(d) {
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}

function aktualizujListu() {
  const d = new Date();
  const svarek = getDnešníSvátek();
  const bar = document.getElementById('infoBar');
  if (!bar) return;

  const cal = `📅 ${DNY[d.getDay()].charAt(0).toUpperCase() + DNY[d.getDay()].slice(1)} ${formatDatum(d)}`;
  const oslavenci = svarek ? najdiSvatekSpravce(svarek) : [];
  const oslavenciText = oslavenci.length > 0
    ? ` &nbsp;<span class="bar-gratulace">🎂 slaví ho ${pluralSpravcu(oslavenci.length)} z naší komunity!</span>`
    : '';
  const sva = svarek ? `&nbsp;| Svátek má: <strong>${svarek}</strong>${oslavenciText}` : '';

  const narozBar = _narozeniniceDnes.length > 0
    ? `&nbsp;| 🎂 <span class="bar-narozeniny">Narozeniny má: <strong>${_narozeniniceDnes.map(n => n.jmeno).join(', ')}</strong> – gratulujeme a děkujeme za péči o budky!</span>`
    : '';

  bar.innerHTML = `<span class="bar-left">${cal}${sva}${narozBar}</span>
    <span class="bar-right">⏰ <span id="liveCas">${formatCas(d)}</span> &nbsp;|&nbsp; 🌿 Pomáháme ptactvu nejen po celé ČR</span>`;
}

function tickCas() {
  const el = document.getElementById('liveCas');
  if (el) {
    const d = new Date();
    el.textContent = formatCas(d);
  }
}

async function nactiStatistiky() {
  try {
    const res = await fetch('data/statistiky.json?v=20260527k');
    const data = await res.json();

    document.getElementById('stat-osidlenych').textContent = data.osidlenych;
    document.getElementById('stat-spravcu').textContent = data.spravcuRegistrovano;

    const ted = new Date();
    const cas = `${ted.getDate()}.${ted.getMonth()+1}. ${String(ted.getHours()).padStart(2,'0')}:${String(ted.getMinutes()).padStart(2,'0')}`;
    document.getElementById('stat-aktualizace').textContent = cas;

    nactiAktuality(data.aktuality);
    nactiPartnery(data.partneri);
    nactiPodekovani(data.podekovani);
    nactiDruhyPtaku(data.druhy_ptaku);
    window._druhy_ptaku_base = data.druhy_ptaku;
    window._nactiDruhyPtaku  = nactiDruhyPtaku;

    const nav = data.navstevnost;
    const elCelkem = document.getElementById('navst-celkem');
    const elDnes   = document.getElementById('navst-dnes');
    const elVcera  = document.getElementById('navst-vcera');
    if (elCelkem) elCelkem.textContent = nav.celkem.toLocaleString('cs-CZ');
    if (elDnes)   elDnes.textContent   = nav.dnes;
    if (elVcera)  elVcera.textContent  = nav.vcera;
  } catch(e) {
    console.error('Chyba načítání statistik:', e);
  }
}

const BIRD_ICONS = {
  konadra: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <ellipse cx="18" cy="30" rx="11" ry="15" fill="#f5c800" transform="rotate(-8,18,30)"/>
    <ellipse cx="32" cy="30" rx="11" ry="15" fill="#f5c800" transform="rotate(8,32,30)"/>
    <rect x="20" y="18" width="10" height="22" rx="5" fill="#1a1f2e"/>
    <ellipse cx="25" cy="17" rx="13" ry="12" fill="#1a1f2e"/>
    <ellipse cx="13" cy="21" rx="6" ry="5" fill="#fff" opacity="0.9"/>
    <ellipse cx="37" cy="21" rx="6" ry="5" fill="#fff" opacity="0.9"/>
    <circle cx="19" cy="14" r="1.2" fill="#fff"/>
    <circle cx="33" cy="14" r="1.2" fill="#fff"/>
    <path d="M21,27 L29,27 L25,33 Z" fill="#ff9999"/>
  </svg>`,
  modrinka: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <ellipse cx="25" cy="34" rx="13" ry="11" fill="#ffd700"/>
    <rect x="19" y="20" width="12" height="18" rx="6" fill="#1a5a9a"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#1a5a9a"/>
    <rect x="13" y="12" width="24" height="6" rx="3" fill="#4ab0e8"/>
    <ellipse cx="15" cy="23" rx="5" ry="4" fill="#fff" opacity="0.9"/>
    <ellipse cx="35" cy="23" rx="5" ry="4" fill="#fff" opacity="0.9"/>
    <circle cx="21" cy="15" r="1.2" fill="#fff"/>
    <circle cx="31" cy="15" r="1.2" fill="#fff"/>
    <path d="M22,28 L28,28 L25,34 Z" fill="#ff9999"/>
  </svg>`,
  parukarka: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <ellipse cx="25" cy="32" rx="12" ry="10" fill="#e8e0d0"/>
    <rect x="19" y="20" width="12" height="16" rx="6" fill="#5a5a5a"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#2a2a2a"/>
    <path d="M22,8 L25,18 L28,8 C27,4 23,4 22,8Z" fill="#2a2a2a"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#fff" opacity="0.8"/>
    <ellipse cx="36" cy="22" rx="5" ry="4" fill="#fff" opacity="0.8"/>
    <circle cx="21" cy="14" r="1.2" fill="#fff"/>
    <circle cx="31" cy="14" r="1.2" fill="#fff"/>
    <path d="M22,27 L28,27 L25,32 Z" fill="#ffcc88"/>
  </svg>`,
  vrabec: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <ellipse cx="25" cy="32" rx="13" ry="11" fill="#c8a060"/>
    <rect x="19" y="20" width="12" height="16" rx="6" fill="#8B6040"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#6B4020"/>
    <rect x="13" y="13" width="24" height="5" rx="2.5" fill="#c8a060"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#e8c890" opacity="0.8"/>
    <ellipse cx="36" cy="22" rx="5" ry="4" fill="#e8c890" opacity="0.8"/>
    <circle cx="21" cy="14" r="1.2" fill="#fff"/>
    <circle cx="31" cy="14" r="1.2" fill="#fff"/>
    <path d="M22,27 L28,27 L25,32 Z" fill="#dda060"/>
  </svg>`,
  sojka: `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <ellipse cx="25" cy="32" rx="13" ry="11" fill="#d4b8f0"/>
    <rect x="19" y="20" width="12" height="16" rx="6" fill="#6644aa"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#334488"/>
    <rect x="10" y="12" width="30" height="5" rx="2.5" fill="#88aadd"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#eeddff" opacity="0.9"/>
    <ellipse cx="36" cy="22" rx="5" ry="4" fill="#eeddff" opacity="0.9"/>
    <circle cx="21" cy="14" r="1.2" fill="#fff"/>
    <circle cx="31" cy="14" r="1.2" fill="#fff"/>
    <path d="M22,27 L28,27 L25,32 Z" fill="#ffcc88"/>
  </svg>`
};

const BIRD_KEY_MAP = {
  'Sýkora koňadra': 'konadra',
  'Sýkora modřinka': 'modrinka',
  'Sýkora parukářka': 'parukarka',
  'Vrabec domácí': 'vrabec',
  'Sojka obecná': 'sojka'
};

function _renderAktualityPanel(staticke, liveEntries) {
  const el = document.getElementById('aktualityList');
  if (!el) return;

  const liveHTML = liveEntries.map(v => {
    const datum = v.ts ? new Date(v.ts).toLocaleDateString('cs-CZ') : '—';
    const cas = v.ts ? new Date(v.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '';
    const budkaNazevStr = (v.budka_nazev && v.budka_nazev !== String(v.budka_cislo)) ? ` – ${v.budka_nazev}` : '';
    return `<div class="pribeh-item pribeh-item--live">
      <div class="pribeh-ikona">🏠</div>
      <div class="pribeh-text">
        <div class="pribeh-druh">Správce ${v.jmeno}</div>
        <div class="pribeh-popis">${v.zprava}</div>
        <div class="pribeh-datum">${datum} · ${cas}</div>
        ${v.budka_cislo ? `<a class="aktualita-link" data-budka="${v.budka_cislo}" href="#">→ Budka č. ${v.budka_cislo}${budkaNazevStr}</a>` : ''}
      </div>
    </div>`;
  }).join('');

  const staticHTML = staticke.map(p => `
    <div class="pribeh-item">
      <div class="pribeh-ikona">${BIRD_ICONS[p.ikona] || BIRD_ICONS.konadra}</div>
      <div class="pribeh-text">
        <div class="pribeh-druh">${p.ptak}</div>
        <div class="pribeh-popis">${p.text}</div>
        <div class="pribeh-datum">${p.datum}${p.cas ? ` · ${p.cas}` : ''}</div>
        ${p.budka_id ? `<a class="aktualita-link" data-budka="${p.budka_id}" href="#">→ Budka č. ${p.budka_id}</a>` : ''}
      </div>
    </div>`).join('');

  el.innerHTML = liveHTML + staticHTML;
}

function _poslechniAktualityFirebase() {
  if (_aktualityListenerSet) return;
  const db = typeof firebase !== 'undefined' ? firebase.database() : null;
  if (!db) return;
  _aktualityListenerSet = true;

  let _liveEntries = [];
  let _fbAktuality = [];

  function _rerender() {
    _renderAktualityPanel([..._fbAktuality, ..._statickeAktuality], _liveEntries);
  }

  db.ref('aktivita').orderByChild('ts').limitToLast(10).on('value', snap => {
    _liveEntries = [];
    snap.forEach(child => { _liveEntries.unshift(child.val()); });
    _rerender();
  });

  db.ref('aktuality').orderByChild('ts').limitToLast(20).on('value', snap => {
    _fbAktuality = [];
    snap.forEach(child => { _fbAktuality.unshift(child.val()); });
    _rerender();
  });
}

function nactiAktuality(aktuality) {
  _statickeAktuality = aktuality || [];
  const el = document.getElementById('aktualityList');
  if (el && !el._clickSet) {
    el._clickSet = true;
    el.addEventListener('click', e => {
      const link = e.target.closest('.aktualita-link');
      if (!link) return;
      e.preventDefault();
      const cislo = parseInt(link.dataset.budka, 10);
      focusBudka(cislo);
      document.querySelector('.map-wrapper').scrollIntoView({ behavior: 'smooth' });
    });
  }
  _renderAktualityPanel(_statickeAktuality, []);
  _poslechniAktualityFirebase();
}

function nactiPartnery(partneri) {
  _partneriData = partneri || [];
  const el = document.getElementById('partneriList');
  if (!el || !partneri) return;
  el.innerHTML = partneri.map(p => {
    const obsah = p.logo
      ? `<img src="${p.logo}" alt="${p.nazev}" class="partner-logo">`
      : p.nazev;
    return p.url
      ? `<a href="${p.url}" class="partner-item${p.logo ? ' partner-item--logo' : ''}" target="_blank" rel="noopener" title="${p.nazev}">${obsah}</a>`
      : `<span class="partner-item${p.logo ? ' partner-item--logo' : ''}" title="${p.nazev}">${obsah}</span>`;
  }).join('') + `<a href="mailto:info@mojebudky.cz" class="partner-item partner-item--logo partner-placeholder" title="Staňte se partnerem projektu MojeBudky.cz">✨&nbsp;Tady může být<br>i Vaše logo</a>`;
}

function nactiPodekovani(podekovani) {
  _podekovaniData = podekovani || [];
  const wrap = document.getElementById('podekovaniWrap');
  const el = document.getElementById('podekovaniList');
  if (!wrap || !el || !podekovani || !podekovani.length) return;
  el.innerHTML = podekovani.map(p => {
    const jmeno = typeof p === 'string' ? p : p.jmeno;
    const popis = typeof p === 'object' && p.popis ? p.popis : null;
    if (popis) {
      return `<span class="podekovani-item podekovani-item--ma-text" tabindex="0" title="${popis}">${jmeno}<span class="pod-bublina">${popis}</span></span>`;
    }
    return `<span class="podekovani-item">${jmeno}</span>`;
  }).join('');
  wrap.style.display = 'block';
}

function _zobrazPartneriModal() {
  const existujici = document.getElementById('modalPartneri');
  if (existujici) { existujici.remove(); return; }

  const logoHTML = _partneriData.map(p => {
    const img = p.logo
      ? `<img src="${p.logo}" alt="${p.nazev}" class="pm-logo-img">`
      : `<span class="pm-logo-text">${p.nazev}</span>`;
    return p.url
      ? `<a href="${p.url}" class="pm-logo-item" target="_blank" rel="noopener" title="${p.nazev}">${img}</a>`
      : `<span class="pm-logo-item" title="${p.nazev}">${img}</span>`;
  }).join('');

  const podHTML = _podekovaniData.map((p, i) => {
    const jmeno = typeof p === 'string' ? p : p.jmeno;
    const popis = typeof p === 'object' && p.popis ? p.popis : null;
    return `<div class="pm-pod-osoba" data-idx="${i}">
      <button type="button" class="pm-pod-jmeno${popis ? ' pm-pod-jmeno--ma-text' : ''}">${jmeno}</button>
      ${popis ? `<div class="pm-bublina">${popis}</div>` : ''}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'modalPartneri';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box pm-box">
      <button class="modal-zavrit" id="modalPartneriZavrit">×</button>
      <div class="pm-header">🤝 Podporovatelé projektu MojeBudky.cz</div>
      <div class="pm-podpora">
        <div class="pm-podpora-nadpis">💛 Fandíte projektu MojeBudky? <img src="img/logo.svg" alt="" class="podpora-logo-img"></div>
        <p>Celý projekt roste a s ním i radost z každého nového ptačího souseda. Abychom mohli mapu udržovat v chodu, posílat zprávy z terénu a starat se o bezpečný chod celé aplikace, neobejde se to bez provozních nákladů (např. za hosting a zabezpečení webu).</p>
        <p>Všechno ostatní kolem výroby a kontroly budek děláme s našimi správci čistě dobrovolně a rádi ve svém volném čase. Pokud byste chtěli provoz webu finančně podpořit – ať už jako firma (rádi vás přidáme mezi partnery), nebo jako fanoušek přírody – budeme moc vděční za jakýkoliv příspěvek.</p>
        <div class="pm-podpora-jak">Jak můžete pomoci?</div>
        <p>Staňte se podporovatelem: Napište nám na <a href="mailto:info@mojebudky.cz">info@mojebudky.cz</a> a domluvíme se na umístění vašeho loga.</p>
      </div>
      <div class="pm-loga">${logoHTML}</div>
      <div class="pm-podekovani">
        <div class="pm-pod-label">🙏 Poděkování</div>
        <div class="pm-pod-grid">${podHTML}</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('modalPartneriZavrit').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.pm-pod-jmeno').forEach(btn => {
    btn.addEventListener('click', () => {
      const bublina = btn.nextElementSibling;
      if (!bublina || !bublina.classList.contains('pm-bublina')) return;
      const jeOtevrena = bublina.classList.contains('pm-bublina--open');
      modal.querySelectorAll('.pm-bublina').forEach(b => b.classList.remove('pm-bublina--open'));
      if (!jeOtevrena) bublina.classList.add('pm-bublina--open');
    });
  });
}

function nactiDruhyPtaku(druhy) {
  const el = document.getElementById('druhyPanel');
  if (!el || !druhy || !druhy.length) return;

  const elStatDruhu = document.getElementById('stat-druhu');
  if (elStatDruhu) elStatDruhu.textContent = druhy.filter(d => d.pocet > 0).length;

  const elIkony = document.getElementById('stat-druhu-ikony');
  if (elIkony) {
    const top4 = [...druhy].sort((a, b) => b.pocet - a.pocet).slice(0, 4);
    elIkony.innerHTML = top4.map(d => {
      const key = BIRD_KEY_MAP[d.nazev] || 'konadra';
      return BIRD_ICONS[key].replace(/width="38" height="38"/, 'width="22" height="22"');
    }).join('');
  }

  const aktivnich = druhy.filter(d => d.pocet > 0).length;
  const druhSlovo = aktivnich === 1 ? 'druh' : aktivnich <= 4 ? 'druhy' : 'druhů';
  el.innerHTML = `
    <div class="druhy-title-row">
      <span class="druhy-title">🐦 Druhy ptáků v budkách</span>
      <button class="druhy-filter-reset" id="druhyFilterReset" hidden title="Zrušit filtr mapy">× Zrušit filtr</button>
    </div>
    <div class="druhy-intro">Aktuálně evidujeme v budkách tyto <strong>${aktivnich} ${druhSlovo}</strong>:</div>
    <div class="druhy-list" id="druhyList">
      ${druhy.map(d => {
        const key = BIRD_KEY_MAP[d.nazev] || 'konadra';
        const icon = BIRD_ICONS[key].replace(/width="38" height="38"/, 'width="28" height="28"');
        const mapBtn = d.pocet > 0
          ? `<button class="druh-mapa-btn" data-nazev="${d.nazev.replace(/"/g,'&quot;')}" title="Zobrazit na mapě" tabindex="-1">🗺</button>`
          : '';
        return `<div class="druh-item" data-id="${d.id}" data-nazev="${d.nazev.replace(/"/g,'&quot;')}">
          <div class="druh-svg">${icon}</div>
          <span class="druh-nazev">${d.nazev}</span>
          <span class="druh-pocet${d.pocet > 0 ? ' druh-pocet--klik' : ''}" data-nazev="${d.nazev.replace(/"/g,'&quot;')}" title="${d.pocet > 0 ? 'Zobrazit na mapě' : ''}">${d.pocet}</span><span class="druh-pocet-label">${d.pocet === 1 ? 'budka' : d.pocet <= 4 ? 'budky' : 'budek'}</span>${mapBtn}
        </div>`;
      }).join('')}
    </div>`;

  window._aktualizujFilterBtn = function(nazev) {
    const btn = document.getElementById('druhyFilterReset');
    if (!btn) return;
    if (nazev) { btn.textContent = `× ${nazev}`; btn.hidden = false; }
    else btn.hidden = true;
    document.querySelectorAll('.druh-item').forEach(el => el.classList.toggle('druh-item--aktivni-filter', el.dataset.nazev === nazev));
  };

  document.getElementById('druhyFilterReset').addEventListener('click', () => {
    if (typeof window._zrusitFilterMapy === 'function') window._zrusitFilterMapy();
  });

  document.getElementById('druhyList').addEventListener('click', e => {
    const pocetBtn = e.target.closest('.druh-pocet--klik, .druh-mapa-btn');
    if (pocetBtn) {
      e.stopPropagation();
      const nazev = pocetBtn.dataset.nazev;
      if (typeof window._filtrovatMapuPoDruhu === 'function') {
        window._filtrovatMapuPoDruhu(nazev);
        window._aktualizujFilterBtn(nazev);
        document.querySelector('.map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    const item = e.target.closest('.druh-item');
    if (!item) return;
    const druh = druhy.find(d => String(d.id) === item.dataset.id);
    if (druh) {
      const key = BIRD_KEY_MAP[druh.nazev] || 'konadra';
      zobrazModalDruhu(druh, BIRD_ICONS[key]);
    }
  });
}

function zobrazModalDruhu(druh, iconSvg) {
  let overlay = document.getElementById('druhModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'druhModalOverlay';
    overlay.className = 'druh-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.hidden = true;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !overlay.hidden) overlay.hidden = true;
    });
  }

  const bigIcon = iconSvg.replace(/width="38" height="38"/, 'width="110" height="110"');
  const placeholderFoto = `img/ptaci/${druh.id}_placeholder.svg`;
  const fotoHTML = druh.foto
    ? `<div class="druh-modal-foto druh-modal-foto--klikatelna" title="Klikněte pro zvětšení">
        <img src="${druh.foto}" alt="${druh.nazev}" class="druh-modal-foto-img"
             onerror="this.src='${placeholderFoto}';this.closest('.druh-modal-foto').classList.remove('druh-modal-foto--klikatelna');this.closest('.druh-modal-foto').title=''">
        <div class="druh-foto-zoom-hint">🔍 Zvětšit</div>
        ${druh.foto_autor ? `<div class="druh-modal-foto-autor">© ${druh.foto_autor}</div>` : ''}
       </div>`
    : '';

  overlay.innerHTML = `
    <div class="druh-modal-box${druh.foto ? ' druh-modal-box--foto' : ''}">
      <button class="druh-modal-zavrit" aria-label="Zavřít">×</button>
      ${fotoHTML}
      <div class="druh-modal-content">
        <div class="druh-modal-header">
          <div class="druh-modal-icon">${bigIcon}</div>
          <div>
            <div class="druh-modal-nazev">${druh.nazev}</div>
            <div class="druh-modal-vedecky">${druh.vedecky || ''}</div>
          </div>
        </div>
        <p class="druh-modal-popis">${druh.popis || ''}</p>
        <div class="druh-modal-info">
          <div class="druh-modal-info-item">
            <div class="druh-modal-info-label">Počet budek</div>
            <div class="druh-modal-info-value">${druh.pocet}</div>
          </div>
          <div class="druh-modal-info-item">
            <div class="druh-modal-info-label">Průměr otvoru</div>
            <div class="druh-modal-info-value">${druh.otvor || '—'}</div>
          </div>
        </div>
        <div class="druh-modal-links">
          ${druh.zpev ? `<a href="${druh.zpev}" class="druh-modal-zpev" target="_blank" rel="noopener">🎵 Chceš si poslechnout, jak zpívá?</a>` : ''}
          ${druh.wiki ? `<a href="${druh.wiki}" class="druh-modal-wiki" target="_blank" rel="noopener">📖 Více na Wikipedii →</a>` : ''}
        </div>
      </div>
    </div>`;

  overlay.querySelector('.druh-modal-zavrit').addEventListener('click', () => {
    overlay.hidden = true;
  });

  const fotoEl = overlay.querySelector('.druh-modal-foto--klikatelna');
  if (fotoEl) {
    fotoEl.addEventListener('click', () => {
      const img = fotoEl.querySelector('img');
      if (!img || img.src.includes('_placeholder')) return;
      const zoomDiv = document.createElement('div');
      zoomDiv.className = 'foto-zoom-overlay';
      zoomDiv.innerHTML = `<img src="${img.src}" alt="${img.alt}"><span class="foto-zoom-zavrit">×</span>`;
      document.body.appendChild(zoomDiv);
      zoomDiv.addEventListener('click', () => zoomDiv.remove());
    });
  }

  overlay.hidden = false;
}

function inicializujPushNotifikace() {
  const area = document.getElementById('pushNotifArea');
  if (!area) return;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    area.innerHTML = '<span class="push-info">⚠️ Notifikace nejsou podporovány</span>';
    return;
  }

  async function ulozToken() {
    if (typeof _PUSH_VAPID_KEY === 'undefined' || !_PUSH_VAPID_KEY) return;
    try {
      const reg = window._swReg || await navigator.serviceWorker.ready;
      const msg = typeof firebase !== 'undefined' ? firebase.messaging() : null;
      if (!msg) return;
      const token = await msg.getToken({ vapidKey: _PUSH_VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) return;
      const db = typeof firebase !== 'undefined' ? firebase.database() : null;
      if (!db) return;
      const loginId = window._aktualniSpravce?.loginId || 'anon';
      const klic = loginId === 'anon' ? 'anon_' + token.slice(0, 20) : loginId;
      db.ref('push_tokens/' + klic).set({
        token,
        loginId,
        ts: firebase.database.ServerValue.TIMESTAMP,
        ua: navigator.userAgent.slice(0, 80)
      });
    } catch (e) {
      console.warn('FCM token:', e.message);
    }
  }

  function aktualizujStav() {
    if (Notification.permission === 'granted') {
      ulozToken();
      area.innerHTML = '<span class="push-info push-ok">✅ Notifikace povoleny</span>';
    } else if (Notification.permission === 'denied') {
      area.innerHTML = '<span class="push-info push-denied">❌ Notifikace blokovány – změňte v nastavení prohlížeče</span>';
    } else {
      area.innerHTML = '<button class="btn-push-notif" id="btnPushNotif">🔔 Povolit push notifikace</button>';
      document.getElementById('btnPushNotif').addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') await ulozToken();
        aktualizujStav();
      });
    }
  }

  aktualizujStav();
}

function inicializujHamburger() {
  const btn = document.getElementById('navHamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
  });

  links.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      links.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', false);
    }
  });
}

function inicializujFullscreenMapu() {
  const navMapa = document.getElementById('nav-mapa');
  const mainContent = document.querySelector('.main-content');
  const btnZpet   = document.getElementById('btn-zpet-mapa');
  const btnZpetTR = document.getElementById('btn-zpet-mapa-tr');
  const mapWrapper = document.querySelector('.map-wrapper');
  if (!navMapa || !mainContent || !btnZpet) return;

  function spocitejVyskyMapy() {
    const navH = (document.querySelector('.navbar') || {}).offsetHeight || 0;
    const infoH = (document.querySelector('.info-bar') || {}).offsetHeight || 0;
    return window.innerHeight - navH - infoH;
  }

  function rozbalMapu() {
    mainContent.classList.add('mapa-fullscreen');
    btnZpet.style.display = 'block';
    if (btnZpetTR) btnZpetTR.style.display = 'block';
    mainContent.style.height = spocitejVyskyMapy() + 'px';
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 50);
      setTimeout(() => mapInstance.invalidateSize(), 300);
    }
  }

  function sbalMapu() {
    mainContent.classList.remove('mapa-fullscreen');
    mainContent.style.height = '';
    btnZpet.style.display = 'none';
    if (btnZpetTR) btnZpetTR.style.display = 'none';
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 100);
    }
  }

  navMapa.addEventListener('click', e => { e.preventDefault(); rozbalMapu(); });

  if (mapWrapper) {
    const hint = document.createElement('div');
    hint.className = 'map-hint';
    const isMobile = window.innerWidth < 600;
    hint.textContent = isMobile
      ? '⛶ Klepněte 2× na mapu pro zobrazení na celé obrazovce'
      : '⛶ Klikněte 2× kdekoliv do mapy pro zobrazení na celé ploše';
    mapWrapper.appendChild(hint);

    // Při první návštěvě zobraz hint automaticky na 4 sekundy
    if (!localStorage.getItem('mb_hintSeen')) {
      hint.style.opacity = '1';
      setTimeout(() => {
        hint.style.transition = 'opacity 1s';
        hint.style.opacity = '';
        localStorage.setItem('mb_hintSeen', '1');
      }, 4000);
    }

    mapWrapper.addEventListener('dblclick', e => {
      if (mainContent.classList.contains('mapa-fullscreen')) return;
      if (!e.target.closest('.leaflet-container')) return;
      e.stopPropagation();
      const map = window._getMapInstance && window._getMapInstance();
      if (map) map.doubleClickZoom.disable();
      rozbalMapu();
      setTimeout(() => { if (map) map.doubleClickZoom.enable(); }, 600);
    });

    // Mobil: dvojité klepnutí přes touchend (dblclick na touch nefunguje)
    let _lastTap = 0;
    mapWrapper.addEventListener('touchend', e => {
      if (mainContent.classList.contains('mapa-fullscreen')) return;
      if (!e.target.closest('.leaflet-container')) return;
      const now = Date.now();
      if (now - _lastTap < 320) {
        e.preventDefault();
        const map = window._getMapInstance && window._getMapInstance();
        if (map) map.doubleClickZoom.disable();
        rozbalMapu();
        setTimeout(() => { if (map) map.doubleClickZoom.enable(); }, 600);
        _lastTap = 0;
      } else {
        _lastTap = now;
      }
    }, { passive: false });
  }

  btnZpet.addEventListener('click', e => { e.stopPropagation(); sbalMapu(); });
  if (btnZpetTR) btnZpetTR.addEventListener('click', e => { e.stopPropagation(); sbalMapu(); });
}

const _SPLASH_TEXTY = [
  'Vítej zpátky – ptáci tě nepřestali sledovat.',
  'Díky, že se staráš o místo, kde to žije.',
  'Každá budka se počítá. Díky, že jsi tady.',
  'Ptáci to bez tebe nedají.',
  'Vstup povolen. Budky čekají.',
  'Něco tu na tebe pípá.',
  'Vítej tam, kde mají přehled i sýkorky.',
  'Tady se ví, kdo kde hnízdí.',
  'Ptačí realitní trh tě vítá.',
  'Díky, že pomáháš udržet budky v kondici.',
  'Všechno je připravené. Jdeme na to.',
  'V klidu… budky nikam neodletí.',
  'Nebo možná jo. Radši to zkontroluj.',
  'Vítej zpět. Přehled čeká.',
  'Ptačí inspekce začíná právě teď.',
  'Dneska to vypadá na dobrý den pro kontrolu.',
  'Budky hlášeny, systém připraven.',
  'Kdo má přehled, ten nepanikaří.',
  'A kdo nemá, ten ho teď získá.',
  'Vítej v systému, kde i ptáci mají pořádek.',
  'Díky, že ses vrátil. Už jsme tě čekali.',
  'Ano, i dnes se někde něco děje.',
  'Najdeš to tady.',
  'Všechno důležité na jednom místě.',
  'Bez keře kolem – jdeme na to.',
  'Malý krok pro tebe, velký pro budky.',
  'Tady začíná přehled.',
  'A někdy i překvapení.',
  'Jsi připraven? Oni už ano.',
  'Budky připraveny, ptáci v pozoru.',
  'Díky, že jim věnuješ čas.',
  'Bez tebe by to byla jen prázdná prkna.',
  'Vítej zpátky.',
  'Zkontroluj, co je nového v korunách stromů.',
  'Něco se změnilo. Možná víc, než čekáš.',
  'Ptačí svět se nezastavil.',
  'Naštěstí ty taky ne.',
  'Tady máš přehled.',
  'Každé kliknutí pomáhá.',
  'Dneska to zvládneš levou zadní.',
  'I pravou, kdyby bylo potřeba.',
  'Vítej.',
  'Teď začíná akce.',
  'Nebo aspoň kontrola 😄',
  'Klid… všechno má svoje místo.',
  'A když nemá, ty to spravíš.',
  'Díky za tvoji péči.',
  'Ptáci by ti zatleskali.',
  'Kdyby měli ruce.',
  'Nebo Wi‑Fi.',
  'Ale mají tebe.',
  'Takže dobrý.',
  'Vítej v MojeBudky.',
  'Tady se z chaosu stává přehled.',
  'A z přehledu klid.',
  'Něco tu čeká na tvoji pozornost.',
  'Možná víc věcí.',
  'Ale žádný stres.',
  'Jdeš na to postupně.',
  'Jako vždycky.',
  'Díky, že pomáháš přírodě dávat smysl.',
  'Ptačí komunita si toho (asi) váží.',
  'Minimálně ti neutekla.',
  'Zatím.',
  'Vítej zpátky.',
  'Dneska bude produktivní den.',
  'I kdyby jen trochu.',
  'A to stačí.',
  'Budky jsou tvůj revír.',
  'Zkontroluj ho.',
  'Všechno běží.',
  'Teď jsi na tahu ty.',
  'Nepodceňuj malé detaily.',
  'Ptáci to určitě nedělají.',
  'Díky, že držíš přehled.',
  'Bez tebe by to bylo… no… divoké.',
  'Hodně divoké.',
  'Vítej v systému, který dává smysl.',
  'A občas i radost.',
  'Ano, i to se počítá.',
  'Jsi zpátky.',
  'A to je hlavní.',
  'Tak co dnes zjistíš?',
  'Kdo kde bydlí?',
  'Kdo se nastěhoval bez smlouvy?',
  'Realita budek je neúprosná 😄',
  'Ale ty to zvládneš.',
  'Jako vždycky.',
  'Díky, že se staráš.',
  'Má to smysl.',
  'I když to někdy vypadá jen jako čísla.',
  'Za těmi čísly něco žije.',
  'A ty to víš.',
  'Vítej zpátky.',
  'Přehled čeká.',
  'Klikni a uvidíš.',
  'Možná tě překvapí.',
];

function inicializujSplash() {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;

  const navstev = parseInt(localStorage.getItem('mb_visit_count') || '0', 10);

  const elN = splash.querySelector('.splash-nadpis');
  const elP = splash.querySelector('.splash-podnadpis');
  const elI = splash.querySelector('.splash-ikony');

  if (navstev === 0) {
    if (elN) elN.textContent = 'Ahoj, naše budky jsou všude okolo!';
    if (elP) elP.textContent = 'Pojď s námi sledovat ptačí život';
    if (elI) elI.textContent = '🤝 👏 👍';
  } else {
    const nadpis = _SPLASH_TEXTY[Math.floor(Math.random() * _SPLASH_TEXTY.length)];
    if (elN) elN.textContent = nadpis;
    if (elP) { elP.textContent = ''; elP.hidden = true; }
    if (elI) { elI.textContent = ''; elI.hidden = true; }
  }

  localStorage.setItem('mb_visit_count', navstev + 1);

  splash.addEventListener('click', () => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 800);
  });
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 800);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  inicializujSplash();
  aktualizujListu();
  setInterval(tickCas, 30000);
  nactiStatistiky();
  nactiSpravce();
  inicializujMapu();
  inicializujFullscreenMapu();
  inicializujHamburger();
  inicializujPushNotifikace();

  // Podpora projektu – modal z nav tlačítka
  const navPodpora = document.getElementById('navPodporaLink') || document.getElementById('navPodpora');
  if (navPodpora) {
    navPodpora.addEventListener('click', (e) => {
      e.preventDefault();
      if (document.getElementById('modalPodpora')) return;
      const modal = document.createElement('div');
      modal.id = 'modalPodpora';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="podpora-modal-box">
          <button class="modal-zavrit" id="modalPodporaZavrit" style="color:#3a4a10">×</button>
          <div class="podpora-modal-header">
            <img src="img/logo.svg" alt="" class="podpora-logo-img">
            <div class="podpora-modal-header-text">Fandíte projektu MojeBudky?</div>
          </div>
          <div class="podpora-modal-body">
            <p>Celý projekt roste a s ním i radost z každého nového ptačího souseda. Abychom mohli mapu udržovat v chodu, posílat zprávy z terénu a starat se o bezpečný chod celé aplikace, neobejde se to bez provozních nákladů (např. za hosting a zabezpečení webu).</p>
            <p>Všechno ostatní kolem výroby a kontroly budek děláme s našimi správci čistě dobrovolně a rádi ve svém volném čase. Pokud byste chtěli provoz webu finančně podpořit – ať už jako firma (rádi vás přidáme mezi partnery), nebo jako fanoušek přírody – budeme moc vděční za jakýkoliv příspěvek.</p>
            <div class="podpora-modal-jak">Jak můžete pomoci?</div>
            <p>Staňte se podporovatelem: Napište nám na <a href="mailto:info@mojebudky.cz">info@mojebudky.cz</a> a domluvíme se na umístění vašeho loga.</p>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('modalPodporaZavrit').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    });
  }

  // Partneři nav → modal
  document.querySelectorAll('a[href="#partneri"]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); _zobrazPartneriModal(); });
  });

  // Poděkování sekce → modal
  // Poděkování: klik na jméno s popisem otevře/zavře bublinu
  document.getElementById('podekovaniList') && document.getElementById('podekovaniList').addEventListener('click', e => {
    const item = e.target.closest('.podekovani-item--ma-text');
    if (!item) return;
    const jeOtevrena = item.classList.contains('pod-open');
    document.querySelectorAll('.podekovani-item--ma-text.pod-open').forEach(el => el.classList.remove('pod-open'));
    if (!jeOtevrena) {
      item.classList.add('pod-open');
      const bublina = item.querySelector('.pod-bublina');
      if (bublina) requestAnimationFrame(() => {
        bublina.style.left = '50%';
        bublina.style.transform = 'translateX(-50%)';
        const r = bublina.getBoundingClientRect();
        const vw = window.innerWidth;
        if (r.right > vw - 8) {
          bublina.style.left = `calc(50% - ${r.right - vw + 8}px)`;
          bublina.style.transform = 'none';
        } else if (r.left < 8) {
          bublina.style.left = `calc(50% + ${8 - r.left}px)`;
          bublina.style.transform = 'none';
        }
      });
    }
  });

  // Desatero správce → modal
  const modalDesatero = document.getElementById('modalDesatero');
  function otevritDesatero(e) {
    e.preventDefault();
    if (modalDesatero) {
      modalDesatero.hidden = false;
      modalDesatero.focus();
    }
  }
  function zavritDesatero() {
    if (modalDesatero) modalDesatero.hidden = true;
  }
  document.getElementById('navDesatero')?.addEventListener('click', otevritDesatero);
  document.getElementById('desateroZavrit')?.addEventListener('click', zavritDesatero);
  modalDesatero?.addEventListener('click', e => { if (e.target === modalDesatero) zavritDesatero(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalDesatero && !modalDesatero.hidden) zavritDesatero(); });
  const tileDesatero = document.getElementById('desateroTile');
  tileDesatero?.addEventListener('click', otevritDesatero);
  tileDesatero?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); otevritDesatero(e); } });
});
