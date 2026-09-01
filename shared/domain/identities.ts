/**
 * Canonical identity vocabulary.
 *
 * Internal role and persisted field: `learner` / `learnerId`.
 * Public UI may say "Apprentice/Learner". Never persist `apprenticeId`.
 */

export const USER_ROLE = {
  learner: 'learner',
  mentor: 'mentor',
  admin: 'admin',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export type SignupRole = Exclude<UserRole, typeof USER_ROLE.admin>;

export const PAIRING_ID_FIELD = {
  learner: 'learnerId',
  mentor: 'mentorId',
} as const;

export type PairingIdField = (typeof PAIRING_ID_FIELD)[keyof typeof PAIRING_ID_FIELD];

/** Display copy only. Not a role, field, or collection name. */
export const PUBLIC_LEARNER_LABEL = 'Apprentice/Learner';

export const CANONICAL_LEARNER_ROLE = USER_ROLE.learner;
export const CANONICAL_LEARNER_ID_FIELD = PAIRING_ID_FIELD.learner;

export function isUserRole(value: unknown): value is UserRole {
  return (
    value === USER_ROLE.learner || value === USER_ROLE.mentor || value === USER_ROLE.admin
  );
}

export function isSignupRole(value: unknown): value is SignupRole {
  return value === USER_ROLE.learner || value === USER_ROLE.mentor;
}

export function isLearnerRole(role: UserRole | string | null | undefined): boolean {
  return role === USER_ROLE.learner;
}

export function isMentorRole(role: UserRole | string | null | undefined): boolean {
  return role === USER_ROLE.mentor;
}

export function isAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === USER_ROLE.admin;
}

export function pairingIdFieldForRole(role: UserRole | string): PairingIdField {
  return role === USER_ROLE.mentor ? PAIRING_ID_FIELD.mentor : PAIRING_ID_FIELD.learner;
}
