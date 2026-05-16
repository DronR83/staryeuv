import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

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

export const SESSION_ID = "staryeuv-crew";

export async function fsGet(collection, id = SESSION_ID) {
  try {
    const snap = await getDoc(doc(db, collection, id));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("fsGet error:", e);
    return null;
  }
}

export async function fsSet(collection, data, id = SESSION_ID) {
  try {
    await setDoc(doc(db, collection, id), data, { merge: true });
  } catch (e) {
    console.warn("fsSet error:", e);
  }
}

export function fsListen(collection, callback, id = SESSION_ID) {
  return onSnapshot(doc(db, collection, id), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}