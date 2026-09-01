/**
 * Firestore collection names as written in production.
 * Do not rename these keys' values without a migration.
 */

export const COLLECTIONS = {
  users: 'users',
  learnerProfiles: 'learnerProfiles',
  mentorProfiles: 'mentorProfiles',
  applications: 'mentorshipApplications',
  relationships: 'mentorshipRelationships',
  messages: 'messages',
  contracts: 'learningContracts',
  showcases: 'showcases',
  auditLogs: 'adminAuditLogs',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Names reserved for planned entities. Not written by the current app.
 * Not listed in COLLECTIONS so existing repositories cannot target them by accident.
 */
export const RESERVED_COLLECTIONS = {
  notifications: 'notifications',
  adminAuditLogs: 'adminAuditLogs',
  /**
   * Abandoned unified pairing collection. Rules still mention it.
   * Domain code must not read or write it.
   */
  legacyMentorships: 'mentorships',
} as const;

export type ReservedCollectionName =
  (typeof RESERVED_COLLECTIONS)[keyof typeof RESERVED_COLLECTIONS];
