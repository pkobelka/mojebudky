# AquaControl – stav projektu (handoff)

> Poslední aktualizace: 2026-06-24. Tenhle soubor slouží k navázání v novém chatu.

## Co to je
**AquaControl** = webová PWA pro evidenci mimořádných událostí na vodárenské infrastruktuře VHOS („mimka" / klikací prototyp). Vše je v jednom souboru **`aqua/index.html`** (inline CSS+JS), + ikony, `manifest.json`, `sw.js`.

- **Živá adresa:** https://pkobelka.github.io/mojebudky/aqua/ (GitHub Pages z větve `main`).
- **Vývojová větev:** `claude/epic-feynman-hqyngr`. Po každé změně se pushuje na větev **i** na `main` (fast-forward) → web se hned aktualizuje.
- **Náhled větve bez nasazení:** htmlpreview.github.io/?https://github.com/pkobelka/mojebudky/blob/claude/epic-feynman-hqyngr/aqua/index.html
- Pozn.: stále jde o **mimku** – nic se reálně neukládá ani neodesílá (žádné push/e-mail/SMS, to až s backendem).

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
- **Chlorace:** Moravská Třebová (původní), **Svitavy 13**, **Jevíčko 20**, **Polička 12** (placeholder – jen názvy + chlornan/plynný, čeká na podrobný seznam s typy čerpadel a dávkováním).
- **Ponorná čerpadla** (pole `c`) doplněna k vrtům/zdrojům Svitavy, Litomyšl, Jevíčko, Polička (MT už byla). Vynechané zdroje bez objektu v datech: Pohledy P-2, Sklené SN-1, Budislav S-2, Polička V-7/V-8, Pustá Kamenice PKV-3.
- **Kontakty:** všech 19 lidí má telefon; bez e-mailu zůstávají **Radovan Selinger** a **Jiří Bombera**. Funkce vedení: GŘ=generální, PŘ=provozní, TŘ=technický ředitel (odhad z kódů, k potvrzení).

## CI / GitHub Actions
- `.github/workflows/firebase-deploy.yml` – nasazuje pravidla Firebase DB. Upraveno: běží **jen při změně** `database.rules.json`/`firebase.json`/workflow (ne při každém pushi), `firebase-tools@latest` (verze 13 neuměla ADC auth → nepinovat), retry 3×. Poslední běh zelený.
- `.github/workflows/send-push.yml` – ruční odeslání push notifikace (workflow_dispatch).

## Otevřené úkoly / nápady
1. **Polička chlorace** – nahradit placeholder podrobným seznamem (typy čerpadel, dávkování), až dorazí.
2. **Doplnit e-maily** Selinger, Bombera (zatím jen tel).
3. **Potvrdit funkce vedení** a případně doplnit funkce ostatním.
4. **Backend pro notifikace** (push + e-mail; SMS jen pro vysokou závažnost kvůli ceně) – zatím mimka.
5. **Samostatné repo pro AC** (mimo `mojebudky`) – nutno přepsat scope v `manifest.json`, `sw.js`, registraci SW v `index.html` (teď natvrdo `/mojebudky/aqua/`).
6. Případně propsat mail/tel do souhrnu události u řešitele/informovaných.

## Mimochodem (budky app)
- Oprava svátků: 23.6 = Zdeňka (ne Zdeněk), 8.5 = Den vítězství. Přihlašovací tlačítko „Vstup" → „Přihlášení".
- Pozn.: existuje stará divergentní lokální větev `main` z 4.6. (push notifikace v `auth.js`) – needěláno, k prověření zvlášť.
