import { ADMIN_ACTION } from './administration.js';
import type { IsoDateString } from './users.js';

/**
 * Audit events for mentorship and admin actions.
 * Persisted in `adminAuditLogs`. Clients cannot write this collection.
 */
export const AUDIT_EVENT = {
  applicationAccepted: 'APPLICATION_ACCEPTED',
  applicationDeclined: 'APPLICATION_DECLINED',
  relationshipCreated: 'RELATIONSHIP_CREATED',
  relationshipPaused: 'RELATIONSHIP_PAUSED',
  relationshipResumed: 'RELATIONSHIP_RESUMED',
  relationshipEnded: 'RELATIONSHIP_ENDED',
  relationshipTerminated: 'RELATIONSHIP_TERMINATED',
  sessionScheduled: 'SESSION_SCHEDULED',
  sessionCancelled: 'SESSION_CANCELLED',
  sessionCompleted: 'SESSION_COMPLETED',
  mentorApproved: ADMIN_ACTION.approveMentor,
  mentorRejected: ADMIN_ACTION.rejectMentor,
  mentorSuspended: ADMIN_ACTION.suspendMentor,
  mentorVerified: ADMIN_ACTION.verifyMentor,
  verificationRemoved: ADMIN_ACTION.removeVerification,
  verificationReviewed: ADMIN_ACTION.reviewVerification,
  accountSuspended: ADMIN_ACTION.suspendAccount,
  accountRestricted: ADMIN_ACTION.restrictAccount,
  accountTerminated: ADMIN_ACTION.terminateAccount,
  accountRestored: ADMIN_ACTION.restoreAccount,
  supportIssueResolved: ADMIN_ACTION.resolveSupportIssue,
} as const;

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

/** @deprecated Use AUDIT_EVENT. Kept so existing imports compile. */
export const ADMIN_AUDIT_ACTION = AUDIT_EVENT;

export type AdminAuditAction = AuditEvent;

export interface AdminAuditLog {
  id: string;
  adminId: string;
  actorId: string;
  action: AuditEvent;
  targetUserId: string | null;
  reason: string | null;
  timestamp: IsoDateString;
  metadata: Record<string, string>;
  createdAt: IsoDateString;
}

export function buildAuditLog(input: {
  id: string;
  actorId: string;
  adminId?: string;
  action: AuditEvent;
  targetUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, string>;
  now: IsoDateString;
}): AdminAuditLog {
  return {
    id: input.id,
    adminId: input.adminId ?? input.actorId,
    actorId: input.actorId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    reason: input.reason ?? null,
    timestamp: input.now,
    metadata: input.metadata ?? {},
    createdAt: input.now,
  };
}
