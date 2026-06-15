#!/usr/bin/env python3
"""
Generátor videa mapa-animace.mp4
MojeBudky.cz – animovaná mapa ptačích budek
"""

import asyncio
import io
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2
from playwright.async_api import async_playwright

CHROME = '/root/.cache/puppeteer/chrome-headless-shell/linux-149.0.7827.22/chrome-headless-shell-linux64/chrome-headless-shell'
OUTPUT  = '/home/user/mojebudky/mapa-animace.mp4'
WIDTH, HEIGHT = 1280, 720
FPS = 12


def make_tile(color=(242, 239, 228)):
    """Papírově béžová dlaždice – neutrální mapové pozadí."""
    img = Image.new('RGB', (256, 256), color=color)
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return buf.getvalue()


def frame_to_bgr(png_bytes):
    arr = np.array(Image.open(io.BytesIO(png_bytes)).convert('RGB'))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


async def main():
    tile_data = make_tile()

    with open('/tmp/leaflet_js.bin', 'rb') as f:
        leaflet_js = f.read()
    with open('/tmp/leaflet_css.bin', 'rb') as f:
        leaflet_css = f.read()

    frames = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        page = await browser.new_page()
        await page.set_viewport_size({'width': WIDTH, 'height': HEIGHT})

        async def handle_route(route):
            url = route.request.url
            if 'leaflet.js' in url:
                await route.fulfill(body=leaflet_js, content_type='application/javascript')
            elif 'leaflet.css' in url:
                await route.fulfill(body=leaflet_css, content_type='text/css')
            elif any(d in url for d in [
                'basemaps.cartocdn.com', 'openstreetmap.org',
                'tile.', '.tile.', '/tiles/'
            ]):
                await route.fulfill(body=tile_data, content_type='image/png')
            else:
                try:
                    await route.continue_()
                except Exception:
                    pass

        await page.route('**/*', handle_route)

        print('🌐 Načítám video-mapa.html ...')
        await page.goto('http://localhost:3000/video-mapa.html', timeout=25000)
        await page.wait_for_timeout(3000)

        total = await page.evaluate('BUDKY_RAW.length')
        print(f'📍 Celkem budek: {total}')

        # ── Úvodní záběr (2 sekundy) ──────────────────────────────────────
        intro = await page.screenshot()
        for _ in range(FPS * 2):
            frames.append(intro)

        prev_year = ''
        for i in range(total):
            await page.evaluate('pridejBudku()')
            await page.wait_for_timeout(55)       # čas na CSS pop-animaci
            shot = await page.screenshot()
            frames.append(shot)

            # Na přechodu roku přidej 1s pauzu
            year = await page.evaluate(
                "document.getElementById('rok-display').textContent"
            )
            if year != prev_year and prev_year:
                print(f'  📅 Přechod: {prev_year} → {year}')
                for _ in range(FPS):
                    frames.append(shot)
            prev_year = year

            if (i + 1) % 30 == 0:
                pct = (i + 1) / total * 100
                print(f'  ⏳ {i+1}/{total}  ({pct:.0f}%)')

        # ── Závěrečný záběr (3 sekundy) ───────────────────────────────────
        final = await page.screenshot()
        for _ in range(FPS * 3):
            frames.append(final)

        await browser.close()

    total_s = len(frames) / FPS
    print(f'\n🎬 Snímků: {len(frames)}  →  délka videa: {total_s:.1f} s')
    print('🔨 Kóduji MP4 ...')

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(OUTPUT, fourcc, FPS, (WIDTH, HEIGHT))

    for fb in frames:
        out.write(frame_to_bgr(fb))

    out.release()

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f'\n✅ Video uloženo: {OUTPUT}')
    print(f'   Velikost: {size_mb:.1f} MB  |  Rozlišení: {WIDTH}×{HEIGHT}  |  FPS: {FPS}')

    # Re-encode with ffmpeg for universal compatibility
    mp4_final = OUTPUT.replace('.mp4', '_final.mp4')
    ret = os.system(
        f'ffmpeg -y -i "{OUTPUT}" -vcodec libx264 -crf 22 -preset fast '
        f'-movflags +faststart "{mp4_final}" 2>/dev/null'
    )
    if ret == 0 and os.path.exists(mp4_final):
        final_mb = os.path.getsize(mp4_final) / 1024 / 1024
        print(f'   H.264 verze: {mp4_final} ({final_mb:.1f} MB)')
        os.replace(mp4_final, OUTPUT)
        print(f'✅ Finální soubor: {OUTPUT}')

if __name__ == '__main__':
    asyncio.run(main())
