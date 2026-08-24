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
  "ostatni": [
    { "nazev": "Z dílny", "fotky": ["img/galerie/dilna/1.jpg", ...] },
    ...
  ]
}

Fotky do záložky „Ostatní" stačí nahrát do img/galerie/ — podsložka se bere
jako album (jedna dlaždice s listováním), volný soubor jako samostatná fotka.
Podrobnosti v img/galerie/README.md.

Spuštění:  python3 generuj_galerii.py
"""
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
BUDKY_DIR = os.path.join(ROOT, "img", "budky")
GALERIE_DIR = os.path.join(ROOT, "img", "galerie")
NAZVY_JSON = os.path.join(GALERIE_DIR, "nazvy.json")
BUDKY_JSON = os.path.join(ROOT, "data", "budky.json")
OUT_JSON = os.path.join(ROOT, "data", "galerie.json")
# Data pro web se zapisují přímo do index.html mezi značky GALERIE-DATA –
# hosting opakovaně neservíroval nově nahrané soubory, kdežto index.html
# dorazí vždy. data/galerie.json zůstává jako čitelná záloha dat.
INDEX_HTML = os.path.join(ROOT, "index.html")
ZNACKA_OD = "<!-- GALERIE-DATA-START -->"
ZNACKA_DO = "<!-- GALERIE-DATA-END -->"

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


def _popisek(zaklad, nazvy):
    """Popisek dlaždice: buď z nazvy.json, jinak z názvu souboru/složky."""
    if zaklad in nazvy:
        return nazvy[zaklad]
    text = zaklad.replace("_", " ").replace("-", " ").strip()
    return text[:1].upper() + text[1:]


def nacti_ostatni():
    """Záložka „Ostatní" — fotky z img/galerie/.

    Podsložka = album (jedna dlaždice, uvnitř se listuje), volný soubor =
    samostatná dlaždice. Hezčí popisky se dají nastavit v img/galerie/nazvy.json
    ve tvaru {"dilna": "Z naší dílny"}.
    """
    if not os.path.isdir(GALERIE_DIR):
        return []

    nazvy = {}
    if os.path.exists(NAZVY_JSON):
        try:
            with open(NAZVY_JSON, encoding="utf-8") as f:
                nazvy = json.load(f)
        except (ValueError, OSError) as e:
            print(f"Varování: {NAZVY_JSON} se nepodařilo načíst ({e}) – popisky budou z názvů souborů.")

    polozky = []
    for jmeno in sorted(os.listdir(GALERIE_DIR), key=_sort_key):
        cesta = os.path.join(GALERIE_DIR, jmeno)
        if os.path.isdir(cesta):
            soubory = sorted(
                [s for s in os.listdir(cesta) if s.lower().endswith(IMG_EXT)],
                key=_sort_key)
            if not soubory:
                continue
            polozky.append({
                "nazev": _popisek(jmeno, nazvy),
                "fotky": [f"img/galerie/{jmeno}/{s}" for s in soubory],
            })
        elif jmeno.lower().endswith(IMG_EXT):
            polozky.append({
                "nazev": _popisek(os.path.splitext(jmeno)[0], nazvy),
                "fotky": [f"img/galerie/{jmeno}"],
            })
    return polozky


def zapis_do_index(out):
    """Přepíše blok s daty galerie v index.html (mezi značkami GALERIE-DATA)."""
    with open(INDEX_HTML, encoding="utf-8") as f:
        html = f.read()

    od = html.find(ZNACKA_OD)
    do = html.find(ZNACKA_DO)
    if od == -1 or do == -1 or do < od:
        raise SystemExit(
            f"V {INDEX_HTML} chybí značky {ZNACKA_OD} / {ZNACKA_DO} – "
            "data galerie nemám kam zapsat.")

    # kompaktní zápis: index.html se neukládá do cache, ať je co nejmenší
    data_js = "window.GALERIE_DATA=" + json.dumps(
        out, ensure_ascii=False, separators=(",", ":")) + ";"
    novy = f"{ZNACKA_OD}\n<script>{data_js}</script>\n"

    html = html[:od] + novy + html[do:]
    with open(INDEX_HTML, "w", encoding="utf-8") as f:
        f.write(html)


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
        # Záložka „Ostatní" (dílna, akce, výroba…) – načte se z img/galerie/
        "ostatni": nacti_ostatni(),
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    zapis_do_index(out)

    poc_fotek = sum(len(x["fotky"]) for x in umistene)
    poc_ost = sum(len(x["fotky"]) for x in out["ostatni"])
    print(f"Hotovo: {len(umistene)} budek s fotkami, {poc_fotek} fotek celkem.")
    print(f"Ostatní: {len(out['ostatni'])} položek, {poc_ost} fotek.")
    print(f"Zapsáno do {OUT_JSON} a do {INDEX_HTML} (blok GALERIE-DATA)")


if __name__ == "__main__":
    main()
