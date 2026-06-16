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
import sqlite3
from datetime import datetime

# Cesta k databázi: aquacontroll/data/aquacontroll.db (vedle tohoto skriptu)
ZAKLADNI_ADRESAR = os.path.dirname(os.path.abspath(__file__))
ADRESAR_DAT = os.path.join(ZAKLADNI_ADRESAR, "data")
CESTA_DB = os.path.join(ADRESAR_DAT, "aquacontroll.db")


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
    lokalita      TEXT,                            -- konkrétní lokalita / vodovod
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
"""


# --------------------------------------------------------------------------
# Testovací data
# --------------------------------------------------------------------------

# Střediska (centrála + provozní střediska).
# Sloupce: nazev, kod, popis, je_centrala
TESTOVACI_STREDISKA = [
    ("VHOS (centrála)",  "VHOS", "Centrála společnosti VHOS a.s.",        1),
    ("Moravská Třebová", "MT",   "Provozní středisko Moravská Třebová",   0),
]

# Uživatelé. Sloupce: jmeno, zkratka, email, role, funkce, nazev_strediska
# POZN.: Ředitelské funkce (Provozní/Generální/Technický ředitel) mají
#        systémovou roli 'Director'; konkrétní titul je ve sloupci funkce.
#        E-maily a telefony zatím chybí (NULL) – doplníme dle skutečnosti.
TESTOVACI_UZIVATELE = [
    ("Tomáš Zvejška",       "PŘ", None,                 "Director",  "Provozní ředitel",    "VHOS (centrála)"),
    ("Jana Drábková",       "GŘ", None,                 "Director",  "Generální ředitelka", "VHOS (centrála)"),
    ("Aleš Bubák",          "AB", None,                 "Mistr",     "Mistr střediska",     "Moravská Třebová"),
    ("Blažena Kolaříková",  "BK", None,                 "Technolog", "Technolog",           "VHOS (centrála)"),
    ("Lukáš Vykydal",       "LV", None,                 "Vedoucí",   "Vedoucí střediska",   "Moravská Třebová"),
    ("Petr Kobelka",        "TŘ", "p.kobelka@gmail.com", "Director",  "Technický ředitel",   "VHOS (centrála)"),
]


def nyni() -> str:
    """Aktuální čas jako ISO řetězec (ukládáme jako TEXT)."""
    return datetime.now().isoformat(timespec="seconds")


def zaloz_schema(conn: sqlite3.Connection) -> None:
    """Vytvoří všechny tabulky a indexy."""
    conn.executescript(SCHEMA_SQL)
    conn.commit()


def vloz_strediska(conn: sqlite3.Connection) -> None:
    """Vloží testovací střediska (jen pokud ještě neexistují)."""
    cur = conn.cursor()
    for nazev, kod, popis, je_centrala in TESTOVACI_STREDISKA:
        existuje = cur.execute(
            "SELECT 1 FROM strediska WHERE nazev = ?", (nazev,)
        ).fetchone()
        if existuje:
            print(f"  • středisko již existuje: {nazev}")
            continue
        cur.execute(
            """INSERT INTO strediska (nazev, kod, popis, je_centrala, vytvoreno)
               VALUES (?, ?, ?, ?, ?)""",
            (nazev, kod, popis, je_centrala, nyni()),
        )
        print(f"  + vloženo středisko: {nazev}")
    conn.commit()


def vloz_uzivatele(conn: sqlite3.Connection) -> None:
    """Vloží testovací uživatele (jen pokud ještě neexistují)."""
    cur = conn.cursor()
    for jmeno, zkratka, email, role, funkce, nazev_strediska in TESTOVACI_UZIVATELE:
        existuje = cur.execute(
            "SELECT 1 FROM uzivatele WHERE jmeno = ? OR (email IS NOT NULL AND email = ?)",
            (jmeno, email),
        ).fetchone()
        if existuje:
            print(f"  • uživatel již existuje: {jmeno}")
            continue

        radek = cur.execute(
            "SELECT id FROM strediska WHERE nazev = ?", (nazev_strediska,)
        ).fetchone()
        stredisko_id = radek[0] if radek else None
        if stredisko_id is None:
            print(f"  ! upozornění: středisko '{nazev_strediska}' nenalezeno "
                  f"(uživatel {jmeno} bude bez střediska)")

        cur.execute(
            """INSERT INTO uzivatele
                   (jmeno, zkratka, email, role, funkce, stredisko_id, aktivni, vytvoreno)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?)""",
            (jmeno, zkratka, email, role, funkce, stredisko_id, nyni()),
        )
        print(f"  + vložen uživatel: {jmeno} ({role} / {funkce}, {nazev_strediska})")
    conn.commit()


def vypis_prehled(conn: sqlite3.Connection) -> None:
    """Vypíše krátkou rekapitulaci obsahu databáze."""
    cur = conn.cursor()
    print("\nPřehled databáze:")
    for tabulka in ("strediska", "uzivatele", "udalosti", "ukoly"):
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

        print("\nVkládám testovací střediska...")
        vloz_strediska(conn)

        print("\nVkládám testovací uživatele...")
        vloz_uzivatele(conn)

        vypis_prehled(conn)
        print("\nHotovo ✓")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
