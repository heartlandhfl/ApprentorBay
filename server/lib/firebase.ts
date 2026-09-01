import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export interface AdminFirebaseState {
  configured: boolean;
  initialized: boolean;
  emulator: boolean;
  app: App | null;
  error: string | null;
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

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/-----BEGIN[\s\S]+?-----END[^-]+-----/g, '[pem]').slice(0, 240);
}

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('{') && key.endsWith('}')) ||
    (key.startsWith("'{") && key.endsWith("}'")) ||
    (key.startsWith('"{') && key.endsWith('}"'))
  ) {
    const parsed = JSON.parse(key.replace(/^['"]|['"]$/g, '')) as { private_key?: string };
    if (!parsed.private_key) {
      throw new Error('FIREBASE_PRIVATE_KEY JSON is missing private_key');
    }
    key = parsed.private_key;
  }
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('FIREBASE_PRIVATE_KEY must be the PEM private key from the Firebase service account');
  }
  return key.trim();
}

export function getAdminFirebase(): AdminFirebaseState {
  const emulator = usingEmulator();

  const existing = getApps()[0];
  if (existing) {
    return { configured: true, initialized: true, emulator, app: existing, error: null };
  }

  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    try {
      const app = initializeApp({ projectId: projectId() });
      return { configured: true, initialized: true, emulator: true, app, error: null };
    } catch (error) {
      console.error('Firebase Admin emulator failed to initialize', error);
      return { configured: true, initialized: false, emulator: true, app: null, error: publicError(error) };
    }
  }

  if (!hasAdminCredentials()) {
    return { configured: false, initialized: false, emulator: false, app: null, error: null };
  }

  try {
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY!);
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
        privateKey,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return { configured: true, initialized: true, emulator: false, app, error: null };
  } catch (error) {
    console.error('Firebase Admin failed to initialize', error);
    return { configured: true, initialized: false, emulator: false, app: null, error: publicError(error) };
  }
}

export function requireAdminApp(): App {
  const state = getAdminFirebase();
  if (!state.app) {
    throw new Error(state.error || 'Firebase Admin is not initialized');
  }
  return state.app;
}

export function adminAuth() {
  return getAuth(requireAdminApp());
}

export function adminDb() {
  return getFirestore(requireAdminApp());
}
