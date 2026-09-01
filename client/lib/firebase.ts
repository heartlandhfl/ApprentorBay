import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import type { FirebaseClientStatus } from '@apprentorbay/shared';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

function isConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let initError: string | null = null;
let emulatorsBound = false;

function getApp(): FirebaseApp | null {
  if (app) return app;
  if (!isConfigured()) return null;

  try {
    app = getApps()[0] ?? initializeApp(config);
    return app;
  } catch (error) {
    initError = error instanceof Error ? error.message : 'Firebase failed to initialize';
    return null;
  }
}

function bindEmulators(auth: Auth, db: Firestore, storage: FirebaseStorage) {
  if (emulatorsBound || !useEmulator) return;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  emulatorsBound = true;
}

function services(): { auth: Auth; db: Firestore; storage: FirebaseStorage } | null {
  const instance = getApp();
  if (!instance) return null;
  const auth = getAuth(instance);
  const db = getFirestore(instance);
  const storage = getStorage(instance);
  bindEmulators(auth, db, storage);
  return { auth, db, storage };
}

export function getFirebaseStatus(): FirebaseClientStatus & { error: string | null } {
  const instance = getApp();
  return {
    configured: isConfigured(),
    initialized: Boolean(instance),
    projectId: config.projectId || null,
    emulator: useEmulator,
    error: initError,
  };
}

export function getFirebaseAuth(): Auth | null {
  return services()?.auth ?? null;
}

export function getFirebaseDb(): Firestore | null {
  return services()?.db ?? null;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  return services()?.storage ?? null;
}
