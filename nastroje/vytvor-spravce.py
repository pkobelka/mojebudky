"""
Spuštění:
  pip install firebase-admin
  python nastroje/vytvor-spravce.py cesta/k/spravci.csv cesta/k/serviceAccount.json
"""

import sys
import csv
import time
import firebase_admin
from firebase_admin import credentials, auth

def main():
    if len(sys.argv) < 3:
        print("Použití: python vytvor-spravce.py spravci.csv serviceAccount.json")
        sys.exit(1)

    csv_soubor = sys.argv[1]
    sa_soubor = sys.argv[2]

    cred = credentials.Certificate(sa_soubor)
    firebase_admin.initialize_app(cred)

    spravci = []
    with open(csv_soubor, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        for radek in reader:
            id_ = radek.get("ID", "").strip()
            heslo = radek.get("Heslo", "").strip()
            jmeno = radek.get("Jmeno", radek.get("Jméno", "")).strip()
            prijmeni = radek.get("Prijmeni", radek.get("Příjmení", "")).strip()
            if id_ and heslo:
                spravci.append({
                    "id": id_,
                    "heslo": heslo,
                    "jmeno": f"{jmeno} {prijmeni}".strip()
                })

    print(f"Načteno {len(spravci)} správců")
    ok = preskoceno = chyby = 0

    for s in spravci:
        email = f"{s['id']}@mojebudky.cz"
        try:
            auth.create_user(email=email, password=s["heslo"], display_name=s["jmeno"])
            print(f"✓ {s['id']} – {s['jmeno']}")
            ok += 1
        except firebase_admin.auth.EmailAlreadyExistsError:
            print(f"– {s['id']} již existuje")
            preskoceno += 1
        except Exception as e:
            print(f"✗ {s['id']}: {e}")
            chyby += 1

    print(f"\nHotovo! Vytvořeno: {ok}, přeskočeno: {preskoceno}, chyby: {chyby}")

if __name__ == "__main__":
    main()
