#!/usr/bin/env python3
"""Zapíše seznam fotek pro tlačítka „Plánek budky“ a „Moje budka“ do index.html
(místo "__MB_INFO__").

Spouští se při nasazení (workflow ftp-deploy*.yml). Tlačítka ve Fotogalerii si
pak berou fotky z tohoto seznamu a nemusí se serveru ptát, jestli soubor
existuje.

Fotky leží přímo v img/, ne v podsložce: složky, které vytvoří FTP deploy,
dostanou na WEDOSu špatná práva a server z nich vrací 403 (viz PLAN.md).
Hledají se jen soubory pojmenované podle tlačítek (data-soubor v index.html):
planek-budky.jpg, moje-budka-1.jpg, moje-budka-2.jpg, …

Výsledek: {"planek-budky": ["img/planek-budky.jpg"],
           "moje-budka": ["img/moje-budka-1.jpg", ...]}
Album (nazev-1.jpg, nazev-2.jpg, …) má přednost před samostatným souborem.
"""
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLOZKA = os.path.join(KOREN, 'img')
INDEX = os.path.join(KOREN, 'index.html')
PRIPONY = ('.jpg', '.jpeg', '.png', '.webp', '.pdf')


def seznam(nazvy):
    alba, samostatne = {}, {}
    for f in os.listdir(SLOZKA):
        zaklad, pripona = os.path.splitext(f)
        if pripona.lower() not in PRIPONY:
            continue
        m = re.fullmatch(r'(.+)-(\d+)', zaklad)
        if m and m.group(1) in nazvy and pripona.lower() != '.pdf':
            alba.setdefault(m.group(1), []).append((int(m.group(2)), f))
        elif zaklad in nazvy:
            samostatne.setdefault(zaklad, f)
    out = {}
    for nazev, f in samostatne.items():
        out[nazev] = ['img/' + f]
    for nazev, polozky in alba.items():
        out[nazev] = ['img/' + f for _, f in sorted(polozky)]
    return out


def main():
    html = open(INDEX, encoding='utf-8').read()
    if '"__MB_INFO__"' not in html:
        sys.exit('index.html neobsahuje "__MB_INFO__"')
    nazvy = set(re.findall(r'class="[^"]*galerie-info-btn[^"]*"[^>]*data-soubor="([^"]+)"', html))
    data = seznam(nazvy)
    html = html.replace('"__MB_INFO__"', json.dumps(data, ensure_ascii=False), 1)
    open(INDEX, 'w', encoding='utf-8').write(html)
    print('tlačítka:', sorted(nazvy), '→ fotky:', {k: len(v) for k, v in data.items()})


if __name__ == '__main__':
    main()
