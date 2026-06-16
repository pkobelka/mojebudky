// AquaControll – dashboard (čte web/data.json vygenerovaný export skriptem)

const POPISKY_TYP = {
  havarie: "Havárie",
  rozbor_chemicky: "Chem. rozbor",
  rozbor_mikrobiologicky: "Mikrobiol. rozbor",
  reklamace: "Reklamace",
  stiznost: "Stížnost",
  jine: "Jiné",
};
const POPISKY_STAV = {
  novy: "Nový", v_reseni: "V řešení", vyreseno: "Vyřešeno", uzavreno: "Uzavřeno",
};
const POPISKY_STAV_UKOL = {
  novy: "Nový", probiha: "Probíhá", hotovo: "Hotovo", zruseno: "Zrušeno",
};
const POPISKY_ZAV = {
  nizka: "Nízká", stredni: "Střední", vysoka: "Vysoká", kriticka: "Kritická",
};

const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));

function formatDatum(s) {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d)) return s;
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function nacti() {
  try {
    const r = await fetch("data.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    vykresli(await r.json());
  } catch (e) {
    document.getElementById("souhrn").innerHTML =
      `<div class="karta-souhrn"><div class="popis">Nepodařilo se načíst data.json
       (${esc(e.message)}). Spusť dashboard přes lokální server – viz README.</div></div>`;
  }
}

function vykresli(data) {
  // souhrn
  const s = data.souhrn;
  document.getElementById("souhrn").innerHTML = `
    <div class="karta-souhrn"><div class="cislo">${s.strediska}</div>
      <div class="popis">Středisek</div></div>
    <div class="karta-souhrn"><div class="cislo">${s.udalosti}</div>
      <div class="popis">Událostí celkem</div></div>
    <div class="karta-souhrn otevrene"><div class="cislo">${s.otevrene}</div>
      <div class="popis">Otevřených</div></div>
    <div class="karta-souhrn kriticke"><div class="cislo">${s.kriticke}</div>
      <div class="popis">Kritických</div></div>`;

  // střediska
  document.getElementById("strediska").innerHTML = data.strediska.map((st) => {
    let badge = `<span class="odznak">${st.otevrene}</span>`;
    let tridy = "dlazdice-stredisko";
    if (st.kriticke > 0) { badge = `<span class="odznak kriticke">${st.otevrene}</span>`;
      tridy += " ma-kriticke"; }
    else if (st.otevrene > 0) { badge = `<span class="odznak otevrene">${st.otevrene}</span>`;
      tridy += " ma-otevrene"; }
    return `<div class="${tridy}">
      ${badge}
      <div class="stredisko-nazev">${esc(st.nazev)}</div>
      ${st.je_centrala ? '<span class="stredisko-centrala">Centrála</span>' : ""}
      <div class="stredisko-meta">
        <span><b>${st.pocet_vodovodu}</b> vodovodů</span>
        <span><b>${st.pocet_lidi}</b> lidí</span>
      </div>
    </div>`;
  }).join("");

  // události
  document.getElementById("pocet-udalosti").textContent = `(${data.udalosti.length})`;
  document.getElementById("udalosti").innerHTML = data.udalosti.map(kartaUdalosti).join("")
    || '<p style="color:#6b7a8d">Žádné události.</p>';

  // rozbalování detailu
  document.querySelectorAll(".udalost-hlava").forEach((h) => {
    h.addEventListener("click", () => h.closest(".karta-udalost").classList.toggle("otevreno"));
  });

  document.getElementById("vygenerovano").textContent =
    "aktualizováno " + formatDatum(data.vygenerovano);
}

function kartaUdalosti(u) {
  const ukoly = (u.ukoly || []).map((t) => `
    <div class="ukol">
      <span class="ukol-nazev">${esc(t.nazev)}</span>
      <span class="chip stav-${esc(t.stav)}">${esc(POPISKY_STAV_UKOL[t.stav] || t.stav)}</span>
      <span class="ukol-osoby">řeší <b>${esc(t.prirazeno || "—")}</b>${
        t.termin ? " · termín " + esc(t.termin) : ""}</span>
    </div>`).join("") || '<p style="color:#6b7a8d;font-size:14px">Žádné úkoly.</p>';

  const cc = (u.informovani || []).map((j) => `<span class="osoba">${esc(j)}</span>`).join("")
    || '<span style="color:#6b7a8d;font-size:13px">nikdo</span>';

  const misto = [u.vodovod, u.adresa].filter(Boolean).map(esc).join(" · ");

  return `<article class="karta-udalost zav-${esc(u.zavaznost)}">
    <div class="udalost-hlava">
      <span class="udalost-titul">${esc(u.titul)}</span>
      <span class="chip typ">${esc(POPISKY_TYP[u.typ] || u.typ)}</span>
      <span class="chip zav-${esc(u.zavaznost)}">${esc(POPISKY_ZAV[u.zavaznost] || u.zavaznost)}</span>
      <span class="chip stav-${esc(u.stav)}">${esc(POPISKY_STAV[u.stav] || u.stav)}</span>
      <span class="udalost-misto">${esc(u.stredisko || "")}${misto ? " · " + misto : ""}</span>
    </div>
    <div class="udalost-detail">
      ${u.popis ? `<div class="popis-box">${esc(u.popis)}</div>` : ""}
      <div class="detail-mrizka">
        <div class="detail-radek"><span class="stitek">Vodovod (VF kód)</span>
          ${esc(u.vodovod || "—")}${u.vf ? " (" + esc(u.vf) + ")" : ""}</div>
        <div class="detail-radek"><span class="stitek">Adresa</span>${esc(u.adresa || "—")}</div>
        <div class="detail-radek"><span class="stitek">Nahlásil</span>
          ${esc(u.nahlasil || "—")}${u.nahlasil_tel ? " · " + esc(u.nahlasil_tel) : ""}</div>
        <div class="detail-radek"><span class="stitek">Nahlášeno</span>${formatDatum(u.nahlaseno)}</div>
        <div class="detail-radek"><span class="stitek">Založil</span>${esc(u.vytvoril || "—")}</div>
        <div class="detail-radek"><span class="stitek">Řešitel</span>${esc(u.prirazeno || "—")}</div>
      </div>
      <div class="podnadpis">Úkoly</div>
      ${ukoly}
      <div class="podnadpis">Informováni</div>
      <div class="osoby-cc">${cc}</div>
    </div>
  </article>`;
}

nacti();
