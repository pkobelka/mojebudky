#!/usr/bin/env python3
"""
Zpracování seznamu správců z CSV → data/spravci_jmena.json
CSV obsahuje jen číslo budky, jméno, příjmení – žádná citlivá data.
Spuštění: python3 zpracuj_spravce.py spravci.csv
"""
import csv
import json
import re
import sys

def cistit_jmeno(s):
    if not s or not s.strip():
        return None
    # Odstraní emoji a nečíselné/nepísmenné znaky mimo běžnou diakritiku
    s = re.sub(r'[^\w\s\-áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]', '', s)
    s = s.strip()
    if not s:
        return None
    # Vezme jen první slovo (přezdívka nebo křestní jméno)
    prvni = s.split()[0]
    # Přeskočí zkratky jako "EŘ", jednopísmenné tokeny
    if len(prvni) <= 2 and prvni.isupper():
        zbyvajici = s.split()[1:]
        prvni = zbyvajici[0] if zbyvajici else None
    if not prvni:
        return None
    # Kapitalizace (zachová diakritiku)
    return prvni[0].upper() + prvni[1:].lower()

def zpracuj(csv_path, json_path):
    spravci = []

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        content = f.read()

    # Zjistí oddělovač (středník nebo čárka)
    sep = ';' if content.count(';') > content.count(',') else ','

    reader = csv.reader(content.splitlines(), delimiter=sep)
    rows = list(reader)

    for row in rows:
        if len(row) < 2:
            continue
        # Přeskočí záhlaví (neobsahuje číslo budky jako číslo)
        cislo_raw = row[0].strip()
        if not cislo_raw.isdigit():
            continue

        cislo = int(cislo_raw)
        jmeno_raw = row[1].strip() if len(row) > 1 else ''
        jmeno = cistit_jmeno(jmeno_raw)

        if jmeno:
            spravci.append({'cislo': cislo, 'jmeno': jmeno})

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(spravci, f, ensure_ascii=False, indent=2)

    print(f"Správců se jménem: {len(spravci)}")
    jmena = sorted(set(s['jmeno'] for s in spravci))
    print(f"Unikátních jmen: {len(jmena)}")
    print(f"Seznam: {', '.join(jmena)}")

if __name__ == '__main__':
    csv_path  = sys.argv[1] if len(sys.argv) > 1 else 'spravci.csv'
    json_path = sys.argv[2] if len(sys.argv) > 2 else 'data/spravci_jmena.json'
    zpracuj(csv_path, json_path)
