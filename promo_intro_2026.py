#!/usr/bin/env python3
"""
promo_intro_2026.mp4  –  MojeBudky.cz filmové titulky
1920×1080, 25 fps, H.264

Použití:
  python3 promo_intro_2026.py
"""

import os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

# ── Nastavení ─────────────────────────────────────────────────────────────────
SIRKA, VYSKA = 1920, 1080
FPS          = 25
OUTPUT       = '/home/user/mojebudky/promo_intro_2026.mp4'

# Fonty s českou diakritikou (priorita: DejaVu Bold → Liberation → FreeSans)
FONT_CESTY = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
]

# Texty (7 vět)
VETY = [
    "Všechno to začalo úplně nenápadně, v tichu jedné obyčejné garáže…",
    "Na počátku stál prostý rodinný podnět\na chuť tvořit něco smysluplného vlastníma rukama.",
    "Chtěli jsme jen dát bezpečný domov\npár ptáčkům v našem nejbližším okolí.",
    "V té době by nás ani ve snu nenapadlo,\njak obrovskou lavinu zájmu tento malý rodinný nápad spustí…",
    "Udržet takto velký projekt v chodu\nvšak vyžaduje nejen čas, ale i nemalé náklady.",
    "Budeme vděční, když podpoříte dobrou myšlenku\na stanete se hrdým partnerem MojeBudky.cz.",
    "Společně budujeme projekt,\nkterý vrací život tam, kam patří.",
]

# Timing na větu
SNIMKU_NA_VETU   = 100   # 4.0 s celkem
SNIMKU_FADE_IN   = 12    # 0.48 s – nástup
SNIMKU_FADE_OUT  = 25    # 1.0 s – odchod (posledních N snímků věty)
SNIMKU_CERNA     = 12    # 0.48 s tma mezi větami

# Barvy pozadí (jemný tmavě zelený přechod → černá)
BG_TOP    = (5, 20, 5)      # RGB
BG_BOTTOM = (0, 0, 0)       # RGB


# ── Pomocné funkce ────────────────────────────────────────────────────────────

def nacti_font(velikost: int) -> ImageFont.FreeTypeFont:
    for cesta in FONT_CESTY:
        if os.path.exists(cesta):
            return ImageFont.truetype(cesta, velikost)
    return ImageFont.load_default()


def zalamuj_text(text: str, font, draw, max_sirka: int) -> list[str]:
    """Rozdělí text na řádky tak, aby nepřekročily max_sirka pixelů.
    Respektuje explicitní \\n v textu."""
    radky = []
    for cast in text.split('\n'):
        slova = cast.split(' ')
        radek = ''
        for slovo in slova:
            test = (radek + ' ' + slovo).strip()
            w = draw.textbbox((0, 0), test, font=font)[2]
            if w > max_sirka and radek:
                radky.append(radek)
                radek = slovo
            else:
                radek = test
        if radek:
            radky.append(radek)
    return radky


def gradient_pozadi() -> np.ndarray:
    """Vytvoří tmavě zeleno→černý gradient jako pozadí."""
    bg = np.zeros((VYSKA, SIRKA, 3), dtype=np.uint8)
    for y in range(VYSKA):
        t = y / VYSKA
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        bg[y, :] = [b, g, r]   # OpenCV: BGR
    return bg


def generuj_snimek(text: str, meritko: float, alfa: float,
                   bg: np.ndarray, zakladni_vel: int) -> np.ndarray:
    """Vrátí jeden BGR snímek s textem na pozadí."""
    velikost = max(10, int(zakladni_vel * meritko))
    img = Image.new('RGB', (SIRKA, VYSKA), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = nacti_font(velikost)

    max_sirka_textu = int(SIRKA * 0.82)
    radky = zalamuj_text(text, font, draw, max_sirka_textu)

    # Výška jednoho řádku
    vh = draw.textbbox((0, 0), 'Áy', font=font)[3]
    mezera = int(vh * 0.25)
    celk_vyska = len(radky) * vh + (len(radky) - 1) * mezera

    y0 = (VYSKA - celk_vyska) // 2
    for i, radek in enumerate(radky):
        w = draw.textbbox((0, 0), radek, font=font)[2]
        x = (SIRKA - w) // 2
        y = y0 + i * (vh + mezera)
        # Stín pro lepší čitelnost
        draw.text((x + 3, y + 3), radek, font=font, fill=(0, 0, 0))
        draw.text((x, y),         radek, font=font, fill=(255, 255, 255))

    # Převod na BGR numpy
    snimek = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    # Blend s pozadím (tmavý gradient viditelný skrz text – jen na pozadí)
    # Aplikuj pozadí → překryj textem
    out = bg.copy().astype(np.float32)
    txt = snimek.astype(np.float32)
    # Kde je text bílý, zobraz text; jinak pozadí (jednoduché max blend)
    mask = np.max(txt, axis=2, keepdims=True) / 255.0
    blended = out * (1 - mask) + txt * mask
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    # Fade (alfa)
    return cv2.convertScaleAbs(blended, alpha=alfa, beta=0)


# ── Hlavní smyčka ─────────────────────────────────────────────────────────────

def main():
    bg = gradient_pozadi()
    ZAKLADNI_VEL = 68    # základní velikost písma pro měřítko 1.0

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video  = cv2.VideoWriter(OUTPUT, fourcc, FPS, (SIRKA, VYSKA))
    cerna  = np.zeros((VYSKA, SIRKA, 3), dtype=np.uint8)

    print(f'🎬 Generuji promo intro ({len(VETY)} vět, {FPS} fps)…')

    for vi, veta in enumerate(VETY):
        print(f'  📝 Věta {vi+1}/{len(VETY)}: {veta[:45]}…')

        for i in range(SNIMKU_NA_VETU):
            t = i / float(SNIMKU_NA_VETU)

            # Měřítko: 1.28 → 0.88  (plynulý zoom-out)
            meritko = 1.28 - t * 0.40

            # Alfa: fade-in → plná → fade-out
            if i < SNIMKU_FADE_IN:
                alfa = i / SNIMKU_FADE_IN
            elif i >= SNIMKU_NA_VETU - SNIMKU_FADE_OUT:
                zbyvajici = SNIMKU_NA_VETU - i
                alfa = zbyvajici / SNIMKU_FADE_OUT
            else:
                alfa = 1.0

            snimek = generuj_snimek(veta, meritko, alfa, bg, ZAKLADNI_VEL)
            video.write(snimek)

        # Krátká tma mezi větami
        if vi < len(VETY) - 1:
            for _ in range(SNIMKU_CERNA):
                video.write(cerna)

    video.release()

    delka = (len(VETY) * SNIMKU_NA_VETU + (len(VETY) - 1) * SNIMKU_CERNA) / FPS
    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f'\n✅ Video hotovo: {OUTPUT}')
    print(f'   Délka:      {delka:.1f} s')
    print(f'   Rozlišení:  {SIRKA}×{VYSKA}  |  {FPS} fps')
    print(f'   Velikost:   {size_mb:.1f} MB')

    # Re-encode H.264 pro universální přehrávatelnost
    h264 = OUTPUT.replace('.mp4', '_h264.mp4')
    ret = os.system(
        f'ffmpeg -y -i "{OUTPUT}" -vcodec libx264 -crf 18 '
        f'-preset fast -movflags +faststart "{h264}" 2>/dev/null'
    )
    if ret == 0 and os.path.exists(h264):
        os.replace(h264, OUTPUT)
        size_mb2 = os.path.getsize(OUTPUT) / 1024 / 1024
        print(f'   H.264:      {size_mb2:.1f} MB  ← finální soubor')


if __name__ == '__main__':
    main()
