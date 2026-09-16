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

**Známá vada testu (9/2026):** na `_test` vrací `img/budky/*.jpg` chybu 403
Zakázáno, takže tam v bublinách nejsou vidět fotky budek. Na ostrém webu je
stejná složka v pořádku – ověřeno vedle sebe: `_test/img/179.jpg` se
servíruje, `_test/img/budky/111.jpg` ne, `mojebudky.cz/img/budky/111.jpg` ano.
Není to tedy příponou ani `.htaccess` (pravidla pro obrázky tam jsou, i přímo
v té složce), ale právy adresáře na disku, která FTP deploy nenastavuje.
Opravit jde jedině ručně u WEDOSu (FTP klient nebo souborový manažer, složce
práva 755 a souborům 644). Vědomě neřešeno – je to vada jen testovací kopie
a na ostrý web nemá vliv.

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

## Žádost o budku z webu (od 9/2026)

Kdo chce budku, vyplní na webu formulář **„🪺 Chci budku"** (tlačítko v bloku
o slíbených budkách). Dřív na to sloužil obecný kontakt a jméno, telefon
i adresu bylo potřeba vylovit z volného textu — odtud pocházejí díry
v datech slibů (chybějící měsíce, místo „Tady bude").

Telefon je povinný: bez něj není jak potvrdit založení žádosti, a formulář to
tak i říká. Žádost padá do `admin_requests/zpravy` s příznakem `typ: "budka"`
a s poli zvlášť (`telefon`, `obec`, `adresa`, `poznamka`), takže push
notifikace přijde stejnou cestou jako dosud, jen s vlastním nadpisem.

V administraci (📬 Žádosti → ✉️ Zprávy a žádosti) má taková žádost tlačítko
**„➕ Založit slib"** — formulář slibu se otevře předvyplněný a po uložení se
žádost sama označí jako vyřízená.

**Souřadnice z adresy:** formulář slibu i hromadný import umí místo dohledat
přes Nominatim (OpenStreetMap, zdarma a bez klíče). Volá to prohlížeč
přihlášeného admina, ne server. Nominatim si účtuje zhruba dotaz za vteřinu,
proto se v importu adresy hledají postupně s pauzou; co se nenajde, vypíše se
a do mapy se to nenahraje. Klikání do mapy zůstává jako druhá cesta a rozepsané
údaje se přitom neztrácejí.

---

## Sezóna osídlení (od 9/2026)

Osídlení je sezónní věc: hnízdí se od jara do konce léta, na podzim a v zimě
jsou budky prázdné. Mapa to od 9/2026 respektuje sama — `SEZONA_OD_MESIC`
a `SEZONA_DO_MESIC` v `js/mapa.js` (březen–srpen).

Mimo sezónu mapa osídlení vůbec neukazuje: žádná zelená ikona, žádný chip
v bublině, v legendě není položka „Osídlená budka" a dlaždice „Osídlených
budek" se nedá rozkliknout na filtr. Záznam „kdo hnízdí" ze správcovské
aplikace (`budky_edit/{cislo}/{rok}/kdo_hnizdi`) platí jen pro svůj rok, takže
se loňské osídlení na jaře samo neobnoví a nová sezóna se rozsvítí sama,
jakmile ji správci začnou zapisovat. **Ručně se tedy na jaře nic přepínat
nemusí.**

Statistiky zůstávají mimo sezónu na číslech ze `statistiky.json` (dlaždice
i panel druhů) — jsou to výsledky poslední sezóny, ne aktuální stav, a
popisek dlaždice se mimo sezónu mění na „Osídleno v sezóně {rok}". Kdyby
web měl na podzim ukazovat poctivé nuly, stačí ty dvě pojistky
(`_prepocitejDruhy` a přepis dlaždice v `inicializujMapu`) zase pustit.

Stavy v `data/budky.json` se po sezóně 2026 přepnuly na `aktivni` ručně
(37 budek) a `ptak` se u nich vyprázdnil — to pole patří aktuální sezóně,
kdo kdy hnízdil, se drží v `historie`. Budce 11 se přitom do `historie`
doplnila koňadra za rok 2025, jinak by ten záznam nikde nezůstal.

---

## Kdo u nás hnízdí – místo deníku správců (od 9/2026)

Sekce **„Z deníku správců"** na hlavní stránce skončila. Psané zápisy se
neujaly: nikdo do nich nepřispíval a poloprázdná sekce budila dojem, že se
o projekt nikdo nestará. Uzel `aktuality` ve Firebase ani pole `aktuality`
ve `statistiky.json` se ale nemazaly – data zůstala, jen je web nečte.
Uzel `aktivita` se dál plní i čte v administraci (📊 Online historie).

Na jejím místě je sekce **„Kdo u nás hnízdí"** (`#osidleni`). Nic se do ní
nepíše – skládá se sama z toho, co správci u budek stejně evidují:

- `historie` v `data/budky.json` (uzavřené roky),
- `budky_edit/{cislo}/{rok}/kdo_hnizdi` z Firebase (běžící sezóna).

Přepínač sezón ukazuje bilanci zvoleného roku: kolik budek bylo nahlášeno
jako osídlené a jaké druhy v nich hnízdily. Klik na kartu druhu zvýrazní
právě ty budky na mapě (`window._zvyraznitBudkyNaMape` v `js/mapa.js`) –
běžný filtr podle druhu na to nestačí, protože vychází z aktuálního stavu
budky, ne z historie.

Na rozdíl od panelu druhů v pravém sloupci tu **sezónní pojistka
`_jeSezonaOsidleni()` úmyslně neplatí**: přehled není aktuální stav mapy,
ale bilance sezóny, takže loňská čísla nemají v zimě mizet.

Čísla se můžou lišit od dlaždice „Osídlených budek". Ta počítá aktuální
stav (a mimo sezónu čísla ze `statistiky.json`), zatímco tady je součet
hlášení za daný rok – u části budek osídlení nahlášené není. Sekce to pod
kartami přiznává.

Data si sekce načítá vlastním `fetch` `data/budky.json` (stejná URL jako
v `mapa.js`, takže druhé volání sedí v cache). Je to schválně: přehled se
vykreslí i tehdy, když se mapa nenačte.

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
