// lib/firebase.js
import { clientConfig } from '@/config';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Inizializza Firebase solo se non è già stato inizializzato
const app = initializeApp(clientConfig);

// Inizializza Auth e Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export default app;