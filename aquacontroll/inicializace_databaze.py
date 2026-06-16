#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AquaControll – inicializace databáze
====================================

Tento skript založí (pokud ještě neexistují) tabulky SQLite databáze pro
interní aplikaci AquaControll – evidenci provozních událostí, incidentů
a stížností ve vodovodech a kanalizacích (VHOS a.s.).

Tabulky:
    - strediska   ... provozní střediska / centrála
    - uzivatele   ... pracovníci a jejich role
    - udalosti    ... incidenty a události
    - ukoly       ... úkoly navázané na události

Skript je možné spustit opakovaně (idempotentní) – existující data
nepřepíše a testovací uživatele vloží jen jednou.

Spuštění:
    python3 inicializace_databaze.py
"""

import os
import csv
import sqlite3
from datetime import datetime

# Cesta k databázi: aquacontroll/data/aquacontroll.db (vedle tohoto skriptu)
ZAKLADNI_ADRESAR = os.path.dirname(os.path.abspath(__file__))
ADRESAR_DAT = os.path.join(ZAKLADNI_ADRESAR, "data")
CESTA_DB = os.path.join(ADRESAR_DAT, "aquacontroll.db")

# Seed data (verzovaná v gitu) – zdroj uživatelů a středisek
ADRESAR_SEED = os.path.join(ZAKLADNI_ADRESAR, "seed")
SEED_UZIVATELE = os.path.join(ADRESAR_SEED, "uzivatele.csv")
SEED_LOKALITY = os.path.join(ADRESAR_SEED, "lokality.csv")
SEED_UDALOSTI = os.path.join(ADRESAR_SEED, "udalosti.csv")
SEED_UKOLY = os.path.join(ADRESAR_SEED, "ukoly.csv")
SEED_INFORMOVANI = os.path.join(ADRESAR_SEED, "informovani.csv")

# Středisko, které je centrálou společnosti (dostane příznak je_centrala=1)
CENTRALA = "VHOS"

# Pořadí dlaždic středisek na dashboardu (organizační uspořádání).
# Horní řada: Moravská Třebová, Polička, Jevíčko; spodní: Svitavy, Litomyšl.
PORADI_STREDISEK = {
    "Moravská Třebová": 1,
    "Polička": 2,
    "Jevíčko": 3,
    "Svitavy": 4,
    "Litomyšl": 5,
    "VHOS": 0,
}


# --------------------------------------------------------------------------
# Definice schématu
# --------------------------------------------------------------------------

SCHEMA_SQL = """
-- Provozní střediska (a centrála společnosti)
CREATE TABLE IF NOT EXISTS strediska (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nazev        TEXT    NOT NULL UNIQUE,          -- např. "Moravská Třebová"
    kod          TEXT,                             -- krátký kód střediska, např. "MT"
    popis        TEXT,
    je_centrala  INTEGER NOT NULL DEFAULT 0,       -- 1 = centrála VHOS (nadřazená)
    poradi       INTEGER NOT NULL DEFAULT 100,      -- pořadí dlaždic na dashboardu
    vytvoreno    TEXT    NOT NULL
);

-- Uživatelé / pracovníci s přidělenou rolí
CREATE TABLE IF NOT EXISTS uzivatele (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    jmeno         TEXT    NOT NULL,
    zkratka       TEXT,                            -- iniciály, např. "TŘ", "AB"
    email         TEXT    UNIQUE,                  -- pro e-mailové notifikace
    telefon       TEXT,
    -- Systémová role; řídí oprávnění a notifikace
    role          TEXT    NOT NULL
                  CHECK (role IN ('Mistr', 'Technolog', 'Vedoucí', 'Director',
                                  'Dispečer', 'Informace')),
    funkce        TEXT,                            -- konkrétní pracovní pozice (text)
    stredisko_id  INTEGER REFERENCES strediska(id) ON DELETE SET NULL,
    aktivni       INTEGER NOT NULL DEFAULT 1,      -- 1 = aktivní účet
    vytvoreno     TEXT    NOT NULL
);

-- Lokality / vodovody spadající pod středisko
CREATE TABLE IF NOT EXISTS lokality (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nazev         TEXT    NOT NULL,                  -- název vodovodu
    kod           TEXT,                              -- VF kód (nemusí být unikátní)
    stredisko_id  INTEGER NOT NULL
                  REFERENCES strediska(id) ON DELETE CASCADE,
    poznamka      TEXT,
    vytvoreno     TEXT    NOT NULL,
    UNIQUE (stredisko_id, nazev)                     -- v rámci střediska unikátní název
);

-- Události / incidenty
CREATE TABLE IF NOT EXISTS udalosti (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    titul         TEXT    NOT NULL,
    popis         TEXT,
    -- Druh události
    typ           TEXT    NOT NULL DEFAULT 'jine'
                  CHECK (typ IN (
                      'havarie',                   -- havárie na síti
                      'rozbor_chemicky',           -- špatný chemický rozbor
                      'rozbor_mikrobiologicky',    -- špatný mikrobiologický rozbor
                      'reklamace',                 -- reklamace
                      'stiznost',                  -- individuální stížnost občana
                      'jine'
                  )),
    -- Závažnost / priorita (5 stupňů; 'kriticka' jen pro mimořádné události)
    -- 'provereni' = neověřené hlášení, které je teprve třeba prověřit
    zavaznost     TEXT    NOT NULL DEFAULT 'stredni'
                  CHECK (zavaznost IN ('provereni', 'nizka', 'stredni',
                                       'vysoka', 'kriticka')),
    -- Stav řešení
    stav          TEXT    NOT NULL DEFAULT 'novy'
                  CHECK (stav IN ('novy', 'v_reseni', 'vyreseno', 'uzavreno')),
    stredisko_id  INTEGER REFERENCES strediska(id) ON DELETE SET NULL,
    lokalita_id   INTEGER REFERENCES lokality(id) ON DELETE SET NULL,  -- konkrétní vodovod
    lokalita      TEXT,                            -- volný text (pokud není v evidenci)
    adresa        TEXT,                            -- adresa místa (např. "Boršov 86")
    -- Souřadnice jsou VOLITELNÉ (hl. u bodových incidentů a stížností)
    gps_lat       REAL,
    gps_lng       REAL,
    nahlasil      TEXT,                            -- kdo nahlásil (jméno občana)
    nahlasil_tel  TEXT,                            -- telefon nahlašovatele
    nahlaseno     TEXT,                            -- kdy bylo nahlášeno
    vytvoril_id   INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,
    prirazeno_id  INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,  -- odpovědný řešitel
    vytvoreno     TEXT    NOT NULL,
    aktualizovano TEXT    NOT NULL,
    uzavreno      TEXT                              -- čas uzavření (NULL = otevřená)
);

-- Úkoly navázané na konkrétní událost
CREATE TABLE IF NOT EXISTS ukoly (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    udalost_id    INTEGER NOT NULL
                  REFERENCES udalosti(id) ON DELETE CASCADE,
    nazev         TEXT    NOT NULL,
    popis         TEXT,
    zalozil_id    INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,  -- kdo úkol zadal
    prirazeno_id  INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,  -- odpovědný pracovník
    stav          TEXT    NOT NULL DEFAULT 'novy'
                  CHECK (stav IN ('novy', 'probiha', 'hotovo', 'zruseno')),
    termin        TEXT,                             -- termín splnění (datum)
    vytvoreno     TEXT    NOT NULL,
    aktualizovano TEXT    NOT NULL,
    dokonceno     TEXT                              -- čas dokončení (NULL = nedokončeno)
);

-- Informovaní k události (CC / „watchers"; zároveň budoucí příjemci notifikací)
CREATE TABLE IF NOT EXISTS udalost_informovani (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    udalost_id    INTEGER NOT NULL REFERENCES udalosti(id) ON DELETE CASCADE,
    uzivatel_id   INTEGER NOT NULL REFERENCES uzivatele(id) ON DELETE CASCADE,
    vytvoreno     TEXT    NOT NULL,
    UNIQUE (udalost_id, uzivatel_id)
);

-- Indexy pro častější dotazy (dashboard, notifikace)
CREATE INDEX IF NOT EXISTS idx_udalosti_stredisko ON udalosti(stredisko_id);
CREATE INDEX IF NOT EXISTS idx_udalosti_stav      ON udalosti(stav);
CREATE INDEX IF NOT EXISTS idx_ukoly_udalost      ON ukoly(udalost_id);
CREATE INDEX IF NOT EXISTS idx_ukoly_prirazeno    ON ukoly(prirazeno_id);
CREATE INDEX IF NOT EXISTS idx_lokality_stredisko ON lokality(stredisko_id);
CREATE INDEX IF NOT EXISTS idx_udalosti_lokalita  ON udalosti(lokalita_id);
CREATE INDEX IF NOT EXISTS idx_inform_udalost     ON udalost_informovani(udalost_id);
"""


# --------------------------------------------------------------------------
# Testovací data
# --------------------------------------------------------------------------

def nacti_seed_uzivatele() -> list[dict]:
    """Načte uživatele ze seed CSV (UTF-8 s BOM, oddělovač ';').

    Očekávané sloupce:
        jmeno; prijmeni; zkratka; telefon; email; funkce; role; stredisko
    """
    lide = []
    with open(SEED_UZIVATELE, encoding="utf-8-sig", newline="") as f:
        for radek in csv.DictReader(f, delimiter=";"):
            # vyčistit bílé znaky a prázdné hodnoty převést na None
            zaznam = {k.strip(): (v.strip() if v and v.strip() else None)
                      for k, v in radek.items()}
            if not zaznam.get("jmeno"):
                continue
            lide.append(zaznam)
    return lide


def nacti_seed_lokality() -> list[dict]:
    """Načte vodovody/lokality ze seed CSV.

    Očekávané sloupce:  stredisko; nazev; kod
    """
    lokality = []
    if not os.path.exists(SEED_LOKALITY):
        return lokality
    with open(SEED_LOKALITY, encoding="utf-8-sig", newline="") as f:
        for radek in csv.DictReader(f, delimiter=";"):
            zaznam = {k.strip(): (v.strip() if v and v.strip() else None)
                      for k, v in radek.items()}
            if not zaznam.get("nazev"):
                continue
            lokality.append(zaznam)
    return lokality


def nacti_seed_udalosti() -> list[dict]:
    """Načte události ze seed CSV.

    Očekávané sloupce (volitelné nechej prázdné):
        typ; titul; popis; zavaznost; stav; stredisko; lokalita; adresa;
        gps_lat; gps_lng; nahlasil; nahlasil_tel; nahlaseno
    """
    udalosti = []
    if not os.path.exists(SEED_UDALOSTI):
        return udalosti
    with open(SEED_UDALOSTI, encoding="utf-8-sig", newline="") as f:
        for radek in csv.DictReader(f, delimiter=";"):
            zaznam = {k.strip(): (v.strip() if v and v.strip() else None)
                      for k, v in radek.items()}
            if not zaznam.get("titul"):
                continue
            udalosti.append(zaznam)
    return udalosti


def _nacti_csv(cesta: str, povinny_sloupec: str) -> list[dict]:
    """Obecné načtení seed CSV (UTF-8 s BOM, ';') do seznamu slovníků."""
    zaznamy = []
    if not os.path.exists(cesta):
        return zaznamy
    with open(cesta, encoding="utf-8-sig", newline="") as f:
        for radek in csv.DictReader(f, delimiter=";"):
            zaznam = {k.strip(): (v.strip() if v and v.strip() else None)
                      for k, v in radek.items()}
            if zaznam.get(povinny_sloupec):
                zaznamy.append(zaznam)
    return zaznamy


def nyni() -> str:
    """Aktuální čas jako ISO řetězec (ukládáme jako TEXT)."""
    return datetime.now().isoformat(timespec="seconds")


def id_uzivatele(cur: sqlite3.Cursor, zkratka: str | None) -> int | None:
    """Vrátí id uživatele podle zkratky (např. 'AB'), jinak None."""
    if not zkratka:
        return None
    r = cur.execute("SELECT id FROM uzivatele WHERE zkratka = ?",
                    (zkratka,)).fetchone()
    return r[0] if r else None


def id_udalosti(cur: sqlite3.Cursor, titul: str | None) -> int | None:
    """Vrátí id události podle titulu, jinak None."""
    if not titul:
        return None
    r = cur.execute("SELECT id FROM udalosti WHERE titul = ?",
                    (titul,)).fetchone()
    return r[0] if r else None


def zaloz_schema(conn: sqlite3.Connection) -> None:
    """Vytvoří všechny tabulky a indexy."""
    conn.executescript(SCHEMA_SQL)
    conn.commit()


def vloz_strediska(conn: sqlite3.Connection, lide: list[dict]) -> None:
    """Založí střediska odvozená ze seznamu uživatelů (jen nová).

    Centrála (název == CENTRALA) dostane příznak je_centrala=1.
    """
    cur = conn.cursor()
    nazvy = sorted({u["stredisko"] for u in lide if u.get("stredisko")})
    for nazev in nazvy:
        existuje = cur.execute(
            "SELECT 1 FROM strediska WHERE nazev = ?", (nazev,)
        ).fetchone()
        if existuje:
            print(f"  • středisko již existuje: {nazev}")
            continue
        je_centrala = 1 if nazev == CENTRALA else 0
        poradi = PORADI_STREDISEK.get(nazev, 100)
        cur.execute(
            """INSERT INTO strediska (nazev, je_centrala, poradi, vytvoreno)
               VALUES (?, ?, ?, ?)""",
            (nazev, je_centrala, poradi, nyni()),
        )
        print(f"  + vloženo středisko: {nazev}"
              + (" (centrála)" if je_centrala else ""))
    conn.commit()


def vloz_uzivatele(conn: sqlite3.Connection, lide: list[dict]) -> None:
    """Vloží uživatele ze seedu (jen pokud ještě neexistují).

    Jméno skládá z 'jmeno' + 'prijmeni'. Středisko páruje podle názvu.
    """
    cur = conn.cursor()
    for u in lide:
        cele_jmeno = " ".join(p for p in (u.get("jmeno"), u.get("prijmeni")) if p)
        email = u.get("email")

        existuje = cur.execute(
            "SELECT 1 FROM uzivatele WHERE jmeno = ? OR (email IS NOT NULL AND email = ?)",
            (cele_jmeno, email),
        ).fetchone()
        if existuje:
            print(f"  • uživatel již existuje: {cele_jmeno}")
            continue

        nazev_strediska = u.get("stredisko")
        radek = cur.execute(
            "SELECT id FROM strediska WHERE nazev = ?", (nazev_strediska,)
        ).fetchone()
        stredisko_id = radek[0] if radek else None
        if stredisko_id is None and nazev_strediska:
            print(f"  ! upozornění: středisko '{nazev_strediska}' nenalezeno "
                  f"(uživatel {cele_jmeno} bude bez střediska)")

        cur.execute(
            """INSERT INTO uzivatele
                   (jmeno, zkratka, email, telefon, role, funkce,
                    stredisko_id, aktivni, vytvoreno)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (cele_jmeno, u.get("zkratka"), email, u.get("telefon"),
             u.get("role"), u.get("funkce"), stredisko_id, nyni()),
        )
        print(f"  + vložen uživatel: {cele_jmeno} "
              f"({u.get('role')} / {u.get('funkce')}, {nazev_strediska})")
    conn.commit()


def vloz_lokality(conn: sqlite3.Connection, lokality: list[dict]) -> None:
    """Vloží vodovody/lokality ze seedu (jen nové), párováno na středisko."""
    cur = conn.cursor()
    vlozeno = preskoceno = 0
    chybna_strediska = set()
    for l in lokality:
        nazev_strediska = l.get("stredisko")
        radek = cur.execute(
            "SELECT id FROM strediska WHERE nazev = ?", (nazev_strediska,)
        ).fetchone()
        if radek is None:
            chybna_strediska.add(nazev_strediska)
            continue
        stredisko_id = radek[0]
        existuje = cur.execute(
            "SELECT 1 FROM lokality WHERE stredisko_id = ? AND nazev = ?",
            (stredisko_id, l["nazev"]),
        ).fetchone()
        if existuje:
            preskoceno += 1
            continue
        cur.execute(
            """INSERT INTO lokality (nazev, kod, stredisko_id, vytvoreno)
               VALUES (?, ?, ?, ?)""",
            (l["nazev"], l.get("kod"), stredisko_id, nyni()),
        )
        vlozeno += 1
    conn.commit()
    print(f"  + vloženo {vlozeno} vodovodů, přeskočeno {preskoceno} (již existují)")
    if chybna_strediska:
        print(f"  ! střediska nenalezena (vodovody přeskočeny): "
              f"{sorted(chybna_strediska)}")


def vloz_udalosti(conn: sqlite3.Connection, udalosti: list[dict]) -> None:
    """Vloží události ze seedu (jen nové – párováno podle titulu + nahlaseno)."""
    cur = conn.cursor()
    for u in udalosti:
        cas = u.get("nahlaseno") or nyni()
        existuje = cur.execute(
            "SELECT 1 FROM udalosti WHERE titul = ? AND IFNULL(nahlaseno,'') = IFNULL(?, '')",
            (u["titul"], u.get("nahlaseno")),
        ).fetchone()
        if existuje:
            print(f"  • událost již existuje: {u['titul']}")
            continue

        # napárovat středisko a vodovod podle názvu
        stredisko_id = None
        if u.get("stredisko"):
            r = cur.execute("SELECT id FROM strediska WHERE nazev = ?",
                            (u["stredisko"],)).fetchone()
            stredisko_id = r[0] if r else None
        lokalita_id = None
        if u.get("lokalita") and stredisko_id:
            r = cur.execute(
                "SELECT id FROM lokality WHERE nazev = ? AND stredisko_id = ?",
                (u["lokalita"], stredisko_id)).fetchone()
            lokalita_id = r[0] if r else None

        vytvoril_id = id_uzivatele(cur, u.get("vytvoril"))
        prirazeno_id = id_uzivatele(cur, u.get("prirazeno"))

        cur.execute(
            """INSERT INTO udalosti
                   (titul, popis, typ, zavaznost, stav, stredisko_id, lokalita_id,
                    lokalita, adresa, gps_lat, gps_lng, nahlasil, nahlasil_tel,
                    nahlaseno, vytvoril_id, prirazeno_id, vytvoreno, aktualizovano)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (u["titul"], u.get("popis"), u.get("typ") or "jine",
             u.get("zavaznost") or "stredni", u.get("stav") or "novy",
             stredisko_id, lokalita_id,
             None if lokalita_id else u.get("lokalita"),
             u.get("adresa"), u.get("gps_lat"), u.get("gps_lng"),
             u.get("nahlasil"), u.get("nahlasil_tel"), u.get("nahlaseno"),
             vytvoril_id, prirazeno_id, cas, cas),
        )
        print(f"  + vložena událost: {u['titul']} "
              f"({u.get('typ')}, {u.get('stredisko')}/{u.get('lokalita') or '—'})")
    conn.commit()


def vloz_ukoly(conn: sqlite3.Connection, ukoly: list[dict]) -> None:
    """Vloží úkoly ze seedu (párováno na událost podle titulu)."""
    cur = conn.cursor()
    for t in ukoly:
        udalost_id = id_udalosti(cur, t.get("udalost"))
        if udalost_id is None:
            print(f"  ! úkol '{t.get('nazev')}' – událost '{t.get('udalost')}' "
                  f"nenalezena, přeskakuji")
            continue
        existuje = cur.execute(
            "SELECT 1 FROM ukoly WHERE udalost_id = ? AND nazev = ?",
            (udalost_id, t["nazev"]),
        ).fetchone()
        if existuje:
            print(f"  • úkol již existuje: {t['nazev']}")
            continue
        cur.execute(
            """INSERT INTO ukoly
                   (udalost_id, nazev, popis, zalozil_id, prirazeno_id,
                    stav, termin, vytvoreno, aktualizovano)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (udalost_id, t["nazev"], t.get("popis"),
             id_uzivatele(cur, t.get("zalozil")),
             id_uzivatele(cur, t.get("prirazeno")),
             t.get("stav") or "novy", t.get("termin"), nyni(), nyni()),
        )
        print(f"  + vložen úkol: {t['nazev']} "
              f"(zadal {t.get('zalozil')} → řeší {t.get('prirazeno')})")
    conn.commit()


def vloz_informovani(conn: sqlite3.Connection, zaznamy: list[dict]) -> None:
    """Doplní k událostem informované osoby (CC) – párováno podle titulu a zkratky."""
    cur = conn.cursor()
    for z in zaznamy:
        udalost_id = id_udalosti(cur, z.get("udalost"))
        uzivatel_id = id_uzivatele(cur, z.get("zkratka"))
        if udalost_id is None or uzivatel_id is None:
            print(f"  ! informovaný '{z.get('zkratka')}' u '{z.get('udalost')}' "
                  f"– nenalezeno, přeskakuji")
            continue
        cur.execute(
            """INSERT OR IGNORE INTO udalost_informovani
                   (udalost_id, uzivatel_id, vytvoreno) VALUES (?, ?, ?)""",
            (udalost_id, uzivatel_id, nyni()),
        )
        print(f"  + informován: {z.get('zkratka')} u '{z.get('udalost')}'")
    conn.commit()


def vypis_prehled(conn: sqlite3.Connection) -> None:
    """Vypíše krátkou rekapitulaci obsahu databáze."""
    cur = conn.cursor()
    print("\nPřehled databáze:")
    for tabulka in ("strediska", "lokality", "uzivatele", "udalosti", "ukoly",
                    "udalost_informovani"):
        pocet = cur.execute(f"SELECT COUNT(*) FROM {tabulka}").fetchone()[0]
        print(f"  - {tabulka:<10} {pocet} záznamů")


def main() -> None:
    os.makedirs(ADRESAR_DAT, exist_ok=True)
    print(f"Inicializace databáze: {CESTA_DB}\n")

    conn = sqlite3.connect(CESTA_DB)
    try:
        # Zapnout vynucování cizích klíčů (SQLite je má ve výchozím stavu vypnuté)
        conn.execute("PRAGMA foreign_keys = ON")

        print("Zakládám schéma (tabulky a indexy)...")
        zaloz_schema(conn)

        print(f"\nNačítám seed: {SEED_UZIVATELE}")
        lide = nacti_seed_uzivatele()
        print(f"  načteno {len(lide)} uživatelů")

        print("\nVkládám střediska...")
        vloz_strediska(conn, lide)

        print("\nVkládám uživatele...")
        vloz_uzivatele(conn, lide)

        lokality = nacti_seed_lokality()
        print(f"\nVkládám vodovody/lokality ({len(lokality)} v seedu)...")
        vloz_lokality(conn, lokality)

        udalosti = nacti_seed_udalosti()
        if udalosti:
            print(f"\nVkládám události ({len(udalosti)} v seedu)...")
            vloz_udalosti(conn, udalosti)

        ukoly = _nacti_csv(SEED_UKOLY, "nazev")
        if ukoly:
            print(f"\nVkládám úkoly ({len(ukoly)} v seedu)...")
            vloz_ukoly(conn, ukoly)

        informovani = _nacti_csv(SEED_INFORMOVANI, "zkratka")
        if informovani:
            print(f"\nVkládám informované ({len(informovani)} v seedu)...")
            vloz_informovani(conn, informovani)

        vypis_prehled(conn)
        print("\nHotovo ✓")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
