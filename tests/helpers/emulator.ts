import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
} from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from "firebase/auth";

const TEST_PROJECT_ID = "demo-candidai";
const FIRESTORE_EMULATOR_HOST = "127.0.0.1";
const FIRESTORE_EMULATOR_PORT = 8080;
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

function getTestApp(): FirebaseApp {
  if (getApps().length === 0) {
    app = initializeApp({
      apiKey: "fake-api-key",
      authDomain: `${TEST_PROJECT_ID}.firebaseapp.com`,
      projectId: TEST_PROJECT_ID,
    });
  } else {
    app = getApp();
  }
  return app;
}

function getTestFirestore(): Firestore {
  if (!db) {
    const testApp = getTestApp();
    db = getFirestore(testApp);
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
  }
  return db;
}

function getTestAuth(): Auth {
  if (!auth) {
    const testApp = getTestApp();
    auth = getAuth(testApp);
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  }
  return auth;
}

/**
 * Clears all documents from a Firestore collection in the emulator.
 */
export async function clearFirestore(collectionPath?: string): Promise<void> {
  const firestore = getTestFirestore();
  if (collectionPath) {
    const colRef = collection(firestore, collectionPath);
    const snapshot = await getDocs(colRef);
    const deletions = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletions);
  }
}

export interface TestUserOverrides {
  email?: string;
  password?: string;
  displayName?: string;
  uid?: string;
  [key: string]: unknown;
}

/**
 * Creates a test user in the Firebase Auth emulator and optionally stores
 * extra profile data in Firestore.
 */
export async function createTestUser(
  overrides: TestUserOverrides = {}
): Promise<UserCredential> {
  const testAuth = getTestAuth();
  const email = overrides.email ?? `test-${Date.now()}@example.com`;
  const password = overrides.password ?? "Test1234!";

  const credential = await createUserWithEmailAndPassword(
    testAuth,
    email,
    password
  );

  if (Object.keys(overrides).some((k) => k !== "email" && k !== "password")) {
    const firestore = getTestFirestore();
    const userDocRef = doc(firestore, "users", credential.user.uid);
    await setDoc(userDocRef, {
      email,
      ...overrides,
      uid: credential.user.uid,
    });
  }

  return credential;
}

/**
 * Signs in a test user in the Firebase Auth emulator.
 */
export async function signInTestUser(
  email: string,
  password: string = "Test1234!"
): Promise<UserCredential> {
  const testAuth = getTestAuth();
  return signInWithEmailAndPassword(testAuth, email, password);
}

/**
 * Retrieves a Firestore document by its path from the emulator.
 */
export async function getFirestoreDoc(
  path: string
): Promise<Record<string, unknown> | null> {
  const firestore = getTestFirestore();
  const parts = path.split("/");
  if (parts.length < 2 || parts.length % 2 !== 0) {
    throw new Error(
      `Invalid Firestore path: "${path}". Must be a document path (even number of segments).`
    );
  }
  const docRef = doc(firestore, parts[0], ...parts.slice(1));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
}
