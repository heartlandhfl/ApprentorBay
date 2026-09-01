import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import {
  COLLECTIONS,
  ACCOUNT_STATUS,
  buildTermsAcceptance,
  validateSignupTermsAcceptance,
  USER_ROLE,
  emptyLearnerProfile,
  emptyMentorProfile,
  isAccountActive,
  ownPublicProfilePath,
  type SignupRole,
  type User,
} from '@apprentorbay/shared';
import { establishAccountSession, recordTermsAcceptance } from './api';
import { getFirebaseAuth, getFirebaseDb } from './firebase';

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  account: User | null;
  loading: boolean;
  signUp: (input: {
    role: SignupRole;
    email: string;
    password: string;
    displayName: string;
    jobStatus?: string;
    careerAspirations?: string;
    recentRole?: string;
    expertise?: string;
    termsAccepted: boolean;
  }) => Promise<User>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  acceptCurrentTerms: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [account, setAccount] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubUser: (() => void) | undefined;
    let sessionRequestedFor: string | null = null;

    const unsubAuth = onAuthStateChanged(auth, (next) => {
      unsubUser?.();
      unsubUser = undefined;
      sessionRequestedFor = null;
      setFirebaseUser(next);

      if (!next) {
        setAccount(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const ref = doc(db, COLLECTIONS.users, next.uid);
      unsubUser = onSnapshot(
        ref,
        (snap) => {
          const nextAccount = (snap.data() as User | undefined) ?? null;
          if (nextAccount && !isAccountActive(nextAccount)) {
            void signOut(auth);
            setAccount(null);
            setLoading(false);
            return;
          }
          if (!nextAccount && sessionRequestedFor !== next.uid) {
            sessionRequestedFor = next.uid;
            void establishAccountSession().catch(() => undefined);
          }
          if (
            nextAccount &&
            !nextAccount.profileSlug &&
            (nextAccount.role === USER_ROLE.learner || nextAccount.role === USER_ROLE.mentor)
          ) {
            void next.getIdToken().then((token) =>
              fetch('/api/profiles/me/bootstrap', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              }),
            );
          }
          setAccount(
            nextAccount
              ? { ...nextAccount, profileSlug: nextAccount.profileSlug ?? null }
              : null,
          );
          setLoading(false);
        },
        () => {
          setAccount(null);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubAuth();
      unsubUser?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      account,
      loading,
      async signUp(input) {
        const auth = getFirebaseAuth();
        const db = getFirebaseDb();
        if (!auth || !db) {
          throw new Error('Firebase is not initialized');
        }
        const terms = validateSignupTermsAcceptance({ accepted: input.termsAccepted });
        if (!terms.ok) {
          throw new Error(terms.error ?? 'You must agree to the Terms of Use.');
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          input.email.trim(),
          input.password,
        ).catch((error: unknown) => {
          throw new Error(authMessage(error));
        });
        const uid = credential.user.uid;
        const createdAt = new Date().toISOString();
        const displayName = input.displayName.trim();

        const userDoc: User = {
          uid,
          role: input.role,
          email: input.email.trim(),
          displayName,
          active: true,
          accountStatus: ACCOUNT_STATUS.active,
          createdAt,
          ...buildTermsAcceptance(createdAt),
          profileSlug: null,
        };

        try {
          await runTransaction(db, async (tx) => {
            const userRef = doc(db, COLLECTIONS.users, uid);
            const profileRef = doc(
              db,
              input.role === USER_ROLE.learner
                ? COLLECTIONS.learnerProfiles
                : COLLECTIONS.mentorProfiles,
              uid,
            );

            tx.set(userRef, userDoc);

            if (input.role === USER_ROLE.learner) {
              tx.set(profileRef, {
                ...emptyLearnerProfile(uid, displayName),
                jobStatus: input.jobStatus?.trim() ?? '',
                careerAspirations: input.careerAspirations?.trim() ?? '',
              });
            } else {
              const profile = emptyMentorProfile(uid, displayName);
              const recentRole = input.recentRole?.trim();
              const expertise = input.expertise?.trim() || recentRole || '';
              tx.set(profileRef, {
                ...profile,
                expertise,
                experience: recentRole
                  ? [
                      {
                        id: 'signup',
                        organization: '',
                        title: recentRole,
                        summary: '',
                        year: '',
                      },
                    ]
                  : [],
              });
            }
          });
        } catch (error) {
          await credential.user.delete().catch(() => undefined);
          throw error;
        }

        const stored = await getDoc(doc(db, COLLECTIONS.users, uid));
        const token = await credential.user.getIdToken();
        await fetch('/api/profiles/me/bootstrap', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
        const after = await getDoc(doc(db, COLLECTIONS.users, uid));
        return (after.data() as User | undefined) ?? (stored.data() as User | undefined) ?? userDoc;
      },
      async logIn(email, password) {
        const auth = getFirebaseAuth();
        const db = getFirebaseDb();
        if (!auth || !db) throw new Error('Firebase is not initialized');
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        ).catch((error: unknown) => {
          throw new Error(authMessage(error));
        });
        try {
          const { account } = await establishAccountSession();
          if (!isAccountActive(account)) {
            await signOut(auth);
            throw new Error('This account has been suspended.');
          }
        } catch (error) {
          const snap = await getDoc(doc(db, COLLECTIONS.users, credential.user.uid));
          const stored = snap.data() as User | undefined;
          if (isAccountActive(stored)) return;
          await signOut(auth);
          throw error instanceof Error && error.message !== 'This account has been suspended.'
            ? new Error(
                stored
                  ? error.message
                  : 'Signed in, but this email is not an app user yet. If you are the operator listed in admins/, wait for the server to sync or check /api/health (adminInitialized must be true).',
              )
            : error;
        }
      },
      async logOut() {
        const auth = getFirebaseAuth();
        if (!auth) return;
        await signOut(auth);
      },
      async acceptCurrentTerms() {
        await recordTermsAcceptance();
      },
    }),
    [account, firebaseUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

function authMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'auth/email-already-in-use') return 'That email already has an account.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (error instanceof Error && error.message) return error.message;
  return 'Authentication failed.';
}

export function profilePath(account: User): string {
  if (account.role === USER_ROLE.learner || account.role === USER_ROLE.mentor) {
    return ownPublicProfilePath(account.role, account.profileSlug);
  }
  return '/admin';
}

export function signedInHomePath(account: User): string {
  if (account.role === USER_ROLE.admin) return '/admin';
  return '/dashboard';
}
