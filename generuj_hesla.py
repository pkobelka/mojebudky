#!/usr/bin/env python3
"""
Generátor nových hesel bez matoucích znaků.

Vyloučeno 6 znaků: l I 1 O 0 o
  – l (malé L) vypadá jako I nebo 1
  – I (velké i) vypadá jako l nebo 1
  – 1 (jedna) vypadá jako l nebo I
  – O (velké o) vypadá jako 0
  – 0 (nula) vypadá jako O
  – o (malé o) vypadá jako 0 nebo O

Použití:
  python3 generuj_hesla.py Seznam_s_hesly.csv
  → zapíše nová hesla zpět do CSV a vypíše přehled změn
  → zároveň vygeneruje firebase_update.js pro hromadnou aktualizaci v Firebase
"""

import csv, random, string, sys, pathlib

# ── Bezpečná abeceda (bez matoucích znaků) ──────────────────────────────────
MATOUCI = set('lI1O0o')

VELKA   = [c for c in string.ascii_uppercase if c not in MATOUCI]  # 24 znaků
MALA    = [c for c in string.ascii_lowercase if c not in MATOUCI]  # 24 znaků
CISLICE = [c for c in string.digits          if c not in MATOUCI]  # 8 znaků
SPECIAL = list('!@#$%^&*-_+=?')                                     # 13 znaků

VSE = VELKA + MALA + CISLICE  # bez speciálních – snazší psaní na mobilu

DELKA = 8  # délka hesla

def generuj_heslo():
    """Vygeneruje heslo se zaručeným výskytem každé skupiny."""
    while True:
        heslo = (
            [random.choice(VELKA)]    +
            [random.choice(MALA)]     +
            [random.choice(CISLICE)]  +
            [random.choice(VSE) for _ in range(DELKA - 3)]
        )
        random.shuffle(heslo)
        h = ''.join(heslo)
        # Paranoidní kontrola – žádný matoucí znak nesmí projít
        if not any(c in MATOUCI for c in h):
            return h

def zpracuj_csv(csv_path):
    csv_path = pathlib.Path(csv_path)
    if not csv_path.exists():
        print(f"Soubor {csv_path} nenalezen.")
        sys.exit(1)

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        obsah = list(csv.reader(f, delimiter=';'))

    # Najdi sloupec s heslem (hledá záhlaví obsahující "heslo" nebo "password")
    zahlavi = obsah[0] if obsah else []
    heslo_col = None
    for i, h in enumerate(zahlavi):
        if 'heslo' in h.lower() or 'password' in h.lower() or 'pwd' in h.lower():
            heslo_col = i
            break

    if heslo_col is None:
        print("Záhlaví CSV:")
        for i, h in enumerate(zahlavi):
            print(f"  [{i}] {h}")
        print()
        heslo_col = int(input("Zadej číslo sloupce s heslem: "))

    # Sloupec s číslem správce (výchozí: 2 dle zpracuj_csv.py)
    cislo_col = 2

    zmeneno = []
    nova_hesla = {}  # cislo → nové heslo

    for i, radek in enumerate(obsah):
        if i == 0:
            continue  # záhlaví
        if len(radek) <= max(heslo_col, cislo_col):
            continue
        cislo_raw = radek[cislo_col].strip()
        if not cislo_raw.isdigit():
            continue

        stare = radek[heslo_col].strip()
        nove = generuj_heslo()
        obsah[i][heslo_col] = nove
        nova_hesla[cislo_raw] = nove
        zmeneno.append((cislo_raw, stare, nove))

    # Ulož zpět
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        csv.writer(f, delimiter=';').writerows(obsah)

    print(f"\nAktualizováno {len(zmeneno)} hesel v {csv_path}\n")
    print(f"{'Správce':>10}  {'Staré heslo':<12}  {'Nové heslo':<12}")
    print("-" * 40)
    for cislo, stare, nove in zmeneno:
        print(f"{cislo:>10}  {stare:<12}  {nove:<12}")

    # Vygeneruj JS skript pro Firebase update
    vygeneruj_firebase_js(nova_hesla)

def vygeneruj_firebase_js(nova_hesla):
    """Vygeneruje Node.js skript pro hromadnou aktualizaci hesel ve Firebase."""
    radky = []
    for cislo, heslo in nova_hesla.items():
        email = f"{cislo}@mojebudky.cz"
        radky.append(f'  {{ email: "{email}", password: "{heslo}" }},')

    js = f"""// Hromadná aktualizace hesel ve Firebase
// Spuštění: node firebase_update_hesla.js
// Požadavek: npm install firebase-admin  +  service account key

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // <-- doplň cestu

admin.initializeApp({{ credential: admin.credential.cert(serviceAccount) }});
const auth = admin.auth();

const HESLA = [
{chr(10).join(radky)}
];

async function aktualizuj() {{
  let ok = 0, chyba = 0;
  for (const {{ email, password }} of HESLA) {{
    try {{
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, {{ password }});
      console.log(`✅  ${{email}}`);
      ok++;
    }} catch (e) {{
      console.error(`❌  ${{email}}: ${{e.message}}`);
      chyba++;
    }}
  }}
  console.log(`\\nHotovo: ${{ok}} OK, ${{chyba}} chyb`);
  process.exit(0);
}}

aktualizuj();
"""

    out = pathlib.Path('firebase_update_hesla.js')
    out.write_text(js, encoding='utf-8')
    print(f"\nFirebase update skript uložen: {out}")
    print("Spuštění:")
    print("  1. Stáhni serviceAccountKey.json z Firebase Console → Nastavení projektu → Servisní účty")
    print("  2. npm install firebase-admin")
    print("  3. node firebase_update_hesla.js")

if __name__ == '__main__':
    csv_soubor = sys.argv[1] if len(sys.argv) > 1 else 'Seznam_s_hesly.csv'
    zpracuj_csv(csv_soubor)
