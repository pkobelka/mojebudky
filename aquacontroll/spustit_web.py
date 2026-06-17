#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AquaControl – spuštění dashboardu na lokálním serveru.

Dashboard čte data.json přes fetch(), což prohlížeč u file:// blokuje.
Tento skript proto naservíruje složku web/ na http://localhost:8000.

    python3 spustit_web.py        # výchozí port 8000
    python3 spustit_web.py 8080   # vlastní port
"""

import os
import sys
import http.server
import socketserver

ADRESAR_WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


def main() -> None:
    if not os.path.exists(os.path.join(ADRESAR_WEB, "data.json")):
        print("! Upozornění: web/data.json neexistuje.")
        print("  Spusť nejdřív:  python3 inicializace_databaze.py "
              "&& python3 export_dashboard_data.py\n")

    os.chdir(ADRESAR_WEB)
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"AquaControl dashboard běží na:  http://localhost:{PORT}")
        print("Ukončení: Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nUkončeno.")


if __name__ == "__main__":
    main()
