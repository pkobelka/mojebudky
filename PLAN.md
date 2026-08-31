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
| Hosting | WEDOS FTP – produkce `mojebudky.cz` (workflow `ftp-deploy-prod.yml`, **ruční**), test `_test` (workflow `ftp-deploy.yml`, automaticky při pushi do `main`) |
| Svátek | lokální CZ jmenný kalendář v JS |

> GitHub Pages už se pro tohle repo nebuildí – v historii běhů není jediný
> „pages build and deployment". Ta adresa tedy servíruje starou verzi a nedá
> se na ní nic testovat. Testuje se na `_test`.

---

## Přihlašování správců (od 8/2026)

Heslo se ověřuje **na serveru**, ne v prohlížeči. Cloud Function `budkyLoginReq`
ho porovná proti uzlu `budky_auth` (scrypt + sůl, klient tam nemá přístup)
a vydá custom token. Podrobnosti v hlavičkách funkcí v `functions/index.js`.

**Ruční krok, který se neobejde bez konzole:** `createCustomToken()` v Cloud
Functions nepodepisuje lokálně – běhový účet nemá privátní klíč, takže o podpis
žádá IAM Service Account Credentials API. Účet
`moje-budky@appspot.gserviceaccount.com` proto musí mít **sám na sobě** roli
**Service Account Token Creator**:

    console.cloud.google.com/iam-admin/serviceaccounts?project=moje-budky
    -> App Engine default service account -> Permissions -> Manage access
    -> Add another role -> Service Account Token Creator -> Save

Nastaveno ručně 31. 8. 2026. Z CI to udělat nejde – účet ze secretu
`FIREBASE_SERVICE_ACCOUNT` (Admin SDK) nemá právo `iam.serviceAccounts.setIamPolicy`.
Kdyby se někdy projekt zakládal znovu nebo se měnil běhový účet funkcí, tenhle
krok je potřeba zopakovat, jinak se **nikdo nepřihlásí** (heslo projde, ale token
se nevydá – v appce se to ukáže jako `token-failed`).

**Nedodělaný krok (8/2026):** hesla se zneplatnila jen účtům, které se nikdy
nepřihlásily. Účty s historií přihlášení (v 8/2026 jich bylo 28) zůstaly funkční
a spoléhá se na to, že si jejich majitelé nastaví nové heslo sami při dalším
přihlášení (`must_change`). **Dokud to neudělají, jejich původní – prozrazené –
heslo pořád platí.** Za pár týdnů je proto potřeba se podívat do administrace
(📊 Online historie) a workflow „Zneplatnit hesla nepoužívaných účtů" pustit
znovu; komu se to mezitím změnilo, ten už `zneplatneno` nedostane a nic se mu
nestane. Bez toho kroku tam ty účty zůstanou otevřené natrvalo.

**Verze pro cache:** `?v=…` u skriptů a stylů v `index.html` je potřeba po každé
změně v `js/` nebo `css/` ručně zvýšit, jinak lidem zůstane stará verze.

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
