#!/usr/bin/env python3
"""
Generátor videa mapa-animace-s-podkladem.mp4
MojeBudky.cz – animovaná mapa s reálnou podkladovou mapou ČR+SK

Použití:
  python3 generuj_video_s_mapou.py

Výstup:
  mapa-animace-s-podkladem.mp4  (1280×720, H.264)
"""

import sys, os, re, io, math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as patheff
import matplotlib.patches as mpatches
import geopandas as gpd
import cv2

# ── Nastavení ─────────────────────────────────────────────────────────────────
OUTPUT   = '/home/user/mojebudky/mapa-animace-s-podkladem.mp4'
W, H     = 1280, 720
FPS      = 12
DPI      = 96

# Geografický výřez – ČR + SK + okolí s bufferem
XMIN, XMAX = 11.2, 23.2
YMIN, YMAX = 47.5, 51.8

# Barvy podle roku přidání budky
ROK_BARVY = {
    '2022/2023': '#e06820',   # oranžová
    '2023':      '#2a9a20',   # zelená
    '2024':      '#1a72c0',   # modrá
    '2025':      '#9b2d9b',   # fialová
    '2025+':     '#c89610',   # zlatá
}

# Bundled offline shapefile (pyogrio test fixtures – Natural Earth 110m)
NE_SHP = '/usr/local/lib/python3.11/dist-packages/pyogrio/tests/fixtures/naturalearth_lowres/naturalearth_lowres.shp'


# ── Pomocné funkce ────────────────────────────────────────────────────────────

def get_rok(c: int) -> str:
    if c <= 32:  return '2022/2023'
    if c <= 82:  return '2023'
    if c <= 142: return '2024'
    if c <= 203: return '2025'
    return '2025+'


def load_budky():
    """Parsuje BUDKY_RAW ze souboru video-mapa.html."""
    with open('/home/user/mojebudky/video-mapa.html', encoding='utf-8') as f:
        raw = f.read()
    block = re.search(r'const BUDKY_RAW\s*=\s*\[(.*?)\];', raw, re.DOTALL)
    if not block:
        raise RuntimeError('BUDKY_RAW nenalezeno v video-mapa.html')
    budky = []
    # Formát: [cislo,"jmeno",lat,lon]  nebo  [cislo,"",lat,lon]
    for m in re.finditer(
        r'\[\s*(\d+)\s*,\s*((?:"[^"]*")|null)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*\]',
        block.group(1)
    ):
        cislo = int(m.group(1))
        raw_name = m.group(2)
        jmeno = raw_name.strip('"') if raw_name != 'null' else ''
        lat, lon = float(m.group(3)), float(m.group(4))
        budky.append((cislo, jmeno, lat, lon))
    return budky


def fig_to_frame(fig) -> np.ndarray:
    """Převede matplotlib figure na BGR numpy array pro OpenCV."""
    fig.canvas.draw()
    buf = fig.canvas.buffer_rgba()
    arr = np.asarray(buf, dtype=np.uint8).reshape(fig.canvas.get_width_height()[::-1] + (4,))
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR)
    if bgr.shape[1] != W or bgr.shape[0] != H:
        bgr = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_LANCZOS4)
    return bgr


def build_map_axes() -> tuple:
    """Vykreslí mapu na pozadí a vrátí (fig, ax)."""
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
    fig.patch.set_facecolor('#2a3a1a')

    ax.set_xlim(XMIN, XMAX)
    ax.set_ylim(YMIN, YMAX)
    ax.set_aspect('auto')
    ax.axis('off')

    # ── 1. Zkus contextily (funguje lokálně s internetem) ──────────────────
    ctx_ok = False
    try:
        import contextily as ctx
        ctx.add_basemap(
            ax, crs='EPSG:4326',
            source=ctx.providers.CartoDB.Positron,
            zoom=7, attribution=False
        )
        ax.set_xlim(XMIN, XMAX)
        ax.set_ylim(YMIN, YMAX)
        ctx_ok = True
        print('✅ Mapa: CartoDB Positron (contextily)')
    except Exception as e:
        print(f'ℹ️  Contextily nedostupné ({type(e).__name__}), používám offline data')

    if not ctx_ok:
        # ── 2. Offline Natural Earth (bundled shapefile) ───────────────────
        world = gpd.read_file(NE_SHP)
        europe = world[world['continent'] == 'Europe']

        czsk_names  = {'Czechia', 'Slovakia'}
        neighbors   = {'Germany', 'Austria', 'Poland', 'Hungary',
                       'Ukraine', 'Romania', 'Belarus'}

        bg_countries  = europe[~europe['name'].isin(czsk_names | neighbors)]
        neigh_ctrs    = europe[ europe['name'].isin(neighbors)]
        czsk_ctrs     = europe[ europe['name'].isin(czsk_names)]

        # Barvy vrstev
        bg_countries.plot(ax=ax, color='#3a4e28', edgecolor='#506040', lw=0.5, zorder=1)
        neigh_ctrs.plot(  ax=ax, color='#4a5e34', edgecolor='#6a7a50', lw=0.8, zorder=2)
        czsk_ctrs.plot(   ax=ax, color='#5a7840', edgecolor='#8abe60', lw=2.0, zorder=3)

        ax.set_xlim(XMIN, XMAX)
        ax.set_ylim(YMIN, YMAX)
        print('✅ Mapa: Natural Earth 110m (offline geopandas)')

    # ── Přidej jemnou mřížku ────────────────────────────────────────────────
    for lon in range(12, 24, 2):
        ax.axvline(lon, color='white', alpha=0.07, lw=0.5, zorder=4)
    for lat in range(48, 52):
        ax.axhline(lat, color='white', alpha=0.07, lw=0.5, zorder=4)

    # ── Popis klíčových měst ────────────────────────────────────────────────
    mesta = [
        ('Praha',      50.08, 14.43),
        ('Brno',       49.20, 16.61),
        ('Ostrava',    49.84, 18.29),
        ('Bratislava', 48.15, 17.11),
        ('Košice',     48.72, 21.26),
    ]
    for nazev, lat, lon in mesta:
        ax.plot(lon, lat, 's', markersize=4, color='#f0e0c0',
               markeredgecolor='#8a7050', markeredgewidth=0.8, zorder=5)
        ax.text(lon + 0.12, lat, nazev, fontsize=7, color='#f0e0c0',
               va='center', zorder=5,
               path_effects=[patheff.withStroke(linewidth=1.8, foreground='#1a2a0a')])

    return fig, ax


# ── Hlavní smyčka ─────────────────────────────────────────────────────────────

def main():
    budky = load_budky()
    total = len(budky)
    print(f'📍 Načteno {total} budek')

    fig, ax = build_map_axes()

    # ── HUD (aktualizován každý snímek) ─────────────────────────────────────
    rok_label = ax.text(
        0.012, 0.97, '—',
        transform=ax.transAxes, fontsize=24, fontweight='bold',
        color='white', va='top', ha='left', zorder=20,
        bbox=dict(boxstyle='round,pad=0.45', facecolor='#555555',
                  edgecolor='white', linewidth=1.5, alpha=0.92)
    )
    cnt_label = ax.text(
        0.988, 0.97, f'0 / {total}',
        transform=ax.transAxes, fontsize=14, fontweight='bold',
        color='white', va='top', ha='right', zorder=20,
        bbox=dict(boxstyle='round,pad=0.35', facecolor='#1a2a0a', alpha=0.85)
    )
    ax.text(
        0.988, 0.03, 'MojeBudky.cz',
        transform=ax.transAxes, fontsize=11, color='white',
        alpha=0.55, va='bottom', ha='right', zorder=20
    )

    # ── Legenda ─────────────────────────────────────────────────────────────
    legend_handles = [
        mpatches.Patch(color=barva, label=rok)
        for rok, barva in ROK_BARVY.items()
    ]
    ax.legend(
        handles=legend_handles,
        loc='lower left', fontsize=8, framealpha=0.82,
        facecolor='#1a2a0a', edgecolor='#8abe60',
        labelcolor='white', handlelength=1.0
    )

    # ── VideoWriter ─────────────────────────────────────────────────────────
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    vout   = cv2.VideoWriter(OUTPUT, fourcc, FPS, (W, H))

    def write(n=1):
        frame = fig_to_frame(fig)
        for _ in range(n):
            vout.write(frame)

    print('🎬 Generuji snímky...')

    # Úvodní záběr (2 s)
    write(FPS * 2)

    prev_rok = ''
    for i, (cislo, jmeno, lat, lon) in enumerate(budky):
        rok   = get_rok(cislo)
        barva = ROK_BARVY[rok]

        # Přidej bod na mapu (trvalý marker)
        ax.plot(
            lon, lat, 'o',
            markersize=9, color=barva,
            markeredgecolor='white', markeredgewidth=1.4,
            zorder=10, alpha=0.92
        )
        # Popisek u pojmenovaných budek
        if jmeno:
            ax.text(
                lon, lat + 0.08, jmeno,
                fontsize=6.5, ha='center', va='bottom', zorder=11,
                color='white',
                path_effects=[patheff.withStroke(linewidth=2.5, foreground='#1a2a0a')]
            )

        # Aktualizuj HUD
        rok_label.set_text(rok)
        rok_label.get_bbox_patch().set_facecolor(barva)
        cnt_label.set_text(f'{i + 1} / {total}')

        write()

        # Pauza 1 s na přechodu roku
        if rok != prev_rok and prev_rok:
            print(f'  📅  {prev_rok} → {rok}')
            write(FPS)
        prev_rok = rok

        if (i + 1) % 30 == 0:
            pct = (i + 1) / total * 100
            print(f'  ⏳ {i + 1}/{total}  ({pct:.0f} %)')

    # Závěrečný záběr (3 s)
    write(FPS * 3)
    vout.release()
    plt.close(fig)

    size_raw = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f'\n✅ Surové video: {OUTPUT}  ({size_raw:.1f} MB)')

    # H.264 re-encode pro universální přehrávatelnost
    h264_tmp = OUTPUT.replace('.mp4', '_h264.mp4')
    ret = os.system(
        f'ffmpeg -y -i "{OUTPUT}" '
        f'-vcodec libx264 -crf 20 -preset fast '
        f'-movflags +faststart "{h264_tmp}" 2>/dev/null'
    )
    if ret == 0 and os.path.exists(h264_tmp):
        os.replace(h264_tmp, OUTPUT)
        size_final = os.path.getsize(OUTPUT) / 1024 / 1024
        print(f'✅ H.264:       {OUTPUT}  ({size_final:.1f} MB)')

    print(f'\n   Rozlišení : {W}×{H}')
    print(f'   FPS        : {FPS}')
    print(f'   Délka      : ~{(total + FPS * 5) / FPS:.0f} sekund')


if __name__ == '__main__':
    main()
