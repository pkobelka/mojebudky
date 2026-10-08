#!/usr/bin/env python3
"""Zapíše seznam souborů z img/info/ do index.html (místo "__MB_INFO__").

Spouští se při nasazení (workflow ftp-deploy*.yml). Tlačítka „Plánek budky“
a „Moje budka“ ve Fotogalerii si pak berou fotky z tohoto seznamu a nemusí
se serveru ptát, jestli soubor existuje — na WEDOSu to dotazem HEAD
nefungovalo a tlačítka zůstala skrytá.

Výsledek: {"planek-budky": ["img/info/planek-budky.jpg"],
           "moje-budka": ["img/info/moje-budka-1.jpg", ...]}
Album (nazev-1.jpg, nazev-2.jpg, …) má přednost před samostatným souborem.
"""
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLOZKA = os.path.join(KOREN, 'img', 'info')
INDEX = os.path.join(KOREN, 'index.html')
PRIPONY = ('.jpg', '.jpeg', '.png', '.webp', '.pdf')


def seznam():
    alba, samostatne = {}, {}
    if not os.path.isdir(SLOZKA):
        return {}
    for f in os.listdir(SLOZKA):
        zaklad, pripona = os.path.splitext(f)
        if pripona.lower() not in PRIPONY:
            continue
        m = re.fullmatch(r'(.+)-(\d+)', zaklad)
        if m and pripona.lower() != '.pdf':
            alba.setdefault(m.group(1), []).append((int(m.group(2)), f))
        else:
            samostatne.setdefault(zaklad, f)
    out = {}
    for nazev, f in samostatne.items():
        out[nazev] = ['img/info/' + f]
    for nazev, polozky in alba.items():
        out[nazev] = ['img/info/' + f for _, f in sorted(polozky)]
    return out


def main():
    data = seznam()
    html = open(INDEX, encoding='utf-8').read()
    if '"__MB_INFO__"' not in html:
        sys.exit('index.html neobsahuje "__MB_INFO__"')
    html = html.replace('"__MB_INFO__"', json.dumps(data, ensure_ascii=False), 1)
    open(INDEX, 'w', encoding='utf-8').write(html)
    print('img/info:', {k: len(v) for k, v in data.items()})


if __name__ == '__main__':
    main()
