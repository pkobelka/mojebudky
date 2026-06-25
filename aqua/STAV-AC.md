# AquaControl – stav projektu (handoff)

> Poslední aktualizace: 2026-06-25. Tenhle soubor slouží k navázání v novém chatu.

## Co to je
**AquaControl** = webová PWA pro evidenci mimořádných událostí na vodárenské infrastruktuře VHOS („mimka" / klikací prototyp). Vše je v jednom souboru **`aqua/index.html`** (inline CSS+JS), + ikony, `manifest.json`, `sw.js`.

- ⚠️ **ŽIVÁ adresa je teď nové repo:** **https://pkobelka.github.io/aquacontrol/** (samostatné repo `pkobelka/aquacontrol`, viz úkol 5). Stará `https://pkobelka.github.io/mojebudky/aqua/` je legacy – po ověření ke smazání.
- **Dvě kopie kódu:** vývoj/editace probíhá v `mojebudky/aqua/` (na větvi `claude/adoring-ritchie-wp9fcu`), protože chat má GitHub přístup jen k `mojebudky`. **Do `aquacontrol` chat nemůže pushovat** → změny se uživateli posílají jako soubory k ručnímu nahrání (cesty přepsané `/mojebudky/aqua/` → `/aquacontrol/`). Až bude čas, sjednotit na jeden zdroj (ideálně jen `aquacontrol`).
  - ⚠️ **Past při ručním uploadu:** prohlížeč při stahování `index.html` přidá `(n)` (`index (6).html`) a GitHub „Upload files" to pak založí jako **nový soubor**, ne přepis → web dál servíruje starý `index.html`. Po nahrání vždy ověřit, že obsah je opravdu v souboru **`index.html`** (ne `index (n).html`), případně přejmenovat. (Stalo se 25.6. – odhalilo se to tak, že živá lišta zůstávala stará i v anonymním okně.)
- Pozn.: stále jde o **mimku** – události se reálně neukládají; **push ale funguje** (jediné reálně odesílané), a to i **automaticky při vzniku události** (viz Push). E-mail/SMS až s backendem.

## Hlavní datové struktury v `aqua/index.html`
- `STR` – střediska + počty objektů po kategoriích [Vodovody,Vodojemy,Prameniště,Studny,Vrty,Chlorace,Ostatní].
- `OBJEKTY` – objekty po střediscích a typech (vrt/studna/vodojem/chlorace…), pole `n` (název), `p` (popis), `c` (info o čerpadle – ukáže se po kliku na 🔧), `lat/lon`.
- `PLAN` – Plán vzorkování (1005 položek, `datum` + `misto` + `rozsah`).
- `LIDE` `[kód, jméno]` + `LIDE_R` (řazení: vedení GŘ/PŘ/TŘ první, pak abecedně).
- `KONTAKTY` – kód → `{funkce, mail, tel}` (zdroj pro stránku Kontakty).
- `CISTERNY` – 11 cisteren (objem, typ, stanoviště, SPZ, oprávnění, dispo, pozn.).
- `NABIDKA` – nabídka typů událostí (krok 1 wizardu).

## Hotové funkce
- **Wizard Nová událost** (4 kroky: Co se stalo / Kde / Podrobnosti / Úkoly a lidé).
- **Krok Kde:** upřesnění adresy; u „Čištění vodojemu" výběr **více dotčených vodovodů**.
- **Náhradní zásobování cisternou** (krok Podrobnosti) – výběr cisterny, dostupnost, místo přistavení, čas (minuty po 10).
- **Kolize s plánem vzorkování** (krok Podrobnosti): auto varování (🔴/🟡/🟢) podle data události + dotčených míst, a ruční „Prověřit v plánu" – zobrazí **celý plán** od data události, dotčená místa zvýrazněná 📍, vzorky lze označit k přesunu.
- **Krok Úkoly a lidé:** víc úkolů („＋ Další úkol"), upozornění per úkol, informování za celou událost; minuty po 10 / auto 00.
- **Přehled objektů** (mobil ok), 🔧 info o čerpadle na klik.
- **Plán vzorkování:** otevírá se vždy na dnešním datu, šipky ◀/▶ na sousední dny.
- **Kontakty** (menu) – jména, funkce, mail (mailto)/tel (tel:).
- **Online** u data ukazuje příjmení.

## Data doplněná z podkladů
- **Chlorace:** Moravská Třebová (původní), **Svitavy 13**, **Jevíčko 20**, **Polička 12** (✅ doplněno z podkladu „Chlorátory Polička": typ čerpadla Grundfos SMART Digital DDE / Sebranice JESCO C7700, řešení dávkování, dávkování v %; GPS spárováno dle objektů).
- **Ponorná čerpadla** (pole `c`) doplněna k vrtům/zdrojům Svitavy, Litomyšl, Jevíčko, Polička (MT už byla). Vynechané zdroje bez objektu v datech: Pohledy P-2, Sklené SN-1, Budislav S-2, Polička V-7/V-8, Pustá Kamenice PKV-3.
- **Kontakty:** všichni mají telefon. **Jiří Bombera** – doplněn mail `jiri.bombera@cevak.cz`. **Radovan Selinger** – odebrán z LIDE i KONTAKTY (bez mailu, nejistá příslušnost do uzavřené skupiny). Funkce vedení: GŘ=generální, PŘ=provozní, TŘ=technický ředitel (**potvrzeno**).
- **GPS chlorací:** chlorovací zařízení sedí na objektech, jejichž GPS je v `OBJEKTY`. Doplněno `lat/lon` k 66 ze 71 chlorací (spárováno podle názvu objektu/obce a objemu vodojemu). Bez GPS zůstává 5: importní artefakty „V Mor.Třebové 22.6.2026", „Vypracoval: Vykydal", „V Litomyšli 22.6.2026", dále **Chotěnov** (nechloruje se – přesunuto na VDJ Hraničky) a **Bezděčí – ATS** (chybí objekt s GPS).

## Logo / branding
- Zdroj: **`aqua/logo-ac.png`** (mockup odznaku na zdi, 2220×1888, nahrál uživatel). Z něj vyříznut kruhový odznak (střed ~1114,940, r≈704) a vygenerovány:
  - `logo-ac-icon.png` (256, průhledné pozadí) – použito v **hlavičce** místo původní SVG kapky.
  - `logo-ac-512.png` (512, průhledné) – čistý master.
  - `icon-512/192/180/32/16.png` – PWA/favicon, kruh na **bílém čtverci** (kvůli maskable), regenerováno ze zdroje.
- Generátor (jednorázový, není v repu): `scratchpad/gen.js` přes `pngjs` (area-resample, premultiplied alpha). Při výměně loga znovu spustit a bumpnout `CACHE` v `sw.js`.
- Pozn.: v malých velikostech (16/32 px) je vnitřní text odznaku nečitelný – čte se jako barevný kroužek „AC". Pro ostrou malou ikonu by chtělo samostatnou značku jen „AC".

## Push notifikace (FCM) – ✅ FUNGUJE (ruční i auto při vzniku události, otestováno PC i Android)
- **Auto-push při vzniku události – ✅ HOTOVO a otestováno end-to-end (25.6.).** Wizard v kroku 4 (`acSendEvent` v `index.html`) zapíše do RTDB **`aqua_outbox`** `{title, body, targets, ts}`. Cloud Function **`aquaNotify`** (`functions/index.js`, 1st gen, trigger `onCreate` na `/aqua_outbox/{id}`, region `us-central1`) najde tokeny adresátů a pošle FCM; do záznamu dopíše `status` (`sent`/`no-recipients`) + `sent`/`fail`.
  - **`targets`** = sjednocení řešitelů + „upozornit" + „informovat" (kódy z `LIDE`). **Prázdné `targets` = broadcast všem.** Jinak se pošle jen tokenům, jejichž `person` je v `targets` → **uživatel si musí na svém zařízení dát „Povolit notifikace" a vybrat sebe v „Kdo jsi?"**, jinak má token bez `person` a push mu nepřijde (`no-recipients`).
  - **Deploy:** workflow `firebase-deploy.yml` (push do `main` při změně `functions/**` nebo ruční `workflow_dispatch`). Vyžaduje **Blaze** + povolené API Cloud Build/Artifact Registry – proto merge #65 (25.6. 12:38) na Spark/oprávnění **selhal**; po přepnutí na Blaze prošel běh 12:46 („functions[aquaNotify(us-central1)] Successful update operation"). Projekt je teď na **Blaze (Free Trial, 90 dní)**.
  - **Pozn. ke 2 kopiím:** funkce + outbox je nová věc – na živý `aquacontrol` se musel ručně nahrát aktualizovaný `index.html` (viz past s „index (n).html" výše).

- **Zprávy jsou `data-only`** (titulek/text v `data{}`), zobrazení řeší výhradně náš kód (SW na pozadí, `onMessage` na popředí) → **vždy jen jedna** notifikace (dřív chodily 2×, protože Firebase zobrazil jednu sám). Header `Urgency: high`.
- Notifikace má **`requireInteraction: true`** → zůstane na obrazovce do kliknutí (klik ji zavře a otevře appku).
- **FCM SW se auto-aktualizuje:** `firebase-messaging-sw.js` má `skipWaiting`/`clients.claim` a `index.html` ho při startu (pokud `ac_push_on`) tiše přeregistruje + `update()`. → nové verze SW se šíří samy, **netřeba mazat data webu** (to byl jediný způsob, jak prosadit změnu, dokud se SW registroval jen na klik).
- **Sdílí Firebase projekt `moje-budky`** (stejný config/VAPID jako budky appka, stejná doména) – netřeba nové klíče. Projekt je na **Spark (free)** – Cloud Functions by chtěly Blaze.
- `aqua/firebase-messaging-sw.js` – FCM service worker (vlastní úzký scope `/mojebudky/aqua/fcm/`, nekoliduje s offline `sw.js`), ikona + klik-URL na AC.
- `index.html` – Firebase compat SDK (app+database+messaging 10.12.2) + tlačítko **„🔔 Povolit notifikace"** v hlavičce. Token se ukládá do **`aqua_push_tokens/{id}`** (AC nemá login → `id` = trvalé náhodné z localStorage, klíč `ac_dev_id`).
- `database.rules.json` – přidán uzel `aqua_push_tokens`.
- `send_push_aqua.py` + workflow `.github/workflows/send-push-aqua.yml` (**Odeslat push (AquaControl)**, ruční spuštění) – pošle FCM všem/jednomu zařízení.
- **Jak otestovat:** 1) na živém webu (https, na iPhonu přidat na plochu) kliknout „Povolit notifikace" → povolit → tlačítko ukáže „✅". 2) GitHub → Actions → *Odeslat push (AquaControl)* → Run workflow (titulek+text) → notifikace dorazí (i offline).
- TODO: e-mail (zvoleno **Gmail SMTP / app password** – zatím neimplementováno), pak napojit na vznik události (řešitel/informovaní).

## CI / GitHub Actions
- `.github/workflows/firebase-deploy.yml` – nasazuje pravidla Firebase DB. Upraveno: běží **jen při změně** `database.rules.json`/`firebase.json`/workflow (ne při každém pushi), `firebase-tools@latest` (verze 13 neuměla ADC auth → nepinovat), retry 3×. Poslední běh zelený.
- `.github/workflows/send-push.yml` – ruční odeslání push notifikace pro **budky** (`push_tokens`).
- `.github/workflows/send-push-aqua.yml` – ruční odeslání push pro **AquaControl** (`aqua_push_tokens`).

## Otevřené úkoly / nápady
1. ~~**Polička chlorace** – nahradit placeholder podrobným seznamem (typy čerpadel, dávkování)~~ ✅ hotovo (z podkladu „Chlorátory Polička"). K prověření 2 párování GPS: „Pomezí VDJ (pro Květnou)" je nově na VDJ Pomezí (dle podkladu) místo dřívějšího VDJ Květná; „Pustá Kamenice úpravna vody" na Manipulačním vodojemu ÚV (není samostatný objekt ÚV).
2. ~~**Doplnit e-maily** Selinger, Bombera~~ ✅ Bombera `jiri.bombera@cevak.cz` doplněn; Selinger odebrán z appky (bez mailu, nejistá příslušnost do skupiny).
3. ~~Potvrdit funkce vedení~~ ✅ potvrzeno (GŘ/PŘ/TŘ). Případně doplnit funkce ostatním.
4. **Backend pro notifikace** – ✅ **push hotový a funkční, včetně auto-odeslání při vzniku události** (Cloud Function `aquaNotify` na Blaze, viz sekce *Push notifikace*). Ruční push z Actions (všem/jednomu) zůstává taky. Zbývá: **e-mail** (Gmail SMTP / app password) a SMS jen pro vysokou závažnost.
5. ~~**Samostatné repo pro AC**~~ ✅ **HOTOVO a živé.** Nové repo **`pkobelka/aquacontrol`** (public) → Pages **https://pkobelka.github.io/aquacontrol/**, secret `FIREBASE_SERVICE_ACCOUNT` nastaven, workflow „Odeslat push (AquaControl)" funguje. Jiná cesta `/aquacontrol/` = oddělený SW scope (vyřešilo „otevírá se jako mojebudky" i push na mobilu). Pozn.: existuje i omylem vzniklé prázdné repo **`AquaControll`** (2× L, privátní) – ke smazání.
6. Případně propsat mail/tel do souhrnu události u řešitele/informovaných.

## Mimochodem (budky app)
- Oprava svátků: 23.6 = Zdeňka (ne Zdeněk), 8.5 = Den vítězství. Přihlašovací tlačítko „Vstup" → „Přihlášení".
- Pozn.: existuje stará divergentní lokální větev `main` z 4.6. (push notifikace v `auth.js`) – needěláno, k prověření zvlášť.
