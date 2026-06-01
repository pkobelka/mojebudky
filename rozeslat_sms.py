#!/usr/bin/env python3
"""
Rozešle přihlašovací SMS správcům přes Twilio.

Použití:
    pip install twilio
    python3 rozeslat_sms.py hesla.csv

CSV musí obsahovat sloupce: ID (nebo číslo budky) a Heslo (plaintext).
Telefony a jména se načtou z data/spravci_info.json.

NIKDY nekomitovat hesla.csv ani tento skript s vyplněnými tokeny!
"""
import csv, json, re, sys, time, unicodedata
from pathlib import Path

# ── TWILIO KONFIGURACE ─────────────────────────────────────────────
# Vyplň po registraci na twilio.com (Console → Account Info)
TWILIO_ACCOUNT_SID = ''   # např. 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
TWILIO_AUTH_TOKEN  = ''   # např. '0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
TWILIO_FROM        = ''   # kupené číslo nebo Messaging Service SID
#   Číslo ve formátu '+12015551234' nebo MessagingServiceSid 'MGxxx'
#   Pro ČR doporučuji Messaging Service (lepší doručitelnost)

# Text SMS — {osloveni}, {id}, {heslo} budou nahrazeny
SMS_SABLONA = (
    "Ahoj {osloveni}! 🏡 Tvůj přístup do MojeBudky.cz:\n"
    "ID: {id}\n"
    "Heslo: {heslo}\n"
    "👉 mojebudky.cz\n"
    "Petr Kobelka"
)

# Prodleva mezi SMS (sekundy) — Twilio free tier: 1 SMS/s
PRODLEVA = 1.2

# ── POMOCNÉ FUNKCE ────────────────────────────────────────────────

def _norm(s):
    s = s.lower().strip()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s)

def normalizuj_telefon(t):
    """Převede české číslo na +420xxxxxxxxx."""
    t = re.sub(r'[\s\-\(\)\/]', '', str(t))
    if t.startswith('00420'):
        t = '+420' + t[5:]
    elif t.startswith('420') and len(t) == 12:
        t = '+' + t
    elif t.startswith('+'):
        pass
    elif len(t) == 9:
        t = '+420' + t
    return t if re.fullmatch(r'\+\d{9,15}', t) else None

def nacti_info():
    with open('data/spravci_info.json', encoding='utf-8') as f:
        return json.load(f)

def detekuj_sloupce(headers):
    """Automaticky najde sloupce ID a Heslo v CSV."""
    HESLO_SLOVA = {'heslo', 'password', 'pass', 'pwd'}
    ID_SLOVA    = {'id', 'loginid', 'cislo', 'login'}
    id_col = heslo_col = None
    for i, h in enumerate(headers):
        n = _norm(h)
        if n in ID_SLOVA and id_col is None:
            id_col = i
        if n in HESLO_SLOVA and heslo_col is None:
            heslo_col = i
    return id_col, heslo_col

# ── HLAVNÍ LOGIKA ─────────────────────────────────────────────────

def main():
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_FROM:
        print('⛔  Vyplň TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN a TWILIO_FROM v tomto skriptu.')
        sys.exit(1)

    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'hesla.csv'
    if not Path(csv_path).exists():
        print(f'⛔  Soubor {csv_path} nenalezen.')
        sys.exit(1)

    from twilio.rest import Client
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    info = nacti_info()

    # Numerický index: int(key) → key
    num_idx = {}
    for k in info:
        try: num_idx[int(k)] = k
        except ValueError: pass

    def najdi_id(raw):
        raw = raw.strip()
        if raw in info: return raw
        try: return num_idx.get(int(raw))
        except ValueError: return None

    # Načti CSV
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        content = f.read()
    sep = ';' if content.count(';') >= content.count(',') else ','
    rows = list(csv.reader(content.splitlines(), delimiter=sep))
    if not rows:
        print('CSV je prázdné.'); sys.exit(1)

    id_col, heslo_col = detekuj_sloupce(rows[0])
    if id_col is None or heslo_col is None:
        print(f'Nalezená záhlaví: {rows[0]}')
        print('⛔  Nenalezen sloupec ID nebo Heslo. Zkontroluj záhlaví CSV.')
        sys.exit(1)

    print(f'📋 CSV: {csv_path}  |  ID ve sloupci {chr(65+id_col)}, Heslo ve sloupci {chr(65+heslo_col)}')
    print()

    # Log soubor
    log_path = 'sms_log.txt'
    odeslano = chyba = preskoceno = 0

    with open(log_path, 'w', encoding='utf-8') as log:
        log.write('ID;Jméno;Telefon;Stav\n')

        for i, row in enumerate(rows[1:], 1):
            if not row or len(row) <= max(id_col, heslo_col):
                continue
            raw_id = row[id_col].strip()
            heslo  = row[heslo_col].strip()
            if not raw_id or not heslo:
                continue

            kanonId = najdi_id(raw_id)
            if not kanonId:
                print(f'  [{i}] ID {raw_id} — nenalezeno v JSON, přeskočeno')
                log.write(f'{raw_id};;;přeskočeno – ID nenalezeno\n')
                preskoceno += 1
                continue

            zaznam = info[kanonId]
            jmeno    = zaznam.get('jmeno', raw_id)
            osloveni = zaznam.get('osloveni', jmeno)
            tel_raw  = zaznam.get('telefon', '')
            telefon  = normalizuj_telefon(tel_raw) if tel_raw else None

            if not telefon:
                print(f'  [{i}] {jmeno} ({kanonId}) — chybí telefon, přeskočeno')
                log.write(f'{kanonId};{jmeno};;přeskočeno – chybí telefon\n')
                preskoceno += 1
                continue

            zprava = SMS_SABLONA.format(
                osloveni=osloveni,
                id=kanonId,
                heslo=heslo
            )

            try:
                params = {
                    'body': zprava,
                    'to':   telefon,
                }
                if TWILIO_FROM.startswith('MG'):
                    params['messaging_service_sid'] = TWILIO_FROM
                else:
                    params['from_'] = TWILIO_FROM

                msg = client.messages.create(**params)
                print(f'  ✓ [{i}] {jmeno} → {telefon}  (SID: {msg.sid[:12]}…)')
                log.write(f'{kanonId};{jmeno};{telefon};odesláno {msg.sid}\n')
                odeslano += 1
                time.sleep(PRODLEVA)

            except Exception as e:
                print(f'  ✗ [{i}] {jmeno} → {telefon}  CHYBA: {e}')
                log.write(f'{kanonId};{jmeno};{telefon};CHYBA: {e}\n')
                chyba += 1

    print()
    print(f'✓ Odesláno:   {odeslano}')
    print(f'✗ Chyba:      {chyba}')
    print(f'  Přeskočeno: {preskoceno}')
    print(f'  Log:        {log_path}')
    if chyba:
        print()
        print('Chybné záznamy jsou v sms_log.txt — lze spustit znovu jen pro ně.')

if __name__ == '__main__':
    main()
