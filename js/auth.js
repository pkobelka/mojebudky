import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase.js";

const modal = document.getElementById("authModal");
const btnOtevrit = document.getElementById("btnOtevritModal");
const btnZavrit = document.getElementById("btnZavritModal");
const form = document.getElementById("authForm");
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const errorEl = document.getElementById("authError");
const submitBtn = document.getElementById("authSubmitBtn");
const authNavArea = document.getElementById("authNavArea");

function otevritModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  emailInput.focus();
}

function zavritModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  form.reset();
  skrytChybu();
}

function zobrazitChybu(text) {
  errorEl.textContent = text;
  errorEl.hidden = false;
}

function skrytChybu() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function prekladChyby(code) {
  const map = {
    "auth/invalid-email": "Neplatné ID správce.",
    "auth/user-not-found": "Správce nenalezen.",
    "auth/wrong-password": "Špatné heslo.",
    "auth/invalid-credential": "Nesprávné ID nebo heslo.",
    "auth/too-many-requests": "Příliš mnoho pokusů. Zkuste to za chvíli.",
    "auth/user-disabled": "Tento účet byl deaktivován.",
  };
  return map[code] || "Nastala chyba. Zkuste to znovu.";
}

btnOtevrit.addEventListener("click", e => {
  e.preventDefault();
  otevritModal();
});

btnZavrit.addEventListener("click", zavritModal);

modal.addEventListener("click", e => {
  if (e.target === modal) zavritModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modal.hidden) zavritModal();
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  skrytChybu();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    zobrazitChybu("Vyplňte ID správce i heslo.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Přihlašuji…";

  const emailFirebase = email.includes("@") ? email : `${email}@mojebudky.cz`;

  try {
    await signInWithEmailAndPassword(auth, emailFirebase, password);
    zavritModal();
  } catch (err) {
    zobrazitChybu(prekladChyby(err.code));
    submitBtn.disabled = false;
    submitBtn.textContent = "Přihlásit se";
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    authNavArea.innerHTML = `
      <span class="nav-user-email">${user.email}</span>
      <button class="btn-logout" id="btnOdhlasit">Odhlásit</button>
    `;
    document.getElementById("btnOdhlasit").addEventListener("click", () => signOut(auth));
  } else {
    authNavArea.innerHTML = `<a href="#" class="btn-login" id="btnOtevritModal">Vstup pro správce</a>`;
    document.getElementById("btnOtevritModal").addEventListener("click", e => {
      e.preventDefault();
      otevritModal();
    });
  }
});
