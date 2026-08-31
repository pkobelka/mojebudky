#!/usr/bin/env python3
"""
Callback pro git-filter-repo: vyskrtne osobni udaje ze VSECH historickych
verzi data/spravci_info.json.

Soubor se pozna podle obsahu (mapa loginId -> zaznam s `budka_cislo`), protoze
blob callback nazev souboru nezna. Velke a nejsonove bloby se preskakuji hned,
at se v repu plnem fotek a videi zbytecne neparsuje kazdy blob.

Pouziti:
    git filter-repo --blob-callback "$(cat tools/filtr_historie.py)"
(volani je ve workflow prepis-historie.yml)
"""

CITLIVA = (b'telefon', b'email', b'datum_narozeni')
LIMIT = 512 * 1024

data = blob.data  # noqa: F821  (dodava git-filter-repo)

if len(data) <= LIMIT and data.lstrip()[:1] == b'{' and any(p in data for p in CITLIVA):
    import json
    try:
        obj = json.loads(data.decode('utf-8'))
    except Exception:
        obj = None
    if isinstance(obj, dict) and obj:
        hodnoty = [v for v in obj.values() if isinstance(v, dict)]
        # tvar spravci_info.json: mapa loginId -> zaznam spravce
        if hodnoty and len(hodnoty) == len(obj) and all('budka_cislo' in v for v in hodnoty):
            zmeneno = False
            for zaznam in hodnoty:
                for pole in ('telefon', 'email', 'datum_narozeni'):
                    if pole in zaznam:
                        del zaznam[pole]
                        zmeneno = True
            if zmeneno:
                blob.data = (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode('utf-8')  # noqa: F821
