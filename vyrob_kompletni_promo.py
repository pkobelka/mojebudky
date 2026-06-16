#!/usr/bin/env python3
"""
vyrob_kompletni_promo.py  –  kompletní promo MojeBudky.cz
==========================================================
  1. Filmový úvod  – 4 věty s animací (ze spodu, roste, rozpadne se)
  2. Animovaná mapa – existující mapa-animace-s-podkladem.mp4
  3. Závěrečná výzva – 5 s statická obrazovka pro partnery

Výstup: kompletni_promo_mojebudky.mp4  (1280×720, 25 fps, H.264)
"""

import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Konfigurace ───────────────────────────────────────────────────────────────
W, H       = 1280, 720
FPS        = 25
OUTPUT     = '/home/user/mojebudky/kompletni_promo_mojebudky.mp4'
MAPA_VIDEO = '/home/user/mojebudky/mapa-animace-s-podkladem.mp4'

FONT_CESTY = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
]

VETY_UVOD = [
    "Všechno to začalo úplně nenápadně,\nv tichu jedné obyčejné garáže…",
    "Na počátku stál prostý rodinný podnět\na chuť tvořit něco smysluplného vlastníma rukama.",
    "Chtěli jsme jen dát bezpečný domov\npár ptáčkům v našem nejbližším okolí.",
    "V té době by nás ani ve snu nenapadlo,\njak obrovskou lavinu zájmu\ntento malý rodinný nápad spustí…",
]

FONT_UVOD_VEL = 50   # základní velikost úvodního textu

# Závěrečná obrazovka: (text, velikost, barva RGB)
ZAVER = [
    ("Stanete se hrdým partnerem projektu MojeBudky.cz?", 40, (255, 220, 70)),
    ("", 20, (255, 255, 255)),
    ("Napište nám na:  p.kobelka@gmail.com",              28, (190, 255, 160)),
    ("Více na:  www.mojebudky.cz",                        28, (190, 255, 160)),
]

# Timing (snímky)
N_VETU    = int(FPS * 5.5)   # 5.5 s – délka animace jedné věty
N_CERNA   = int(FPS * 0.5)   # 0.5 s tma mezi větami
N_PRECHOD = int(FPS * 0.6)   # 0.6 s fade přechody
N_ZAVER   = int(FPS * 5.0)   # 5.0 s závěr

# Fáze animace věty (0–1)
P_IN   = 0.13   # konec fade-in
P_HOLD = 0.82   # začátek rozpadu

BG_TOP    = (5, 20, 5)
BG_BOTTOM = (0, 0, 0)


# ── Pomocné funkce ────────────────────────────────────────────────────────────

def nacti_font(vel: int) -> ImageFont.FreeTypeFont:
    for cesta in FONT_CESTY:
        if os.path.exists(cesta):
            return ImageFont.truetype(cesta, vel)
    return ImageFont.load_default()


def wrap_text(text: str, font, draw, max_w: int) -> list:
    radky = []
    for cast in text.split('\n'):
        radek = ''
        for slovo in cast.split(' '):
            test = (radek + ' ' + slovo).strip()
            if draw.textbbox((0, 0), test, font=font)[2] > max_w and radek:
                radky.append(radek); radek = slovo
            else:
                radek = test
        if radek:
            radky.append(radek)
    return radky


def gradient_bg() -> np.ndarray:
    bg = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        t = y / H
        bg[y, :] = [
            int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t),  # B
            int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t),  # G
            int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t),  # R
        ]
    return bg


def blend_text_on_bg(text_img: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Překryje bílý text na gradient pozadí."""
    out = bg.astype(np.float32)
    txt = text_img.astype(np.float32)
    mask = np.max(txt, axis=2, keepdims=True) / 255.0
    return np.clip(out * (1 - mask) + txt * mask, 0, 255).astype(np.uint8)


def render_veta(text: str, t: float, bg: np.ndarray) -> np.ndarray:
    """Vrátí jeden BGR snímek animované věty pro čas t ∈ [0, 1]."""
    # Vypočítej parametry animace
    if t < P_IN:
        p      = t / P_IN
        alfa   = p
        scale  = 0.62 + p * 0.38
        oy     = int(55 * (1 - p))
        blur   = int(5 * (1 - p))
    elif t < P_HOLD:
        p      = (t - P_IN) / (P_HOLD - P_IN)
        alfa   = 1.0
        scale  = 1.0 + p * 0.07
        oy     = int(-8 * p)
        blur   = 0
    else:
        p      = (t - P_HOLD) / (1 - P_HOLD)
        alfa   = 1 - p
        scale  = 1.07 + p * 0.33
        oy     = -8 - int(24 * p)
        blur   = int(9 * p)

    vel  = max(12, int(FONT_UVOD_VEL * scale))
    font = nacti_font(vel)

    img  = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    radky = wrap_text(text, font, draw, int(W * 0.84))

    vh    = draw.textbbox((0, 0), 'Áy', font=font)[3]
    gap   = int(vh * 0.28)
    ch    = len(radky) * vh + (len(radky) - 1) * gap
    y0    = (H - ch) // 2 + oy

    for i, radek in enumerate(radky):
        w = draw.textbbox((0, 0), radek, font=font)[2]
        x = (W - w) // 2
        y = y0 + i * (vh + gap)
        draw.text((x + 2, y + 2), radek, font=font, fill=(0, 0, 0))    # stín
        draw.text((x, y),         radek, font=font, fill=(255, 255, 255))

    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(blur))

    snimek = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    blended = blend_text_on_bg(snimek, bg)
    return cv2.convertScaleAbs(blended, alpha=alfa)


def render_zaver(bg: np.ndarray) -> np.ndarray:
    """Statická závěrečná obrazovka."""
    img  = Image.new('RGB', (W, H), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Spočítej celkovou výšku
    linky = [(t, s, c) for t, s, c in ZAVER if t]
    info  = [(t, nacti_font(s), draw.textbbox((0, 0), t, font=nacti_font(s))[3], c)
             for t, s, c in linky]
    total_h = sum(vh + 18 for _, _, vh, _ in info)

    y = (H - total_h) // 2
    for txt, font, vh, barva in info:
        w = draw.textbbox((0, 0), txt, font=font)[2]
        x = (W - w) // 2
        draw.text((x + 2, y + 2), txt, font=font, fill=(0, 0, 0))
        draw.text((x, y),         txt, font=font, fill=barva)
        y += vh + 22

    snimek = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    return blend_text_on_bg(snimek, bg)


def fade(a: np.ndarray, b: np.ndarray, n: int):
    """Generátor n přechodových snímků z a do b."""
    for i in range(n):
        t = (i + 1) / (n + 1)
        yield cv2.addWeighted(a, 1 - t, b, t, 0)


# ── Hlavní funkce ─────────────────────────────────────────────────────────────

def main():
    bg    = gradient_bg()
    cerna = np.zeros((H, W, 3), dtype=np.uint8)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video  = cv2.VideoWriter(OUTPUT, fourcc, FPS, (W, H))

    # ── ČÁST 1: Filmový úvod ──────────────────────────────────────────────────
    print(f'🎬 ČÁST 1 – Filmový úvod ({len(VETY_UVOD)} věty)')
    last_uvod = cerna
    for vi, veta in enumerate(VETY_UVOD):
        print(f'   ✍️  {vi+1}/{len(VETY_UVOD)}: {veta[:50].replace(chr(10)," ")}…')
        for i in range(N_VETU):
            snimek = render_veta(veta, i / N_VETU, bg)
            video.write(snimek)
            if i == N_VETU - 1:
                last_uvod = snimek
        if vi < len(VETY_UVOD) - 1:
            for _ in range(N_CERNA):
                video.write(cerna)

    # Fade do černé před mapou
    for f in fade(last_uvod, cerna, N_PRECHOD):
        video.write(f)
    video.write(cerna)

    # ── ČÁST 2: Animovaná mapa ────────────────────────────────────────────────
    print(f'\n🗺️  ČÁST 2 – Animovaná mapa ({MAPA_VIDEO})')
    cap = cv2.VideoCapture(MAPA_VIDEO)
    if not cap.isOpened():
        print(f'   ⚠️  Soubor nenalezen, přeskakuji!')
    else:
        mapa_fps   = cap.get(cv2.CAP_PROP_FPS) or 12.0
        mapa_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        ratio      = FPS / mapa_fps   # 25/12 ≈ 2.08
        print(f'   FPS: {mapa_fps}  Snímků: {mapa_total}  Poměr: {ratio:.2f}×')

        prvni = None
        posledni = cerna.copy()
        fi = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame.shape[1] != W or frame.shape[0] != H:
                frame = cv2.resize(frame, (W, H))
            if prvni is None:
                prvni = frame.copy()
                for f in fade(cerna, prvni, N_PRECHOD):
                    video.write(f)
            n = round((fi + 1) * ratio) - round(fi * ratio)
            for _ in range(n):
                video.write(frame)
            posledni = frame
            fi += 1
            if fi % 50 == 0:
                print(f'   ⏳ {fi}/{mapa_total}')
        cap.release()
        print(f'   ✅ {fi} snímků zpracováno')

    # Fade do černé po mapě
    for f in fade(posledni, cerna, N_PRECHOD):
        video.write(f)
    video.write(cerna)

    # ── ČÁST 3: Závěrečná výzva ───────────────────────────────────────────────
    print(f'\n🏁 ČÁST 3 – Závěrečná výzva ({N_ZAVER / FPS:.0f} s)')
    zaver = render_zaver(bg)
    for f in fade(cerna, zaver, N_PRECHOD):
        video.write(f)
    for _ in range(N_ZAVER):
        video.write(zaver)
    for f in fade(zaver, cerna, N_PRECHOD):
        video.write(f)
    video.write(cerna)

    video.release()

    # ── H.264 re-encode ───────────────────────────────────────────────────────
    size_raw = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f'\n✅ Surové video: {OUTPUT}  ({size_raw:.1f} MB)')

    h264 = OUTPUT.replace('.mp4', '_h264.mp4')
    ret = os.system(
        f'ffmpeg -y -i "{OUTPUT}" -vcodec libx264 -crf 18 -preset fast '
        f'-movflags +faststart "{h264}" 2>/dev/null'
    )
    if ret == 0 and os.path.exists(h264):
        os.replace(h264, OUTPUT)
        size_h264 = os.path.getsize(OUTPUT) / 1024 / 1024
        print(f'✅ H.264: {OUTPUT}  ({size_h264:.1f} MB)')

    dur_uvod = (len(VETY_UVOD) * N_VETU + (len(VETY_UVOD) - 1) * N_CERNA) / FPS
    dur_mapa = mapa_total / mapa_fps if 'mapa_total' in dir() else 0
    dur_zaver = N_ZAVER / FPS
    print(f'\n   Rozlišení : {W}×{H}  |  {FPS} fps')
    print(f'   Úvod       : {dur_uvod:.0f} s')
    print(f'   Mapa       : {dur_mapa:.0f} s')
    print(f'   Závěr      : {dur_zaver:.0f} s')
    print(f'   CELKEM     : ~{dur_uvod + dur_mapa + dur_zaver:.0f} s')


if __name__ == '__main__':
    main()
