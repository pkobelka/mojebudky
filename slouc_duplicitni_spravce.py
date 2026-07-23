#!/usr/bin/env python3
"""
Sloučí duplicitní přihlašovací záznamy správců na model „jeden správce = jeden login".

Správci, kteří mají na starosti více budek, mají v data/spravci_info.json jeden
agregovaný záznam s polem budky[] a ID = třímístné číslo NEJNIŽŠÍ budky + poslední
tři číslice telefonu (např. 007109 = budka 7, tel …109, budky [7,29,51,62,116,117]).

Dřív ale existovaly i samostatné per-budka záznamy pro tytéž lidi (029109, 051109 …),
každý s vlastním heslem — a ti dostávali přihlašovací SMS vícekrát. Tento skript je
odstraní z data/spravci_info.json i data/spravci.json (mapa hesel). Po přihlášení
agregovaným ID už umí auth.js editovat všechny budky z pole budky[] (menu „Moje budky").

Skript je idempotentní: opakované spuštění už nic nesmaže.

Použití:
    python3 slouc_duplicitni_spravce.py             # provede úpravu
    python3 slouc_duplicitni_spravce.py --nanecisto  # jen vypíše, co by se stalo
"""
import json, sys
from pathlib import Path

INFO_PATH = Path('data/spravci_info.json')
HESLA_PATH = Path('data/spravci.json')

# Ruční opravy jmen v agregovaných záznamech (potvrzeno správcem projektu).
OPRAVY_JMEN = {
    '004112': {'jmeno': 'Pepa'},   # Pepa (ne Josef) JENIŠ, budky 4, 9, 12
}


def najdi_duplicity(info):
    """Vrátí seřazený seznam ID, která jsou duplicitním per-budka loginem
    správce s agregovaným záznamem (budka patří do jeho budky[], ale klíč se liší)."""
    agregaty = {k: v for k, v in info.items()
                if isinstance(v.get('budky'), list) and len(v['budky']) > 1}
    budka2agg = {}
    for k, v in agregaty.items():
        for b in v['budky']:
            budka2agg[b['cislo']] = k
    dupes = []
    for k, v in info.items():
        if k in agregaty:
            continue
        bc = v.get('budka_cislo')
        if bc in budka2agg and k != budka2agg[bc]:
            dupes.append(k)
    return sorted(set(dupes))


def uloz(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    DRY = any(a in ('--nanecisto', '--dry-run', '-n') for a in sys.argv[1:])

    info = json.loads(INFO_PATH.read_text(encoding='utf-8'))
    hesla = json.loads(HESLA_PATH.read_text(encoding='utf-8'))

    dupes = najdi_duplicity(info)
    print(f"Duplicitních loginů k odstranění: {len(dupes)}")
    for d in dupes:
        z = info.get(d, {})
        jm = f"{z.get('jmeno','')} {z.get('prijmeni','')}".strip()
        print(f"  – {d}  budka {z.get('budka_cislo','?'):>3}  {jm}")

    # Opravy jmen
    print("\nOpravy jmen v agregovaných záznamech:")
    for kid, zmeny in OPRAVY_JMEN.items():
        if kid in info:
            for pole, nova in zmeny.items():
                stara = info[kid].get(pole, '')
                if stara != nova:
                    print(f"  {kid}: {pole} '{stara}' → '{nova}'")
                    if not DRY:
                        info[kid][pole] = nova

    if DRY:
        print("\n🧪 NANEČISTO — nic se neuložilo.")
        return

    for d in dupes:
        info.pop(d, None)
        hesla.pop(d, None)

    uloz(INFO_PATH, info)
    uloz(HESLA_PATH, hesla)
    print(f"\n✓ Hotovo. spravci_info.json: {len(info)} záznamů, spravci.json: {len(hesla)} hesel.")


if __name__ == '__main__':
    main()
