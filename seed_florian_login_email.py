#!/usr/bin/env python3
"""
Florián – naplnění seznamu povolených přihlašovacích e-mailů
=============================================================
Zapíše do uzlu `florian_login_email` mapování klíč(e-mail) -> e-mail.
Appka Florián podle něj po přihlášení e-mailovým odkazem pozná, jestli má
uživatel přístup (admin má přístup vždy, i bez záznamu – přes ověřený claim).
Firebase pravidla čtou tenhle uzel jen pro přihlášené, měnit ho smí jen admin.

Sdílí Firebase projekt moje-budky (stejně jako AquaCtrl a budky).
Klíč = e-mail malými písmeny, tečky nahrazené čárkou (Firebase klíč nesmí mít ".").

Použití:
    python seed_florian_login_email.py                 # doplní chybějící ze seznamu EMAILY
    python seed_florian_login_email.py pridej <e-mail> # přidá/aktualizuje jeden e-mail

Existující záznamy (např. přidané přes appku „Přístup (e-maily)") se nepřepisují.
"""

import sys
import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL    = 'https://moje-budky-default-rtdb.firebaseio.com'
NODE            = 'florian_login_email'

# Povolené e-maily pro Florián (drž v souladu s týmem VHOS / AquaCtrl).
# Hodnota = samotný e-mail (appka jen kontroluje, že záznam existuje).
EMAILY = [
    'petr.kobelka@vhos.cz',      # Petr Kobelka (Admin)
    'tomas.zvejska@vhos.cz',     # Tomáš Zvejška
    'dana.mikulkova@vhos.cz',    # Dana Mikulková
    'ales.bubak@vhos.cz',        # Aleš Bubák
    'vladimir.halva@vhos.cz',    # Vladimír Halva
    'jan.rada@vhos.cz',
    'lukas.vykydal@vhos.cz',
    'zdenek.sojma@vhos.cz',
    'kamil.michalcak@vhos.cz',
    'zdenek.drabek@vhos.cz',
]


def key(email):
    return email.strip().lower().replace('.', ',')


def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})
    ref = db.reference(NODE)

    if len(sys.argv) >= 3 and sys.argv[1] == 'pridej':
        email = sys.argv[2].strip().lower()
        ref.child(key(email)).set(email)
        print(f'Přidáno: {email}')
        return

    existing = ref.get() or {}
    pridano = 0
    for email in EMAILY:
        email = email.strip().lower()
        k = key(email)
        if k in existing:
            print(f'  = {email} už povolený – přeskakuji')
            continue
        ref.child(k).set(email)
        pridano += 1
        print(f'  + {email}')

    print(f'\nHotovo: {pridano} nových povolených e-mailů (existující se nepřepisují).')


if __name__ == '__main__':
    main()
