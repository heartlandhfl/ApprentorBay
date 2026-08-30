import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import type { FirebaseClientStatus } from '@apprentorbay/shared';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let initError: string | null = null;

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

export function getFirebaseStatus(): FirebaseClientStatus & { error: string | null } {
  const instance = getApp();
  return {
    configured: isConfigured(),
    initialized: Boolean(instance),
    projectId: config.projectId || null,
    error: initError,
  };
}

export function getFirebaseAuth(): Auth | null {
  const instance = getApp();
  return instance ? getAuth(instance) : null;
}

export function getFirebaseDb(): Firestore | null {
  const instance = getApp();
  return instance ? getFirestore(instance) : null;
}
