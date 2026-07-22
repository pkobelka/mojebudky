#!/usr/bin/env python3
"""
Rozešle přihlašovací SMS správcům přes SMSbrana.cz (SMS Connect HTTP API).

Použití:
    python3 rozeslat_sms.py hesla.csv              # ostré odeslání
    python3 rozeslat_sms.py hesla.csv --nanecisto  # jen náhled, nic se neodešle

CSV musí obsahovat sloupce: ID (nebo číslo budky) a Heslo (plaintext).
Telefony a jména se načtou z data/spravci_info.json.

NIKDY nekomitovat hesla.csv ani tento skript s vyplněnými přihlašovacími údaji!
"""
import contextlib, csv, hashlib, io, json, re, sys, time, unicodedata, urllib.request, urllib.parse, uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# ── SMSBRANA.CZ KONFIGURACE ────────────────────────────────────────
# Vyplň z portálu SMSbrána.cz → Nastavení → SMS Connect (HTTP)
SMSBRANA_LOGIN = ''   # např. 'MojeBudky_h1'
SMSBRANA_HESLO = ''   # heslo k SMS Connectu (NE heslo k portálu!)

SMSBRANA_URL = 'https://api.smsbrana.cz/smsconnect/http.php'

# Text SMS — {osloveni}, {id}, {heslo} budou nahrazeny
# Bez diakritiky a emoji: vejde se do jedné SMS (GSM7, 160 znaků) místo dvou (UCS-2, 70 znaku/cast)
SMS_SABLONA = (
    "Ahoj {osloveni}! Tvuj pristup do MojeBudky.cz:\n"
    "ID: {id}\n"
    "Heslo: {heslo}\n"
    "mojebudky.cz\n"
    "Petr Kobelka"
)

# Prodleva mezi SMS (sekundy)
PRODLEVA = 0.5

def odesli_sms(telefon, text):
    """Odešle SMS přes SMSbrana.cz SMS Connect (AUTH_HASH). Vrátí (ok, info)."""
    cas = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    sul = uuid.uuid4().hex[:10]
    hash_ = hashlib.md5((SMSBRANA_HESLO + cas + sul).encode('utf-8')).hexdigest()
    params = {
        'action': 'send_sms',
        'login': SMSBRANA_LOGIN,
        'time': cas,
        'sul': sul,
        'hash': hash_,
        'number': telefon.lstrip('+'),
        'message': text,
    }
    url = SMSBRANA_URL + '?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            body = resp.read().decode('utf-8')
        root = ET.fromstring(body)
        err = root.findtext('err', default='?')
        if err == '0':
            return True, root.findtext('sms_id', default='')
        return False, f'err={err}'
    except Exception as e:
        return False, str(e)

# ── POMOCNÉ FUNKCE ────────────────────────────────────────────────

def _norm(s):
    s = s.lower().strip()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s)

def bez_diakritiky(s):
    """Odstraní diakritiku, ale zachová velikost písmen i mezery (Péťo → Peto).

    Drží celou SMS v GSM7 (160 znaků = 1 SMS). Bez toho jediná háčkovaná
    litera v oslovení překlopí zprávu do UCS-2 (jen 70 znaků/část), takže
    se rozpadne na 2 části a stojí dvakrát tolik.
    """
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s))
                   if not unicodedata.combining(c))

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
    args = sys.argv[1:]
    # Režim nanečisto: nic se neodešle, jen se vypíše, komu by co odešlo.
    DRY = any(a in ('--nanecisto', '--dry-run', '-n') for a in args)
    pozicni = [a for a in args if not a.startswith('-')]
    csv_path = pozicni[0] if pozicni else 'hesla.csv'

    if not DRY and (not SMSBRANA_LOGIN or not SMSBRANA_HESLO):
        print('⛔  Vyplň SMSBRANA_LOGIN a SMSBRANA_HESLO v tomto skriptu.')
        print('    Tip: nejdřív si vyzkoušej běh nanečisto:')
        print(f'         python3 rozeslat_sms.py {csv_path} --nanecisto')
        sys.exit(1)

    if not Path(csv_path).exists():
        print(f'⛔  Soubor {csv_path} nenalezen.')
        sys.exit(1)

    if DRY:
        print('🧪 REŽIM NANEČISTO — nic se NEodešle, jen náhled párování a textu SMS.')
        print()

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

    # Log soubor (jen při ostrém odeslání; nanečisto jen vypisuje na obrazovku)
    log_path = 'sms_log.txt'
    odeslano = chyba = preskoceno = 0
    ukazka_hotova = False

    # V režimu nanečisto se nezakládá žádný soubor (aby se nikam neuložily telefony).
    log_cm = open(log_path, 'w', encoding='utf-8') if not DRY else contextlib.nullcontext(io.StringIO())
    with log_cm as log:
        if not DRY:
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
                print(f'  ✗ [{i}] ID {raw_id} — nenalezeno v seznamu správců, přeskočeno')
                if not DRY: log.write(f'{raw_id};;;přeskočeno – ID nenalezeno\n')
                preskoceno += 1
                continue

            zaznam = info[kanonId]
            jmeno    = zaznam.get('jmeno', raw_id)
            prijmeni = zaznam.get('prijmeni', '')
            # Oslovení odháčkujeme, ať SMS zůstane v GSM7 (1 část, ne 2).
            osloveni = bez_diakritiky(zaznam.get('osloveni', jmeno))
            tel_raw  = zaznam.get('telefon', '')
            telefon  = normalizuj_telefon(tel_raw) if tel_raw else None

            if not telefon:
                print(f'  ✗ [{i}] {jmeno} {prijmeni} ({kanonId}) — chybí telefon, přeskočeno')
                if not DRY: log.write(f'{kanonId};{jmeno};;přeskočeno – chybí telefon\n')
                preskoceno += 1
                continue

            if DRY:
                # Heslo maskujeme (první + poslední znak), ať se nikde nezobrazuje celé.
                heslo_mask = (heslo[0] + '•' * (len(heslo) - 2) + heslo[-1]) if len(heslo) > 2 else '••'
                jmeno_full = f'{jmeno} {prijmeni}'.strip()
                id_info = f'{raw_id} → {kanonId}' if raw_id != kanonId else kanonId
                print(f'  ✓ [{i}] {jmeno_full:28} | ID {id_info:16} | {telefon:15} | heslo {heslo_mask}')
                if not ukazka_hotova:
                    ukazka = SMS_SABLONA.format(osloveni=osloveni, id=kanonId, heslo=heslo_mask)
                    print('        ┌─ náhled textu SMS (heslo zamaskováno) ─────')
                    for radek in ukazka.split('\n'):
                        print(f'        │ {radek}')
                    print('        └────────────────────────────────────────────')
                    ukazka_hotova = True
                odeslano += 1
                continue

            zprava = SMS_SABLONA.format(
                osloveni=osloveni,
                id=kanonId,
                heslo=heslo
            )

            ok, info_sms = odesli_sms(telefon, zprava)
            if ok:
                print(f'  ✓ [{i}] {jmeno} → {telefon}  (sms_id: {info_sms})')
                log.write(f'{kanonId};{jmeno};{telefon};odesláno {info_sms}\n')
                odeslano += 1
            else:
                print(f'  ✗ [{i}] {jmeno} → {telefon}  CHYBA: {info_sms}')
                log.write(f'{kanonId};{jmeno};{telefon};CHYBA: {info_sms}\n')
                chyba += 1
            time.sleep(PRODLEVA)

    print()
    if DRY:
        print('🧪 NANEČISTO — nic nebylo odesláno.')
        print(f'   Odeslalo by se:  {odeslano}')
        print(f'   Přeskočeno:      {preskoceno}')
        print()
        print('   Když sedí, spusť ostré odeslání (bez --nanecisto a s vyplněnou SMS bránou):')
        print(f'         python3 rozeslat_sms.py {csv_path}')
    else:
        print(f'✓ Odesláno:   {odeslano}')
        print(f'✗ Chyba:      {chyba}')
        print(f'  Přeskočeno: {preskoceno}')
        print(f'  Log:        {log_path}')
        if chyba:
            print()
            print('Chybné záznamy jsou v sms_log.txt — lze spustit znovu jen pro ně.')

if __name__ == '__main__':
    main()
