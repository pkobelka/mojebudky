// Spusť: node vytvor-spravce.js
// Potřebuješ: npm install firebase-admin
// a soubor serviceAccount.json ve stejné složce

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const spravci = [
  { id: "001400", heslo: "INYOW7", jmeno: "Aja" },
  { id: "002852", heslo: "lHZ4e7", jmeno: "Květa" },
  { id: "003",    heslo: "dtLj7E", jmeno: "Pavel" },
  { id: "004112", heslo: "Hq8Koa", jmeno: "" },
  { id: "005484", heslo: "pWftq3", jmeno: "Vali + Viki" },
  { id: "006187", heslo: "8WEP6j", jmeno: "Honza" },
  { id: "007109", heslo: "KFYtjX", jmeno: "Jirka" },
  { id: "008666", heslo: "2th0zq", jmeno: "Karel" },
  { id: "009112", heslo: "sfnPAz", jmeno: "Plíšek" },
  { id: "010488", heslo: "FMjR0c", jmeno: "Jirka" },
  { id: "011506", heslo: "kBall7", jmeno: "Štěpánek" },
];

async function vytvorUcty() {
  for (const s of spravci) {
    const email = `${s.id}@mojebudky.cz`;
    try {
      await admin.auth().createUser({
        email,
        password: s.heslo,
        displayName: s.jmeno,
      });
      console.log(`✓ ${s.id} (${s.jmeno})`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        console.log(`- ${s.id} již existuje`);
      } else {
        console.error(`✗ ${s.id}: ${err.message}`);
      }
    }
  }
  console.log("Hotovo!");
  process.exit(0);
}

vytvorUcty();
