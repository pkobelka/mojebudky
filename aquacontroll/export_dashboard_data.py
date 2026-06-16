#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AquaControll – export dat pro dashboard.

Načte data ze SQLite databáze a uloží je jako web/data.json, ze kterého
čte statický dashboard (web/index.html). Spouštět po každé změně dat:

    python3 export_dashboard_data.py
"""

import os
import json
import sqlite3
from datetime import datetime

ZAKLADNI_ADRESAR = os.path.dirname(os.path.abspath(__file__))
CESTA_DB = os.path.join(ZAKLADNI_ADRESAR, "data", "aquacontroll.db")
VYSTUP = os.path.join(ZAKLADNI_ADRESAR, "web", "data.json")

# Stavy, které považujeme za "otevřené" (nedořešené)
OTEVRENE_STAVY = ("novy", "v_reseni")


def main() -> None:
    conn = sqlite3.connect(CESTA_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # --- střediska s počítadly pro odznaky ---
    # pořadí závažnosti (pro určení nejvyššího stupně otevřených událostí)
    RANK = {"drobnost": 1, "nizka": 2, "stredni": 3, "vysoka": 4, "kriticka": 5}

    strediska = []
    reditelstvi = None
    for s in cur.execute("SELECT * FROM strediska ORDER BY je_centrala DESC, nazev").fetchall():
        sid = s["id"]
        otevrene = cur.execute(
            f"""SELECT COUNT(*) FROM udalosti
                WHERE stredisko_id = ? AND stav IN {OTEVRENE_STAVY}""",
            (sid,)).fetchone()[0]
        kriticke = cur.execute(
            f"""SELECT COUNT(*) FROM udalosti
                WHERE stredisko_id = ? AND stav IN {OTEVRENE_STAVY}
                  AND zavaznost = 'kriticka'""",
            (sid,)).fetchone()[0]
        # nejvyšší závažnost mezi otevřenými událostmi (pro barvu odznaku)
        max_zav = None
        for r in cur.execute(
                f"""SELECT DISTINCT zavaznost FROM udalosti
                    WHERE stredisko_id = ? AND stav IN {OTEVRENE_STAVY}""", (sid,)):
            if max_zav is None or RANK.get(r["zavaznost"], 0) > RANK.get(max_zav, 0):
                max_zav = r["zavaznost"]
        celkem = cur.execute(
            "SELECT COUNT(*) FROM udalosti WHERE stredisko_id = ?", (sid,)).fetchone()[0]
        pocet_vodovodu = cur.execute(
            "SELECT COUNT(*) FROM lokality WHERE stredisko_id = ?", (sid,)).fetchone()[0]
        pocet_lidi = cur.execute(
            "SELECT COUNT(*) FROM uzivatele WHERE stredisko_id = ?", (sid,)).fetchone()[0]
        zaznam = {
            "id": sid, "nazev": s["nazev"], "je_centrala": bool(s["je_centrala"]),
            "otevrene": otevrene, "kriticke": kriticke, "celkem": celkem,
            "max_zavaznost": max_zav,
            "pocet_vodovodu": pocet_vodovodu, "pocet_lidi": pocet_lidi,
        }
        # VHOS = ředitelství: vyčlenit zvlášť, nepočítat mezi střediska
        if s["je_centrala"]:
            reditelstvi = zaznam
        else:
            strediska.append(zaznam)

    # --- události s detaily ---
    udalosti = []
    for u in cur.execute("""
            SELECT u.*, s.nazev AS stredisko, l.nazev AS vodovod, l.kod AS vf,
                   vz.jmeno AS vytvoril_jmeno, re.jmeno AS prirazeno_jmeno
            FROM udalosti u
            LEFT JOIN strediska s ON s.id = u.stredisko_id
            LEFT JOIN lokality l ON l.id = u.lokalita_id
            LEFT JOIN uzivatele vz ON vz.id = u.vytvoril_id
            LEFT JOIN uzivatele re ON re.id = u.prirazeno_id
            ORDER BY u.nahlaseno DESC, u.id DESC""").fetchall():
        uid = u["id"]
        ukoly = [{
            "nazev": t["nazev"], "popis": t["popis"], "stav": t["stav"],
            "termin": t["termin"], "zalozil": t["zalozil"], "prirazeno": t["prirazeno"],
        } for t in cur.execute("""
            SELECT t.*, z.jmeno AS zalozil, p.jmeno AS prirazeno
            FROM ukoly t
            LEFT JOIN uzivatele z ON z.id = t.zalozil_id
            LEFT JOIN uzivatele p ON p.id = t.prirazeno_id
            WHERE t.udalost_id = ? ORDER BY t.id""", (uid,))]
        informovani = [r["jmeno"] for r in cur.execute("""
            SELECT u.jmeno FROM udalost_informovani i
            JOIN uzivatele u ON u.id = i.uzivatel_id
            WHERE i.udalost_id = ? ORDER BY u.jmeno""", (uid,))]
        udalosti.append({
            "id": uid, "titul": u["titul"], "popis": u["popis"], "typ": u["typ"],
            "zavaznost": u["zavaznost"], "stav": u["stav"],
            "stredisko": u["stredisko"], "vodovod": u["vodovod"], "vf": u["vf"],
            "adresa": u["adresa"], "gps_lat": u["gps_lat"], "gps_lng": u["gps_lng"],
            "nahlasil": u["nahlasil"], "nahlasil_tel": u["nahlasil_tel"],
            "nahlaseno": u["nahlaseno"],
            "vytvoril": u["vytvoril_jmeno"], "prirazeno": u["prirazeno_jmeno"],
            "ukoly": ukoly, "informovani": informovani,
        })

    vysoke = sum(1 for u in udalosti
                 if u["zavaznost"] == "vysoka" and u["stav"] in OTEVRENE_STAVY)
    kriticke = sum(1 for u in udalosti
                   if u["zavaznost"] == "kriticka" and u["stav"] in OTEVRENE_STAVY)
    data = {
        "vygenerovano": datetime.now().isoformat(timespec="seconds"),
        "souhrn": {
            "strediska": len(strediska),          # VHOS (ředitelství) se nepočítá
            "udalosti": len(udalosti),
            "otevrene": sum(s["otevrene"] for s in strediska),
            "vysoke": vysoke,
            "kriticke": kriticke,
        },
        "reditelstvi": reditelstvi,               # VHOS – dohled nad středisky
        "strediska": strediska,
        "udalosti": udalosti,
    }

    os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Export hotov → {VYSTUP}")
    print(f"  střediska: {len(strediska)}, události: {len(udalosti)}, "
          f"otevřené: {data['souhrn']['otevrene']}, kritické: {data['souhrn']['kriticke']}")
    conn.close()


if __name__ == "__main__":
    main()
