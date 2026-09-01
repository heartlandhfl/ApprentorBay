import { ACCOUNT_STATUS, COLLECTIONS, USER_ROLE, buildTermsAcceptance, type User } from '@apprentorbay/shared';
import { adminAuth, adminDb, getAdminFirebase } from './firebase.js';

const RETRY_MS = 1500;
const MAX_ATTEMPTS = 20;

const DEFAULT_SEED_EMAIL = 'admin@apprentorbay.test';
const DEFAULT_SEED_PASSWORD = 'ApprentorBayAdmin-2026';

export async function ensureAdminAccount(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<string> {
  const email = input.email.trim();
  const password = input.password;
  const displayName = input.displayName?.trim() || 'ApprentorBay Admin';

  const auth = adminAuth();
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, displayName });
  } catch {
    const created = await auth.createUser({ email, password, displayName });
    uid = created.uid;
  }

  const existing = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  const prior = existing.data() as User | undefined;
  const now = new Date().toISOString();
  const account: User = {
    uid,
    role: USER_ROLE.admin,
    email,
    displayName,
    active: true,
    accountStatus: prior?.accountStatus ?? ACCOUNT_STATUS.active,
    createdAt: prior?.createdAt ?? now,
    ...buildTermsAcceptance(prior?.termsAcceptedAt ?? now),
    profileSlug: prior?.profileSlug ?? null,
  };

  await adminDb().collection(COLLECTIONS.users).doc(uid).set(account, { merge: true });
  return uid;
}

export async function seedAdmin(attempt = 1): Promise<void> {
  const firebase = getAdminFirebase();
  if (!firebase.initialized) {
    console.warn('Admin seed skipped: Firebase Admin is not initialized');
    return;
  }

  if (!firebase.emulator) {
    console.log('Admin seed skipped: production does not auto-create an admin. Run `npm run create-admin`.');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? DEFAULT_SEED_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD;

  try {
    await ensureAdminAccount({ email, password });
    console.log(`Admin account ready: ${email}`);
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`Admin seed waiting on emulators (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      return seedAdmin(attempt + 1);
    }
    console.error('Admin seed failed', error);
  }
}
