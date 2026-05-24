let mapInstance = null;

const BIRD_SVG = {
  'Sýkora koňadra': `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <ellipse cx="18" cy="30" rx="11" ry="15" fill="#f5c800" transform="rotate(-8,18,30)"/>
    <ellipse cx="32" cy="30" rx="11" ry="15" fill="#f5c800" transform="rotate(8,32,30)"/>
    <rect x="20" y="18" width="10" height="22" rx="5" fill="#1a1f2e"/>
    <ellipse cx="25" cy="17" rx="13" ry="12" fill="#1a1f2e"/>
    <ellipse cx="13" cy="21" rx="6" ry="5" fill="#fff" opacity="0.9"/>
    <ellipse cx="37" cy="21" rx="6" ry="5" fill="#fff" opacity="0.9"/>
    <circle cx="18" cy="15" r="3" fill="#1a1f2e"/>
    <circle cx="32" cy="15" r="3" fill="#1a1f2e"/>
    <circle cx="19" cy="14" r="1.2" fill="#fff"/>
    <circle cx="33" cy="14" r="1.2" fill="#fff"/>
    <path d="M21,27 L29,27 L25,33 Z" fill="#ff9999"/>
  </svg>`,
  'Sýkora modřinka': `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <ellipse cx="25" cy="34" rx="13" ry="11" fill="#ffd700"/>
    <rect x="19" y="20" width="12" height="18" rx="6" fill="#1a5a9a"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#1a5a9a"/>
    <rect x="13" y="12" width="24" height="6" rx="3" fill="#4ab0e8"/>
    <ellipse cx="15" cy="23" rx="5" ry="4" fill="#fff" opacity="0.9"/>
    <ellipse cx="35" cy="23" rx="5" ry="4" fill="#fff" opacity="0.9"/>
    <circle cx="20" cy="16" r="3" fill="#1a1f2e"/>
    <circle cx="30" cy="16" r="3" fill="#1a1f2e"/>
    <circle cx="21" cy="15" r="1.2" fill="#fff"/>
    <circle cx="31" cy="15" r="1.2" fill="#fff"/>
    <path d="M22,28 L28,28 L25,34 Z" fill="#ff9999"/>
  </svg>`,
  'Sýkora parukářka': `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <ellipse cx="25" cy="32" rx="12" ry="10" fill="#e8e0d0"/>
    <rect x="19" y="20" width="12" height="16" rx="6" fill="#5a5a5a"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#2a2a2a"/>
    <path d="M22,8 L25,18 L28,8 C27,4 23,4 22,8Z" fill="#2a2a2a"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#fff" opacity="0.8"/>
    <ellipse cx="36" cy="22" rx="5" ry="4" fill="#fff" opacity="0.8"/>
    <circle cx="20" cy="15" r="3" fill="#2a2a2a"/>
    <circle cx="30" cy="15" r="3" fill="#2a2a2a"/>
    <circle cx="21" cy="14" r="1.2" fill="#fff"/>
    <circle cx="31" cy="14" r="1.2" fill="#fff"/>
    <path d="M22,27 L28,27 L25,32 Z" fill="#ffcc88"/>
  </svg>`,
  'Vrabec domácí': `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <ellipse cx="25" cy="32" rx="13" ry="11" fill="#c8a060"/>
    <rect x="19" y="20" width="12" height="16" rx="6" fill="#8B6040"/>
    <ellipse cx="25" cy="18" rx="13" ry="11" fill="#6B4020"/>
    <rect x="13" y="13" width="24" height="5" rx="2.5" fill="#c8a060"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#e8c890" opacity="0.8"/>
    <ellipse cx="36" cy="22" rx="5" ry="4" fill="#e8c890" opacity="0.8"/>
    <circle cx="20" cy="15" r="3" fill="#3a2010"/>
    <circle cx="30" cy="15" r="3" fill="#3a2010"/>
    <circle cx="21" cy="14" r="1.2" fill="#fff"/>
    <circle cx="31" cy="14" r="1.2" fill="#fff"/>
    <path d="M22,27 L28,27 L25,32 Z" fill="#dda060"/>
  </svg>`
};

function vytvorIkonu(stav) {
  if (stav === 'osidlena') {
    return L.divIcon({
      html: `<div class="budka-marker budka-osidlena"><img src="img/obydleno.svg" width="44" height="44" alt=""></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -46],
      className: ''
    });
  }
  return L.divIcon({
    html: `<div class="budka-marker budka-aktivni"><img src="img/logo.svg" width="32" height="44" alt=""></div>`,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -46],
    className: ''
  });
}

function formatTooltip(b) {
  const isOsidlena = b.stav === 'osidlena';
  const stavColor = isOsidlena ? '#3a9a3a' : '#7B3810';
  const stavLabel = isOsidlena ? '🟢 Osídlená' : '🟤 Aktivní';
  const ptakRadek = b.ptak ? `<div class="tt-ptak">🐦 ${b.ptak}</div>` : '';
  if (b.nazev) {
    return `<div class="budka-tooltip">
      <div class="tt-nazev-hlavni" style="border-left:3px solid ${stavColor}">${b.nazev}</div>
      <div class="tt-cislo-sub">Budka č. ${b.cislo}</div>
      <div class="tt-stav" style="color:${stavColor}">${stavLabel}</div>
      ${ptakRadek}
    </div>`;
  }
  return `<div class="budka-tooltip">
    <div class="tt-cislo" style="border-left:3px solid ${stavColor}">Budka č. ${b.cislo}</div>
    <div class="tt-stav" style="color:${stavColor}">${stavLabel}</div>
    ${ptakRadek}
  </div>`;
}

function formatGps(lat, lng) {
  const latStr = Math.abs(lat).toFixed(5) + '° ' + (lat >= 0 ? 'N' : 'S');
  const lngStr = Math.abs(lng).toFixed(5) + '° ' + (lng >= 0 ? 'E' : 'W');
  return `${latStr}, ${lngStr}`;
}

function formatHistorie(historie) {
  if (!historie || !historie.length) return '';
  const radky = historie.map(r => {
    const cisteno = r.cisteno ? '✅' : '—';
    const kontrola = r.kontrolovano ? '✅' : '—';
    const obsazeno = r.obsazeno || '—';
    return `<tr>
      <td>${r.rok}</td>
      <td>${cisteno}</td>
      <td>${kontrola}</td>
      <td>${obsazeno}</td>
    </tr>`;
  }).join('');
  return `<div class="popup-sekce-title">📋 Historie</div>
    <table class="popup-historie">
      <thead><tr><th>Rok</th><th>Čistění</th><th>Kontrola</th><th>Obsadil</th></tr></thead>
      <tbody>${radky}</tbody>
    </table>`;
}

function formatPopup(b) {
  const isOsidlena = b.stav === 'osidlena';
  const stavColor = isOsidlena ? '#3a9a3a' : '#7B3810';
  const stavLabel = isOsidlena ? '🟢 Osídlená' : '🟤 Aktivní';

  const nadpis = b.nazev
    ? `<span class="popup-nazev-hlavni">${b.nazev}</span><span class="popup-cislo-sub"> · č. ${b.cislo}</span>`
    : `Budka č. ${b.cislo}`;

  const birdSvg = b.ptak && BIRD_SVG[b.ptak] ? BIRD_SVG[b.ptak] : null;
  const ptakBlock = b.ptak
    ? `<div class="popup-ptak">${birdSvg ? `<span class="popup-bird-icon">${birdSvg}</span>` : '🐦'}<span>${b.ptak}</span></div>`
    : '';

  const fotoBlock = b.foto
    ? `<div class="popup-foto"><img src="${b.foto}" alt="Foto budky č. ${b.cislo}"></div>`
    : '';

  const instBlock = b.instalace
    ? `<div class="popup-radek">📅 Instalace: <strong>${b.instalace}</strong></div>`
    : '';

  const gpsBlock = `<div class="popup-radek">📍 GPS: <strong>${formatGps(b.lat, b.lng)}</strong></div>`;
  const otvorBlock = b.typ
    ? `<div class="popup-radek">🔵 Otvor: <strong>${b.typ}</strong></div>`
    : '';

  const historieBlock = formatHistorie(b.historie);

  return `<div class="budka-popup">
    <div class="popup-header" style="border-left:4px solid ${stavColor}">
      <div class="popup-cislo">${nadpis}</div>
      <div class="popup-badge" style="color:${stavColor}">${stavLabel}</div>
    </div>
    ${fotoBlock}
    ${ptakBlock}
    <div class="popup-detail">
      ${instBlock}
      ${gpsBlock}
      ${otvorBlock}
    </div>
    ${historieBlock ? `<div class="popup-sekce">${historieBlock}</div>` : ''}
  </div>`;
}

function pridejLegend(map) {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'mapa-legenda');
    div.innerHTML = `
      <div class="legenda-polozka">
        <img src="img/logo.svg" width="20" height="28" alt="">
        <span>Aktivní budka</span>
      </div>
      <div class="legenda-polozka">
        <img src="img/obydleno.svg" width="28" height="28" alt="">
        <span>Osídlená budka</span>
      </div>`;
    return div;
  };
  legend.addTo(map);
}

async function inicializujMapu() {
  mapInstance = L.map('map', {
    center: [49.75, 15.7],
    zoom: 8,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    maxZoom: 18
  }).addTo(mapInstance);

  pridejLegend(mapInstance);

  try {
    const res = await fetch('data/budky.json');
    const budky = await res.json();

    budky.forEach(b => {
      if (!b.lat || !b.lng) return;
      const marker = L.marker([b.lat, b.lng], { icon: vytvorIkonu(b.stav) });

      marker.bindTooltip(formatTooltip(b), {
        direction: 'top',
        offset: [0, -46],
        className: 'budka-tooltip-wrap',
        sticky: false
      });

      marker.bindPopup(formatPopup(b), {
        maxWidth: 300,
        className: 'budka-popup-wrap'
      });

      marker.addTo(mapInstance);
    });

    document.getElementById('stat-celkem').textContent = budky.length;
  } catch(e) {
    console.error('Chyba načítání dat budek:', e);
  }
}
