import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAiRQqN7CeiMGTa1zF8nAFubIBxE0wVwx4",
    authDomain: "ebook-reader-social.firebaseapp.com",
    projectId: "ebook-reader-social",
    storageBucket: "ebook-reader-social.firebasestorage.app",
    messagingSenderId: "16987937374",
    appId: "1:16987937374:web:4a55801647467ccdfd32cf",
    measurementId: "G-NDSEST44L5"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
