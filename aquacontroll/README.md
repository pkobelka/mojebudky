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
`strediska`, `uzivatele`, `udalosti`, `ukoly` a vloží testovací data.

## Další kroky

- [ ] Doplnit další uživatele a střediska
- [ ] Import dat z CSV
- [ ] Tabulka lokalit / vodovodů (zatím jako textové pole v událostech)
- [ ] REST API / backend
- [ ] PWA frontend + dashboard
- [ ] Notifikace (e-mail, Web Push)
