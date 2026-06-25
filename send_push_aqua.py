#!/usr/bin/env python3
"""
AquaControl – odesílání push notifikací (FCM)
=============================================
Použití:
    python send_push_aqua.py "Titulek" "Text zprávy"
    python send_push_aqua.py "Titulek" "Text zprávy" "ac-xxxx"   # jen jednomu zařízení

Čte tokeny z uzlu `aqua_push_tokens` (registruje je AquaControl appka po
kliknutí na "Povolit notifikace"). Sdílí Firebase projekt moje-budky.
"""

import sys
import time
import firebase_admin
from firebase_admin import credentials, messaging, db

SERVICE_ACCOUNT = 'service-account-key.json'
DATABASE_URL    = 'https://moje-budky-default-rtdb.firebaseio.com'
ICON_URL        = 'https://pkobelka.github.io/mojebudky/aqua/icon-192.png'
APP_URL         = 'https://pkobelka.github.io/mojebudky/aqua/'
NODE            = 'aqua_push_tokens'


def main():
    if len(sys.argv) < 3:
        print('Použití: python send_push_aqua.py "Titulek" "Text" ["device_id"]')
        sys.exit(1)

    title     = sys.argv[1]
    body      = sys.argv[2]
    target_id = sys.argv[3].strip() if len(sys.argv) > 3 else ''
    push_id   = str(int(time.time() * 1000))

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})

    snap = db.reference(NODE).get()
    if not snap:
        print('Žádné uložené tokeny – nikdo ještě nepovolil notifikace v AquaControlu.')
        return

    tokens = []
    for key, val in snap.items():
        if target_id and key != target_id:
            continue
        t = val.get('token') if isinstance(val, dict) else None
        if t:
            tokens.append((key, t))

    if not tokens:
        print(f'Zařízení "{target_id}" nemá uložený token.' if target_id else 'Žádné platné tokeny.')
        return

    print(f'Odesílám {len(tokens)} příjemcům…  Titulek: {title} | Text: {body}')

    ok = err = 0
    neplatne = []
    for key, token in tokens:
        msg = messaging.Message(
            webpush=messaging.WebpushConfig(
                headers={'Urgency': 'high'},
                fcm_options=messaging.WebpushFCMOptions(link=APP_URL),
            ),
            data={'push_id': push_id, 'title': title, 'body': body, 'url': APP_URL},
            token=token,
        )
        try:
            messaging.send(msg)
            ok += 1
        except messaging.UnregisteredError:
            db.reference(f'{NODE}/{key}').delete()
            neplatne.append(key)
            err += 1
        except Exception as e:
            print(f'  Chyba pro {key}: {e}')
            err += 1

    print(f'\nVýsledek: {ok} odesláno, {err} chyb.')
    if neplatne:
        print(f'Odstraněno {len(neplatne)} neplatných tokenů: {neplatne}')


if __name__ == '__main__':
    main()
