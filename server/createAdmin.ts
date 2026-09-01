import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getAdminFirebase } from './lib/firebase.js';
import { ensureAdminAccount } from './lib/seedAdmin.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const DEFAULT_PASSWORD = 'ApprentorBayAdmin-2026';

async function main() {
  const firebase = getAdminFirebase();
  if (!firebase.initialized) {
    throw new Error(
      'Firebase Admin is not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }

  if (firebase.emulator) {
    throw new Error(
      'This command is for the live Firebase project. Unset USE_FIREBASE_EMULATOR and the emulator host vars.',
    );
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env (use a unique production password).');
  }
  if (password === DEFAULT_PASSWORD) {
    throw new Error('Refusing the documented emulator password. Choose a unique production admin password.');
  }

  const uid = await ensureAdminAccount({ email, password });
  console.log(`Production admin ready: ${email} (${uid})`);
  console.log('Sign in at /login, then open /admin.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
