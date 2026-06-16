#!/usr/bin/env python3
"""
pridej_zvuk.py  –  přidá syntetický zvuk k promo videu
=======================================================
- Ptačí zpěv: syntetické frekvenční přechody (chirps) + harmoniky
- Hudební podkres: jemné akordy C-dur progressí
- Kombinace přes moviepy → finalni_filmove_promo.mp4
"""

import numpy as np
from scipy.io import wavfile
import subprocess, os

SR        = 44100   # sample rate
VIDEO_IN  = '/home/user/mojebudky/kompletni_promo_mojebudky.mp4'
AUDIO_WAV = '/tmp/promo_zvuk.wav'
OUTPUT    = '/home/user/mojebudky/finalni_filmove_promo.mp4'

# Zjistíme délku videa
result = subprocess.run(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
     '-of', 'default=noprint_wrappers=1:nokey=1', VIDEO_IN],
    capture_output=True, text=True
)
VIDEO_DUR = float(result.stdout.strip())
N = int(SR * VIDEO_DUR)
print(f'🎬 Video délka: {VIDEO_DUR:.1f} s  →  {N} vzorků')

audio = np.zeros(N, dtype=np.float64)

# ── 1. Hudební podkres ────────────────────────────────────────────────────────
print('🎵 Generuji hudební podkres...')

# Akordy C-dur progressí (C, Am, F, G) + lehká gradace
AKORDY = [
    [261.63, 329.63, 392.00, 523.25],   # C
    [220.00, 261.63, 329.63, 440.00],   # Am
    [174.61, 220.00, 261.63, 349.23],   # F
    [196.00, 246.94, 293.66, 392.00],   # G
]

# Sinusový „klavír" s útlumem (piano-like attack/release)
def tone(freq, dur, amp=0.07):
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    # additivní harmoniky pro teplejší zvuk
    sig = (amp * np.sin(2*np.pi*freq*t)
         + amp*0.4 * np.sin(2*np.pi*freq*2*t)
         + amp*0.15 * np.sin(2*np.pi*freq*3*t))
    # obalová křivka: rychlý nástup, pomalý útlum
    env = np.exp(-t * 1.8)
    env[:int(SR*0.02)] *= np.linspace(0, 1, int(SR*0.02))
    return sig * env

chord_dur = 4.0
i_ch = 0
t_pos = 0.0
while t_pos < VIDEO_DUR:
    akord = AKORDY[i_ch % len(AKORDY)]
    # Gradace: objem roste jak plyne video
    vol_mul = 0.6 + 0.4 * min(t_pos / VIDEO_DUR, 1.0)
    for freq in akord:
        dur = min(chord_dur + 0.3, VIDEO_DUR - t_pos + 0.3)
        t = tone(freq, dur, amp=0.06 * vol_mul)
        s = int(t_pos * SR)
        e = min(s + len(t), N)
        audio[s:e] += t[:e-s]
    t_pos += chord_dur
    i_ch += 1

# ── 2. Ptačí zpěv ─────────────────────────────────────────────────────────────
print('🐦 Generuji ptačí zpěv...')

rng = np.random.default_rng(2026)

def chirp(f0, f1, dur, amp=0.25):
    """Frekvenční přechod – imitace ptačího hvizdu."""
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    # exponenciální přechod frekvence
    freq = f0 * (f1/f0) ** (t/dur)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    sig = amp * np.sin(phase)
    # přidat harmoniku pro „plnější" zvuk
    sig += amp * 0.3 * np.sin(2*phase)
    # obalová křivka (zvonek)
    env = np.sin(np.pi * t / dur) ** 0.6
    return sig * env

def vlnka(f0, amp=0.18, n_vlnek=4):
    """Sérii rychlých hvizdiček – ‚trrr' efekt."""
    dur_v = 0.04
    pause = 0.025
    parts = []
    for _ in range(n_vlnek):
        parts.append(chirp(f0, f0 * 1.15, dur_v, amp))
        parts.append(np.zeros(int(SR * pause)))
    return np.concatenate(parts)

# Typy ptačích zpěvů
def nahodny_zpev():
    typ = rng.choice(['chirp_up', 'chirp_down', 'whistle', 'trill', 'double'])
    if typ == 'chirp_up':
        f0 = rng.uniform(2200, 3800)
        return chirp(f0, f0 * rng.uniform(1.4, 2.2), rng.uniform(0.12, 0.28), rng.uniform(0.18, 0.38))
    elif typ == 'chirp_down':
        f0 = rng.uniform(3500, 5500)
        return chirp(f0, f0 * rng.uniform(0.5, 0.7), rng.uniform(0.15, 0.35), rng.uniform(0.20, 0.40))
    elif typ == 'whistle':
        f = rng.uniform(2800, 4200)
        return chirp(f, f * rng.uniform(0.95, 1.05), rng.uniform(0.3, 0.6), rng.uniform(0.15, 0.30))
    elif typ == 'trill':
        return vlnka(rng.uniform(2500, 4500), rng.uniform(0.15, 0.30), int(rng.uniform(3, 8)))
    else:  # double
        f0 = rng.uniform(2000, 4000)
        c1 = chirp(f0, f0 * 1.5, 0.15, 0.25)
        pause = np.zeros(int(SR * 0.08))
        c2 = chirp(f0 * 1.5, f0 * 0.8, 0.18, 0.22)
        return np.concatenate([c1, pause, c2])

# Rozložení zpěvu: řídší v úvodu (titulky), husté na mapě, ticho na závěru
# Úvod: 0–23 s  |  Mapa: 23–49 s  |  Závěr: 49–54 s
SEKCE = [
    (0,   23, 8,  0.55),   # úvod – řídký zpěv
    (23,  49, 60, 1.0),    # mapa – bohatý zpěv
    (49,  54, 2,  0.4),    # závěr – ticho
]

for t_start, t_end, pocet, amp_mul in SEKCE:
    casy = np.sort(rng.uniform(t_start, t_end, pocet))
    for cas in casy:
        zpev = nahodny_zpev()
        zpev *= amp_mul
        s = int(cas * SR)
        e = min(s + len(zpev), N)
        if s < N:
            audio[s:e] += zpev[:e-s]

# ── 3. Libreofiice příroda (smyčka) ──────────────────────────────────────────
print('🌿 Přidávám přírodní šum...')
NAT_PATHS = [
    '/usr/lib/libreoffice/share/gallery/sounds/nature1.wav',
    '/usr/lib/libreoffice/share/gallery/sounds/nature2.wav',
]
for path in NAT_PATHS:
    try:
        sr_n, nat = wavfile.read(path)
        nat = nat.astype(np.float64) / 32768.0
        # Resample z 11025 Hz na 44100 Hz (prostým opakováním)
        ratio = SR // sr_n
        nat_up = np.repeat(nat, ratio)
        # Zopakuj na délku videa
        reps = N // len(nat_up) + 2
        nat_full = np.tile(nat_up, reps)[:N]
        audio += nat_full * 0.06  # velmi ticho v pozadí
    except Exception as e:
        print(f'   ⚠️  {path}: {e}')

# ── 4. Normalizace + fade in/out ───────────────────────────────────────────────
fade_n = int(SR * 1.5)
audio[:fade_n] *= np.linspace(0, 1, fade_n)
audio[-fade_n:] *= np.linspace(1, 0, fade_n)
peak = np.max(np.abs(audio))
if peak > 0:
    audio = audio / peak * 0.88

audio_i16 = (audio * 32767).astype(np.int16)
wavfile.write(AUDIO_WAV, SR, audio_i16)
print(f'✅ Audio uloženo: {AUDIO_WAV}')

# ── 5. Spojení videa a zvuku přes ffmpeg ───────────────────────────────────────
print('🎬 Spojuji video + zvuk...')
ret = os.system(
    f'ffmpeg -y -i "{VIDEO_IN}" -i "{AUDIO_WAV}" '
    f'-c:v copy -c:a aac -b:a 192k -shortest '
    f'"{OUTPUT}" 2>/dev/null'
)
if ret == 0 and os.path.exists(OUTPUT):
    size = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f'✅ Finální video: {OUTPUT}  ({size:.1f} MB)')
    print(f'   Délka: {VIDEO_DUR:.0f} s  |  Zvuk: ptáci + hudba + příroda')
else:
    print('❌ ffmpeg selhal!')
