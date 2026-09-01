import { COLLECTIONS, buildAuditLog, type AuditEvent } from '@apprentorbay/shared';
import { adminDb } from './firebase.js';

export async function recordAudit(input: {
  actorId: string;
  adminId?: string;
  action: AuditEvent;
  targetUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, string>;
}): Promise<void> {
  const ref = adminDb().collection(COLLECTIONS.auditLogs).doc();
  await ref.set(
    buildAuditLog({
      id: ref.id,
      actorId: input.actorId,
      adminId: input.adminId ?? input.actorId,
      action: input.action,
      targetUserId: input.targetUserId,
      reason: input.reason,
      metadata: input.metadata,
      now: new Date().toISOString(),
    }),
  );
}
