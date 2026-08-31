#!/usr/bin/env python3
"""
MojeBudky – přesun kontaktních údajů správců z veřejného souboru do neveřejné DB
================================================================================
Spouští se ručně přes .github/workflows/seed-spravci-kontakt.yml.

PROČ: `data/spravci_info.json` se servíruje z webu i z veřejného repa a obsahuje
u 215 osob telefon, e-mail a datum narození. Tenhle skript ty tři údaje překlopí
do uzlu `spravci_kontakt`, který v `database.rules.json` NENÍ uvedený – kořen má
`.read/.write: false`, takže se k němu klient nedostane vůbec a čte ho jen
Admin SDK (Cloud Functions, servisní skripty). Teprve pak se smí z veřejného
souboru ty údaje smazat.

POŘADÍ: nejdřív spusť tenhle skript, ověř výpis, a AŽ POTOM slučuj commit, který
veřejný soubor osekává. Jinak se zdroj dat ztratí.

Idempotentní: existující záznam přepíše jen tehdy, když ve zdroji něco je.
Prázdné hodnoty nikdy nepřepisují už uloženou (mohla být mezitím upravená).
"""

import json
import os
import sys
import time

import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL = 'https://moje-budky-default-rtdb.firebaseio.com'
ZDROJ = 'data/spravci_info.json'
NODE = 'spravci_kontakt'

# Přesně tyhle údaje na veřejném webu nemají co dělat.
CITLIVA_POLE = ('telefon', 'email', 'datum_narozeni')


def main():
    if not os.path.exists(ZDROJ):
        sys.exit(
            f'CHYBA: {ZDROJ} neexistuje.\n'
            'Nejspíš už proběhl commit, který veřejný soubor osekal. '
            'Pusť tenhle skript nad commitem, kde údaje ještě jsou.'
        )

    with open(ZDROJ, encoding='utf-8') as f:
        info = json.load(f)

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    cur = db.reference(NODE).get() or {}
    ts = int(time.time() * 1000)

    zapsano = 0
    preskoceno = 0
    davka = {}

    for login_id, osoba in info.items():
        if not isinstance(osoba, dict):
            continue
        zaznam = {}
        for pole in CITLIVA_POLE:
            hodnota = (osoba.get(pole) or '').strip()
            if hodnota:
                zaznam[pole] = hodnota
        if not zaznam:
            preskoceno += 1
            continue
        # co už v DB je a ve zdroji chybí, se nepřepisuje
        stary = cur.get(login_id) or {}
        if isinstance(stary, dict):
            slouceny = dict(stary)
            slouceny.update(zaznam)
        else:
            slouceny = zaznam
        slouceny['ts'] = ts
        davka[login_id] = slouceny
        zapsano += 1

    if not davka:
        print('Nic k zápisu – zdroj neobsahuje žádné kontaktní údaje.')
        return

    db.reference(NODE).update(davka)

    s_tel = sum(1 for v in davka.values() if v.get('telefon'))
    s_mail = sum(1 for v in davka.values() if v.get('email'))
    s_nar = sum(1 for v in davka.values() if v.get('datum_narozeni'))
    print(f'Hotovo: {zapsano} osob zapsáno do `{NODE}` '
          f'(telefon {s_tel}, e-mail {s_mail}, datum narození {s_nar}); '
          f'{preskoceno} osob bez kontaktních údajů přeskočeno.')
    print('\nTeprve teď je bezpečné sloučit commit, který data/spravci_info.json osekává.')


if __name__ == '__main__':
    main()
