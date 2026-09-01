import type { IsoDateString } from './users.js';

/**
 * Admin audit log. Reserved collection: `adminAuditLogs`.
 * No current write path. Verification and suspend already happen via Express;
 * future work should append a row here instead of inventing a new shape.
 */
export const ADMIN_AUDIT_ACTION = {
  mentorApproved: 'mentor_approved',
  mentorRejected: 'mentor_rejected',
  accountSuspended: 'account_suspended',
  accountRestored: 'account_restored',
} as const;

export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTION)[keyof typeof ADMIN_AUDIT_ACTION];

export interface AdminAuditLog {
  id: string;
  actorId: string;
  action: AdminAuditAction;
  targetUserId: string | null;
  metadata: Record<string, string>;
  createdAt: IsoDateString;
}
