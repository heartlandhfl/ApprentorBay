import { COLLECTIONS, TERMS_VERSION, USER_ROLE, type User } from '@apprentorbay/shared';
import { adminAuth, adminDb, getAdminFirebase } from './firebase.js';

const RETRY_MS = 1500;
const MAX_ATTEMPTS = 20;

export async function seedAdmin(attempt = 1): Promise<void> {
  const firebase = getAdminFirebase();
  if (!firebase.initialized) {
    console.warn('Admin seed skipped: Firebase Admin is not initialized');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@apprentorbay.test';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ApprentorBayAdmin-2026';
  const displayName = 'ApprentorBay Admin';

  try {
    const auth = adminAuth();
    let uid: string;

    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
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
      createdAt: prior?.createdAt ?? now,
      termsAcceptedAt: prior?.termsAcceptedAt ?? now,
      termsVersion: prior?.termsVersion ?? TERMS_VERSION,
    };

    await adminDb().collection(COLLECTIONS.users).doc(uid).set(account, { merge: true });
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
