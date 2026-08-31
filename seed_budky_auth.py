#!/usr/bin/env python3
"""
MojeBudky – převod hesel správců do neveřejného uzlu budky_auth
================================================================
Spouští se ručně přes .github/workflows/seed-budky-auth.yml.

PROČ: hesla se dosud ověřovala v prohlížeči proti `data/spravci.json`
(215 neosolených SHA-256 hashů, veřejně servírovaný soubor ve veřejném repu)
nebo proti uzlu `hesla/{id}`, který měl `.read`/`.write: true`. Kdokoli si tedy
mohl hashe stáhnout a rozlousknout – a protože šlo i zapisovat, přepsat komukoli
heslo, aniž by to staré znal.

CO DĚLÁ: každý hash překlopí do uzlu `budky_auth/{loginId}` ve tvaru
    { alg: "scrypt-sha256", salt, hash, admin, must_change: True }
kde  hash = scrypt(legacy_sha256_hex, salt).

Díky tomu, že se protahuje ten starý SHA-256 hex (ne heslo samotné), nemusíme
hesla znát a všem dál fungují ta stávající. `budky_auth` v database.rules.json
NENÍ uvedený, takže kořenové `.read/.write: false` k němu klienta nepustí vůbec
a čte ho jen Cloud Function budkyLoginReq přes Admin SDK.

must_change=True: hashe byly veřejné, takže všechna stávající hesla považujeme
za prozrazená. Appka po přihlášení vynutí nastavení nového. Nikoho to nevyhodí,
ale prozrazená hesla postupně zmizí.

Zdroje hesel, v tomto pořadí (pozdější přebíjí dřívější):
  1) data/spravci.json  – původní dávka
  2) uzel `hesla` v RTDB – ten, kdo si heslo někdy změnil, má novější hash

Idempotentní: koho už v `budky_auth` najde, přeskočí (aby přeběh nezrušil heslo,
které si mezitím někdo nastavil). Přepis vynutíš přepínačem --prepsat-vse.
"""

import hashlib
import json
import os
import secrets
import sys
import time

import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL = 'https://moje-budky-default-rtdb.firebaseio.com'

ZDROJ_HESLA = 'data/spravci.json'
ZDROJ_INFO = 'data/spravci_info.json'
NODE = 'budky_auth'
LEGACY_NODE = 'hesla'

# musí sedět s konstantou SCRYPT ve functions/index.js, jinak se nikdo nepřihlásí
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def scrypt_hex(sha256_hex: str, salt_hex: str) -> str:
    return hashlib.scrypt(
        sha256_hex.encode('utf-8'),
        salt=bytes.fromhex(salt_hex),
        n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN,
    ).hex()


def nacti_json(cesta):
    if not os.path.exists(cesta):
        return {}
    with open(cesta, encoding='utf-8') as f:
        return json.load(f)


def main():
    prepsat_vse = '--prepsat-vse' in sys.argv

    legacy_soubor = nacti_json(ZDROJ_HESLA)
    info = nacti_json(ZDROJ_INFO)

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    legacy_db = db.reference(LEGACY_NODE).get() or {}
    stavajici = db.reference(NODE).get() or {}

    # kdo je admin, se dosud bralo z veřejného spravci_info.json (spravce == 'admin').
    # Od teď je to claim v tokenu, který vydá server – zdrojem pravdy je budky_auth.
    admini = {
        login_id for login_id, osoba in info.items()
        if isinstance(osoba, dict) and osoba.get('spravce') == 'admin'
    }
    if not admini:
        print('POZOR: ve zdroji nebyl nalezen žádný admin. '
              'Zkontroluj, že běžíš nad commitem, kde spravci_info.json ještě má pole `spravce`.')

    # slouč zdroje – novější hash z DB přebíjí ten ze souboru
    hesla = {}
    for login_id, h in legacy_soubor.items():
        if isinstance(h, str) and len(h) == 64:
            hesla[str(login_id)] = h
    prebito = 0
    for login_id, h in legacy_db.items():
        if isinstance(h, str) and len(h) == 64:
            if hesla.get(str(login_id)) not in (None, h):
                prebito += 1
            hesla[str(login_id)] = h

    davka = {}
    preskoceno = 0
    ts = int(time.time() * 1000)

    for login_id, legacy_hash in hesla.items():
        if login_id in stavajici and not prepsat_vse:
            preskoceno += 1
            continue
        salt = secrets.token_bytes(16).hex()
        davka[login_id] = {
            'alg': 'scrypt-sha256',
            'salt': salt,
            'hash': scrypt_hex(legacy_hash, salt),
            'admin': login_id in admini,
            'must_change': True,
            'ts': ts,
        }

    if not davka:
        print(f'Nic k zápisu – všech {preskoceno} účtů už v `{NODE}` je. '
              f'(Přepis vynutíš přepínačem --prepsat-vse.)')
        return

    db.reference(NODE).update(davka)

    print(f'Hotovo: {len(davka)} účtů zapsáno do `{NODE}` '
          f'(z toho {sum(1 for v in davka.values() if v["admin"])} adminů), '
          f'{preskoceno} přeskočeno.')
    print(f'Zdroje: {len(legacy_soubor)} ze souboru, {len(legacy_db)} z uzlu `{LEGACY_NODE}` '
          f'({prebito} novějších hashů z DB přebilo soubor).')
    print('\nVšem je nastaveno must_change=True – stávající hesla dál fungují, '
          'ale appka po přihlášení vynutí nové.')
    print('Teprve teď je bezpečné nasadit klienta, který se přihlašuje přes server.')


if __name__ == '__main__':
    main()
