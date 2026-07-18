#!/usr/bin/env python3
"""
Florián – hromadné přidání lidí do týmu (RTDB florian_lide)
=============================================================
Spouští se ručně přes .github/workflows/seed-florian-lide.yml.
Přidá lidi ze seznamu PEOPLE do uzlu `florian_lide` (jméno, role, pracoviště).
Idempotentní: koho už podle jména v seznamu je, přeskočí (nezaloží duplicitu).
Sdílí Firebase projekt moje-budky.

Role: Admin / TŘ / PŘ / Technik (stejné jako v appce).
"""

import time
import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL    = 'https://moje-budky-default-rtdb.firebaseio.com'
NODE            = 'florian_lide'

# (jméno, role, pracoviště)  – pracoviště prázdné = všechna (upraví se v appce)
PEOPLE = [
    ('Petr Kobelka',  'Admin',   ''),
    ('Tomáš Zvejška', 'PŘ',      ''),
    ('Dana Mikulková', 'Technik', ''),
]


def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    cur = db.reference(NODE).get() or {}
    existing = {
        (v.get('jmeno') or '').strip()
        for v in cur.values() if isinstance(v, dict)
    }

    added = 0
    for jmeno, role, prac in PEOPLE:
        if jmeno in existing:
            print(f'  = {jmeno} už v týmu je – přeskakuji')
            continue
        db.reference(NODE).push({
            'jmeno': jmeno,
            'role': role,
            'pracoviste': prac,
            'ts': int(time.time() * 1000),
        })
        print(f'  + {jmeno} ({role})')
        added += 1

    print(f'\nHotovo: přidáno {added} osob.' if added else '\nNic nového – všichni už v týmu byli.')


if __name__ == '__main__':
    main()
