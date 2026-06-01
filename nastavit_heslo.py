#!/usr/bin/env python3
"""
Nastaví nebo změní heslo správce / administrátora.

Spuštění:
    python3 nastavit_heslo.py

Skript NIKDY neukáže heslo v plaintextu — použij ho pouze lokálně.
NIKDY nekomitovat do gitu!
"""
import hashlib, getpass, json, sys

json_path = 'data/spravci.json'

with open(json_path, encoding='utf-8') as f:
    spravci = json.load(f)

print('=== Nastavení hesla správce / admina ===')
print(f'Soubor: {json_path}')
print()
login_id = input('ID (např. 602356): ').strip()

if not login_id:
    print('ID nesmí být prázdné.'); sys.exit(1)

# Normalizace — stejná logika jako v auth.js
kanonicky = login_id
if login_id not in spravci:
    try:
        n = int(login_id)
        kanonicky = next((k for k in spravci if int(k) == n), None)
    except ValueError:
        kanonicky = None
    if not kanonicky:
        print(f'ID {login_id} nenalezeno v {json_path}.')
        pridat = input('Přidat jako nové ID? [a/N]: ').strip().lower()
        if pridat == 'a':
            kanonicky = login_id
        else:
            sys.exit(1)

heslo  = getpass.getpass('Nové heslo: ')
heslo2 = getpass.getpass('Znovu heslo: ')

if heslo != heslo2:
    print('Hesla se neshodují.'); sys.exit(1)
if len(heslo) < 6:
    print('Heslo musí mít alespoň 6 znaků.'); sys.exit(1)

sha = hashlib.sha256(heslo.encode('utf-8')).hexdigest()
spravci[kanonicky] = sha

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(spravci, f, ensure_ascii=False, indent=2)

print(f'\n✓ Heslo pro ID {kanonicky} bylo nastaveno.')
print(f'  Soubor uložen: {json_path}')
print()
print('Nezapomeň commitnout a pushovat data/spravci.json !')
