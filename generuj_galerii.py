#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generátor dat pro fotogalerii (data/galerie.json).

Prohledá složku img/budky/, seskupí fotky podle čísla budky (číslo = úvodní
číslice v názvu souboru), spáruje s daty budek z data/budky.json (název, stav)
a vytvoří přehled pro sekci Fotogalerie na webu.

Struktura výstupu:
{
  "generovano": "<ISO datum>",
  "umistene": [
    { "cislo": 54, "nazev": "Šidlenka", "stav": "aktivni",
      "fotky": ["img/budky/54.jpg", "img/budky/54_1.jpg"] },
    ...
  ],
  "ostatni": []          # kurátorský výběr – doplní se ručně (viz README níže)
}

Spuštění:  python3 generuj_galerii.py
"""
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
BUDKY_DIR = os.path.join(ROOT, "img", "budky")
BUDKY_JSON = os.path.join(ROOT, "data", "budky.json")
OUT_JSON = os.path.join(ROOT, "data", "galerie.json")

IMG_EXT = (".jpg", ".jpeg", ".png")


def cislo_ze_jmena(nazev):
    """Vytáhne úvodní číslo budky z názvu souboru (např. '54_1.jpg' -> 54)."""
    m = re.match(r"(\d+)", nazev)
    return int(m.group(1)) if m else None


def _sort_key(nazev):
    """Hlavní fotka (přesně '<číslo>.<ext>') první, pak přirozené řazení zbytku."""
    base = os.path.splitext(nazev)[0]
    je_hlavni = 0 if re.fullmatch(r"\d+", base) else 1
    # přirozené řazení: rozseká název na čísla a text
    casti = [int(t) if t.isdigit() else t.lower()
             for t in re.split(r"(\d+)", nazev)]
    return (je_hlavni, casti)


def main():
    if not os.path.isdir(BUDKY_DIR):
        raise SystemExit(f"Složka {BUDKY_DIR} neexistuje.")

    # data budek (název, stav) podle čísla
    budky = {}
    if os.path.exists(BUDKY_JSON):
        with open(BUDKY_JSON, encoding="utf-8") as f:
            for b in json.load(f):
                budky[int(b["cislo"])] = b

    # seskupit soubory podle čísla budky
    skupiny = {}
    for jmeno in os.listdir(BUDKY_DIR):
        if not jmeno.lower().endswith(IMG_EXT):
            continue
        c = cislo_ze_jmena(jmeno)
        if c is None:
            continue
        skupiny.setdefault(c, []).append(jmeno)

    umistene = []
    for cislo in sorted(skupiny):
        soubory = sorted(skupiny[cislo], key=_sort_key)
        fotky = [f"img/budky/{s}" for s in soubory]
        b = budky.get(cislo, {})
        umistene.append({
            "cislo": cislo,
            "nazev": b.get("nazev") or "",
            "stav": b.get("stav") or "",
            "fotky": fotky,
        })

    out = {
        "generovano": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "umistene": umistene,
        # Kurátorský výběr „Ostatní" (dílna, akce, výroba…). Doplňuj sem ručně
        # položky ve tvaru: {"nazev": "Popisek", "fotky": ["img/galerie/xxx.jpg"]}
        "ostatni": [],
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    poc_fotek = sum(len(x["fotky"]) for x in umistene)
    print(f"Hotovo: {len(umistene)} budek s fotkami, {poc_fotek} fotek celkem.")
    print(f"Zapsáno do {OUT_JSON}")


if __name__ == "__main__":
    main()
