#!/usr/bin/env python3
"""
MojeBudky – zneplatnění přístupů u nepoužívaných účtů

POZOR NA NÁZEV: v .gitignore je pravidlo `*hesla*`, které má bránit
commitnutí souboru hesla.csv s hesly v plaintextu. Kdyby se tenhle soubor
jmenoval *_hesla.py, git by ho tiše ignoroval a na GitHub by se nedostal
(což se přesně stalo a chvíli trvalo, než se na to přišlo). Proto
"pristupy" místo "hesla" – to pravidlo je užitečné a nemá se kvůli
názvu souboru obcházet.
===================================================
Spouští se ručně přes .github/workflows/zneplatnit-pristupy.yml.

PROČ: hashe hesel byly do 8/2026 veřejně ke stažení, takže všech 215 účtů
je potřeba považovat za kompromitované. Vynucená změna hesla to řeší jen
u toho, kdo se přihlásí – u zbytku ne. Web reálně používá 10–15 lidí, takže
se hesla zneplatní všem naráz a aktivují se jednotlivě na požádání
(v administraci „Nastavit heslo správci").

CO DĚLÁ: každému účtu kromě těch v PONECHAT nastaví heslo, které nikdo nezná
(náhodných 64 bajtů, které skript nikde nevypíše ani neuloží) a označí ho
`zneplatneno` časovým razítkem. Účet zůstává i s příznakem `admin`, takže
stačí mu přes administraci nastavit nové heslo a zase funguje.

NEVYPISUJE ŽÁDNÁ HESLA. Logy GitHub Actions jsou u veřejného repa veřejné.

Na konci ověří, že účty v PONECHAT zůstaly nedotčené – kdyby se cokoli
pokazilo, provozovatel se nesmí zamknout ven.
"""

import hashlib
import os
import secrets
import sys
import time

import firebase_admin
from firebase_admin import credentials, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL = 'https://moje-budky-default-rtdb.firebaseio.com'
NODE = 'budky_auth'
LOGIN_LOG = 'prihlaseni'

# musí sedět s konstantou SCRYPT ve functions/index.js
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def nahodny_zaznam(admin_priznak, ts):
    """Záznam s heslem, které nikdo nezná – ani tenhle skript si ho nepamatuje."""
    tajemstvi = secrets.token_hex(64)
    salt = secrets.token_bytes(16).hex()
    h = hashlib.scrypt(
        hashlib.sha256(tajemstvi.encode('utf-8')).hexdigest().encode('utf-8'),
        salt=bytes.fromhex(salt),
        n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN,
    ).hex()
    del tajemstvi
    return {
        'alg': 'scrypt-sha256',
        'salt': salt,
        'hash': h,
        'admin': admin_priznak is True,
        'must_change': False,
        'zneplatneno': ts,
        'ts': ts,
    }


def nacti_aktivni():
    """Účty, které se aspoň jednou přihlásily – podle historie v uzlu `prihlaseni`.

    Ten uzel plní `_presenceSetSpravce` při každém přihlášení, takže je to
    nejspolehlivější stopa po tom, kdo web opravdu používá. Vypisovat těch pár
    desítek ID ručně do formuláře by koledovalo o překlep, a překlep by znamenal
    zavřené dveře někomu, kdo se přihlásit potřebuje.
    """
    zaznamy = db.reference(LOGIN_LOG).get() or {}
    if not zaznamy:
        sys.exit(
            f'CHYBA: uzel `{LOGIN_LOG}` je prázdný nebo nečitelný.\n'
            'Bez historie přihlášení nedokážu poznat aktivní účty a zneplatnil '
            'bych i je. Radši nedělám nic.'
        )
    aktivni = set()
    for z in zaznamy.values():
        if isinstance(z, dict) and z.get('loginId'):
            aktivni.add(str(z['loginId']).strip())
    return aktivni


def main():
    ponechat = {
        x.strip() for x in os.environ.get('PONECHAT', '').split(',') if x.strip()
    }
    if not ponechat:
        sys.exit('CHYBA: nezadán žádný účet do PONECHAT. Bez toho by ses zamkl ven.')

    ponechat_aktivni = os.environ.get('PONECHAT_AKTIVNI', '').strip().lower() in (
        '1', 'true', 'ano', 'yes')

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    if ponechat_aktivni:
        aktivni = nacti_aktivni()
        print(f'Účtů s historií přihlášení: {len(aktivni)} – ty se nechávají funkční.')
        ponechat |= aktivni

    ucty = db.reference(NODE).get() or {}
    if not ucty:
        sys.exit(f'CHYBA: uzel `{NODE}` je prázdný. Nic nedělám.')

    # Ručně zadané účty musí existovat – překlep by znamenal zamčení ven.
    # U odvozených z historie to nevadí: v logu můžou být i ID, která už
    # v budky_auth nejsou (smazaný správce), a to není důvod nic nedělat.
    rucni = {x.strip() for x in os.environ.get('PONECHAT', '').split(',') if x.strip()}
    chybi = rucni - set(ucty)
    if chybi:
        sys.exit(f'CHYBA: účty {sorted(chybi)} v `{NODE}` neexistují. '
                 'Zkontroluj ID – nechci zneplatnit všechno a nechat tě venku.')
    ponechat &= set(ucty) | rucni

    # snímek účtů, které mají zůstat, pro kontrolu na konci
    pred = {k: dict(ucty[k]) for k in ponechat if isinstance(ucty[k], dict)}

    ts = int(time.time() * 1000)
    davka = {}
    uz_zneplatnenych = 0
    for login_id, z in ucty.items():
        if login_id in ponechat:
            continue
        if not isinstance(z, dict):
            continue
        if z.get('zneplatneno'):
            uz_zneplatnenych += 1
            continue
        davka[login_id] = nahodny_zaznam(z.get('admin'), ts)

    print(f'Účtů celkem: {len(ucty)}')
    print(f'Ponechávám funkční: {sorted(ponechat)}')
    print(f'Už zneplatněných dřív: {uz_zneplatnenych}')
    print(f'Ke zneplatnění teď: {len(davka)}')

    if not davka:
        print('\nNení co dělat.')
        return

    db.reference(NODE).update(davka)

    # kontrola: ponechané účty se nesměly změnit
    po = db.reference(NODE).get() or {}
    for login_id, puvodni in pred.items():
        nyni = po.get(login_id) or {}
        if nyni.get('hash') != puvodni.get('hash') or nyni.get('salt') != puvodni.get('salt'):
            sys.exit(f'CHYBA: účet {login_id} se změnil, ačkoli měl zůstat! '
                     'Zkontroluj stav v konzoli Firebase.')
        if nyni.get('zneplatneno'):
            sys.exit(f'CHYBA: účet {login_id} je označen jako zneplatněný, ačkoli měl zůstat!')

    zbyva_funkcnich = sum(
        1 for z in po.values() if isinstance(z, dict) and not z.get('zneplatneno'))
    print(f'\nHotovo: zneplatněno {len(davka)} účtů.')
    print(f'Funkčních účtů zůstává: {zbyva_funkcnich} (mělo by být {len(ponechat)}).')
    if ponechat_aktivni:
        print('Aktivní účty zůstaly funkční – jejich uživatelé si heslo\n'
              'nastaví sami při dalším přihlášení (vynucená změna).')
    print('Ponechané účty ověřeny – heslo se jim nezměnilo.')
    print('\nDalšímu správci heslo nastavíš v administraci: Nastavit heslo správci.')


if __name__ == '__main__':
    main()
