#!/usr/bin/env python3
"""
MojeBudky – nahrání slíbených budek (míst, kde budka teprve bude)
=================================================================
Jednorázový převod bodů z pracovní mapy v Google My Maps do databáze.
Dál se sliby přidávají rovnou na webu: administrace → 📋 Slíbené budky →
„Přidat slib – klikem do mapy". Tenhle skript je jen na první dávku.

POZOR NA OSOBNÍ ÚDAJE: vstupní soubor obsahuje jména a telefony, takže
NESMÍ do repozitáře – proto je `prisliby.json` v .gitignore. Skript sám
žádná jména nevypisuje, logy GitHub Actions jsou u veřejného repa veřejné.

Zapisuje do dvou uzlů:
  prisliby/{c}       – jméno, telefon, místo, poznámka; čte jen admin
  prisliby_mapa/{c}  – jen číslo, souřadnice a měsíc; čte kdokoli (mapa)

Vstupní soubor (výchozí `prisliby.json`, jinak 1. argument) je seznam:
  [{"cislo": 1, "misto": "Vlašim", "jmeno": "Jan Novák",
    "lat": 49.70632, "lng": 14.89881,
    "telefon": "777...", "poznamka": "...", "mesic": "5/2026"}, ...]
Povinné je jen `jmeno`, `lat` a `lng`; `cislo` se doplní automaticky.

Idempotentní: záznam s týmž číslem přepíše, ostatní nechá být.
"""

import json
import os
import sys

import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL = 'https://moje-budky-default-rtdb.firebaseio.com'


def main():
    zdroj = sys.argv[1] if len(sys.argv) > 1 else 'prisliby.json'
    if not os.path.exists(zdroj):
        sys.exit(f'CHYBA: vstupní soubor {zdroj} neexistuje.')
    if not os.path.exists(SERVICE_ACCOUNT):
        sys.exit(f'CHYBA: chybí {SERVICE_ACCOUNT} (klíč servisního účtu).')

    with open(zdroj, encoding='utf-8') as f:
        polozky = json.load(f)

    firebase_admin.initialize_app(
        credentials.Certificate(SERVICE_ACCOUNT), {'databaseURL': DATABASE_URL})

    stavajici = db.reference('prisliby').get() or {}
    dalsi = max([int(k) for k in stavajici if str(k).isdigit()] + [0]) + 1

    updates = {}
    pocet_novych = pocet_prepsanych = 0
    for p in polozky:
        if not p.get('jmeno') or p.get('lat') is None or p.get('lng') is None:
            sys.exit(f'CHYBA: záznam bez jména nebo souřadnic: {p.get("cislo", "?")}')
        cislo = p.get('cislo')
        if cislo is None:
            cislo = dalsi
            dalsi += 1
        cislo = int(cislo)
        if str(cislo) in stavajici:
            pocet_prepsanych += 1
        else:
            pocet_novych += 1
        lat, lng = float(p['lat']), float(p['lng'])
        mesic = p.get('mesic', '')
        updates[f'prisliby/{cislo}'] = {
            'cislo': cislo, 'lat': lat, 'lng': lng,
            'misto': p.get('misto', ''), 'jmeno': p['jmeno'],
            'telefon': p.get('telefon', ''), 'poznamka': p.get('poznamka', ''),
            'mesic': mesic, 'sms': p.get('sms', False), 'ts': p.get('ts', 0),
        }
        # veřejná větev – schválně jen tohle, žádné jméno ani telefon
        updates[f'prisliby_mapa/{cislo}'] = {
            'cislo': cislo, 'lat': lat, 'lng': lng, 'mesic': mesic,
        }

    db.reference().update(updates)
    print(f'Hotovo: {pocet_novych} nových, {pocet_prepsanych} přepsaných '
          f'(celkem {len(polozky)} slibů). Jména se schválně nevypisují.')


if __name__ == '__main__':
    main()
