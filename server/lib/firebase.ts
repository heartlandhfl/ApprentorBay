import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { configuredKeySource, resolveServiceAccount } from './privateKey.js';

export interface AdminFirebaseState {
  configured: boolean;
  initialized: boolean;
  emulator: boolean;
  app: App | null;
  error: string | null;
  keySource?: string | null;
  keyBodyPrefix?: string | null;
  keyBodyLength?: number | null;
}

function envProjectId(): string {
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
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      process.env.FIREBASE_PRIVATE_KEY_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY),
  );
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/-----BEGIN[\s\S]+?-----END[^-]+-----/g, '[pem]').slice(0, 280);
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
      const app = initializeApp({ projectId: envProjectId() });
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
    const account = resolveServiceAccount();
    if (!account) {
      return { configured: false, initialized: false, emulator: false, app: null, error: null };
    }
    const projectId = account.projectId || envProjectId();
    const clientEmail = account.clientEmail || process.env.FIREBASE_CLIENT_EMAIL?.trim();
    if (!clientEmail) {
      throw new Error('Set FIREBASE_CLIENT_EMAIL or include client_email in FIREBASE_SERVICE_ACCOUNT_BASE64');
    }
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: account.privateKey,
      }),
      projectId,
    });
    return {
      configured: true,
      initialized: true,
      emulator: false,
      app,
      error: null,
      keySource: account.source,
      keyBodyPrefix: account.bodyPrefix,
      keyBodyLength: account.bodyLength,
    };
  } catch (error) {
    console.error('Firebase Admin failed to initialize', error);
    return {
      configured: true,
      initialized: false,
      emulator: false,
      app: null,
      error: publicError(error),
      keySource: configuredKeySource(),
    };
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
