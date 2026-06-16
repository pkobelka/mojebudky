# AquaControll

Interní webová aplikace (PWA) pro **VHOS a.s.** k evidenci a řízení
provozních událostí, incidentů a stížností ve vodovodech a kanalizacích.

## Cíl

Centrální nástroj pro vedení společnosti i jednotlivá provozní střediska:

- evidence **incidentů** (havárie, špatné chemické/mikrobiologické rozbory,
  reklamace, individuální stížnosti občanů),
- přiřazování **úkolů** odpovědným pracovníkům,
- přehledný **dashboard** s notifikačními odznaky podle středisek,
- automatické **notifikace** (e-mail a Web Push) při založení nebo změně stavu.

## ⚠️ Testovací provoz – žádné notifikace

Aplikace je ve vývoji a testuje ji zatím jen autor. **Nikomu nesmí chodit
žádné oficiální avízo** (e-mail, Web Push, SMS). Brání tomu centrální
vypínač v `config.py`:

- `TESTOVACI_REZIM = True` a `NOTIFIKACE_AKTIVNI = False` (výchozí stav)
- Veškerý budoucí notifikační kód musí volat `config.notifikace_povoleny()`,
  které v testovacím režimu vrací `False` → nic se reálně neodešle.

Aktuálně navíc žádný odesílací kód neexistuje – projekt je jen lokální
SQLite databáze. (Skripty `send_push.py`, `rozeslat_sms.py` v kořeni repa
patří k jinému projektu a s AquaControll nesouvisí.)

## Dashboard

Vizuální přehled (dlaždice středisek s notifikačními odznaky + seznam událostí
s úkoly a informovanými). Statické HTML ve složce `web/`, čte `web/data.json`.

```bash
cd aquacontroll
python3 inicializace_databaze.py      # 1) založí/naplní databázi
python3 export_dashboard_data.py      # 2) vyexportuje web/data.json
python3 spustit_web.py                # 3) http://localhost:8000
```

> Dashboard se musí spouštět přes server (krok 3), ne přes `file://` –
> prohlížeč jinak zablokuje načtení `data.json`.

### Logo

- `web/img/logo.svg` – ikona aplikace (kapka vody + monitorovací křivka)
- `web/img/logo-wordmark.svg` – ikona s názvem
- `web/img/vhos-placeholder.svg` – **dočasný** placeholder, nahraď oficiálním
  logem VHOS a.s.

## Architektura (aktuální fáze)

- **Backend / data:** Python + SQLite (`data/aquacontroll.db`)
- Data se nejprve plní z CSV → SQLite (postupně doplňujeme)
- Frontend: PWA (bude doplněno)

### Organizační struktura

- **Střediska** (`strediska`) – provozní střediska a centrála VHOS
- **Uživatelé** (`uzivatele`) s rolemi: `Mistr`, `Technolog`, `Vedoucí`, `Director`
- **Události** (`udalosti`) – incidenty, volitelně s GPS (hl. bodové incidenty
  a stížnosti), navázané na středisko a lokalitu/vodovod
- **Úkoly** (`ukoly`) – konkrétní úkoly navázané na událost a řešitele

## Spuštění – inicializace databáze

```bash
cd aquacontroll
python3 inicializace_databaze.py
```

Skript je idempotentní – lze ho spustit opakovaně. Založí tabulky
`strediska`, `uzivatele`, `udalosti`, `ukoly` a naplní uživatele a střediska
ze seed souboru `seed/uzivatele.csv`.

### Seed data

- `seed/uzivatele.csv` – seznam pracovníků (UTF-8 s BOM, oddělovač `;`):
  `jmeno; prijmeni; zkratka; telefon; email; funkce; role; stredisko`
- `seed/lokality.csv` – vodovody/lokality:
  `stredisko; nazev; kod` (kód VF nemusí být unikátní)
- `seed/udalosti.csv` – události (vč. `vytvoril`/`prirazeno` = zkratka)
- `seed/ukoly.csv` – úkoly k událostem (`zalozil`/`prirazeno` = zkratka)
- `seed/informovani.csv` – informované osoby (CC) k události
- Střediska se zakládají automaticky podle sloupce `stredisko`
  (středisko `VHOS` = centrála).
- Role: `Mistr`, `Technolog`, `Vedoucí`, `Director`, `Dispečer`, `Informace`.

## Další kroky

- [x] Doplnit uživatele a střediska (15 lidí, 6 středisek)
- [x] Import dat z CSV (uživatelé)
- [x] Tabulka lokalit / vodovodů (124 vodovodů, seed `lokality.csv`)
- [x] Dashboard (dlaždice středisek + odznaky, seznam událostí)
- [x] Logo aplikace (návrh)
- [ ] Oficiální logo VHOS (nahradit placeholder)
- [ ] REST API / backend (živá data místo statického exportu)
- [ ] PWA – service worker, instalovatelnost
- [ ] Notifikace (e-mail, Web Push) – zatím vypnuté (`config.py`)
