let mapInstance = null;

const IKONY = {
  aktivni: `<svg viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="28" width="4" height="10" rx="1" fill="#8B5E3C"/>
    <path d="M3,10 L25,10 L21,28 L7,28 Z" fill="#7B3810"/>
    <rect x="1" y="6" width="26" height="5" rx="1" fill="#C96420"/>
    <line x1="3" y1="11" x2="25" y2="11" stroke="#3d1505" stroke-width="1.5"/>
    <circle cx="14" cy="19" r="5" fill="#2a1205"/>
    <circle cx="14" cy="19" r="4" fill="#f0e8d0"/>
    <circle cx="14" cy="26" r="1.5" fill="#2a1205"/>
  </svg>`,
  osidlena: `<svg viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="28" width="4" height="10" rx="1" fill="#5a8a3c"/>
    <path d="M3,10 L25,10 L21,28 L7,28 Z" fill="#3a6a1a"/>
    <rect x="1" y="6" width="26" height="5" rx="1" fill="#5aaa2a"/>
    <line x1="3" y1="11" x2="25" y2="11" stroke="#1d3a0a" stroke-width="1.5"/>
    <circle cx="14" cy="19" r="5" fill="#1a2a0a"/>
    <circle cx="14" cy="19" r="4" fill="#e8f5d0"/>
    <circle cx="14" cy="15" r="2" fill="#ffd700"/>
    <circle cx="14" cy="26" r="1.5" fill="#1a2a0a"/>
  </svg>`
};

function vytvorIkonu(stav) {
  const svg = IKONY[stav] || IKONY.aktivni;
  return L.divIcon({
    html: `<div class="budka-marker budka-${stav}">${svg}</div>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -38],
    className: ''
  });
}

function formatPopup(b) {
  const ptak = b.ptak ? `<div class="popup-ptak">🐦 ${b.ptak}</div>` : '';
  const nazev = b.nazev ? ` – ${b.nazev}` : '';
  const stavLabel = b.stav === 'osidlena' ? '🟢 Obsazená' : '🟤 Aktivní';
  return `
    <div class="budka-popup">
      <div class="popup-title">Budka č. ${b.cislo}${nazev}</div>
      <div class="popup-stav">${stavLabel}</div>
      ${ptak}
      ${b.typ ? `<div class="popup-info">Typ: ${b.typ}</div>` : ''}
    </div>`;
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

  try {
    const res = await fetch('data/budky.json');
    const budky = await res.json();
    let obsazene = 0;

    budky.forEach(b => {
      if (!b.lat || !b.lng) return;
      const marker = L.marker([b.lat, b.lng], { icon: vytvorIkonu(b.stav) });
      marker.bindPopup(formatPopup(b), { maxWidth: 220 });
      marker.addTo(mapInstance);
      if (b.stav === 'osidlena') obsazene++;
    });

    document.getElementById('stat-celkem').textContent = budky.length;
  } catch(e) {
    console.error('Chyba načítání dat budek:', e);
  }
}
