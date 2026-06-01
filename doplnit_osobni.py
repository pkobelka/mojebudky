#!/usr/bin/env python3
"""
Importuje osobní data správců (oslovení, jméno, příjmení, telefon,
e-mail, datum narození) ze zdrojového CSV do data/spravci_info.json.

Spuštění:
    python3 doplnit_osobni.py <soubor.csv>

CSV musí být UTF-8, oddělovač středník (;), první řádek = záhlaví.
NIKDY nekomitovat zdrojový CSV – obsahuje osobní data!
Výsledný data/spravci_info.json je bezpečné commitovat (bez hesel).
"""
import csv
import json
import re
import sys
import unicodedata


def _norm(s):
    """Normalizuje záhlaví: malá písmena, bez diakritiky, bez mezer."""
    s = s.lower().strip()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


# Mapování normalizovaných záhlaví → klíč v spravci_info.json
HEADER_MAP = {
    'id':             '__id__',
    'loginid':        '__id__',
    'cislo':          '__id__',
    'osloveni':       'osloveni',
    'osloven':        'osloveni',
    'jmeno':          'jmeno',
    'krestni':        'jmeno',
    'firstname':      'jmeno',
    'prijmeni':       'prijmeni',
    'surname':        'prijmeni',
    'lastname':       'prijmeni',
    'telefon':        'telefon',
    'tel':            'telefon',
    'phone':          'telefon',
    'email':          'email',
    'mail':           'email',
    'datumnarozeni':  'datum_narozeni',
    'narozeni':       'datum_narozeni',
    'datum':          'datum_narozeni',
    'dob':            'datum_narozeni',
}

csv_path  = sys.argv[1] if len(sys.argv) > 1 else 'osobni_data.csv'
json_path = 'data/spravci_info.json'

# ── Načtení JSON ──────────────────────────────────────────────────
with open(json_path, encoding='utf-8') as f:
    info = json.load(f)

# ── Načtení CSV ───────────────────────────────────────────────────
with open(csv_path, newline='', encoding='utf-8-sig') as f:
    content = f.read()

sep = ';' if content.count(';') >= content.count(',') else ','
reader = csv.reader(content.splitlines(), delimiter=sep)
rows   = list(reader)

if not rows:
    print('CSV je prázdné.')
    sys.exit(1)

# ── Mapování záhlaví ─────────────────────────────────────────────
headers = [_norm(h) for h in rows[0]]
print('Nalezená záhlaví:', rows[0])
print()

col_map = {}   # JSON klíč → index sloupce
id_col  = 0    # výchozí: sloupec A

for i, h in enumerate(headers):
    mapped = HEADER_MAP.get(h)
    if mapped == '__id__':
        id_col = i
        print(f'  ID správce:    sloupec {chr(65+i)} (index {i}) → "{rows[0][i]}"')
    elif mapped:
        col_map[mapped] = i
        print(f'  {mapped:18s} sloupec {chr(65+i)} (index {i}) → "{rows[0][i]}"')

if not col_map:
    print('\n⚠ Nenalezeny žádné importovatelné sloupce.')
    print('Zkontroluj záhlaví CSV – očekává se např.: ID, Osloveni, Jmeno, Prijmeni, Telefon, Email, DatumNarozeni')
    sys.exit(1)

print()

# ── Import řádek po řádku ─────────────────────────────────────────
aktualizovano = 0
preskoceno    = 0

for row in rows[1:]:
    if not row or len(row) <= id_col:
        continue
    login_id = row[id_col].strip()
    if not login_id:
        continue

    # Pokus o doplnění vedoucích nul (2852 → 002852)
    if login_id not in info:
        padded = login_id.zfill(6)
        if padded in info:
            login_id = padded
        else:
            preskoceno += 1
            continue

    zaznam = info[login_id]

    for pole, idx in col_map.items():
        if len(row) > idx:
            hodnota = row[idx].strip()
            if hodnota:
                zaznam[pole] = hodnota

    aktualizovano += 1

# ── Uložení ───────────────────────────────────────────────────────
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(info, f, ensure_ascii=False, indent=2)

print(f'✓ Aktualizováno:              {aktualizovano} správců')
print(f'  Přeskočeno (ID nenalezeno): {preskoceno}')
print(f'  Uloženo do:                 {json_path}')
