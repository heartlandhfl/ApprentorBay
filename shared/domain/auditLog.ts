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
  mentorApproved: 'mentor_approved',
  mentorRejected: 'mentor_rejected',
  accountSuspended: 'account_suspended',
  accountRestored: 'account_restored',
} as const;

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

/** @deprecated Use AUDIT_EVENT. Kept so existing imports compile. */
export const ADMIN_AUDIT_ACTION = AUDIT_EVENT;

export type AdminAuditAction = AuditEvent;

export interface AdminAuditLog {
  id: string;
  actorId: string;
  action: AuditEvent;
  targetUserId: string | null;
  metadata: Record<string, string>;
  createdAt: IsoDateString;
}

export function buildAuditLog(input: {
  id: string;
  actorId: string;
  action: AuditEvent;
  targetUserId?: string | null;
  metadata?: Record<string, string>;
  now: IsoDateString;
}): AdminAuditLog {
  return {
    id: input.id,
    actorId: input.actorId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.now,
  };
}
