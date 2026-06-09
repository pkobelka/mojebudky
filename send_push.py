#!/usr/bin/env python3
"""
MojeBudky.cz – odesílání push notifikací
==========================================
Použití:
    python send_push.py "Titulek" "Text zprávy"
    python send_push.py "Titulek" "Text zprávy" "loginId"   # jen jednomu správci

Potřebuješ:
    1. service-account-key.json  (stáhnout z Firebase Console →
       Project Settings → Service accounts → Generate new private key)
    2. pip install firebase-admin

Skript pošle notifikaci všem uloženým tokenům v Firebase
node: push_tokens/{id}/token
"""

import sys
import json
import time
import firebase_admin
from firebase_admin import credentials, messaging, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL    = 'https://moje-budky-default-rtdb.firebaseio.com'
ICON_URL        = 'https://pkobelka.github.io/mojebudky/img/icon-192.png'
CLICK_URL       = 'https://pkobelka.github.io/mojebudky/'

def main():
    if len(sys.argv) < 3:
        print('Použití: python send_push.py "Titulek" "Text zprávy" ["loginId"]')
        sys.exit(1)

    title     = sys.argv[1]
    body      = sys.argv[2]
    target_id = sys.argv[3].strip() if len(sys.argv) > 3 else ''

    # Inicializace Firebase Admin
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    # Načti tokeny (všechny nebo jen cílového správce)
    snap = db.reference('push_tokens').get()
    if not snap:
        print('Žádné uložené tokeny – nikdo ještě nepovolil notifikace.')
        return

    tokens = []
    for key, val in snap.items():
        if target_id and key != target_id:
            continue
        t = val.get('token') if isinstance(val, dict) else None
        if t:
            tokens.append((key, t))

    if not tokens:
        if target_id:
            print(f'Správce "{target_id}" nemá uložený push token.')
        else:
            print('Žádné platné tokeny.')
        return

    if target_id:
        print(f'Odesílám notifikaci správci "{target_id}"…')
    else:
        print(f'Odesílám notifikaci {len(tokens)} příjemcům…')
    print(f'  Titulek: {title}')
    print(f'  Text:    {body}')

    ok = 0
    err = 0
    neplatne = []

    for key, token in tokens:
        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon=ICON_URL,
                    badge=ICON_URL,
                ),
                fcm_options=messaging.WebpushFCMOptions(link=CLICK_URL),
            ),
            token=token,
        )
        try:
            messaging.send(msg)
            ok += 1
        except messaging.UnregisteredError:
            db.reference(f'push_tokens/{key}').delete()
            neplatne.append(key)
            err += 1
        except Exception as e:
            print(f'  Chyba pro {key}: {e}')
            err += 1

    print(f'\nVýsledek: {ok} odesláno, {err} chyb.')
    if neplatne:
        print(f'Odstraněno {len(neplatne)} neplatných tokenů: {neplatne}')

    # Zapíše broadcast do DB — app zachytí a zobrazí banner i při otevřené stránce
    broadcast = {'title': title, 'body': body, 'ts': int(time.time() * 1000)}
    if target_id:
        broadcast['target'] = target_id
    db.reference('push_broadcast').set(broadcast)

if __name__ == '__main__':
    main()
