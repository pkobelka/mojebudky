/* Fotogalerie – sekce #galerie
 * Načte data/galerie.json a vykreslí dlaždice fotek ve dvou kategoriích
 * (Umístěné budky / Ostatní). Klik otevře lightbox s listováním a možností
 * otevřít danou budku v mapě (window.focusBudka).
 */
(function () {
  'use strict';

  var grid = document.getElementById('galerieGrid');
  if (!grid) return; // sekce na stránce není

  var DATA = null;
  var aktivniTab = 'umistene';

  // ── Načtení dat ────────────────────────────────────────────────
  fetch('data/galerie.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (d) { DATA = d; render(); wireTaby(); })
    .catch(function () {
      grid.innerHTML = '<div class="galerie-prazdno">Fotogalerii se nepodařilo načíst.</div>';
    });

  // ── Přepínání záložek ──────────────────────────────────────────
  function wireTaby() {
    document.querySelectorAll('.galerie-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        if (tab === aktivniTab) return;
        aktivniTab = tab;
        document.querySelectorAll('.galerie-tab').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        render();
      });
    });
  }

  // ── Vykreslení dlaždic ─────────────────────────────────────────
  function polozky() {
    if (aktivniTab === 'umistene') {
      return (DATA.umistene || []).map(function (b) {
        var popis = (b.nazev ? b.nazev + ' ' : '') + '(č. ' + b.cislo + ')';
        return {
          foto: b.fotky[0],
          fotky: b.fotky,
          nadpis: b.nazev || ('Budka č. ' + b.cislo),
          popis: 'č. ' + b.cislo + (b.nazev ? ' · ' + b.nazev : ''),
          pocet: b.fotky.length,
          cislo: b.cislo,
          alt: 'Budka ' + popis
        };
      });
    }
    // ostatni
    return (DATA.ostatni || []).map(function (o) {
      var fotky = o.fotky || [];
      return {
        foto: fotky[0],
        fotky: fotky,
        nadpis: o.nazev || '',
        popis: o.nazev || '',
        pocet: fotky.length,
        cislo: null,
        alt: o.nazev || 'Fotka'
      };
    }).filter(function (o) { return o.foto; });
  }

  function render() {
    var items = polozky();
    if (!items.length) {
      grid.innerHTML = aktivniTab === 'ostatni'
        ? '<div class="galerie-prazdno">Do této kategorie jsme zatím žádné fotky nepřidali. 📷<br>Brzy sem doplníme fotky z dílny, výroby a akcí.</div>'
        : '<div class="galerie-prazdno">Zatím tu nejsou žádné fotky.</div>';
      return;
    }
    var html = items.map(function (it, i) {
      var badge = it.pocet > 1 ? '<span class="galerie-badge">📷 ' + it.pocet + '</span>' : '';
      return '' +
        '<button class="galerie-dlazdice" data-idx="' + i + '" type="button" aria-label="Zvětšit: ' + esc(it.nadpis) + '">' +
          '<img src="' + it.foto + '" alt="' + esc(it.alt) + '" loading="lazy" ' +
               'onerror="this.closest(\'.galerie-dlazdice\').style.display=\'none\'">' +
          badge +
          '<span class="galerie-popisek">' + esc(it.popis) + '</span>' +
        '</button>';
    }).join('');
    grid.innerHTML = html;

    grid.querySelectorAll('.galerie-dlazdice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        otevriLightbox(items, parseInt(btn.getAttribute('data-idx'), 10));
      });
    });
  }

  // ── Lightbox ───────────────────────────────────────────────────
  function otevriLightbox(items, idx) {
    var item = items[idx];
    var fotoIdx = 0;

    var ov = document.createElement('div');
    ov.className = 'galerie-lightbox';
    ov.innerHTML =
      '<button class="glb-zavrit" aria-label="Zavřít">×</button>' +
      '<button class="glb-nav glb-prev" aria-label="Předchozí">&#8249;</button>' +
      '<div class="glb-stred">' +
        '<img class="glb-img" alt="">' +
        '<div class="glb-info">' +
          '<span class="glb-nadpis"></span>' +
          '<span class="glb-pocitadlo"></span>' +
          '<span class="glb-akce"></span>' +
        '</div>' +
      '</div>' +
      '<button class="glb-nav glb-next" aria-label="Další">&#8250;</button>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';

    var img = ov.querySelector('.glb-img');
    var nadpisEl = ov.querySelector('.glb-nadpis');
    var pocEl = ov.querySelector('.glb-pocitadlo');
    var akceEl = ov.querySelector('.glb-akce');

    function zobraz() {
      img.src = item.fotky[fotoIdx];
      img.alt = item.alt;
      nadpisEl.textContent = item.nadpis;
      pocEl.textContent = item.fotky.length > 1 ? (fotoIdx + 1) + ' / ' + item.fotky.length : '';
      if (item.cislo != null) {
        akceEl.innerHTML = '<button class="glb-mapa" type="button">📍 Ukázat v mapě</button>';
        akceEl.querySelector('.glb-mapa').addEventListener('click', function () {
          zavri();
          if (typeof window.focusBudka === 'function') window.focusBudka(item.cislo);
          else location.hash = '#mapa';
        });
      } else {
        akceEl.innerHTML = '';
      }
    }

    // uvnitř jedné položky listujeme mezi fotkami; na krajích přeskočíme na
    // sousední položku (budku)
    function dalsi(dir) {
      var ni = fotoIdx + dir;
      if (ni >= 0 && ni < item.fotky.length) { fotoIdx = ni; zobraz(); return; }
      var pi = idx + dir;
      if (pi >= 0 && pi < items.length) {
        idx = pi; item = items[idx];
        fotoIdx = dir > 0 ? 0 : item.fotky.length - 1;
        zobraz();
      }
    }

    function zavri() {
      ov.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') zavri();
      else if (e.key === 'ArrowRight') dalsi(1);
      else if (e.key === 'ArrowLeft') dalsi(-1);
    }

    ov.querySelector('.glb-zavrit').addEventListener('click', zavri);
    ov.querySelector('.glb-prev').addEventListener('click', function () { dalsi(-1); });
    ov.querySelector('.glb-next').addEventListener('click', function () { dalsi(1); });
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.classList.contains('glb-stred')) zavri(); });
    document.addEventListener('keydown', onKey);

    zobraz();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
