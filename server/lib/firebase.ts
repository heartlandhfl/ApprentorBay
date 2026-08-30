import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export interface AdminFirebaseState {
  configured: boolean;
  initialized: boolean;
  emulator: boolean;
  app: App | null;
}

function projectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'apprentorbay-demo'
  );
}

function usingEmulator(): boolean {
  return (
    process.env.USE_FIREBASE_EMULATOR === 'true' ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
  );
}

function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function getAdminFirebase(): AdminFirebaseState {
  const emulator = usingEmulator();

  const existing = getApps()[0];
  if (existing) {
    return { configured: true, initialized: true, emulator, app: existing };
  }

  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    const app = initializeApp({ projectId: projectId() });
    return { configured: true, initialized: true, emulator: true, app };
  }

  if (!hasAdminCredentials()) {
    return { configured: false, initialized: false, emulator: false, app: null };
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  return { configured: true, initialized: true, emulator: false, app };
}

export function requireAdminApp(): App {
  const state = getAdminFirebase();
  if (!state.app) {
    throw new Error('Firebase Admin is not initialized');
  }
  return state.app;
}

export function adminAuth() {
  return getAuth(requireAdminApp());
}

export function adminDb() {
  return getFirestore(requireAdminApp());
}
