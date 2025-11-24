import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBGZYsm7S0Ih2eSS5RdXha3H8bDdUHfrss",
    authDomain: "srsfsrs-ddf65.firebaseapp.com",
    projectId: "srsfsrs-ddf65",
    storageBucket: "srsfsrs-ddf65.firebasestorage.app",
    messagingSenderId: "198094611180",
    appId: "1:198094611180:web:b42791d4fe33910c2c3bc9",
    measurementId: "G-38MFMDV2G8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const analytics = getAnalytics(app);
