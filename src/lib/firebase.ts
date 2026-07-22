/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';

// Permanent database ID for this application
export const FIREBASE_DATABASE_ID = "ai-studio-investyarealesta-ac1ea9f8-3719-4f80-acc1-938a72544e51";

export const firebaseConfig = {
  apiKey: "AIzaSyC7ZQUo7hq9ZY7K-vk2j8o6M_5wcslHL38",
  authDomain: "gen-lang-client-0327121259.firebaseapp.com",
  projectId: "gen-lang-client-0327121259",
  storageBucket: "gen-lang-client-0327121259.firebasestorage.app",
  messagingSenderId: "1005239416050",
  appId: "1:1005239416050:web:5e46ce99441b9248facc6b"
};

// Auto-initializing singleton instances
let app: any;
let db: any;
let auth: any;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      experimentalForceLongPolling: true
    }, FIREBASE_DATABASE_ID);
    console.log(`[Firebase] Firestore auto-linked successfully to database ID: ${FIREBASE_DATABASE_ID}`);
  } catch (err) {
    console.warn("[Firebase] initializeFirestore failed, falling back to getFirestore:", err);
    db = getFirestore(app, FIREBASE_DATABASE_ID);
  }
  auth = getAuth(app);
} catch (error) {
  console.error("[Firebase] Initialization error:", error);
}

export { app, db, auth };
