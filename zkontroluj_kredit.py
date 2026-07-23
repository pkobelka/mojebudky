#!/usr/bin/env python3
"""
Zjistí zůstatek SMS kreditu na SMSbrana.cz (SMS Connect HTTP API, action=credit_info).

Použití:
    # Přihlašovací údaje přes proměnné prostředí (doporučeno – nic se necommituje):
    SMSBRANA_LOGIN=MojeBudky_h1 SMSBRANA_HESLO=tajne python3 zkontroluj_kredit.py

    # …nebo je vyplň dole do konstant (a pak NEcommituj!).

Vrátí zbývající kredit v Kč. Orientačně: jedna SMS bez diakritiky (GSM7, do 160 znaků)
stojí obvykle kolem 1 Kč — přesná cena podle tvého tarifu na SMSbrana.cz.
"""
import hashlib, os, sys, urllib.request, urllib.parse, uuid
import xml.etree.ElementTree as ET
from datetime import datetime

# ── SMSBRANA.CZ KONFIGURACE ────────────────────────────────────────
# Vyplň z portálu SMSbrána.cz → Nastavení → SMS Connect (HTTP),
# nebo (lépe) předej přes proměnné prostředí SMSBRANA_LOGIN / SMSBRANA_HESLO.
SMSBRANA_LOGIN = os.environ.get('SMSBRANA_LOGIN', '')   # např. 'MojeBudky_h1'
SMSBRANA_HESLO = os.environ.get('SMSBRANA_HESLO', '')   # heslo k SMS Connectu (NE heslo k portálu!)

SMSBRANA_URL = 'https://api.smsbrana.cz/smsconnect/http.php'


def zjisti_kredit():
    """Zavolá credit_info přes SMS Connect (AUTH_HASH). Vrátí (ok, hodnota_nebo_chyba)."""
    cas = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    sul = uuid.uuid4().hex[:10]
    hash_ = hashlib.md5((SMSBRANA_HESLO + cas + sul).encode('utf-8')).hexdigest()
    params = {
        'action': 'credit_info',
        'login': SMSBRANA_LOGIN,
        'time': cas,
        'sul': sul,
        'hash': hash_,
    }
    url = SMSBRANA_URL + '?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            body = resp.read().decode('utf-8')
        root = ET.fromstring(body)
        err = root.findtext('err', default='?')
        if err == '0':
            return True, root.findtext('credit', default='?')
        return False, f'err={err}'
    except Exception as e:
        return False, str(e)


def main():
    if not SMSBRANA_LOGIN or not SMSBRANA_HESLO:
        print('⛔  Chybí přihlašovací údaje k SMS bráně.')
        print('    Spusť s proměnnými prostředí, např.:')
        print('        SMSBRANA_LOGIN=MojeBudky_h1 SMSBRANA_HESLO=tajne python3 zkontroluj_kredit.py')
        sys.exit(1)

    ok, hodnota = zjisti_kredit()
    if ok:
        try:
            kc = float(hodnota)
            print(f'💰 Zbývající kredit: {kc:.2f} Kč')
            print(f'   (orientačně ~{int(kc)} SMS bez diakritiky při ceně ~1 Kč/SMS)')
        except ValueError:
            print(f'💰 Zbývající kredit: {hodnota}')
    else:
        print(f'⛔  Nepodařilo se zjistit kredit: {hodnota}')
        sys.exit(1)


if __name__ == '__main__':
    main()
