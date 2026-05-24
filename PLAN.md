# MojeBudky.cz – Plán tvorby webu

**Projekt:** MojeBudky.cz – Pomáháme ptactvu  
**Autor:** Petr Kobelka  
**Verze plánu:** 1.0 (24. 5. 2026)

---

## Co budujeme

Veřejná read-only vrstva webu (ETAPA 3, verze 1.0).  
Stránka bez přihlášení, bez osobních údajů, bez editací.  
Živá mapa ČR s budkami + statistiky + příběhy z přírody.

---

## Technologie

| Co | Jak |
|---|---|
| Základ | HTML + CSS + vanilla JavaScript |
| Mapa | Leaflet.js + OpenStreetMap (zdarma, bez API klíče) |
| Data | statický `budky.json` (bez osobních údajů) |
| Hosting | GitHub Pages (`pkobelka.github.io/mojebudky`) |
| Svátek | lokální CZ jmenný kalendář v JS |

---

## Etapy

### Krok 1 – Kostra a design
- Struktura souborů
- CSS: zeleno-hnědé přírodní téma, logo, fonty
- Layout: horní lišta + 3-sloupcový blok + footer
- Responzivní základ

### Krok 2 – Data
- `budky.json` – veřejná data: číslo, GPS, typ, druh ptáka, stav
- `statistiky.json` – agregované počty
- Žádné osobní údaje (jméno, telefon, email, heslo)

### Krok 3 – Mapa
- Leaflet.js s custom ikonami budek (prázdná / osídlená / zkontrolovaná)
- Hover: lehké zvětšení ikony
- Klik: popup s veřejným detailem (číslo, lokalita, druh ptáka, stav)

### Krok 4 – Panely a lišta
- Horní lišta: datum, živý čas, svátek dle CZ kalendáře
- Pravý panel: statistiky projektu + návštěvnost
- Levý panel: "Příběhy z přírody" (3–5 krátkých záznamů)

### Krok 5 – Partneři + finalizace
- Spodní pás s logy partnerů
- Odkaz na přihlášení správce (viditelný, nenápadný)
- Mobilní responzivita
- Nasazení na GitHub Pages

---

## Vědomě vynecháno z v1.0

- Narozeniny / jmenoviny správců
- Filtry mapy
- PWA / "přidat na plochu"
- Jakákoliv editace nebo administrace (ETAPA 1+2 přijde později)

---

## Budoucí etapy (po v1.0)

- **ETAPA 1** – Přihlášení správce (login + SMS obnova hesla)
- **ETAPA 2A** – Profil správce (karta, QR vizitka, Facebook komunita)
- **ETAPA 2B** – Správa budek (editace, deník, stavy)

---

## Struktura repozitáře (plánovaná)

```
mojebudky/
├── index.html          # hlavní stránka
├── css/
│   └── style.css
├── js/
│   ├── main.js         # inicializace, lišta, statistiky
│   ├── mapa.js         # Leaflet mapa
│   └── svatky.js       # CZ jmenný kalendář
├── data/
│   ├── budky.json      # veřejná data budek (bez osobních údajů)
│   └── statistiky.json # agregované statistiky
├── img/
│   ├── logo.svg
│   └── ikony/          # ikony budek pro mapu
└── PLAN.md             # tento soubor
```
