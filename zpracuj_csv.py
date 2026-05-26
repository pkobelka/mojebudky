#!/usr/bin/env python3
"""
Zpracování dat budek z CSV → budky.json + spravci.json + spravci_jmena.json
POZOR: CSV obsahuje osobní data (hesla, telefony, emaily) – NIKDY nekomitovat!
Exportuje POUZE veřejná data bez hesel.
Do spravci.json jdou pouze SHA-256 hashe hesel (bez plaintext hesel).
Do spravci_jmena.json jdou pouze křestní jména (pro svátek) – bez hesel, bez ID.
"""
import csv
import hashlib
import json
import re
import sys

ROMAN = {'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8,'IX':9,'X':10,'XI':11,'XII':12}

def roman_to_num(s):
    return ROMAN.get(s.upper())

def normaliz_datum(s):
    if not s or not s.strip():
        return None
    s = s.strip()
    m = re.match(r'^([IVX]+)\./(\d{2})$', s, re.I)
    if m:
        mon = roman_to_num(m.group(1).upper())
        if mon:
            return f"{mon}/{2000 + int(m.group(2))}"
    m = re.match(r'^(\d{1,2})\.([IVX]+)\.(\d{4})$', s, re.I)
    if m:
        mon = roman_to_num(m.group(2).upper())
        if mon:
            return f"{int(m.group(1))}.{mon}.{m.group(3)}"
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', s)
    if m:
        return s.strip()
    return s

def normaliz_druh(s):
    if not s:
        return None
    sl = s.lower()
    if 'adra' in sl:        return 'Sýkora koňadra'
    if 'mod' in sl:         return 'Sýkora modřinka'
    if 'paru' in sl:        return 'Sýkora parukářka'
    if 'vrab' in sl:        return 'Vrabec domácí'
    if 'sojk' in sl:        return 'Sojka obecná'
    return None

def parse_historie(s):
    if not s or not s.strip():
        return []
    results = []
    for part in re.split(r',\s*', s.strip()):
        part = part.strip()
        m = re.match(r'^(\d{2,4})[-\s]+(.+)$', part)
        if not m:
            continue
        yr = int(m.group(1))
        if yr < 100:
            yr += 2000
        species_raw = m.group(2).strip()
        species_raw = re.sub(r'\s+\d+x?\s*$', '', species_raw).strip()
        species_raw = re.sub(r'\s*[:;(].*$', '', species_raw).strip()
        if 'nic' in species_raw.lower():
            results.append({'rok': yr, 'obsazeno': None})
        else:
            druh = normaliz_druh(species_raw)
            results.append({'rok': yr, 'obsazeno': druh})
    return sorted(results, key=lambda x: x['rok'], reverse=True)

def zpracuj(csv_path, json_path):
    budky = []
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        rows = list(reader)

    for row in rows:
        if len(row) < 9:
            continue
        cislo_raw = row[2].strip() if len(row) > 2 else ''
        if not cislo_raw or not re.match(r'^\d+$', cislo_raw):
            continue
        cislo = int(cislo_raw)
        nazev    = row[3].strip() or None
        mm_raw   = row[4].strip()
        typ      = f"{mm_raw}mm" if mm_raw.isdigit() else None
        instalace = normaliz_datum(row[5]) if len(row) > 5 else None
        kdo_raw  = row[7].strip() if len(row) > 7 else ''
        lat_raw  = row[8].strip() if len(row) > 8 else ''
        lng_raw  = row[9].strip() if len(row) > 9 else ''
        try:
            lat = round(float(lat_raw), 5)
            lng = round(float(lng_raw), 5)
        except (ValueError, TypeError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        historie = parse_historie(kdo_raw)
        ptak = None
        stav = 'aktivni'
        for h in sorted(historie, key=lambda x: x['rok'], reverse=True):
            if h['obsazeno']:
                ptak = h['obsazeno']
                stav = 'osidlena'
                break
        budky.append({
            'cislo': cislo, 'nazev': nazev, 'typ': typ,
            'instalace': instalace, 'lat': lat, 'lng': lng,
            'ptak': ptak, 'stav': stav,
            'historie': historie if historie else None
        })

    budky.sort(key=lambda b: b['cislo'])
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(budky, f, ensure_ascii=False, indent=2)

    osidlene = sum(1 for b in budky if b['stav'] == 'osidlena')
    print(f"Budek celkem:        {len(budky)}")
    print(f"Osídlených:          {osidlene}")

def generate_spravci(csv_path,
                     out_path='data/spravci.json',
                     jmena_path='data/spravci_jmena.json'):
    """
    Generuje spravci.json (SHA-256 hashe hesel) a spravci_jmena.json (křestní jména).
    Formát CSV: ID ; HESLO ; Jméno ; Příjmení
    Do repozitáře jdou jen hashe a jména – nikdy plaintext hesla.
    """
    spravci = {}
    jmena = []
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        for row in reader:
            if len(row) < 2:
                continue
            login_id = row[0].strip()
            heslo    = row[1].strip()
            jmeno    = row[2].strip() if len(row) > 2 else ''
            if not re.match(r'^\d{6}$', login_id):
                continue
            if not heslo:
                continue
            spravci[login_id] = hashlib.sha256(heslo.encode('utf-8')).hexdigest()
            if jmeno:
                jmena.append({'jmeno': jmeno})

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(spravci, f, ensure_ascii=False, indent=2)
    print(f"Správci vygenerováni: {len(spravci)} záznamů → {out_path}")

    with open(jmena_path, 'w', encoding='utf-8') as f:
        json.dump(jmena, f, ensure_ascii=False, indent=2)
    print(f"Jména správců:        {len(jmena)} záznamů → {jmena_path}")


if __name__ == '__main__':
    csv_budky   = sys.argv[1] if len(sys.argv) > 1 else 'Seznam_budek.csv'
    json_budky  = sys.argv[2] if len(sys.argv) > 2 else 'data/budky.json'
    csv_hesla   = sys.argv[3] if len(sys.argv) > 3 else 'Seznam_s_hesly.csv'
    zpracuj(csv_budky, json_budky)
    generate_spravci(csv_hesla)
