import { COLLECTIONS, buildAuditLog, type AuditEvent } from '@apprentorbay/shared';
import { adminDb } from './firebase.js';

export async function recordAudit(input: {
  actorId: string;
  action: AuditEvent;
  targetUserId?: string | null;
  metadata?: Record<string, string>;
}): Promise<void> {
  const ref = adminDb().collection(COLLECTIONS.auditLogs).doc();
  await ref.set(
    buildAuditLog({
      id: ref.id,
      actorId: input.actorId,
      action: input.action,
      targetUserId: input.targetUserId,
      metadata: input.metadata,
      now: new Date().toISOString(),
    }),
  );
}
