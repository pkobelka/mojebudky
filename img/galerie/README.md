# Fotky do záložky „📷 Ostatní"

Sem patří fotky, které nepatří ke konkrétní budce — z dílny, z výroby, z akcí.
(Fotky budek zůstávají v `img/budky/`, ty se páruje podle čísla v názvu.)

## Jak fotku přidat

1. **Nahraj sem soubor** (`.jpg`, `.jpeg` nebo `.png`):
   - **podsložka = album** — jedna dlaždice, ve které se pak listuje
     (např. `dilna/1.jpg`, `dilna/2.jpg` → jedna dlaždice „Dilna" se třemi fotkami);
   - **volný soubor = samostatná dlaždice** (např. `vyroba.jpg`).
2. **Spusť** v kořeni projektu:
   ```
   python3 generuj_galerii.py
   ```
   Přepíše to `data/galerie.json` a zároveň blok s daty přímo v `index.html`
   (mezi značkami `GALERIE-DATA`) — odtud si je bere galerie na webu.
   Soubory se načtou samy, nic se nemusí psát ručně.
3. **Commitni a nasaď** — na testovací web se to nahraje samo po pushi do `main`,
   na ostrý web je potřeba ručně spustit workflow „Deploy na WEDOS FTP (produkce)".

## Popisky dlaždic

Bez dalšího nastavení se popisek udělá z názvu souboru nebo složky:
podtržítka a pomlčky se změní na mezery a první písmeno se zvětší
(`vyroba_budek.jpg` → „Vyroba budek").

Pro hezčí popisek (s diakritikou, s mezerami) založ v této složce soubor
`nazvy.json`:

```json
{
  "dilna": "Z naší dílny",
  "vyroba_budek": "Jak budky vznikají",
  "akce-2026": "Akce 2026"
}
```

Klíč je název složky, nebo název souboru bez přípony.

## Na co si dát pozor

- **Názvy souborů bez diakritiky a mezer** — FTP a servery s nimi občas dělají
  problémy. Použij `akce-2026`, ne `Akce 2026`.
- **Zmenši fotky před nahráním** (stačí ~1600 px na delší straně), ať se
  galerie na mobilu nenačítá dlouho.
- **Pořadí** dlaždic i fotek v albu je podle názvu souboru — když chceš určit
  pořadí, pojmenuj je `1.jpg`, `2.jpg`, `3.jpg`.
