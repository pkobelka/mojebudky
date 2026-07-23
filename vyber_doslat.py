#!/usr/bin/env python3
"""
Vybere z hlavního CSV s hesly jen vybraná ID a zapíše je do nového CSV
(pro doslání SMS jen konkrétním správcům).

Použití:
    python3 vyber_doslat.py hesla.csv doslat.csv 035051 067038 147563 169377 196963

Když nezadáš ID, použije se přednastavená pětice slovenských správců
(kterým dřív SMS nedorazila kvůli předvolbě +420 místo +421).
"""
import csv, sys
from rozeslat_sms import detekuj_sloupce

# Přednastavená ID (5 slovenských správců)
VYCHOZI_IDS = ['035051', '067038', '147563', '169377', '196963']


def main():
    args = sys.argv[1:]
    vstup = args[0] if len(args) > 0 else 'hesla.csv'
    vystup = args[1] if len(args) > 1 else 'doslat.csv'
    hledana = args[2:] if len(args) > 2 else VYCHOZI_IDS
    hledana_set = set(hledana)

    with open(vstup, newline='', encoding='utf-8-sig') as f:
        content = f.read()
    sep = ';' if content.count(';') >= content.count(',') else ','
    rows = list(csv.reader(content.splitlines(), delimiter=sep))
    if not rows:
        print('Vstupní CSV je prázdné.'); sys.exit(1)

    hlavicka = rows[0]
    id_col, _ = detekuj_sloupce(hlavicka)
    if id_col is None:
        print(f'Nenalezen sloupec ID. Záhlaví: {hlavicka}'); sys.exit(1)

    vybrane = []
    nalezena = set()
    for row in rows[1:]:
        if len(row) <= id_col:
            continue
        rid = row[id_col].strip()
        if rid in hledana_set:
            vybrane.append(row)
            nalezena.add(rid)

    with open(vystup, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(hlavicka)
        w.writerows(vybrane)

    print(f'✓ Zapsáno {len(vybrane)} řádků do {vystup}')
    chybi = hledana_set - nalezena
    if chybi:
        print(f'⚠️  Tato ID se v {vstup} nenašla: {sorted(chybi)}')
    print(f'\nDál:  python3 rozeslat_sms.py {vystup} --nanecisto')


if __name__ == '__main__':
    main()
