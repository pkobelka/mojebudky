// AquaCtrl – Cloud Functions
// Sdílí Firebase projekt moje-budky (stejná RTDB jako budky), region us-central1.
//
// 1) aquaNotify   – push při vzniku události (trigger: nový /aquactrl_outbox/{id})
// 2) aquaUkolyCheck – plánovač (každých 15 min): hlídá termíny úkolů
//      a) po termínu a nesplněno  -> push "upozornit" osobám + řešiteli
//      b) připomenutí před termínem (1 h) -> push řešiteli
//      c) nepotvrzeno do 2 h       -> push zadavateli události

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const APP_URL = "https://pkobelka.github.io/aquactrl/";
const UKOLY_URL = APP_URL + "#moje-ukoly";

// ---- sdílené odeslání push konkrétním osobám (podle pole `person` u tokenu) ----
async function sendToPersons(persons, title, body, link) {
  const set = new Set((persons || []).filter(Boolean));
  if (!set.size) return 0;
  const tokensSnap = await admin.database().ref("aquactrl_push_tokens").get();
  const tokens = [];
  tokensSnap.forEach((c) => {
    const v = c.val() || {};
    if (v.schvaleno === false) return; // nové, neschválené zařízení nedostává push
    if (v.token && v.person && set.has(v.person)) tokens.push({ key: c.key, token: v.token });
  });
  if (!tokens.length) return 0;

  const pushId = String(Date.now());
  const url = link || APP_URL;
  const messages = tokens.map((t) => ({
    token: t.token,
    webpush: { headers: { Urgency: "high" }, fcmOptions: { link: url } },
    data: { push_id: pushId, title: String(title || "AquaCtrl"), body: String(body || ""), url },
  }));
  const resp = await admin.messaging().sendEach(messages);

  // pročisti neplatné tokeny
  const dels = [];
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
        dels.push(admin.database().ref("aquactrl_push_tokens/" + tokens[i].key).remove());
      }
    }
  });
  await Promise.all(dels);
  return resp.successCount;
}

function fmtCz(ms) {
  try {
    return new Date(ms).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return ""; }
}

// ===== 1) Push při vzniku události =====
exports.aquaNotify = functions.database
  .ref("/aquactrl_outbox/{id}")
  .onCreate(async (snap) => {
    const data = snap.val() || {};
    const title = String(data.title || "AquaCtrl");
    const body = String(data.body || "");
    const targets = Array.isArray(data.targets) ? data.targets : [];

    // prázdné targets = broadcast všem; jinak jen osobám z targets
    const tokensSnap = await admin.database().ref("aquactrl_push_tokens").get();
    const tokens = [];
    tokensSnap.forEach((c) => {
      const v = c.val() || {};
      if (!v.token) return;
      if (v.schvaleno === false) return; // nové, neschválené zařízení nedostává push
      if (!targets.length || (v.person && targets.includes(v.person))) {
        tokens.push({ key: c.key, token: v.token });
      }
    });

    if (!tokens.length) {
      await snap.ref.update({ status: "no-recipients", sent: 0, done_ts: Date.now() });
      return null;
    }

    const pushId = String(Date.now());
    const messages = tokens.map((t) => ({
      token: t.token,
      webpush: { headers: { Urgency: "high" }, fcmOptions: { link: APP_URL } },
      data: { push_id: pushId, title, body, url: APP_URL },
    }));
    const resp = await admin.messaging().sendEach(messages);

    const dels = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
          dels.push(admin.database().ref("aquactrl_push_tokens/" + tokens[i].key).remove());
        }
      }
    });
    await Promise.all(dels);

    await snap.ref.update({
      status: "sent", sent: resp.successCount, fail: resp.failureCount, done_ts: Date.now(),
    });
    return null;
  });

// ===== 1b) Florián – push při vzniku úkolu (trigger: nový /florian_outbox/{id}) =====
// Sesterská appka Florián (mapa požárních hydrantů) sdílí stejný Firebase projekt.
// Vlastní tokeny (florian_push_tokens) i vlastní frontu (florian_outbox), aby se
// nemíchala s AquaCtrlem. Logika je shodná s aquaNotify.
const FLORIAN_URL = "https://pkobelka.github.io/florian/";
exports.florianNotify = functions.database
  .ref("/florian_outbox/{id}")
  .onCreate(async (snap) => {
    const data = snap.val() || {};
    const title = String(data.title || "Florián");
    const body = String(data.body || "");
    const targets = Array.isArray(data.targets) ? data.targets : [];

    // prázdné targets = broadcast všem; jinak jen osobám z targets (podle pole `person` u tokenu)
    const tokensSnap = await admin.database().ref("florian_push_tokens").get();
    const tokens = [];
    tokensSnap.forEach((c) => {
      const v = c.val() || {};
      if (!v.token) return;
      if (v.schvaleno === false) return;
      if (!targets.length || (v.person && targets.includes(v.person))) {
        tokens.push({ key: c.key, token: v.token });
      }
    });

    if (!tokens.length) {
      await snap.ref.update({ status: "no-recipients", sent: 0, done_ts: Date.now() });
      return null;
    }

    const pushId = String(Date.now());
    const messages = tokens.map((t) => ({
      token: t.token,
      webpush: { headers: { Urgency: "high" }, fcmOptions: { link: FLORIAN_URL } },
      data: { push_id: pushId, title, body, url: FLORIAN_URL },
    }));
    const resp = await admin.messaging().sendEach(messages);

    const dels = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
          dels.push(admin.database().ref("florian_push_tokens/" + tokens[i].key).remove());
        }
      }
    });
    await Promise.all(dels);

    await snap.ref.update({
      status: "sent", sent: resp.successCount, fail: resp.failureCount, done_ts: Date.now(),
    });
    return null;
  });

// ===== 2) Hlídání termínů úkolů (plánovač) =====
const PRE_LEAD_MS = 60 * 60 * 1000;        // a) připomenutí 1 h před termínem
const CONFIRM_GRACE_MS = 15 * 60 * 1000; // c) 15 min na potvrzení

exports.aquaUkolyCheck = functions.pubsub
  .schedule("every 15 minutes")
  .timeZone("Europe/Prague")
  .onRun(async () => {
    const snap = await admin.database().ref("aquactrl_ukoly").get();
    if (!snap.exists()) return null;

    const now = Date.now();
    const updates = {};
    const sends = []; // {persons, title, body}

    snap.forEach((c) => {
      const t = c.val() || {};
      const id = c.key;
      if (t.stav === "splneny") return;
      const kdo = t.resitel;
      const ctx = t.kontext ? " – " + t.kontext : "";
      const popis = t.popis || "Úkol";

      // a) po termínu a nesplněno
      if (t.termin && now > t.termin && !t.alerted_overdue) {
        const persons = [...new Set([...(t.upozornit || []), kdo].filter(Boolean))];
        sends.push({ persons, title: "⏰ Úkol po termínu", body: popis + ctx + " · termín byl " + fmtCz(t.termin) });
        updates[id + "/alerted_overdue"] = true;
      }

      // b) připomenutí před termínem (řešiteli)
      if (t.termin && now <= t.termin && now >= t.termin - PRE_LEAD_MS && !t.reminded_pre) {
        sends.push({ persons: [kdo].filter(Boolean), title: "🔔 Připomenutí úkolu", body: popis + ctx + " · termín " + fmtCz(t.termin) });
        updates[id + "/reminded_pre"] = true;
      }

      // c) nepotvrzeno do 2 h -> zadavateli
      if (t.stav === "novy" && t.vznik_ts && now > t.vznik_ts + CONFIRM_GRACE_MS && !t.alerted_unconfirmed) {
        const jm = t.resitel_jmeno || kdo || "Řešitel";
        sends.push({ persons: [t.zadal].filter(Boolean), title: "⚠️ Úkol nepotvrzen", body: jm + " zatím nepotvrdil/a úkol: " + popis + ctx });
        updates[id + "/alerted_unconfirmed"] = true;
      }
    });

    let sentTotal = 0;
    for (const s of sends) {
      sentTotal += await sendToPersons(s.persons, s.title, s.body, UKOLY_URL);
    }
    if (Object.keys(updates).length) {
      await admin.database().ref("aquactrl_ukoly").update(updates);
    }
    console.log(`aquaUkolyCheck: ${sends.length} upozornění, odesláno ${sentTotal} push.`);
    return null;
  });

// ===== 3) Automatické přidělení identity (person claim) při prvním přihlášení =====
// Když v Firebase Auth vznikne účet, podle e-mailu v aquactrl_login_email nastaví
// custom claim `person` (a `admin` pro TŘ). Díky tomu má každý uživatel ověřenou
// identitu hned od prvního přihlášení, bez ručního spouštění sync_person_claims.py.
const ADMIN_CODES = ["TŘ"];
exports.aquaSetPersonClaim = functions.auth.user().onCreate(async (user) => {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;
  const key = email.replace(/\./g, ",");
  const snap = await admin.database().ref("aquactrl_login_email/" + key).get();
  if (!snap.exists()) return null; // není to uživatel AquaCtrlu
  const code = String(snap.val());
  const claims = { person: code };
  if (ADMIN_CODES.includes(code)) claims.admin = true;
  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(`aquaSetPersonClaim: ${email} -> person=${code}`);
  return null;
});

// ===== 4) Florián – denní kontrola revizí hydrantů =====
// Denní přehled blížících se / prošlých revizí požárních hydrantů. Data:
//   florian_revize/{id} = { d:datum revize (DD.MM.RRRR), s:středisko, o:obec, u:adresa, typ }
//   živá editace florian_domereni/{id}.datumRevize má přednost před florian_revize/{id}.d
//   práh „blíží se konec" = florian_config/rev_warn (fallback 30), platnost revize 365 dní
// Příjemci (dle role v florian_lide) a rozsah přehledu:
//   Admin, PŘ           -> celý přehled (všechny hydranty)
//   Vedoucí střediska   -> jen hydranty ze svého střediska (vč. pracovišť pod ním)
//   Vedoucí pracoviště  -> jen hydranty ze svého pracoviště
//   ostatní (Technik…)  -> denní přehled nedostávají
// Rozesílka jde přes frontu florian_outbox -> florianNotify (stejné tokeny/mechanika).
const FL_REV_VALID_DAYS = 365;
const FL_REV_DEFAULT_WARN = 30;
function flStrediskoOf(prac) {
  return String(prac || "").split(", pracoviště ")[0];
}
function flParseCzDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d.getTime();
}
exports.florianRevizeCheck = functions.pubsub
  .schedule("every day 07:00")
  .timeZone("Europe/Prague")
  .onRun(async () => {
    const [revSnap, domSnap, warnSnap, lideSnap] = await Promise.all([
      admin.database().ref("florian_revize").get(),
      admin.database().ref("florian_domereni").get(),
      admin.database().ref("florian_config/rev_warn").get(),
      admin.database().ref("florian_lide").get(),
    ]);
    if (!revSnap.exists()) {
      console.log("florianRevizeCheck: žádná revizní data (florian_revize prázdné)");
      return null;
    }
    const dom = domSnap.val() || {};
    let warn = parseInt(warnSnap.val(), 10);
    if (!(warn > 0)) warn = FL_REV_DEFAULT_WARN;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // dotčené hydranty (po termínu nebo do prahu)
    const items = []; // { dni, stred, adresa }
    revSnap.forEach((c) => {
      const r = c.val() || {};
      const id = c.key;
      const raw = (dom[id] && dom[id].datumRevize) || r.d; // živá editace má přednost
      const t = flParseCzDate(raw);
      if (t == null) return; // bez platného data neřešíme
      const dni = Math.round((t + FL_REV_VALID_DAYS * DAY - now) / DAY);
      if (dni > warn) return; // revize je v pořádku
      items.push({ dni, stred: r.s || "", adresa: [r.o, r.u].filter(Boolean).join(" ") });
    });
    if (!items.length) {
      console.log(`florianRevizeCheck: nic k hlášení (práh ${warn} d)`);
      return null;
    }

    const lide = lideSnap.val() || {};
    let sent = 0;
    for (const pid of Object.keys(lide)) {
      const p = lide[pid] || {};
      const role = p.role;
      let inScope;
      if (role === "Admin" || role === "PŘ") {
        inScope = () => true;
      } else if (role === "Vedoucí střediska") {
        inScope = (it) => flStrediskoOf(it.stred) === flStrediskoOf(p.pracoviste);
      } else if (role === "Vedoucí pracoviště") {
        inScope = (it) => it.stred === p.pracoviste;
      } else {
        continue; // Technik apod. – denní přehled nedostává
      }
      const mine = items.filter(inScope);
      if (!mine.length) continue;

      const overdue = mine.filter((x) => x.dni < 0).sort((a, b) => a.dni - b.dni);
      const soon = mine.filter((x) => x.dni >= 0).sort((a, b) => a.dni - b.dni);
      const parts = [];
      if (overdue.length) parts.push(overdue.length + " po termínu");
      if (soon.length) parts.push(soon.length + " do " + warn + " dní");
      const sample = overdue.concat(soon).slice(0, 5).map((x) =>
        (x.dni < 0 ? ("po termínu o " + (-x.dni) + " d") : ("zbývá " + x.dni + " d")) +
        (x.adresa ? (" · " + x.adresa) : ""));
      const body = parts.join(" · ") + (sample.length ? ("\n" + sample.join("\n")) : "");

      await admin.database().ref("florian_outbox").push({
        title: "🚦 Revize hydrantů – denní přehled",
        body,
        targets: [pid],
        ts: Date.now(),
      });
      sent++;
    }
    console.log(`florianRevizeCheck: ${items.length} dotčených, odesláno ${sent} přehledů (práh ${warn} d).`);
    return null;
  });
