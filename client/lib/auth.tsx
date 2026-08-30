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
  emptyLearnerProfile,
  emptyMentorProfile,
  type SignupRole,
  type User,
} from '@apprentorbay/shared';
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
  }) => Promise<User>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
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

    const unsubAuth = onAuthStateChanged(auth, (next) => {
      unsubUser?.();
      unsubUser = undefined;
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
          setAccount((snap.data() as User | undefined) ?? null);
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
          createdAt,
        };

        try {
          await runTransaction(db, async (tx) => {
            const userRef = doc(db, COLLECTIONS.users, uid);
            const profileRef = doc(
              db,
              input.role === 'learner'
                ? COLLECTIONS.learnerProfiles
                : COLLECTIONS.mentorProfiles,
              uid,
            );

            tx.set(userRef, userDoc);

            if (input.role === 'learner') {
              tx.set(profileRef, {
                ...emptyLearnerProfile(uid, displayName),
                jobStatus: input.jobStatus?.trim() ?? '',
                careerAspirations: input.careerAspirations?.trim() ?? '',
              });
            } else {
              const profile = emptyMentorProfile(uid, displayName);
              const recentRole = input.recentRole?.trim();
              tx.set(profileRef, {
                ...profile,
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
        return (stored.data() as User | undefined) ?? userDoc;
      },
      async logIn(email, password) {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error('Firebase is not initialized');
        await signInWithEmailAndPassword(auth, email.trim(), password).catch(
          (error: unknown) => {
            throw new Error(authMessage(error));
          },
        );
      },
      async logOut() {
        const auth = getFirebaseAuth();
        if (!auth) return;
        await signOut(auth);
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
  if (account.role === 'learner') return `/learners/${account.uid}`;
  if (account.role === 'mentor') return `/mentors/${account.uid}`;
  return '/admin/verification';
}
