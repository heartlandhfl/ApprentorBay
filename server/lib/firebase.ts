import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';

export interface AdminFirebaseState {
  configured: boolean;
  initialized: boolean;
  app: App | null;
}

function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function getAdminFirebase(): AdminFirebaseState {
  if (!hasAdminCredentials()) {
    return { configured: false, initialized: false, app: null };
  }

  const existing = getApps()[0];
  if (existing) {
    return { configured: true, initialized: true, app: existing };
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

  return { configured: true, initialized: true, app };
}
