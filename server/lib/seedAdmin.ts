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

  await writeAdminUserDoc({ uid, email, displayName });
  return uid;
}

export async function writeAdminUserDoc(input: {
  uid: string;
  email: string;
  displayName?: string;
}): Promise<User> {
  const existing = await adminDb().collection(COLLECTIONS.users).doc(input.uid).get();
  const prior = existing.data() as User | undefined;
  const now = new Date().toISOString();
  const account: User = {
    uid: input.uid,
    role: USER_ROLE.admin,
    email: input.email.trim(),
    displayName: input.displayName?.trim() || prior?.displayName || 'ApprentorBay Admin',
    active: true,
    accountStatus: prior?.accountStatus ?? ACCOUNT_STATUS.active,
    createdAt: prior?.createdAt ?? now,
    ...buildTermsAcceptance(prior?.termsAcceptedAt ?? now),
    profileSlug: prior?.profileSlug ?? null,
  };
  await adminDb().collection(COLLECTIONS.users).doc(input.uid).set(account, { merge: true });
  return account;
}

export async function loadOperatorAdmin(
  uid: string,
  email?: string,
): Promise<{ uid: string; email: string } | null> {
  const byId = await adminDb().collection(COLLECTIONS.operatorAdmins).doc(uid).get();
  if (byId.exists) {
    const data = byId.data() as { email?: string; uid?: string } | undefined;
    return {
      uid,
      email: (data?.email || email || '').trim(),
    };
  }
  if (email) {
    const match = await adminDb()
      .collection(COLLECTIONS.operatorAdmins)
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!match.empty) {
      const row = match.docs[0];
      const data = row.data() as { email?: string; uid?: string };
      return {
        uid: (typeof data.uid === 'string' && data.uid) || row.id,
        email: (data.email || email).trim(),
      };
    }
  }
  return null;
}

export async function hydrateAccountFromOperator(input: {
  uid: string;
  email?: string;
  displayName?: string;
}): Promise<User | undefined> {
  const snap = await adminDb().collection(COLLECTIONS.users).doc(input.uid).get();
  const current = snap.data() as User | undefined;
  if (current?.role === USER_ROLE.admin) return current;

  const operator = await loadOperatorAdmin(input.uid, input.email);
  if (!operator) return current;

  return writeAdminUserDoc({
    uid: input.uid,
    email: operator.email || input.email || current?.email || '',
    displayName: input.displayName,
  });
}

export async function materializeOperatorAdmin(input: {
  uid: string;
  email: string;
  password?: string;
}): Promise<string> {
  const auth = adminAuth();
  const email = input.email.trim();
  let uid = input.uid;

  try {
    await auth.getUser(uid);
  } catch {
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      if (!input.password) {
        throw new Error(
          `No Firebase Auth user for ${email}. Set SEED_ADMIN_PASSWORD or create the Auth user, then sign in at /login.`,
        );
      }
      await auth.createUser({
        uid: input.uid,
        email,
        password: input.password,
        displayName: 'ApprentorBay Admin',
      });
      uid = input.uid;
    }
  }

  await writeAdminUserDoc({ uid, email });
  return uid;
}

export async function syncOperatorAdmins(): Promise<void> {
  const snaps = await adminDb().collection(COLLECTIONS.operatorAdmins).get();
  if (snaps.empty) {
    console.log('Operator admin sync skipped: collection admins/ is empty');
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD;
  const usablePassword =
    password && password !== DEFAULT_SEED_PASSWORD ? password : undefined;

  for (const row of snaps.docs) {
    const data = row.data() as { email?: string; uid?: string };
    const uid = (typeof data.uid === 'string' && data.uid) || row.id;
    const email = (data.email || '').trim();
    if (!email) {
      console.warn(`admins/${row.id} has no email; skipped`);
      continue;
    }
    try {
      const ready = await materializeOperatorAdmin({ uid, email, password: usablePassword });
      console.log(`Operator admin synced: ${email} (${ready})`);
    } catch (error) {
      console.error(`Operator admin sync failed for ${email}`, error);
    }
  }
}

export async function seedAdmin(attempt = 1): Promise<void> {
  const firebase = getAdminFirebase();
  if (!firebase.initialized) {
    console.warn(
      'Admin seed skipped: Firebase Admin is not initialized',
      firebase.error ?? '',
    );
    return;
  }

  if (!firebase.emulator) {
    await syncOperatorAdmins();
    await bootstrapFirstAdmin();
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

export async function bootstrapFirstAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log(
      'First-admin bootstrap skipped: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin.',
    );
    return;
  }
  if (password === DEFAULT_SEED_PASSWORD) {
    console.error(
      'First-admin bootstrap refused the emulator password. Set a unique SEED_ADMIN_PASSWORD.',
    );
    return;
  }

  const existingAdmins = await adminDb()
    .collection(COLLECTIONS.users)
    .where('role', '==', USER_ROLE.admin)
    .limit(1)
    .get();
  if (!existingAdmins.empty) {
    console.log('First-admin bootstrap skipped: an admin account already exists.');
    return;
  }

  const uid = await ensureAdminAccount({ email, password });
  console.log(`First admin ready: ${email} (${uid}). Sign in at /login, then open /admin.`);
}
