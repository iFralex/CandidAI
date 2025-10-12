// lib/firebase.js
import { clientConfig } from '@/config';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Inizializza Firebase solo se non è già stato inizializzato
const app = initializeApp(clientConfig);

// Inizializza Auth e Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;