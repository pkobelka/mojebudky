const DNY = ['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'];
const MESICE = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];

const PREZDIVKY = {
  'Jiří': ['Jirka'], 'Josef': ['Pepa'], 'Jan': ['Honza'],
  'Tomáš': ['Tomášek'], 'Václav': ['Vašek'], 'Miroslav': ['Miro'],
  'Petra': ['Peťa'], 'Kateřina': ['Katka'], 'Anna': ['Anička'],
  'Vladimíra': ['Vlaďka'], 'Gabriela': ['Gábi'],
};
const KANONICKY = {};
for (const [k, arr] of Object.entries(PREZDIVKY)) arr.forEach(p => KANONICKY[p] = k);

let spravciJmena = [];

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
    const res = await fetch('data/spravci_jmena.json');
    spravciJmena = await res.json();
    aktualizujListu();
  } catch(e) {
    console.error('Chyba načítání správců:', e);
  }
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
  const sva = svarek ? `&nbsp;| Svátek má: <strong>${svarek}</strong>` : '';
  const cas = `&nbsp;| ⏰ <span id="liveCas">${formatCas(d)}</span>`;

  const oslavenci = svarek ? najdiSvatekSpravce(svarek) : [];
  const gratulace = oslavenci.length > 0
    ? `&nbsp;| 🎂 <span class="bar-gratulace">${pluralSpravcu(oslavenci.length)} slaví svátek – gratulujeme!</span>`
    : '';

  bar.innerHTML = `<span class="bar-left">${cal}${sva}${gratulace}${cas}</span>
    <span class="bar-right">🌿 Pomáháme ptactvu po celé ČR</span>`;
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
    const res = await fetch('data/statistiky.json');
    const data = await res.json();

    document.getElementById('stat-osidlenych').textContent = data.osidlenych;
    document.getElementById('stat-spravcu').textContent = data.spravcuRegistrovano;

    const ted = new Date();
    const cas = `${ted.getDate()}.${ted.getMonth()+1}. ${String(ted.getHours()).padStart(2,'0')}:${String(ted.getMinutes()).padStart(2,'0')}`;
    document.getElementById('stat-aktualizace').textContent = cas;

    nactiAktuality(data.aktuality);
    nactiPartnery(data.partneri);
    nactiPodekovani(data.podekovani);

    const nav = data.navstevnost;
    document.getElementById('footer-stats').innerHTML =
      `Návštěvy: Celkem: <strong>${nav.celkem.toLocaleString('cs-CZ')}</strong>`+
      ` &nbsp;|&nbsp; Dnes: <strong>${nav.dnes}</strong>`+
      ` &nbsp;|&nbsp; Včera: <strong>${nav.vcera}</strong>`+
      ` &nbsp;|&nbsp; Předevčírem: <strong>${nav.predvcírem}</strong>`;
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

function nactiAktuality(aktuality) {
  const el = document.getElementById('aktualityList');
  if (!el || !aktuality) return;
  el.innerHTML = aktuality.map(p => `
    <div class="pribeh-item">
      <div class="pribeh-ikona">${BIRD_ICONS[p.ikona] || BIRD_ICONS.konadra}</div>
      <div class="pribeh-text">
        <div class="pribeh-druh">${p.ptak}</div>
        <div class="pribeh-popis">${p.text}</div>
        <div class="pribeh-datum">${p.datum}</div>
        ${p.budka_id ? `<a class="aktualita-link" data-budka="${p.budka_id}" href="#">→ Budka č. ${p.budka_id}</a>` : ''}
      </div>
    </div>`).join('');

  el.addEventListener('click', e => {
    const link = e.target.closest('.aktualita-link');
    if (!link) return;
    e.preventDefault();
    const cislo = parseInt(link.dataset.budka, 10);
    focusBudka(cislo);
    document.querySelector('.map-wrapper').scrollIntoView({ behavior: 'smooth' });
  });
}

function nactiPartnery(partneri) {
  const el = document.getElementById('partneriList');
  if (!el || !partneri) return;
  el.innerHTML = partneri.map(p => {
    const obsah = p.logo
      ? `<img src="${p.logo}" alt="${p.nazev}" class="partner-logo">`
      : p.nazev;
    return p.url
      ? `<a href="${p.url}" class="partner-item${p.logo ? ' partner-item--logo' : ''}" target="_blank" rel="noopener" title="${p.nazev}">${obsah}</a>`
      : `<span class="partner-item${p.logo ? ' partner-item--logo' : ''}" title="${p.nazev}">${obsah}</span>`;
  }).join('');
}

function nactiPodekovani(podekovani) {
  const wrap = document.getElementById('podekovaniWrap');
  const el = document.getElementById('podekovaniList');
  if (!wrap || !el || !podekovani || !podekovani.length) return;
  el.innerHTML = podekovani.map(p =>
    `<span class="podekovani-osoba" title="${p.popis}">🙏 ${p.jmeno}<em>${p.popis}</em></span>`
  ).join('');
  wrap.style.display = 'block';
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
  const btnZpet = document.getElementById('btn-zpet-mapa');
  if (!navMapa || !mainContent || !btnZpet) return;

  navMapa.addEventListener('click', e => {
    e.preventDefault();
    mainContent.classList.add('mapa-fullscreen');
    btnZpet.style.display = 'block';
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 50);
    }
    mainContent.scrollIntoView({ behavior: 'smooth' });
  });

  btnZpet.addEventListener('click', () => {
    mainContent.classList.remove('mapa-fullscreen');
    btnZpet.style.display = 'none';
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 50);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  aktualizujListu();
  setInterval(tickCas, 30000);
  nactiStatistiky();
  nactiSpravce();
  inicializujMapu();
  inicializujFullscreenMapu();
  inicializujHamburger();
});
