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

# Středisko, které je centrálou společnosti (dostane příznak je_centrala=1)
CENTRALA = "VHOS"


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
    -- Závažnost / priorita
    zavaznost     TEXT    NOT NULL DEFAULT 'stredni'
                  CHECK (zavaznost IN ('nizka', 'stredni', 'vysoka', 'kriticka')),
    -- Stav řešení
    stav          TEXT    NOT NULL DEFAULT 'novy'
                  CHECK (stav IN ('novy', 'v_reseni', 'vyreseno', 'uzavreno')),
    stredisko_id  INTEGER REFERENCES strediska(id) ON DELETE SET NULL,
    lokalita_id   INTEGER REFERENCES lokality(id) ON DELETE SET NULL,  -- konkrétní vodovod
    lokalita      TEXT,                            -- volný text (pokud není v evidenci)
    -- Souřadnice jsou VOLITELNÉ (hl. u bodových incidentů a stížností)
    gps_lat       REAL,
    gps_lng       REAL,
    nahlasil      TEXT,                            -- kdo nahlásil (např. jméno občana)
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
    prirazeno_id  INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,  -- odpovědný pracovník
    stav          TEXT    NOT NULL DEFAULT 'novy'
                  CHECK (stav IN ('novy', 'probiha', 'hotovo', 'zruseno')),
    termin        TEXT,                             -- termín splnění (datum)
    vytvoreno     TEXT    NOT NULL,
    aktualizovano TEXT    NOT NULL,
    dokonceno     TEXT                              -- čas dokončení (NULL = nedokončeno)
);

-- Indexy pro častější dotazy (dashboard, notifikace)
CREATE INDEX IF NOT EXISTS idx_udalosti_stredisko ON udalosti(stredisko_id);
CREATE INDEX IF NOT EXISTS idx_udalosti_stav      ON udalosti(stav);
CREATE INDEX IF NOT EXISTS idx_ukoly_udalost      ON ukoly(udalost_id);
CREATE INDEX IF NOT EXISTS idx_ukoly_prirazeno    ON ukoly(prirazeno_id);
CREATE INDEX IF NOT EXISTS idx_lokality_stredisko ON lokality(stredisko_id);
CREATE INDEX IF NOT EXISTS idx_udalosti_lokalita  ON udalosti(lokalita_id);
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


def nyni() -> str:
    """Aktuální čas jako ISO řetězec (ukládáme jako TEXT)."""
    return datetime.now().isoformat(timespec="seconds")


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
        cur.execute(
            """INSERT INTO strediska (nazev, je_centrala, vytvoreno)
               VALUES (?, ?, ?)""",
            (nazev, je_centrala, nyni()),
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


def vypis_prehled(conn: sqlite3.Connection) -> None:
    """Vypíše krátkou rekapitulaci obsahu databáze."""
    cur = conn.cursor()
    print("\nPřehled databáze:")
    for tabulka in ("strediska", "lokality", "uzivatele", "udalosti", "ukoly"):
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

        vypis_prehled(conn)
        print("\nHotovo ✓")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
