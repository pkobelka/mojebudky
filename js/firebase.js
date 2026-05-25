import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEAhZNxq3REoy1vExIrnNEXlyFXHzP4uI",
  authDomain: "moje-budky.firebaseapp.com",
  databaseURL: "https://moje-budky-default-rtdb.firebaseio.com",
  projectId: "moje-budky",
  storageBucket: "moje-budky.firebasestorage.app",
  messagingSenderId: "325649258561",
  appId: "1:325649258561:web:b5571c3278d98405320ec0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged };
