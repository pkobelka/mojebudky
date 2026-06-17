# AquaControll — plán a předání projektu

Interní PWA pro **VHOS a.s.** k evidenci a řízení provozních událostí,
incidentů a stížností ve vodovodech a kanalizacích.

> **Tento soubor je „předávací dokument".** Shrnuje aktuální stav, všechna
> dosavadní rozhodnutí o vzhledu a chování, a kompletní seznam funkcí k
> realizaci. Slouží k tomu, aby se v práci dalo plynule pokračovat (i v novém
> sezení nad repozitářem AquaControll).

---

## 🔒 Bezpečnostní zásada (nejdůležitější)
Aplikace je ve vývoji a testuje ji zatím jen autor. **NIKOMU nesmí chodit
žádné oficiální avízo** (e-mail, Web Push, SMS, telefon). Hlídá to centrální
vypínač v `config.py` (`TESTOVACI_REZIM=True`, `NOTIFIKACE_AKTIVNI=False`,
`notifikace_povoleny()` → `False`). Veškerý notifikační kód to MUSÍ
respektovat. Notifikace se zapnou až vědomě, po dokončení.

---

## Aktuální stav (hotovo)
- **Databáze SQLite** (`inicializace_databaze.py`), plněná ze seed CSV (`seed/`).
- Tabulky: `strediska`, `lokality`, `uzivatele`, `udalosti`, `ukoly`,
  `udalost_informovani`.
- **Seed data:** 15 lidí, 124 vodovodů, 5 provozních středisek + VHOS,
  2 vzorové události (stížnost Boršov 86; bakteriologický nález Lubná) s úkoly
  a informovanými.
- **Živý dashboard** (`web/index.html`, `css/style.css`, `js/app.js`) – už zanesený
  nový vzhled: hlavička s kapkou + místem pro logo VHOS (`VHOS.png`), proužek
  datum/čas (živé hodiny) + online monogramy (zatím ukázkové) + tlačítko
  „＋ Nová událost" (+ plovoucí na mobilu), souhrn (3 karty), 3D dlaždice v
  pořadí dle `poradi` (bez VHOS) s odznaky a legendou závažnosti, sekce
  „Aktuální události" (jen otevřené, prázdný stav „Vše vyřešeno"), jemná tapeta
  piktogramů (`EAG_picto_1..7.png`). Data přes `export_dashboard_data.py` →
  `web/data.json`, spuštění `python3 spustit_web.py`.
- **Hotovo dále:** klik na dlaždici/událost (rozbalení detailu události); detail
  střediska (historie + vodovody) je zatím zástupný (`detailStrediska()`).
- **config.py** – kill-switch notifikací.

### Datová rozhodnutí (už zapracovaná v seedu/kódu)
- **VHOS = ředitelství**, ne provozní středisko (nemá vodovody, jen lidi
  nadřazené střediskům). Na dashboardu se NEzobrazuje jako dlaždice ani se
  nepočítá mezi střediska.
- **Pořadí dlaždic** (sloupec `strediska.poradi`): horní řada Moravská Třebová(1),
  Polička(2), Jevíčko(3); spodní Svitavy(4), Litomyšl(5).
- **Závažnost = 5 stupňů:** `provereni` (neověřené hlášení k prověření),
  `nizka`, `stredni`, `vysoka`, `kriticka`. „Kritická" jen pro mimořádné
  události. Přesné definice doladit s technologem.
- **Monogramy ředitelů podle funkce:** Kobelka **TŘ**, Zvejška **PŘ**,
  Drábková **GŘ**; ostatní podle jména (AB, BK, LV…). Všechny unikátní.

---

## 🎨 Vzhled (odsouhlasené návrhy – zatím jen jako mockupy, NUTNO zanést do web/)
- **Hlavička:** vlevo **kapka AquaControll se znakem VHOS uvnitř** + název
  „AquaControll" (bez podtitulu); vpravo **logo VHOS a.s.** (znak + text).
  Skutečné soubory: `web/VHOS.png`. *(Můj kreslený znak je jen placeholder.)*
- **3D vystouplé dlaždice** středisek (vrchní lesk, barevná „hrana" podle
  nejvyšší závažnosti otevřených událostí, jemný stín).
- **Jemná tapeta** ze 7 piktogramů (`web/EAG_picto_1..7.png`) přes celou
  plochu (~5–6 % krytí). Doladit hustotu/sílu. *(Co je `Pepsina.png`? – zjistit.)*
- **Souhrn:** 3 kachličky – Otevřených událostí / Vysoká závažnost / Kritická.
  (Kachličku „Středisek" a počet lidí NEzobrazovat.)
- **Legenda závažnosti** (Prověření → Kritická) u sekce středisek.
- **Dlaždice ukazují jen počet vodovodů** (ne lidí).
- Barvy: modrá #1e8fe0 / tmavá #0b3a66; závažnost: provereni=šedá,
  nizka=#7e92a8, stredni=modrá, vysoka=oranžová #e8881b, kriticka=červená #e23b3b.

---

## 🗺️ Funkce k realizaci (roadmap)

### Dashboard / navigace
- 🗓️ **Proužek nahoře:** den + datum + čas (živě, např. „Úterý 16. 6. 2026 · 18:39").
- 👥 **Kdo je online** – monogramy (TŘ · BK · LV), zeleně. Detekce přes
  „heartbeat" (klient se každých pár s ozve, po ~1 min nečinnosti zhasne).
- ➕ **Tlačítko „Nová událost"** (+ plovoucí kulaté ＋ na mobilu).
- 📋 **Dole jen OTEVŘENÉ události** (nové + v řešení), přejmenovat na
  „Aktuální události". Prázdný stav = zelené „✅ Vše vyřešeno".
- 🖱️ **Aktivní dlaždice** (i s nulou) → detail střediska: **historie všech
  událostí** + **seznam vodovodů**; u vodovodu s událostí **číslo (počet závad)**.
- 💧 **Klikací jsou jen vodovody s číslem** → historie konkrétního vodovodu;
  vodovody bez události jen vypsané (neklikací).

### Přihlášení a bezpečnost
- 🌐 **Veřejná HTTPS adresa** (přístup z mobilu v terénu odkudkoliv).
- 🔐 **PIN + zapamatovat zařízení** (zadá jednou, dál jen otevře a je přihlášen).
- 👤 **Uzavřený seznam lidí** (účty zakládá jen admin), zamykání po špatných
  pokusech, zahashované PINy.
- 📜 **Historie přihlášení** (admin) + volitelně **audit akcí** (kdo co udělal).

### Události a úkoly
- 📝 **Formulář nové události:** typ, středisko, vodovod, adresa/GPS, popis,
  závažnost, kdo nahlásil; přílohy; označení lidí (řešitel + informovaní).
- 🎤📷📎 **Přílohy:** hlasová zpráva (nahrávání mikrofonem v PWA), fotka, soubor.
  → nová tabulka `prilohy` (typ audio/foto/soubor, kdo, kdy).
- ⏰ **Úkoly s termínem (datum + hodina):** označení splnění fajfkou (kdo, kdy,
  volitelně hlasovka). Notifikace **po termínu** (nesplněno) a **o splnění**
  (informovaným). → doplnit `ukoly`: termín s časem, `dokoncil_id`, pozn. splnění.
- 🔔 **Potvrzení příjmu notifikace** („Beru na vědomí") – u každého informovaného
  viditelný stav (✅ potvrdil čas / ⏳ nepotvrdil), zápis do historie; volitelná
  eskalace při nepotvrzení.

### Komunikace
- ☎️ **„Zatelefonovat"** (jen přihlášený) → seznam lidí → ťuk vytáčí (`tel:`,
  1:1, zdarma).
- 👥 **Konferenční porada** k události: **Jitsi** (online místnost, zdarma) /
  WhatsApp skupina / **Twilio** (skutečné zvonění na mobily, placené per minuta).

### Organizace
- 🧪 **Skupina „Laboratoř"** (jako ředitelství – ne provozní středisko) + její
  lidi (seznam dodá uživatel).

### Nápady do budoucna
- 🗺️ mapa událostí (GPS), 📊 statistiky, 📅 kalendář odběrů, 🔎 filtrování/hledání,
  lepší využití plochy na velkém monitoru vs. mobilu.

---

## Architektura (cílová)
Z dnešní statické appky se stane **živá webová aplikace**: malý **Python backend**
(Flask/FastAPI) nad SQLite, **veřejná HTTPS** (např. Render/Railway/VPS). Backend
je potřeba pro: online přítomnost, přihlášení, notifikace, přílohy, audit.

## Otevřené body k doladění
- přesné **definice stupňů závažnosti** (s technologem),
- detaily **auditu** (co logovat, jak dlouho držet, kdo vidí),
- účel souboru **`Pepsina.png`**,
- volba **konference** (Jitsi zdarma vs. Twilio placené).
