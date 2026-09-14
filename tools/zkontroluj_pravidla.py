#!/usr/bin/env python3
"""Kontrola database.rules.json před nasazením.

Realtime Database bere KAŽDÝ klíč jako název uzlu – kromě klíčů začínajících
tečkou (.read, .write, .validate, .indexOn, .priority). Klíč jako "_komentar"
se proto tváří jako podstrom a jeho textová hodnota je syntaktická chyba
("Expected '***'"), kterou JSON validace neodhalí. Tohle to odhalí předem.
"""
import json
import sys

TECKOVE = {'.read', '.write', '.validate', '.indexOn', '.priority'}


def projdi(uzel, cesta, chyby):
    if not isinstance(uzel, dict):
        chyby.append(f"{cesta or '/'}: očekává se objekt, je tam {type(uzel).__name__}")
        return
    for klic, hodnota in uzel.items():
        kam = f"{cesta}/{klic}"
        if klic.startswith('.'):
            if klic not in TECKOVE:
                chyby.append(f"{kam}: neznámý klíč s tečkou")
            elif klic == '.indexOn':
                if not isinstance(hodnota, (list, str)):
                    chyby.append(f"{kam}: .indexOn má být seznam nebo řetězec")
            elif not isinstance(hodnota, (str, bool)):
                chyby.append(f"{kam}: {klic} má být výraz (text) nebo true/false")
        else:
            # běžný klíč = název uzlu, hodnota tedy MUSÍ být objekt s pravidly
            if not isinstance(hodnota, dict):
                chyby.append(
                    f"{kam}: klíč bez tečky je název uzlu, ale hodnota je "
                    f"{type(hodnota).__name__} – poznámky do pravidel nepatří")
            else:
                projdi(hodnota, kam, chyby)


def main():
    cesta = sys.argv[1] if len(sys.argv) > 1 else 'database.rules.json'
    with open(cesta, encoding='utf-8') as f:
        data = json.load(f)
    if 'rules' not in data:
        sys.exit('CHYBA: chybí kořenový klíč "rules".')
    chyby = []
    projdi(data['rules'], '', chyby)
    if chyby:
        print('Nalezené problémy:')
        for ch in chyby:
            print('  ✗', ch)
        sys.exit(1)
    print(f'{cesta}: struktura pravidel v pořádku')


if __name__ == '__main__':
    main()
