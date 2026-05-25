import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase.js";

const modal = document.getElementById("authModal");
const btnOtevrit = document.getElementById("btnOtevritModal");
const btnZavrit = document.getElementById("btnZavritModal");
const form = document.getElementById("authForm");
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const errorEl = document.getElementById("authError");
const submitBtn = document.getElementById("authSubmitBtn");
const authNavArea = document.getElementById("authNavArea");
const tabs = document.querySelectorAll(".auth-tab");

let activeTab = "login";

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
    "auth/invalid-email": "Neplatný formát e-mailu.",
    "auth/user-not-found": "Uživatel nenalezen.",
    "auth/wrong-password": "Špatné heslo.",
    "auth/email-already-in-use": "Tento e-mail je již zaregistrován.",
    "auth/weak-password": "Heslo musí mít alespoň 6 znaků.",
    "auth/invalid-credential": "Nesprávný e-mail nebo heslo.",
    "auth/too-many-requests": "Příliš mnoho pokusů. Zkuste to za chvíli.",
  };
  return map[code] || "Nastala chyba. Zkuste to znovu.";
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    submitBtn.textContent = activeTab === "login" ? "Přihlásit se" : "Registrovat se";
    skrytChybu();
    form.reset();
  });
});

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
    zobrazitChybu("Vyplňte e-mail i heslo.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Načítám…";

  try {
    if (activeTab === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
    zavritModal();
  } catch (err) {
    zobrazitChybu(prekladChyby(err.code));
    submitBtn.disabled = false;
    submitBtn.textContent = activeTab === "login" ? "Přihlásit se" : "Registrovat se";
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
