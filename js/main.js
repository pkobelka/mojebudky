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
};
const KANONICKY = {};
for (const [k, arr] of Object.entries(PREZDIVKY)) arr.forEach(p => KANONICKY[p] = k);

let spravciJmena = [];
let _boxManagerKey = {};  // box_cislo → manažerský klíč (suffix), pro deduplikaci správců
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
  // Podpora pro více jmen (např. "Petr a Pavel") — hledej každé zvlášť
  const jmena = svarekJmeno.split(' a ').map(j => j.trim()).filter(Boolean);
  const hledej = new Set();
  jmena.forEach(jmeno => {
    const kanon = KANONICKY[jmeno] || jmeno;
    hledej.add(kanon); hledej.add(jmeno);
    (PREZDIVKY[kanon] || []).forEach(p => hledej.add(p));
  });
  const kanon = KANONICKY[svarekJmeno] || svarekJmeno;
  const pasujici = spravciJmena.filter(s => hledej.has(s.jmeno));
  // Deduplikuj – správce s více budkami má v 6místném loginId stejný 3místný suffix
  if (Object.keys(_boxManagerKey).length > 0) {
    const videniSpravci = new Set();
    return pasujici.filter(s => {
      const key = _boxManagerKey[s.cislo];
      if (key === undefined) return true;  // budka není v seznamu → počítej zvlášť
      if (videniSpravci.has(key)) return false;
      videniSpravci.add(key);
      return true;
    });
  }
  return pasujici;
}

async function nactiSpravce() {
  try {
    const [resJmena, resIds] = await Promise.all([
      fetch('data/spravci_jmena.json?v=20260625a'),
      fetch('data/spravci_ids.json?v=20260831')
    ]);
    spravciJmena = await resJmena.json();
    // Dřív se sem tahal data/spravci.json, což byl veřejně servírovaný soubor
    // s hashi hesel – používaly se z něj ale jen klíče. Teď je to prostý
    // seznam loginId bez čehokoli citlivého.
    const loginIds = await resIds.json();
    // Postav mapu box_cislo → manažerský klíč (suffix 6-místného loginId)
    for (const loginId of loginIds) {
      let boxNum, managerKey;
      if (loginId.length === 6) {
        boxNum = parseInt(loginId.slice(0, 3), 10);
        managerKey = loginId.slice(3);  // 3-místný suffix = identifikátor správce
      } else {
        boxNum = parseInt(loginId, 10);
        managerKey = loginId;  // kratší loginId = unikátní účet
      }
      _boxManagerKey[boxNum] = managerKey;
    }
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

  const onlineText = window._lastOnlineText || '🟢 …';
  const casBuildu = (window.MB_CAS && !window.MB_CAS.startsWith('__MB_CAS'))
    ? ` · ${window.MB_CAS}`
    : '';
  const verze = (window.MB_VERZE && !window.MB_VERZE.startsWith('__MB_VERZE'))
    ? `&nbsp;|&nbsp;<span class="bar-verze" title="Verze aplikace a čas nasazení">🏷️ verze ${window.MB_VERZE}${casBuildu}</span>`
    : '';
  bar.innerHTML = `<span class="bar-left">${cal}&nbsp;|&nbsp;⏰ <span id="liveCas">${formatCas(d)}</span>${sva}${narozBar}&nbsp;|&nbsp;<span id="onlineBar" class="bar-online">${onlineText}</span>${verze}</span>`;
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
    const res = await fetch('data/statistiky.json?v=' + (window.MB_VERZE || Date.now()));
    const data = await res.json();

    document.getElementById('stat-osidlenych').textContent = data.osidlenych;
    document.getElementById('stat-spravcu').textContent = data.spravcuRegistrovano;

    const ted = new Date();
    const cas = `${ted.getDate()}.${ted.getMonth()+1}. ${String(ted.getHours()).padStart(2,'0')}:${String(ted.getMinutes()).padStart(2,'0')}`;
    document.getElementById('stat-aktualizace').textContent = cas;

    if (window.MB_VERZE && !window.MB_VERZE.startsWith('__MB_VERZE')) {
      const el = document.getElementById('stat-aktualizace');
      if (el) el.textContent = `${window.MB_CAS} (verze ${window.MB_VERZE})`;
    }

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

    if (window._nactiZivouNavstevnost) {
      window._nactiZivouNavstevnost().then(live => {
        if (elCelkem) elCelkem.textContent = live.celkem.toLocaleString('cs-CZ');
        if (elDnes)   elDnes.textContent   = live.dnes;
        if (elVcera)  elVcera.textContent  = live.vcera;
      }).catch(e => console.error('Chyba načítání živé návštěvnosti:', e));
    }
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
  'Sýkora koňadra': 'konadra',   'Sýk. koňadra': 'konadra',
  'Sýkora modřinka': 'modrinka', 'Sýk. modřinka': 'modrinka',
  'Sýkora parukářka': 'parukarka','Sýk. parukářka': 'parukarka',
  'Sýkora babka': 'konadra',     'Sýk. babka': 'konadra',
  'Sýkora úhelníček': 'modrinka','Sýk. úhelníček': 'modrinka',
  'Vrabec domácí': 'vrabec',
  'Slavík obecný': 'konadra',
  'Rehek domácí': 'konadra',
  'Lejsek bělokrký': 'konadra',
  'Lejsek šedý': 'konadra',
  'Brhlík lesní': 'konadra',
  'Špaček obecný': 'konadra',
  'Sýček obecný': 'konadra',
  'Střízlík obecný': 'konadra',
  'Plch lesní': 'konadra',
  'Myš domácí': 'konadra',
  'Sojka obecná': 'sojka',
};

// ── Kdo u nás hnízdí ──────────────────────────────────────────────────────
// Nahradilo sekci „Z deníku správců" (9/2026). Psané zápisy se neujaly:
// nikdo do nich nepřispíval a prázdná sekce budila dojem, že se o projekt
// nikdo nestará. Tady se psát nemusí nic — přehled se skládá sám z toho, co
// správci u budek stejně evidují: `historie` v `budky.json` (uzavřené roky)
// a zápisy `budky_edit/{cislo}/{rok}/kdo_hnizdi` z Firebase (běžící sezóna).
//
// Na rozdíl od panelu druhů v pravém sloupci tohle NENÍ aktuální stav mapy,
// ale bilance zvolené sezóny — proto tu na roky nesahá `_jeSezonaOsidleni()`
// a loňská čísla nezmizí ani v zimě.

// Druhy mimo BIRD_ICONS (savci, hmyz, nehlášený druh) dostanou aspoň emoji.
const OSIDLENI_EMOJI = {
  'Vosy': '🐝', 'Sršni': '🐝', 'Včely': '🐝',
  'Plch lesní': '🐭', 'Plch velký': '🐭', 'Myš domácí': '🐭', 'Veverka': '🐿️',
  'Osídlena – nevím kdo': '❓', 'Nezjištěno': '❓',
};

// Správce může v aplikaci zvolit „+ Jiný druh" a napsat cokoli, takže názvy
// druhů jsou volný text — do HTML jdou vždy přes _esc().
const _escOsidleni = t => (window._esc ? window._esc(t)
  : String(t == null ? '' : t).replace(/[<>&"]/g, z => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[z])));

const OSIDLENI_NEURCENO = 'Osídlena – nevím kdo';
const OSIDLENI_POPIS_MAPA = '🗺 Ukázat na mapě';
const OSIDLENI_POPIS_ZRUSIT = '✓ Na mapě · zrušit';

function _sklonuj(n, [jedna, dva, hodne]) {
  return n === 1 ? jedna : (n >= 2 && n <= 4) ? dva : hodne;
}

function _osidleniIkona(nazev) {
  const key = BIRD_KEY_MAP[nazev];
  if (key) return BIRD_ICONS[key].replace(/width="38" height="38"/, 'width="34" height="34"');
  return `<span class="osidleni-karta-emoji">${OSIDLENI_EMOJI[nazev] || '🪶'}</span>`;
}

let _osidleniVybranyRok = null;

// Vrátí { rok: { cislo_budky: druh } }. Klíčem je číslo budky, takže se jedna
// budka nezapočítá dvakrát; Firebase se aplikuje po JSON a tedy vyhrává.
function _osidleniPoRocich() {
  const podleRoku = {};
  const norm = window._normDruh || (x => x);
  const pridej = (rok, cislo, druh) => {
    const r = Number(rok), c = Number(cislo);
    if (!r || !druh || Number.isNaN(c)) return;
    (podleRoku[r] = podleRoku[r] || {})[c] = norm(druh);
  };

  (window._budkyData || []).forEach(b => {
    (b.historie || []).forEach(h => pridej(h.rok, b.cislo, h.obsazeno));
  });

  Object.entries(window._vsechnyEdity || {}).forEach(([cislo, raw]) => {
    if (!raw) return;
    const roky = Object.keys(raw).filter(k => /^\d{4}$/.test(k));
    if (roky.length) {
      roky.forEach(rok => { if (raw[rok] && raw[rok].kdo_hnizdi) pridej(rok, cislo, raw[rok].kdo_hnizdi); });
    } else if (raw.kdo_hnizdi) {
      pridej(raw.rok || new Date().getFullYear(), cislo, raw.kdo_hnizdi);   // starý plochý formát
    }
  });

  return podleRoku;
}

function _renderOsidleni() {
  const elObsah = document.getElementById('osidleniObsah');
  const elRoky  = document.getElementById('osidleniRoky');
  if (!elObsah || !elRoky) return;

  const podleRoku = _osidleniPoRocich();
  const roky = Object.keys(podleRoku).map(Number).sort((a, b) => b - a);

  if (!roky.length) {
    elRoky.innerHTML = '';
    elObsah.innerHTML = `<p class="osidleni-prazdno">Zatím tu nemáme žádné hlášení o osídlení.
      Jakmile správci začnou u budek zapisovat, kdo v nich hnízdí, objeví se přehled tady.</p>`;
    return;
  }

  if (!roky.includes(_osidleniVybranyRok)) _osidleniVybranyRok = roky[0];

  elRoky.innerHTML = roky.map(r =>
    `<button type="button" class="osidleni-rok${r === _osidleniVybranyRok ? ' is-active' : ''}" data-rok="${r}">
      🪺 <span class="osidleni-rok-slovo">Sezóna </span>${r}
    </button>`).join('');

  const zaznamy = podleRoku[_osidleniVybranyRok];
  const druhy = {};
  Object.entries(zaznamy).forEach(([cislo, druh]) => {
    (druhy[druh] = druhy[druh] || []).push(Number(cislo));
  });
  const serazene = Object.entries(druhy).sort((a, b) =>
    (a[0] === OSIDLENI_NEURCENO) - (b[0] === OSIDLENI_NEURCENO)
    || b[1].length - a[1].length
    || a[0].localeCompare(b[0], 'cs'));

  const budek = Object.keys(zaznamy).length;
  const pocetDruhu = serazene.length;

  const karty = serazene.map(([druh, cisla]) => `
    <button type="button" class="osidleni-karta" data-druh="${_escOsidleni(druh)}"
            title="Ukázat tyto budky na mapě">
      <span class="osidleni-karta-ikona">${_osidleniIkona(druh)}</span>
      <span class="osidleni-karta-nazev">${_escOsidleni(druh === OSIDLENI_NEURCENO ? 'Neurčený druh' : druh)}</span>
      <span class="osidleni-karta-cislo">
        <strong class="osidleni-karta-pocet">${cisla.length}</strong>
        <span class="osidleni-karta-jednotka">${_sklonuj(cisla.length, ['budka', 'budky', 'budek'])}</span>
      </span>
      <span class="osidleni-karta-mapa">${OSIDLENI_POPIS_MAPA}</span>
    </button>`).join('');

  elObsah.innerHTML = `
    <p class="osidleni-shrnuti">
      V sezóně <strong>${_osidleniVybranyRok}</strong> nám správci nahlásili osídlení
      u <strong>${budek} ${_sklonuj(budek, ['budky', 'budek', 'budek'])}</strong> –
      dohromady <strong>${pocetDruhu} ${_sklonuj(pocetDruhu, ['druh', 'druhy', 'druhů'])}</strong>.
    </p>
    <div class="osidleni-karty">${karty}</div>
    <p class="osidleni-pozn">Čísla vycházejí z hlášení správců, ne z odborného monitoringu –
      u části budek zůstává hnízdění nenahlášené.</p>`;
}

// Obnovu si vyžádá mapa.js pokaždé, když dorazí budky.json nebo edity z Firebase.
window._prepocitejOsidleni = _renderOsidleni;

// Klik na kartu zvýrazní budky daného druhu na mapě, klik na tu samou kartu
// znovu zvýraznění zruší (stejná logika jako u legendy mapy).
let _osidleniAktivniDruh = null;

window._osidleniZrusitZvyrazneni = function() {
  _osidleniAktivniDruh = null;
  document.querySelectorAll('.osidleni-karta--aktivni').forEach(el => {
    el.classList.remove('osidleni-karta--aktivni');
    const popis = el.querySelector('.osidleni-karta-mapa');
    if (popis) popis.textContent = OSIDLENI_POPIS_MAPA;
  });
};

// Data budek si sekce načítá sama, i když je fetchuje i mapa.js. Je to stejná
// URL, takže druhé volání sedí v cache prohlížeče — a přehled se vykreslí i
// tehdy, když se mapa nenačte (výpadek CDN s Leafletem, blokované skripty).
async function _nactiBudkyProOsidleni() {
  if (window._budkyData) return;
  try {
    const res = await fetch('data/budky.json?v=20260824a');
    if (!window._budkyData) window._budkyData = await res.json();
  } catch (e) {
    console.error('Chyba načítání budek pro přehled osídlení:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const sekce = document.getElementById('osidleni');
  if (!sekce) return;
  _nactiBudkyProOsidleni().then(_renderOsidleni);

  document.getElementById('osidleniRoky').addEventListener('click', e => {
    const btn = e.target.closest('.osidleni-rok');
    if (!btn) return;
    _osidleniVybranyRok = Number(btn.dataset.rok);
    if (typeof window._zrusitFilterMapy === 'function') window._zrusitFilterMapy();
    _renderOsidleni();
  });

  document.getElementById('osidleniObsah').addEventListener('click', e => {
    const karta = e.target.closest('.osidleni-karta');
    if (!karta) return;
    const druh = karta.dataset.druh;
    if (_osidleniAktivniDruh === druh) {
      if (typeof window._zrusitFilterMapy === 'function') window._zrusitFilterMapy();
      return;
    }
    const cisla = Object.entries(_osidleniPoRocich()[_osidleniVybranyRok] || {})
      .filter(([, d]) => d === druh).map(([c]) => Number(c));
    if (typeof window._zvyraznitBudkyNaMape !== 'function') return;
    if (!window._zvyraznitBudkyNaMape(cisla, `${druh} (${_osidleniVybranyRok})`)) return;
    _osidleniAktivniDruh = druh;
    karta.classList.add('osidleni-karta--aktivni');
    karta.querySelector('.osidleni-karta-mapa').textContent = OSIDLENI_POPIS_ZRUSIT;
    document.querySelector('.map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

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
  }).join('') + `<a href="mailto:p.kobelka@gmail.com" class="partner-item partner-item--logo partner-placeholder" title="Staňte se partnerem projektu MojeBudky.cz">✨&nbsp;Tady může být<br>i Vaše logo</a>`;
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
        <p>Staňte se podporovatelem: Napište nám na <a href="mailto:p.kobelka@gmail.com">p.kobelka@gmail.com</a> a domluvíme se na umístění vašeho loga.</p>
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

  const obsazene = druhy.filter(d => d.pocet > 0);
  const prazdne = druhy.filter(d => d.pocet === 0);
  const aktivnich = obsazene.length;
  const druhSlovo = aktivnich === 1 ? 'druh' : aktivnich <= 4 ? 'druhy' : 'druhů';

  // Mimo hnízdní sezónu jsou čísla bilancí poslední sezóny, ne aktuálním stavem —
  // na mapě už osídlené budky nejsou, takže odkaz „ukaž na mapě" nemá co zobrazit.
  const jeSezona = typeof window._jeSezonaOsidleni === 'function' ? window._jeSezonaOsidleni() : true;

  const renderItem = d => {
    const key = BIRD_KEY_MAP[d.nazev] || 'konadra';
    const icon = BIRD_ICONS[key].replace(/width="38" height="38"/, 'width="28" height="28"');
    const naMapu = d.pocet > 0 && jeSezona;
    const mapBtn = naMapu
      ? `<button class="druh-mapa-btn" data-nazev="${d.nazev.replace(/"/g,'&quot;')}" title="Zobrazit na mapě" tabindex="-1">🗺</button>`
      : '';
    return `<div class="druh-item${d.pocet === 0 ? ' druh-item--prazdny' : ''}" data-id="${d.id}" data-nazev="${d.nazev.replace(/"/g,'&quot;')}">
      <div class="druh-svg">${icon}</div>
      <span class="druh-nazev">${d.nazev}</span>
      <span class="druh-pocet${naMapu ? ' druh-pocet--klik' : ''}" data-nazev="${d.nazev.replace(/"/g,'&quot;')}" title="${naMapu ? 'Zobrazit na mapě' : ''}">${d.pocet}</span><span class="druh-pocet-label">${d.pocet === 1 ? 'budka' : d.pocet <= 4 ? 'budky' : 'budek'}</span>${mapBtn}
    </div>`;
  };

  const TOGGLE_TEXT = (n, otevreno) =>
    `${otevreno ? '▾' : '▸'} Další druhy, které v našich budkách zatím nesídlí (${n})`;

  const prazdneHTML = prazdne.length ? `
    <button type="button" class="druhy-dalsi-toggle" id="druhyDalsiToggle">${TOGGLE_TEXT(prazdne.length, false)}</button>
    <div class="druhy-list druhy-list--prazdne" id="druhyListPrazdne" style="display:none">
      ${prazdne.map(renderItem).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="druhy-title-row">
      <span class="druhy-title">🐦 Druhy ptáků v budkách</span>
      <button class="druhy-filter-reset" id="druhyFilterReset" hidden title="Zrušit filtr mapy">× Zrušit filtr</button>
    </div>
    <div class="druhy-intro">Aktuálně evidujeme v budkách tyto <strong>${aktivnich} ${druhSlovo}</strong>:</div>
    <div class="druhy-list" id="druhyList">
      ${obsazene.map(renderItem).join('')}
    </div>${prazdneHTML}`;

  const dalsiToggle = document.getElementById('druhyDalsiToggle');
  if (dalsiToggle) {
    dalsiToggle.addEventListener('click', () => {
      const box = document.getElementById('druhyListPrazdne');
      const otevreno = box.style.display !== 'none';
      box.style.display = otevreno ? 'none' : 'flex';
      box.style.flexDirection = 'column';
      dalsiToggle.textContent = TOGGLE_TEXT(prazdne.length, !otevreno);
    });
  }

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

  el.addEventListener('click', e => {
    const pocetBtn = e.target.closest('.druh-pocet--klik, .druh-mapa-btn');
    if (pocetBtn) {
      e.stopPropagation();
      const nazev = pocetBtn.dataset.nazev;
      if (typeof window._filtrovatMapuPoDruhu === 'function') {
        // false = na mapě není co zvýraznit (mimo sezónu), filtr se nezapíná
        if (window._filtrovatMapuPoDruhu(nazev) === false) return;
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
    ? `<div class="druh-modal-foto druh-modal-foto--klikatelna" title="Klikni pro zvětšení">
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
    document.body.classList.add('mapa-cele');
    btnZpet.style.display = 'block';
    if (btnZpetTR) btnZpetTR.style.display = 'block';
    mainContent.style.height = spocitejVyskyMapy() + 'px';
    // Ve fullscreenu rovnou aktivuj mapu, aby pinch zoomoval mapu (ne stránku)
    // a zoom ovládání nemizelo kvůli zoomu celé stránky
    if (typeof window._mapaAktivovat === 'function') window._mapaAktivovat();
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 50);
      setTimeout(() => mapInstance.invalidateSize(), 300);
    }
  }

  function sbalMapu() {
    mainContent.classList.remove('mapa-fullscreen');
    document.body.classList.remove('mapa-cele');
    mainContent.style.height = '';
    btnZpet.style.display = 'none';
    if (btnZpetTR) btnZpetTR.style.display = 'none';
    if (typeof mapInstance !== 'undefined' && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 100);
    }
  }

  navMapa.addEventListener('click', e => {
    e.preventDefault();
    // Nejdřív posuň k mapě (jinak se rozbalí mimo obrazovku a vypadá to, že se nic nestalo)
    document.querySelector('.map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    rozbalMapu();
  });

  if (mapWrapper) {
    const hint = document.createElement('div');
    hint.className = 'map-hint';
    const isMobile = window.innerWidth < 600;
    hint.textContent = isMobile
      ? '⛶ Tlačítkem „Celá obrazovka" zobrazíš mapu přes celý displej'
      : '⛶ Klikni 2× kdekoliv do mapy pro zobrazení na celé ploše';
    mapWrapper.appendChild(hint);

    // Viditelné tlačítko (hlavně pro mobil): mapa na celou obrazovku
    const btnCele = document.createElement('button');
    btnCele.id = 'btn-mapa-cele';
    btnCele.type = 'button';
    btnCele.setAttribute('aria-label', 'Zobrazit mapu na celou obrazovku');
    btnCele.innerHTML = '⛶ Celá obrazovka';
    mapWrapper.appendChild(btnCele);
    btnCele.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelector('.map-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      rozbalMapu();
    });

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

    // Na mobilu se celá obrazovka spouští jen viditelným tlačítkem „Celá obrazovka"
    // (žádné dvojité klepnutí do mapy – to mátlo a bralo běžné přiblížení/posun).
  }

  btnZpet.addEventListener('click', e => { e.stopPropagation(); sbalMapu(); });
  if (btnZpetTR) btnZpetTR.addEventListener('click', e => { e.stopPropagation(); sbalMapu(); });
}

const _SPLASH_TEXTY = [
  'Vítej zpátky – ptáci Tě nepřestali sledovat.',
  'Díky, že se staráš o místo, kde to žije.',
  'Každá budka se počítá. Díky, že jsi tady.',
  'Ptáci to bez Tebe nedají.',
  'Vstup povolen. Budky čekají.',
  'Něco tu na Tebe pípá.',
  'Vítej tam, kde mají přehled i sýkorky.',
  'Tady se ví, kdo kde hnízdí.',
  'Ptačí realitní trh Tě vítá.',
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
  'Díky, že ses vrátil. Už jsme Tě čekali.',
  'Ano, i dnes se někde něco děje.',
  'Najdeš to tady.',
  'Všechno důležité na jednom místě.',
  'Bez keře kolem – jdeme na to.',
  'Malý krok pro Tebe, velký pro budky.',
  'Tady začíná přehled.',
  'A někdy i překvapení.',
  'Jsi připraven? Oni už ano.',
  'Budky připraveny, ptáci v pozoru.',
  'Díky, že jim věnuješ čas.',
  'Bez Tebe by to byla jen prázdná prkna.',
  'Vítej zpátky.',
  'Zkontroluj, co je nového v korunách stromů.',
  'Něco se změnilo. Možná víc, než čekáš.',
  'Ptačí svět se nezastavil.',
  'Naštěstí Ty taky ne.',
  'Tady máš přehled.',
  'Každé kliknutí pomáhá.',
  'Dneska to zvládneš levou zadní.',
  'I pravou, kdyby bylo potřeba.',
  'Vítej.',
  'Teď začíná akce.',
  'Nebo aspoň kontrola 😄',
  'Klid… všechno má svoje místo.',
  'A když nemá, Ty to spravíš.',
  'Díky za Tvoji péči.',
  'Ptáci by Ti zatleskali.',
  'Kdyby měli ruce.',
  'Nebo Wi‑Fi.',
  'Ale mají Tebe.',
  'Takže dobrý.',
  'Vítej v MojeBudky.',
  'Tady se z chaosu stává přehled.',
  'A z přehledu klid.',
  'Něco tu čeká na Tvoji pozornost.',
  'Možná víc věcí.',
  'Ale žádný stres.',
  'Jdeš na to postupně.',
  'Jako vždycky.',
  'Díky, že pomáháš přírodě dávat smysl.',
  'Ptačí komunita si toho (asi) váží.',
  'Minimálně Ti neutekla.',
  'Zatím.',
  'Vítej zpátky.',
  'Dneska bude produktivní den.',
  'I kdyby jen trochu.',
  'A to stačí.',
  'Budky jsou Tvůj revír.',
  'Zkontroluj ho.',
  'Všechno běží.',
  'Teď jsi na tahu Ty.',
  'Nepodceňuj malé detaily.',
  'Ptáci to určitě nedělají.',
  'Díky, že držíš přehled.',
  'Bez Tebe by to bylo… no… divoké.',
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
  'Ale Ty to zvládneš.',
  'Jako vždycky.',
  'Díky, že se staráš.',
  'Má to smysl.',
  'I když to někdy vypadá jen jako čísla.',
  'Za těmi čísly něco žije.',
  'A Ty to víš.',
  'Vítej zpátky.',
  'Přehled čeká.',
  'Klikni a uvidíš.',
  'Možná Tě překvapí.',
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
    // Uvítací hesla bereme ze seznamu B (window.SLOGANY v index.html); _SPLASH_TEXTY je záloha.
    const pool = (window.SLOGANY && window.SLOGANY.length) ? window.SLOGANY : _SPLASH_TEXTY;
    const nadpis = pool[Math.floor(Math.random() * pool.length)];
    if (elN) elN.textContent = nadpis;
    if (elP) { elP.textContent = ''; elP.hidden = true; }
    if (elI) { elI.textContent = ''; elI.hidden = true; }
  }

  localStorage.setItem('mb_visit_count', navstev + 1);

  function zavriSplash() {
    if (!splash.isConnected) return;
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.remove();
      if (navstev === 0) setTimeout(ukazUvitaciToast, 600);
    }, 600);
  }

  splash.addEventListener('click', zavriSplash);
  setTimeout(zavriSplash, 2000);
}

function ukazUvitaciToast() {
  if (localStorage.getItem('mb_uvod_toast_zobrazen')) return;
  localStorage.setItem('mb_uvod_toast_zobrazen', '1');

  // Slovo po slově (několik "kusů" je celý odkaz/zalomení, aby se nerozbilo HTML)
  const KUSY = [
    '👋 Vítejte', 'na', 'mém', 'novém', 'webu!', '<br>',
    'Teprve', 'ho', 'rozjíždíme,', 'takže', 'něco', 'ještě', 'nemusí', 'úplně', 'hladce', 'fungovat.', '<br>',
    'Budu', 'moc', 'rád', 'za', 'jakoukoli', 'připomínku', 'nebo', 'nápad', '—',
    '<a href="#" onclick="document.getElementById(\'btnNapsat\').click();return false;" style="color:inherit;text-decoration:underline;pointer-events:auto">napište mi</a>.',
    '💌'
  ];
  const DOBA_SLOVO = 340;
  const DOBA_DRZENI = 9000;

  const existujici = document.getElementById('adminToast');
  if (existujici) existujici.remove();

  // Celý text (i s okoukem plné velikosti) je v DOM hned od začátku – jen jsou
  // slova zprůhledněná a postupně se "vybarvují", aby se okno neroztahovalo.
  const html = KUSY.map(kus => kus === '<br>'
    ? '<br>'
    : `<span class="uvod-toast-slovo">${kus}</span>`
  ).join(' ');

  const toast = document.createElement('div');
  toast.id = 'adminToast';
  toast.className = 'admin-toast';
  toast.innerHTML = html;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('admin-toast--show'), 50);

  const slova = toast.querySelectorAll('.uvod-toast-slovo');
  let i = 0;
  function dalsiSlovo() {
    if (!toast.isConnected) return;
    if (i < slova.length) {
      slova[i].classList.add('uvod-toast-slovo--viditelne');
      slova[i].scrollIntoView({ block: 'nearest' });
      i++;
      setTimeout(dalsiSlovo, DOBA_SLOVO);
    } else {
      setTimeout(() => {
        toast.classList.remove('admin-toast--show');
        setTimeout(() => toast.remove(), 500);
      }, DOBA_DRZENI);
    }
  }
  dalsiSlovo();
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
            <p>Staňte se podporovatelem: Napište nám na <a href="mailto:p.kobelka@gmail.com">p.kobelka@gmail.com</a> a domluvíme se na umístění vašeho loga.</p>
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
