import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAJszhc6p2r6jgaWM9esK-fEEGP8s1YkFU",
  authDomain: "staryeuv.firebaseapp.com",
  projectId: "staryeuv",
  storageBucket: "staryeuv.firebasestorage.app",
  messagingSenderId: "78975653553",
  appId: "1:78975653553:web:3717ef470231710fd37490"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const SESSION_ID = "staryeuv-crew";

// Connexion anonyme automatique — nécessaire pour que les règles Firestore
// (allow read, write: if request.auth != null) acceptent les requêtes.
let authReadyResolve;
export const authReady = new Promise((resolve) => { authReadyResolve = resolve; });

onAuthStateChanged(auth, (user) => {
  if (user) {
    authReadyResolve(user);
  } else {
    signInAnonymously(auth).catch((e) => console.error("Auth anonyme échouée:", e));
  }
});

async function waitForAuth() {
  await authReady;
}

export async function fsGet(collection, id = SESSION_ID) {
  try {
    await waitForAuth();
    const snap = await getDoc(doc(db, collection, id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("fsGet error:", e);
    return null;
  }
}

export async function fsSet(collection, data, id = SESSION_ID) {
  try {
    await waitForAuth();
    await setDoc(doc(db, collection, id), data, { merge: true });
  } catch (e) {
    console.warn("fsSet error:", e);
  }
}

export function fsListen(collection, callback, id = SESSION_ID) {
  let unsub = () => {};
  waitForAuth().then(() => {
    unsub = onSnapshot(doc(db, collection, id), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  });
  return () => unsub();
}
