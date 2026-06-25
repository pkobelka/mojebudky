// AquaControl – Cloud Function: odeslání push při vzniku události
// Trigger: nový záznam v /aqua_outbox/{id} (appka ho zapíše při uložení události).
// Najde push tokeny osob v `targets` a pošle jim FCM notifikaci.
// Sdílí Firebase projekt moje-budky (stejná RTDB jako budky), region us-central1.

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const APP_URL = "https://pkobelka.github.io/aquacontrol/";

exports.aquaNotify = functions.database
  .ref("/aqua_outbox/{id}")
  .onCreate(async (snap) => {
    const data = snap.val() || {};
    const title = String(data.title || "AquaControl");
    const body = String(data.body || "");
    const targets = Array.isArray(data.targets) ? data.targets : [];

    // načti všechny tokeny a vyber adresáty
    const tokensSnap = await admin.database().ref("aqua_push_tokens").get();
    const tokens = [];
    tokensSnap.forEach((c) => {
      const v = c.val() || {};
      if (!v.token) return;
      // prázdné targets = broadcast všem; jinak jen osobám z targets
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
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: APP_URL },
      },
      // data-only: zobrazení řeší service worker v appce (jednotně s ručním pushem)
      data: { push_id: pushId, title, body, url: APP_URL },
    }));

    const resp = await admin.messaging().sendEach(messages);

    // pročisti neplatné tokeny
    const dels = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-argument"
        ) {
          dels.push(admin.database().ref("aqua_push_tokens/" + tokens[i].key).remove());
        }
      }
    });
    await Promise.all(dels);

    await snap.ref.update({
      status: "sent",
      sent: resp.successCount,
      fail: resp.failureCount,
      done_ts: Date.now(),
    });
    return null;
  });
