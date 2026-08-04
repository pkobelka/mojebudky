# Promo video „Naše aplikace" – pracovní poznámky (dolaďování hlasu)

Soubor: `promo_web_2026.mp4` (na webu v `index.html`, druhé video „🗺️ Naše aplikace…").
Větev: `claude/video-reseni-fbeois`.

## Stav (ověřeno ffmpegem 4. 8. 2026)

- **Nasazený soubor JE správná nová verze.** Živá mapa naskakuje v **~8 s** (v 3–5 s je jen
  logo MojeBudky.cz). Když přehrávač ukazuje mapu ve 4 s, je to **cache prohlížeče / stará
  verze na YouTube**, ne chyba souboru. Řešení: tvrdý refresh (Ctrl+Shift+R); v `index.html`
  je cache-busting `?v=__MB_BUILD__`.
- Video 1280×720, 25 fps, délka **65,2 s**. Audio = klidný hlas smíchaný s ptačím zpěvem (ducking).

## Ověřená časová osa (obraz vs. hlas)

| čas | obraz | hlas |
|---|---|---|
| 0–6 s | Intro: logo MojeBudky.cz + „pomáháme ptactvu vrátit domov" | mluví #1 |
| 7–13 s | Živá mapa (plní se 67 → 178 → 202 budek) | mluví #2 |
| 13–18 s | „Každá budka má svůj příběh i svého správce" (detail, 154 správců) | mluví #2 |
| 19–27 s | Fotky budek (č. 11 / 35 / 69 / 71) | #2 dozní → ticho |
| 27–35 s | Plánky typ 2025 | ticho → mluví #3 |
| 35–41 s | Plánky typ 2026 | mluví #3 |
| 41–48 s | Dílna (ručně, kus po kuse) | #3 dozní → ticho |
| 48–55 s | „Naším cílem je pokrýt celou mapu Česka i Slovenska" | mluví #4 |
| 55–61 s | „Pomozte nám růst / Dejte nám vědět" | ticho |
| 61–65 s | „Přidej se k nám / www.mojebudky.cz" | mluví #5 |

## Bloky hlasu (z hlasitostní obálky)

- #1 ~0,5–7,5 s (intro)
- #2 ~8,5–20,5 s (mapa + příběh)
- #3 ~31–41 s (plánky + dílna)
- #4 ~49–55 s (cíl)
- #5 ~62–65 s (přidej se)

## Rozhodnutí: varianta B – jeden finální rebuild

Domluveno (4. 8. 2026): video se poskládá znovu **naráz** tak, aby sedělo
obraz + hlas + **nové fotky hotových budek**. Žádný mezikrok.

Uživatel doma připraví a dodá:
1. **Text namluvení po větách** + u každé věty **cílový čas/scénu**
   (např. „má začít až u mapy ~9 s", „posunout o 2 s dřív").
2. **Fotky hotových budek** (pošle do chatu) + kam ve videu patří,
   jak dlouho každá (typ. 2–3 s) a případný popisek (č. budky, druh ptáka).

Poznámka: text se z disku obnovit nedá (předchozí session je pryč) a přepis přes AI model
v tomto prostředí nejde – **proxy blokuje stažení modelu** (huggingface.co / azure /
alphacephei = 403/000; povolené jen pypi/github/npm). Proto uživatel čte text z videa ručně.

## Postup dokončení (až bude text + časy)

1. Nástroje: `ffmpeg` je potřeba doinstalovat (`apt-get install -y ffmpeg`) – bundled
   `imageio-ffmpeg` NEMÁ `drawtext` (chybí freetype). Font: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.
2. Přesadit hlas na správné časy. Buď:
   - posun stávajících hlasových úseků (vystřihnout z mp4, přemístit, crossfade), nebo
   - vygenerovat hlas znovu z textu (TTS „klidný hlas") + namíchat pod ptačí podklad s duckingem.
3. Sestavit `promo_web_2026.mp4` (libx264, 720p, ~4–6 MB, `+faststart`), obnovit poster `promo_web_2026.jpg`.
4. Commit + push na `claude/video-reseni-fbeois`. Po nasazení tvrdý refresh kvůli cache.

## Pomůcky poslané uživateli (4. 8. 2026)

- `promo_web_2026_KONTROLA.mp4` – ověřovací kopie s vypáleným počítadlem vteřin.
- 5× mp3 úseků hlasu (potlačený ptačí zpěv) pojmenovaných podle scény – pro ruční přepis.
