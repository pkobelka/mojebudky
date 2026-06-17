// AquaControll – dashboard (čte web/data.json z export_dashboard_data.py)

const ZAV = {
  provereni: { label: "Prověření", barva: "#6b7a8d", chipBg: "#eef2f7", chipFg: "#6b7a8d" },
  nizka:     { label: "Nízká",     barva: "#7e92a8", chipBg: "#eef2f7", chipFg: "#6b7a8d" },
  stredni:   { label: "Střední",   barva: "#1e8fe0", chipBg: "#eaf4fc", chipFg: "#0b3a66" },
  vysoka:    { label: "Vysoká",    barva: "#e8881b", chipBg: "#fde7d2", chipFg: "#9a5c00" },
  kriticka:  { label: "Kritická",  barva: "#e23b3b", chipBg: "#e23b3b", chipFg: "#ffffff" },
};
const HRANA = { kriticka: "#e8b6b6", vysoka: "#eccba0" };
const TYP = {
  havarie: ["Havárie", "H"], rozbor_chemicky: ["Chem. rozbor", "C"],
  rozbor_mikrobiologicky: ["Mikrobiol. rozbor", "M"], reklamace: ["Reklamace", "R"],
  stiznost: ["Stížnost", "S"], jine: ["Jiné", "?"],
};
const STAV = {
  novy: ["Nový", "#fdecec", "#b62525"], v_reseni: ["V řešení", "#fff1dd", "#9a5c00"],
  vyreseno: ["Vyřešeno", "#e5f6ec", "#1d7a42"], uzavreno: ["Uzavřeno", "#eef2f7", "#6b7a8d"],
};
const OTEVRENE = ["novy", "v_reseni"];

const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));

// ---- živé hodiny ----
function tikni() {
  const d = new Date();
  let s = d.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric", year: "numeric" });
  s = s.charAt(0).toUpperCase() + s.slice(1);
  const cas = d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("datum").textContent = `${s} · ${cas}`;
}

function datumCas(s) {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function nacti() {
  tikni(); setInterval(tikni, 10000);
  try {
    const r = await fetch("data.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    vykresli(await r.json());
  } catch (e) {
    document.getElementById("souhrn").innerHTML =
      `<div class="karta-souhrn"><div class="popis">Nepodařilo se načíst data.json (${esc(e.message)}).
       Spusť dashboard přes server: <code>python3 spustit_web.py</code></div></div>`;
  }
}

function tapeta() {
  const box = document.getElementById("tapeta");
  const W = window.innerWidth, H = Math.max(window.innerHeight, document.body.scrollHeight);
  let html = "";
  let i = 0;
  for (let y = 60; y < H; y += 120) {
    const off = ((y - 60) / 120) % 2 ? 60 : 0;
    for (let x = off; x < W; x += 120) {
      const n = (i % 7) + 1; i++;
      html += `<img src="EAG_picto_${n}.png" style="left:${x}px;top:${y}px" onerror="this.remove()">`;
    }
  }
  box.innerHTML = html;
}

function vykresli(data) {
  const S = data.souhrn;

  // souhrn (3 karty)
  const karta = (n, lbl, barva) => `
    <div class="karta-souhrn">
      <div class="ikona" style="background:${barva}29"><i style="background:${barva}"></i></div>
      <div><div class="cislo" style="color:${barva==='#7e92a8'?'#1f2a37':barva}">${n}</div>
      <div class="popis">${lbl}</div></div>
    </div>`;
  document.getElementById("souhrn").innerHTML =
    karta(S.otevrene, "Otevřených událostí", "#7e92a8") +
    karta(S.vysoke, "Vysoká závažnost", "#e8881b") +
    karta(S.kriticke, "Kritická", "#e23b3b");

  // legenda
  document.getElementById("legenda").innerHTML =
    ["provereni","nizka","stredni","vysoka","kriticka"].map(k =>
      `<span><i style="background:${ZAV[k].barva}"></i>${ZAV[k].label}</span>`).join("");

  // dlaždice středisek (data jsou už seřazená dle pořadí, bez VHOS)
  const ikDrop = '<svg viewBox="0 0 24 24" fill="#1e8fe0"><path d="M12 3 C12 3 5 11 5 16 a7 7 0 1 0 14 0 C19 11 12 3 12 3 Z"/></svg>';
  document.getElementById("strediska").innerHTML = data.strediska.map(st => {
    const mz = st.max_zavaznost;
    const hrana = mz ? (HRANA[mz] || "#c6d4e4") : "#dfe7f0";
    let odznak;
    if (mz) {
      const b = ZAV[mz].barva;
      odznak = `<div class="odznak akt ${mz}" style="background:${b};--odznak-ring:${b}2e">${st.otevrene}</div>`;
    } else {
      odznak = `<div class="odznak">0</div>`;
    }
    return `<div class="dlazdice-stredisko klik" style="--hrana:${hrana}" onclick="detailStrediska('${esc(st.nazev)}')">
      ${odznak}
      <div class="nazev-s">${esc(st.nazev)}</div>
      <div class="meta">${ikDrop}<b>${st.pocet_vodovodu}</b>&nbsp;vodovodů</div>
    </div>`;
  }).join("");

  // online (zatím ukázkově – napojí se na živou přítomnost přes backend)
  const online = ["TŘ", "BK", "LV"];
  document.getElementById("online").innerHTML =
    `<span class="lbl">Online:</span>` + online.map(m => `<span class="mono">${esc(m)}</span>`).join("");

  // aktuální (otevřené) události
  const otevrene = data.udalosti.filter(u => OTEVRENE.includes(u.stav));
  document.getElementById("pocet-udalosti").textContent = `(${otevrene.length})`;
  const cont = document.getElementById("udalosti");
  if (!otevrene.length) {
    cont.innerHTML = `<div class="prazdno">✅ Vše vyřešeno — žádné otevřené události.</div>`;
  } else {
    cont.innerHTML = otevrene.map(kartaUdalosti).join("");
    cont.querySelectorAll(".karta-udalost").forEach(k =>
      k.addEventListener("click", () => k.classList.toggle("open")));
  }

  document.getElementById("vygenerovano").textContent = "aktualizováno " + datumCas(data.vygenerovano);
  tapeta();
}

function kartaUdalosti(u) {
  const z = ZAV[u.zavaznost] || ZAV.stredni;
  const [tlabel, tletter] = TYP[u.typ] || TYP.jine;
  const [slabel, sbg, sfg] = STAV[u.stav] || STAV.novy;
  const misto = [u.stredisko, u.vodovod, u.adresa].filter(Boolean).map(esc).join(" · ");
  const ukoly = (u.ukoly || []).map(t => {
    const [tl, tb, tf] = STAV[t.stav] || STAV.novy;
    return `<div class="ukol"><b>${esc(t.nazev)}</b>
      <span class="chip" style="background:${tb};color:${tf}">${esc(tl)}</span>
      &nbsp;řeší <b>${esc(t.prirazeno || "—")}</b>${t.termin ? " · termín " + esc(t.termin) : ""}</div>`;
  }).join("") || `<div style="color:#6b7a8d;font-size:13px">Žádné úkoly.</div>`;
  const cc = (u.informovani || []).map(j => `<span class="osoba">${esc(j)}</span>`).join("") ||
    `<span style="color:#6b7a8d;font-size:13px">nikdo</span>`;
  return `<article class="karta-udalost" style="border-left-color:${z.barva}">
    <div class="udalost-hlava">
      <div class="typ-ikona" style="background:${z.barva}26;color:${z.barva}">${tletter}</div>
      <span class="udalost-titul">${esc(u.titul)}</span>
      <span class="chip" style="background:#eaf4fc;color:#0b3a66">${esc(tlabel)}</span>
      <span class="chip" style="background:${z.chipBg};color:${z.chipFg}">${esc(z.label)}</span>
      <span class="chip" style="background:${sbg};color:${sfg}">${esc(slabel)}</span>
      <span class="udalost-misto">${misto}</span>
    </div>
    <div class="udalost-detail">
      ${u.popis ? `<div class="popis-box">${esc(u.popis)}</div>` : ""}
      <div class="detail-mrizka">
        <div><span class="stitek">Nahlásil</span>${esc(u.nahlasil || "—")}${u.nahlasil_tel ? " · " + esc(u.nahlasil_tel) : ""}</div>
        <div><span class="stitek">Nahlášeno</span>${datumCas(u.nahlaseno)}</div>
        <div><span class="stitek">Založil</span>${esc(u.vytvoril || "—")}</div>
        <div><span class="stitek">Řešitel</span>${esc(u.prirazeno || "—")}</div>
      </div>
      <div class="podnadpis">Úkoly</div>${ukoly}
      <div class="podnadpis">Informováni</div><div>${cc}</div>
    </div>
  </article>`;
}

function detailStrediska(nazev) {
  // Detail střediska (historie + vodovody) – připravujeme dle PLAN.md
  alert("Detail střediska „" + nazev + "“ — historie událostí a seznam vodovodů (připravujeme).");
}

window.addEventListener("resize", () => { if (window._d) tapeta(); });
nacti().then(() => { window._d = true; });
