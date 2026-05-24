const DNY = ['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'];
const MESICE = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];

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

  bar.innerHTML = `<span class="bar-left">${cal}${sva}${cas}</span>
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

    nactiPribehy(data.pribehy);
    nactiPartnery(data.partneri);

    const nav = data.navstevnost;
    document.getElementById('footer-stats').innerHTML =
      `Počet návštěv: Celkem: <strong>${nav.celkem.toLocaleString('cs-CZ')}</strong>
       | Dnes: <strong>${nav.dnes}</strong>
       | Včera: <strong>${nav.vcera}</strong>
       | Předevčírem: <strong>${nav.predvcírem}</strong>`;
  } catch(e) {
    console.error('Chyba načítání statistik:', e);
  }
}

const BIRD_ICONS = {
  konadra: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#4a7c1a"/>
    <ellipse cx="16" cy="18" rx="7" ry="8" fill="#ffd700"/>
    <ellipse cx="16" cy="12" rx="5" ry="6" fill="#1a1a1a"/>
    <circle cx="14" cy="11" r="1.5" fill="white"/>
    <path d="M11,20 Q16,25 21,20" fill="#ff9900" stroke="none"/>
  </svg>`,
  modrinka: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#2255aa"/>
    <ellipse cx="16" cy="18" rx="7" ry="8" fill="#ffd700"/>
    <ellipse cx="16" cy="12" rx="5" ry="6" fill="#1155dd"/>
    <circle cx="14" cy="11" r="1.5" fill="white"/>
  </svg>`,
  parukarka: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#556622"/>
    <ellipse cx="16" cy="18" rx="7" ry="8" fill="#eeeeaa"/>
    <ellipse cx="16" cy="12" rx="5" ry="6" fill="#222200"/>
    <path d="M16,6 Q13,2 15,0 Q17,2 19,4 Q17,5 16,6" fill="#333300"/>
    <circle cx="14" cy="11" r="1.5" fill="white"/>
  </svg>`,
  vrabec: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#8B6914"/>
    <ellipse cx="16" cy="18" rx="7" ry="8" fill="#c8a050"/>
    <ellipse cx="16" cy="12" rx="5" ry="6" fill="#5a3a10"/>
    <circle cx="14" cy="11" r="1.5" fill="white"/>
  </svg>`,
  sojka: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#7755aa"/>
    <ellipse cx="16" cy="18" rx="7" ry="8" fill="#ddbbff"/>
    <ellipse cx="16" cy="12" rx="5" ry="6" fill="#334488"/>
    <circle cx="14" cy="11" r="1.5" fill="white"/>
  </svg>`
};

function nactiPribehy(pribehy) {
  const el = document.getElementById('pribehyList');
  if (!el || !pribehy) return;
  el.innerHTML = pribehy.map(p => `
    <div class="pribeh-item">
      <div class="pribeh-ikona">${BIRD_ICONS[p.ikona] || BIRD_ICONS.konadra}</div>
      <div class="pribeh-text">
        <div class="pribeh-druh">${p.ptak}</div>
        <div class="pribeh-popis">${p.text}</div>
        <div class="pribeh-datum">${p.datum}</div>
      </div>
    </div>`).join('');
}

function nactiPartnery(partneri) {
  const el = document.getElementById('partneriList');
  if (!el || !partneri) return;
  el.innerHTML = partneri.map(p =>
    p.url
      ? `<a href="${p.url}" class="partner-item" target="_blank" rel="noopener">${p.nazev}</a>`
      : `<span class="partner-item">${p.nazev}</span>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  aktualizujListu();
  setInterval(tickCas, 30000);
  nactiStatistiky();
  inicializujMapu();
});
