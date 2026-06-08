let mapInstance = null;
const markersByCislo = {};
let budkyData = [];
window._markersByCislo = markersByCislo;
window._getMapInstance = () => mapInstance;

function _prepocitejDruhy() {
  if (!window._nactiDruhyPtaku || !window._druhy_ptaku_base) return;
  const pocty = {};
  Object.values(window._budkyDataMap || {}).forEach(b => {
    if (b.stav === 'osidlena' && b.ptak && b.ptak !== 'nezjisteno')
      pocty[b.ptak] = (pocty[b.ptak] || 0) + 1;
  });
  const updated = window._druhy_ptaku_base.map(d => ({ ...d, pocet: pocty[d.nazev] || 0 }));
  window._nactiDruhyPtaku(updated);
}

function _aktualizujMarkerZFirebase(cisloNum, kdoHnizdi) {
  const marker = markersByCislo[cisloNum];
  if (!marker) return;
  const bData = (window._budkyDataMap || {})[cisloNum];
  if (!bData) return;
  // Přepočítat counter i když budka je už osídlená (mohla být aktualizována z Firebase)
  if (bData.stav !== 'osidlena') {
    const bUp = { ...bData, stav: 'osidlena', ptak: kdoHnizdi };
    marker.setIcon(vytvorIkonu(bUp));
    marker.unbindTooltip();
    marker.bindTooltip(formatTooltip(bUp), {
      direction: 'top', offset: [0, -46], className: 'budka-tooltip-wrap', sticky: false
    });
    const isMobile = window.innerWidth < 600;
    marker.unbindPopup();
    marker.bindPopup(formatPopup(bUp), {
      minWidth: isMobile ? Math.min(window.innerWidth - 80, 300) : 420,
      maxWidth: isMobile ? Math.min(window.innerWidth - 80, 300) : 520,
      className: 'budka-popup-wrap',
      autoPanPaddingTopLeft: L.point(38, 100),
      autoPanPaddingBottomRight: L.point(38, 20)
    });
    if (window._budkyDataMap) window._budkyDataMap[cisloNum] = bUp;
  }
  // Přepočítat počet osídlených + druhy ptáků v UI (vždy)
  const pocetOsidl = Object.values(window._budkyDataMap || {}).filter(b => b.stav === 'osidlena').length;
  const elOsidl = document.getElementById('stat-osidlenych');
  if (elOsidl) elOsidl.textContent = pocetOsidl;
  _prepocitejDruhy();
}
window._aktualizujMarkerZFirebase = _aktualizujMarkerZFirebase;

const FOTO_ROKY = ['2026', '2025', '2024'];

// Zoom fotky v popupu — delegovaný listener, funguje i pod adminskou session
document.addEventListener('click', function(e) {
  const img = e.target.closest('.popup-foto-zoomable');
  if (!img) return;
  const blok = img.closest('.popup-foto--auto');
  const total = blok ? parseInt(blok.dataset.total || '1') : 1;
  let idx = blok ? parseInt(blok.dataset.idx || '0') : 0;
  const cislo = blok ? blok.dataset.cislo : null;

  // idx=0: aktuální src z img (může být Firebase base64), vyšší: statické soubory
  function _getSrc(i) {
    if (i === 0) return img.src;
    return `img/budky/${cislo}_${i}.jpg`;
  }

  const o = document.createElement('div');
  o.className = 'foto-zoom-overlay';

  function _render(i) {
    o.innerHTML = `<img src="${_getSrc(i)}" class="foto-zoom-img"><span class="foto-zoom-zavrit">×</span>`;
    if (total > 1) {
      const nav = document.createElement('div');
      nav.className = 'foto-zoom-nav';
      nav.innerHTML = `
        <button class="foto-zoom-btn foto-zoom-prev">&#8249;</button>
        <span class="foto-zoom-cnt">${i + 1} / ${total}</span>
        <button class="foto-zoom-btn foto-zoom-next">&#8250;</button>`;
      nav.querySelector('.foto-zoom-prev').disabled = (i === 0);
      nav.querySelector('.foto-zoom-next').disabled = (i === total - 1);
      nav.querySelector('.foto-zoom-prev').addEventListener('click', function(ev) {
        ev.stopPropagation(); idx = Math.max(0, idx - 1); _render(idx);
      });
      nav.querySelector('.foto-zoom-next').addEventListener('click', function(ev) {
        ev.stopPropagation(); idx = Math.min(total - 1, idx + 1); _render(idx);
      });
      o.appendChild(nav);
    }
    o.querySelector('.foto-zoom-zavrit').addEventListener('click', () => o.remove());
  }

  _render(idx);
  document.body.appendChild(o);
  o.addEventListener('click', function(ev) {
    if (ev.target.closest('.foto-zoom-nav,.foto-zoom-zavrit,.foto-zoom-img')) return;
    o.remove();
  });
});

// Galerie v popupu — delegovaný listener místo inline onclick
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.foto-nav-btn');
  if (!btn) return;
  e.stopPropagation();
  window._fotoNav(btn, btn.classList.contains('foto-next') ? 1 : -1);
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.popup-zavrit-btn')) return;
  const map = window._getMapInstance && window._getMapInstance();
  if (map) map.closePopup();
});

// Tažení za popup: vertikálně scrolluje popup, horizontálně+diagonálně posouvá mapu
(function() {
  let ps = null;
  document.addEventListener('touchstart', function(e) {
    if (!e.target.closest('.leaflet-popup')) { ps = null; return; }
    const t = e.touches[0];
    ps = { sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, dir: null };
    // Vypnout Leaflet drag aby nebojoval s naším panBy
    const m = window._getMapInstance && window._getMapInstance();
    if (m) m.dragging.disable();
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!ps) return;
    const cx = e.touches[0].clientX, cy = e.touches[0].clientY;
    const dx = cx - ps.sx, dy = cy - ps.sy;
    if (!ps.dir) {
      if (Math.hypot(dx, dy) < 10) return;
      ps.dir = Math.abs(dx) > Math.abs(dy) * 0.5 ? 'h' : 'v';
    }
    if (ps.dir === 'v') { ps.lx = cx; ps.ly = cy; return; }
    const m = window._getMapInstance && window._getMapInstance();
    if (m) m.panBy([-(cx - ps.lx), -(cy - ps.ly)], { animate: false });
    ps.lx = cx; ps.ly = cy;
  }, { passive: true });
  document.addEventListener('touchend', function() {
    if (ps) {
      const m = window._getMapInstance && window._getMapInstance();
      if (m) m.dragging.enable();
    }
    ps = null;
  }, { passive: true });
  document.addEventListener('touchcancel', function() {
    if (ps) {
      const m = window._getMapInstance && window._getMapInstance();
      if (m) m.dragging.enable();
    }
    ps = null;
  }, { passive: true });
})();

window._fotoNav = function(btn, dir) {
  const blok = btn.closest('.popup-foto--auto');
  if (!blok) return;
  const cislo = blok.dataset.cislo;
  const total = parseInt(blok.dataset.total);
  let idx = parseInt(blok.dataset.idx) + dir;
  if (idx < 0 || idx >= total) return;
  blok.dataset.idx = idx;
  const src = idx === 0
    ? `img/budky/${cislo}.jpg`
    : `img/budky/${cislo}_${idx}.jpg`;
  const img = blok.querySelector('img');
  if (img) {
    img.src = src;
    img.onerror = idx === 0
      ? function() { window._tryBudkaFoto(this, cislo, [...FOTO_ROKY]); }
      : null;
  }
  const counter = blok.querySelector('.foto-counter');
  if (counter) counter.textContent = `${idx + 1} / ${total}`;
  blok.querySelector('.foto-prev').disabled = idx === 0;
  blok.querySelector('.foto-next').disabled = idx === total - 1;
};

window._tryBudkaFoto = function(img, cislo, roky) {
  if (!roky || !roky.length) {
    // Všechny statické cesty selhaly — zkus Firebase jako zálohu
    if (typeof firebase !== 'undefined') {
      try {
        firebase.database().ref(`budky_edit/${cislo}/foto`).once('value').then(snap => {
          const fotoBase64 = snap.val();
          const blok = img.closest('.popup-foto--auto');
          if (fotoBase64) {
            img.onerror = null;
            img.src = fotoBase64;
            if (blok) blok.style.display = '';
          } else {
            if (blok) blok.style.display = 'none';
          }
        }).catch(() => {
          const blok = img.closest('.popup-foto--auto');
          if (blok) blok.style.display = 'none';
        });
      } catch(e) {
        const blok = img.closest('.popup-foto--auto');
        if (blok) blok.style.display = 'none';
      }
    } else {
      const blok = img.closest('.popup-foto--auto');
      if (blok) blok.style.display = 'none';
    }
    return;
  }
  const next = roky[0];
  img.onerror = function() { window._tryBudkaFoto(this, cislo, roky.slice(1)); };
  // 'flat' = bez roku, přímo img/budky/{cislo}.jpg
  img.src = next === 'flat' ? 'img/budky/' + cislo + '.jpg'
                            : 'img/budky/' + next + '/' + cislo + '.jpg';
};

function _formatDatum(ts) {
  if (!ts) return '';
  const dny = (Date.now() - ts) / 86400000;
  if (dny < 1)   return 'dnes';
  if (dny < 2)   return 'včera';
  if (dny < 7)   return `před ${Math.floor(dny)} dny`;
  const d = new Date(ts);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function _spravceStav(ts, stavBudky) {
  const datum = ts ? _formatDatum(ts) : '';
  if (stavBudky === 'osidlena')
    return { emoji: '👍👍', text: '', cls: 'stav-top',     datum };
  if (ts) {
    const days = (Date.now() - ts) / 86400000;
    if (days <= 30)  return { emoji: '👍👍', text: '', cls: 'stav-top',     datum };
    if (days <= 60)  return { emoji: '👍',   text: '', cls: 'stav-aktivni', datum };
    if (days <= 90)  return { emoji: '😐',   text: '', cls: 'stav-pasivni', datum };
  }
  return { emoji: '👎', text: '', cls: 'stav-nezajem', datum };
}

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

function vytvorIkonu(b) {
  const stav = b.stav;
  const nezjisteno = stav === 'osidlena' && (!b.ptak || b.ptak === 'nezjisteno');
  if (nezjisteno) {
    return L.divIcon({
      html: `<div class="budka-marker budka-nezjisteno"><img src="img/obydleno.svg" width="44" height="44" alt=""><span class="budka-otaznik">?</span></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -46],
      className: ''
    });
  }
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

function _stavInfo(b) {
  const nezjisteno = b.stav === 'osidlena' && (!b.ptak || b.ptak === 'nezjisteno');
  if (b.stav === 'osidlena')
    return nezjisteno
      ? { color: '#b8860b', label: '🟡 Obsazená' }
      : { color: '#3a9a3a', label: '🟢 Osídlená' };
  if (b.spravce_last_ts) {
    const days = (Date.now() - b.spravce_last_ts) / 86400000;
    if (days <= 30) return { color: '#3a9a3a', label: '🟢 Top správce' };
    if (days <= 60) return { color: '#c8a000', label: '🟡 Aktivní' };
    if (days <= 90) return { color: '#c09060', label: '🟫 Pasivní' };
  }
  return { color: '#222222', label: '⚫ Bez zájmu' };
}

function formatTooltip(b) {
  const nezjisteno = b.stav === 'osidlena' && (!b.ptak || b.ptak === 'nezjisteno');
  const { color: stavColor, label: stavLabel } = _stavInfo(b);
  const ptakRadek = (b.ptak && b.ptak !== 'nezjisteno')
    ? `<div class="tt-ptak">🐦 ${b.ptak}</div>`
    : nezjisteno ? `<div class="tt-ptak" style="color:#b8860b">❓ Druh zatím nezjištěn</div>` : '';
  const spravceStav = (b.spravce || b.spravce_last_ts || b.stav === 'osidlena') ? _spravceStav(b.spravce_last_ts, b.stav) : null;
  const spravceRadek = b.spravce
    ? `<div class="tt-spravce ${spravceStav.cls}">👤 ${b.spravce} ${spravceStav.emoji}</div>${spravceStav.datum ? `<div class="tt-aktivni-datum">naposledy aktivní: ${spravceStav.datum}</div>` : ''}`
    : (spravceStav ? `<div class="tt-spravce ${spravceStav.cls}">${spravceStav.emoji}</div>${spravceStav.datum ? `<div class="tt-aktivni-datum">naposledy aktivní: ${spravceStav.datum}</div>` : ''}` : '');
  if (b.nazev) {
    return `<div class="budka-tooltip">
      <div class="tt-nazev-hlavni" style="border-left:3px solid ${stavColor}">${b.nazev}</div>
      <div class="tt-cislo-sub">Budka č. ${b.cislo}</div>
      <div class="tt-stav" style="color:${stavColor}">${stavLabel}</div>
      ${ptakRadek}
      ${spravceRadek}
    </div>`;
  }
  return `<div class="budka-tooltip">
    <div class="tt-cislo" style="border-left:3px solid ${stavColor}">Budka č. ${b.cislo}</div>
    <div class="tt-stav" style="color:${stavColor}">${stavLabel}</div>
    ${ptakRadek}
    ${spravceRadek}
  </div>`;
}

function formatGps(lat, lng) {
  const latStr = Math.abs(lat).toFixed(5) + '° ' + (lat >= 0 ? 'N' : 'S');
  const lngStr = Math.abs(lng).toFixed(5) + '° ' + (lng >= 0 ? 'E' : 'W');
  return `<span class="gps-icon">📍</span><span class="gps-vals"><span>${latStr}</span><span>${lngStr}</span></span>`;
}

function formatHistorie(historie) {
  if (!historie || !historie.length) return '';
  const radky = historie.map(r => {
    const cisteno = r.cisteno ? '✅' : '—';
    const kontrola = r.kontrolovano ? '✅' : '—';
    const obsazeno = r.obsazeno || '—';
    const poznamkaRow = r.poznamka
      ? `<tr><td colspan="4" class="popup-poznamka">📝 ${r.poznamka}</td></tr>`
      : '';
    return `<tr>
      <td>${r.rok}</td>
      <td>${cisteno}</td>
      <td>${kontrola}</td>
      <td>${obsazeno}</td>
    </tr>${poznamkaRow}`;
  }).join('');
  return `<div class="popup-sekce-title">📋 Historie</div>
    <table class="popup-historie">
      <thead><tr><th>Rok</th><th>Čistění</th><th>Kontrola</th><th>Obsadil</th></tr></thead>
      <tbody>${radky}</tbody>
    </table>`;
}

function formatPopup(b) {
  const nezjisteno = b.stav === 'osidlena' && (!b.ptak || b.ptak === 'nezjisteno');
  const { color: stavColor, label: stavLabel } = _stavInfo(b);

  const osidlenaBadge = b.stav === 'osidlena'
    ? nezjisteno
      ? ` <span class="popup-osidlena-chip popup-osidlena-chip--nezjisteno">❓ Osídlená</span>`
      : ` <span class="popup-osidlena-chip">🟢 Osídlená</span>`
    : '';
  const nadpis = b.nazev
    ? `<span class="popup-nazev-hlavni">${b.nazev}</span><span class="popup-cislo-sub"> · č. ${b.cislo}</span>${osidlenaBadge}`
    : `Budka č. ${b.cislo}${osidlenaBadge}`;

  const birdSvg = b.ptak && BIRD_SVG[b.ptak] ? BIRD_SVG[b.ptak] : null;
  const ptakBlock = nezjisteno
    ? `<div class="popup-ptak popup-ptak--nezjisteno">❓ <span>Budka je obsazená, druh zatím neznáme</span></div>`
    : b.ptak
      ? `<div class="popup-ptak">${birdSvg ? `<span class="popup-bird-icon">${birdSvg}</span>` : '🐦'}<span>${b.ptak}</span></div>`
      : '';

  const cisloStr = String(b.cislo).padStart(3, '0');
  const fotoSrc = b.foto || `img/budky/${b.cislo}.jpg`;
  const fotoFallback = `window._tryBudkaFoto(this,${b.cislo},[${FOTO_ROKY.map(r=>`'${r}'`).join(',')}])`;
  const extraCount = b.foto_extra || 0;
  const totalFotos = 1 + extraCount;
  const galNav = totalFotos > 1
    ? `<div class="foto-nav">
        <button class="foto-nav-btn foto-prev" disabled>&#8249;</button>
        <span class="foto-counter">1 / ${totalFotos}</span>
        <button class="foto-nav-btn foto-next">&#8250;</button>
       </div>`
    : '';
  const fotoBlock = `<div class="popup-foto popup-foto--auto" data-cislo="${b.cislo}" data-idx="0" data-total="${totalFotos}" data-src="${fotoSrc}">
    <img src="${fotoSrc}" alt="Foto budky č. ${b.cislo}"
         style="cursor:zoom-in"
         class="popup-foto-zoomable"
         onerror="${fotoFallback}">
    ${galNav}
  </div>`;

  const spravceStavP = (b.spravce || b.spravce_last_ts || b.stav === 'osidlena') ? _spravceStav(b.spravce_last_ts, b.stav) : null;
  const spravceBlock = b.spravce
    ? `<div class="popup-radek">👤 Správce: <strong>${b.spravce}</strong> <span class="popup-spravce-stav ${spravceStavP.cls}">${spravceStavP.emoji}</span></div>${spravceStavP.datum ? `<div class="popup-radek popup-aktivni-datum">⏱ naposledy aktivní: <strong>${spravceStavP.datum}</strong></div>` : ''}`
    : (spravceStavP ? `<div class="popup-radek"><span class="popup-spravce-stav ${spravceStavP.cls}">${spravceStavP.emoji}</span></div>${spravceStavP.datum ? `<div class="popup-radek popup-aktivni-datum">⏱ naposledy aktivní: <strong>${spravceStavP.datum}</strong></div>` : ''}` : '');

  const instBlock = b.instalace
    ? `<div class="popup-radek">📅 Instalace: <strong>${b.instalace}</strong></div>`
    : '';

  const gpsBlock = `<div class="popup-radek popup-gps">${formatGps(b.lat, b.lng)}</div>`;
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
      ${spravceBlock}
      ${instBlock}
      ${gpsBlock}
      ${otvorBlock}
    </div>
    ${historieBlock ? `<div class="popup-sekce">${historieBlock}</div>` : ''}
    <button class="popup-zavrit-btn">✕ Zavřít</button>
  </div>`;
}

function pridejLegend(map) {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'mapa-legenda');
    div.innerHTML = `
      <div class="legenda-polozka">
        <img src="img/obydleno.svg" width="28" height="28" alt="">
        <span>Osídlená budka</span>
      </div>`;
    return div;
  };
  legend.addTo(map);
}

function focusBudka(cislo) {
  const marker = markersByCislo[cislo];
  if (!marker || !mapInstance) return;
  mapInstance.setView(marker.getLatLng(), 16);
  setTimeout(() => marker.openPopup(), 150);
}

async function hledejBudku(dotaz) {
  const q = dotaz.trim().toLowerCase();
  if (!q) return;

  const cislo = parseInt(q, 10);
  if (!isNaN(cislo) && markersByCislo[cislo]) {
    focusBudka(cislo);
    return;
  }

  const nalezena = budkyData.find(b => b.nazev && b.nazev.toLowerCase().includes(q));
  if (nalezena) {
    focusBudka(nalezena.cislo);
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dotaz)}&format=json&limit=1&countrycodes=cz,nl`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'cs' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const { lat, lon, display_name } = data[0];
      mapInstance.flyTo([parseFloat(lat), parseFloat(lon)], 14, { duration: 1.2 });
    }
  } catch {}
}

async function inicializujMapu() {
  mapInstance = L.map('map', {
    center: [50.5, 13.5],
    zoom: 6,
    zoomControl: true,
    minZoom: 5,
    maxBounds: [[42.0, -2.0], [57.0, 26.0]],
    maxBoundsViscosity: 1.0,
    wheelPxPerZoomLevel: 120,
    zoomSnap: 0.5,
    zoomDelta: 0.5
  });
  // Zabrán zoom pod minZoom i kolečkem myši
  mapInstance.setMinZoom(5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
    tileSize: 512,
    zoomOffset: -1
  }).addTo(mapInstance);

  pridejLegend(mapInstance);

  try {
    const [resBudky, resSpravci] = await Promise.all([
      fetch('data/budky.json?v=20260603a'),
      fetch('data/spravci_jmena.json?v=20260527k')
    ]);
    const budky = await resBudky.json();
    budkyData = budky;
    window._budkyData = budky;
    const spravciList = await resSpravci.json();
    const spravci = Object.fromEntries(spravciList.map(s => [s.cislo, s.jmeno]));

    budky.forEach(b => {
      if (!b.lat || !b.lng) return;
      const bData = { ...b, spravce: spravci[b.cislo] || null };
      const marker = L.marker([b.lat, b.lng], { icon: vytvorIkonu(b) });

      marker.bindTooltip(formatTooltip(bData), {
        direction: 'top',
        offset: [0, -46],
        className: 'budka-tooltip-wrap',
        sticky: false
      });

      const isMobile = window.innerWidth < 600;
      marker.bindPopup(formatPopup(bData), {
        minWidth: isMobile ? Math.min(window.innerWidth - 40, 340) : 420,
        maxWidth: isMobile ? Math.min(window.innerWidth - 40, 340) : 520,
        className: 'budka-popup-wrap',
        autoPanPaddingTopLeft: L.point(20, 100),
        autoPanPaddingBottomRight: L.point(20, 20)
      });

      markersByCislo[b.cislo] = marker;
      marker.addTo(mapInstance);
      if (!window._budkyDataMap) window._budkyDataMap = {};
      window._budkyDataMap[b.cislo] = bData;
    });

    document.getElementById('stat-celkem').textContent = budky.length;

    // Po načtení markerů překryj daty z Firebase (osídlení + aktivita správce)
    if (typeof firebase !== 'undefined') {
      try {
        Promise.all([
          firebase.database().ref('budky_edit').once('value'),
          firebase.database().ref('spravce_aktivita').once('value')
        ]).then(([editSnap, aktSnap]) => {
          const edits   = editSnap.val() || {};
          const aktivita = aktSnap.val() || {};
          window._spravceAktivita = aktivita;

          Object.entries(edits).forEach(([cislo, edit]) => {
            if (edit.kdo_hnizdi) _aktualizujMarkerZFirebase(Number(cislo), edit.kdo_hnizdi);
          });

          // Aktualizuj tooltipy a popupy s aktivitou správce
          Object.entries(window._budkyDataMap || {}).forEach(([cislo, bData]) => {
            const editTs = (edits[cislo] && edits[cislo].ts) || 0;
            const aktTs  = aktivita[cislo] || 0;
            const lastTs = Math.max(editTs, aktTs);
            if (lastTs) {
              bData.spravce_last_ts = lastTs;
              const marker = markersByCislo[Number(cislo)];
              if (marker) {
                marker.unbindTooltip();
                marker.bindTooltip(formatTooltip(bData), { direction: 'top', offset: [0, -46], className: 'budka-tooltip-wrap', sticky: false });
              }
            }
          });

          const pocet = Object.values(window._budkyDataMap || {}).filter(b => b.stav === 'osidlena').length;
          const elS = document.getElementById('stat-osidlenych');
          if (elS) elS.textContent = pocet;
          _prepocitejDruhy();

          // Aktivních budek = Firebase aktivita NEBO osídlená v JSON
          // (aktivních vždy ≥ osídlených — osídlení = někdo to nahlásil = aktivita)
          const aktivnichCisla = new Set([
            ...Object.keys(edits),
            ...Object.keys(aktivita),
            ...Object.entries(window._budkyDataMap || {})
              .filter(([, b]) => b.stav === 'osidlena')
              .map(([c]) => String(c))
          ]);
          const elA = document.getElementById('stat-aktivnich');
          if (elA) elA.textContent = aktivnichCisla.size;
        }).catch(() => {});
      } catch(e) {}
    }
  } catch(e) {
    console.error('Chyba načítání dat budek:', e);
  }

  setTimeout(() => mapInstance.invalidateSize(), 200);

  window.addEventListener('resize', () => {
    clearTimeout(window._mapaResizeTimer);
    window._mapaResizeTimer = setTimeout(() => mapInstance && mapInstance.invalidateSize(), 250);
  });

  const searchInput = document.querySelector('.search-box input');
  const searchBtn = document.querySelector('.search-box button');
  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => hledejBudku(searchInput.value));
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') hledejBudku(searchInput.value); });
  }

  function _pridejEditTlacitka(popup) {
    const spravce = window._aktualniSpravce;
    if (!spravce || !window._editBudku) return;
    const el = popup.getElement();
    if (!el || el.querySelector('.popup-edit-btn')) return;

    const cislo = Object.keys(markersByCislo).map(Number).find(k => markersByCislo[k].getPopup() === popup);
    if (!cislo) return;
    if (!spravce.jeAdmin && !spravce.budkyList.some(b => b.cislo === cislo)) return;

    let nazev = '';
    if (spravce.jeAdmin) {
      const bd = (window._budkyData || []).find(x => x.cislo === cislo);
      nazev = (bd && bd.nazev) ? bd.nazev : '';
    } else {
      const b = spravce.budkyList.find(b => b.cislo === cislo);
      nazev = b ? (b.nazev || '') : '';
    }
    const text = nazev ? `Budka č. ${cislo} – ${nazev}` : `Budka č. ${cislo}`;

    const btn = document.createElement('button');
    btn.className = 'popup-edit-btn';
    btn.textContent = '✏️ Editovat budku';
    btn.addEventListener('click', () => {
      popup.close();
      window._editBudku(spravce.loginId, spravce.spravceInfo, text, cislo, nazev);
    });

    const content = el.querySelector('.leaflet-popup-content');
    if (content) content.appendChild(btn);

    if (spravce.jeAdmin && typeof window._editSpravceByBudka === 'function') {
      const btnSpr = document.createElement('button');
      btnSpr.className = 'popup-edit-btn popup-edit-spravce-btn';
      btnSpr.textContent = '👤 Editovat správce';
      btnSpr.addEventListener('click', () => {
        popup.close();
        window._editSpravceByBudka(cislo);
      });
      if (content) content.appendChild(btnSpr);
    }

    if (spravce.jeAdmin && typeof window._napisSpravciByBudka === 'function') {
      const btnNapis = document.createElement('button');
      btnNapis.className = 'popup-edit-btn popup-edit-napis-btn';
      btnNapis.textContent = '✉ Napsat správci';
      btnNapis.addEventListener('click', () => {
        popup.close();
        window._napisSpravciByBudka(cislo);
      });
      if (content) content.appendChild(btnNapis);
    }
  }

  mapInstance.on('popupopen', e => {
    const popup = e.popup;

    // Zjisti číslo budky pro tento popup
    const cisloPopup = Object.keys(markersByCislo).map(Number).find(k => markersByCislo[k].getPopup() === popup);

    // Načti Firebase edity (foto, nazev) pro tento popup
    if (cisloPopup && typeof firebase !== 'undefined') {
      try {
        firebase.database().ref(`budky_edit/${cisloPopup}`).once('value').then(snap => {
          const edit = snap.val() || {};
          const el = popup.getElement();
          if (!el) return;
          // Fotka – nastavíme src přímo, bez popup.update() který by resetoval obsah
          if (edit.foto) {
            const fotoBlok = el.querySelector('.popup-foto--auto');
            const img = fotoBlok && fotoBlok.querySelector('img');
            if (img) {
              img.onerror = null;
              img.src = edit.foto;
              fotoBlok.style.display = '';
            }
          }
          // Název
          if (edit.nazev) {
            const cisloEl = el.querySelector('.popup-cislo');
            if (cisloEl) cisloEl.innerHTML =
              `<span class="popup-nazev-hlavni">${edit.nazev}</span><span class="popup-cislo-sub"> · č. ${cisloPopup}</span>`;
          }
          _pridejEditTlacitka(popup);
        }).catch(() => {});
      } catch(err) {}
    }

    // Fotka se načítá asynchronně – po načtení znovu vycentrujeme popup
    setTimeout(() => {
      const el = popup.getElement();
      if (!el) return;
      const img = el.querySelector('.popup-foto--auto img');
      if (img && !img.complete) {
        img.addEventListener('load', () => { _pridejEditTlacitka(popup); }, { once: true });
      }
      // Pokud je vrchol popupu nad okrajem mapy, posuneme mapu dolů
      const mapRect = mapInstance.getContainer().getBoundingClientRect();
      const popupRect = el.getBoundingClientRect();
      if (popupRect.top < mapRect.top + 20) {
        mapInstance.panBy([0, popupRect.top - mapRect.top - 20], { animate: true });
      }
    }, 60);

    _pridejEditTlacitka(popup);
  });
}
