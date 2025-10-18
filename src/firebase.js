import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDRrqOUwwJRWH_3Wd-1YJG60RbBiCrXPO8",
  authDomain: "sementeogum.firebaseapp.com",
  projectId: "sementeogum",
  storageBucket: "sementeogum.firebasestorage.app",
  messagingSenderId: "297958963395",
  appId: "1:297958963395:web:3580b2903fd0d2bf6cca76"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export { serverTimestamp };


export async function signInWithGoogle() {
return signInWithPopup(auth, provider);
}