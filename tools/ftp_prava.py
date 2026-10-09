#!/usr/bin/env python3
"""Vypíše příkazy pro lftp, které na WEDOSu srovnají práva nahraných souborů:
složkám 755, souborům 644.

Spouští se při nasazení (workflow ftp-deploy*.yml) hned po FTP deployi.
FTP deploy práva nenastavuje a složky, které na serveru nově vytvoří, dostanou
taková, že z nich server vrací 403 Forbidden („Server unable to read htaccess
file“) – stalo se to u img/info/ i u volby/ (viz PLAN.md).

Bere jen soubory z gitu (stejné vynechávky jako deploy), takže nesahá na nic,
co na serveru leží mimo repo – na produkčním účtu hlavně na složku _test.

Použití: python3 tools/ftp_prava.py > prava.lftp
"""
import fnmatch
import os
import subprocess

# Stejné jako "exclude" v ftp-deploy*.yml
VYNECHAT = [".git*", ".github/*", "functions/*", "*.py", "PLAN.md",
            "data/*.csv", "*.wav", "*.mp3", "_test/*"]


def vynechat(cesta):
    jmeno = os.path.basename(cesta)
    for vzor in VYNECHAT:
        if fnmatch.fnmatch(cesta, vzor) or fnmatch.fnmatch(jmeno, vzor):
            return True
        if vzor.endswith("/*") and cesta.startswith(vzor[:-1]):
            return True
    return False


def main():
    soubory = subprocess.run(["git", "ls-files", "-z"], capture_output=True,
                             check=True, text=True).stdout.split("\0")
    soubory = sorted(s for s in soubory if s and not vynechat(s))

    slozky = set()
    for s in soubory:
        d = os.path.dirname(s)
        while d:
            slozky.add(d)
            d = os.path.dirname(d)

    def q(cesta):
        return '"' + cesta.replace("\\", "\\\\").replace('"', '\\"') + '"'

    # Nejdřív složky – dokud se do nich nedá vstoupit, nejdou změnit ani soubory
    for d in sorted(slozky):
        print(f"chmod 755 {q(d)}")
    for s in soubory:
        print(f"chmod 644 {q(s)}")


if __name__ == "__main__":
    main()
