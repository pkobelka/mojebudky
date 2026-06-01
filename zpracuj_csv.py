#!/usr/bin/env python3
"""
Zpracování dat budek z CSV → budky.json + spravci.json
POZOR: CSV obsahuje osobní data (hesla, telefony, emaily) – NIKDY nekomitovat!
Exportuje POUZE veřejná data bez osobních údajů.
Do spravci.json jdou pouze SHA-256 hashe hesel (bez plaintext hesel).
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
    """Normalizuje datum instalace do čitelné podoby."""
    if not s or not s.strip():
        return None
    s = s.strip()
    # "III./22" → "3/2022"
    m = re.match(r'^([IVX]+)\./(\d{2})$', s, re.I)
    if m:
        mon = roman_to_num(m.group(1).upper())
        if mon:
            return f"{mon}/{2000 + int(m.group(2))}"
    # "3.III.2024" nebo "18.III.2024"
    m = re.match(r'^(\d{1,2})\.([IVX]+)\.(\d{4})$', s, re.I)
    if m:
        mon = roman_to_num(m.group(2).upper())
        if mon:
            return f"{int(m.group(1))}.{mon}.{m.group(3)}"
    # "1.3.2023" nebo "18.4.2024" — ponecháme
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', s)
    if m:
        return s.strip()
    return s

def normaliz_druh(s):
    """Normalizuje název druhu ptáka."""
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
    """
    Parsuje historii hnízdění z textu jako:
    '23-koňadra, 24-koňadra, 25-vrabec'
    '23-nic, 24-modřinka'
    '2023 modřinka'
    Vrací seznam {rok, obsazeno} seřazený od nejnovějšího.
    """
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
        # Odstraní poznámky jako "2x", ":-(" atd.
        species_raw = re.sub(r'\s+\d+x?\s*$', '', species_raw).strip()
        species_raw = re.sub(r'\s*[:;(].*$', '', species_raw).strip()

        sl = species_raw.lower()
        if 'nic' in sl or sl in ('ne', 'prázdno', 'prazdno', '0'):
            results.append({'rok': yr, 'obsazeno': None})
        else:
            druh = normaliz_druh(species_raw)
            if druh is None and sl not in ('', '-'):
                druh = 'nezjisteno'
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

        # Sloupec 2 = číslo budky
        cislo_raw = row[2].strip() if len(row) > 2 else ''
        if not cislo_raw or not re.match(r'^\d+$', cislo_raw):
            continue
        cislo = int(cislo_raw)

        nazev    = row[3].strip() or None              # Jméno budky / přezdívka
        mm_raw   = row[4].strip()                      # mm (32 nebo 28)
        typ      = f"{mm_raw}mm" if mm_raw.isdigit() else None
        instalace = normaliz_datum(row[5]) if len(row) > 5 else None
        kdo_raw  = row[7].strip() if len(row) > 7 else ''  # kdo hnízdil
        lat_raw  = row[8].strip() if len(row) > 8 else ''
        lng_raw  = row[9].strip() if len(row) > 9 else ''

        # GPS souřadnice
        try:
            lat = round(float(lat_raw), 5)
            lng = round(float(lng_raw), 5)
        except (ValueError, TypeError):
            continue  # přeskočit budky bez GPS

        # Sanity check – souřadnice v rozumném rozsahu
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue

        # Historie hnízdění (veřejné)
        historie = parse_historie(kdo_raw)

        # Aktuální druh a stav
        ptak = None
        stav = 'aktivni'
        for h in sorted(historie, key=lambda x: x['rok'], reverse=True):
            if h['obsazeno']:
                ptak = h['obsazeno']          # může být druh nebo 'nezjisteno'
                stav = 'osidlena'
                break

        budky.append({
            'cislo':     cislo,
            'nazev':     nazev,
            'typ':       typ,
            'instalace': instalace,
            'lat':       lat,
            'lng':       lng,
            'ptak':      ptak,
            'stav':      stav,
            'historie':  historie if historie else None
        })

    budky.sort(key=lambda b: b['cislo'])

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(budky, f, ensure_ascii=False, indent=2)

    osidlene = sum(1 for b in budky if b['stav'] == 'osidlena')
    s_ins    = sum(1 for b in budky if b['instalace'])
    s_hist   = sum(1 for b in budky if b['historie'])
    print(f"Budek celkem:        {len(budky)}")
    print(f"Osídlených:          {osidlene}")
    print(f"S datem instalace:   {s_ins}")
    print(f"S historií hnízdění: {s_hist}")

def generate_spravci(csv_path, out_path='data/spravci.json'):
    """
    Generuje spravci.json se SHA-256 hashi hesel.
    Čte sloupec 0 (ID) a sloupec 1 (HESLO) z CSV.
    Do repozitáře jdou jen hashe, nikdy plaintext hesla.
    """
    spravci = {}
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=';')
        for row in reader:
            if len(row) < 2:
                continue
            login_id = row[0].strip()
            heslo    = row[1].strip()
            if not re.match(r'^\d{6}$', login_id):
                continue  # přeskočit hlavičku nebo záznamy bez 6místného ID
            if not heslo:
                continue
            spravci[login_id] = hashlib.sha256(heslo.encode('utf-8')).hexdigest()

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(spravci, f, ensure_ascii=False, indent=2)
    print(f"Správci vygenerováni: {len(spravci)} záznamů → {out_path}")


if __name__ == '__main__':
    csv_path  = sys.argv[1] if len(sys.argv) > 1 else 'Seznam_s_hesly.csv'
    json_path = sys.argv[2] if len(sys.argv) > 2 else 'data/budky.json'
    zpracuj(csv_path, json_path)
    generate_spravci(csv_path)
