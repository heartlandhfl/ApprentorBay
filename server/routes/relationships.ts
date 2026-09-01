import { Router } from 'express';
import {
  AUDIT_EVENT,
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  canEndRelationship,
  canPauseRelationship,
  canResumeRelationship,
  canTerminateRelationship,
  isRelationshipStatus,
  normalizeRelationship,
  type MentorshipRelationship,
  type RelationshipStatus,
} from '@apprentorbay/shared';
import { recordAudit } from '../lib/audit.js';
import { adminDb } from '../lib/firebase.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const relationshipsRouter = Router();

relationshipsRouter.use(requireAccount);

const MEMBER_STATUSES = new Set<RelationshipStatus>([
  RELATIONSHIP_STATUS.active,
  RELATIONSHIP_STATUS.paused,
  RELATIONSHIP_STATUS.ended,
]);

relationshipsRouter.post('/:id/status', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const relationshipId = String(req.params.id ?? '');
    const nextStatus = (req.body as { status?: unknown } | undefined)?.status;
    if (!isRelationshipStatus(nextStatus)) {
      sendApiError(res, 400, 'invalid', 'status must be active, paused, ended, or terminated');
      return;
    }

    const ref = adminDb().collection(COLLECTIONS.relationships).doc(relationshipId);
    const snap = await ref.get();
    if (!snap.exists) {
      sendApiError(res, 404, 'not_found', 'Relationship not found');
      return;
    }

    const current = normalizeRelationship({
      ...(snap.data() as MentorshipRelationship),
      id: snap.id,
    });

    if (nextStatus === current.status) {
      res.json({ relationship: current });
      return;
    }

    const actor = account;
    let allowed = false;
    let action: (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT] =
      AUDIT_EVENT.relationshipEnded;

    if (nextStatus === RELATIONSHIP_STATUS.paused) {
      allowed = canPauseRelationship(actor, current);
      action = AUDIT_EVENT.relationshipPaused;
    } else if (nextStatus === RELATIONSHIP_STATUS.active) {
      allowed = canResumeRelationship(actor, current);
      action = AUDIT_EVENT.relationshipResumed;
    } else if (nextStatus === RELATIONSHIP_STATUS.ended) {
      allowed = canEndRelationship(actor, current);
      action = AUDIT_EVENT.relationshipEnded;
    } else if (nextStatus === RELATIONSHIP_STATUS.terminated) {
      allowed = canTerminateRelationship(actor, current);
      action = AUDIT_EVENT.relationshipTerminated;
    }

    if (!allowed) {
      sendApiError(res, 403, 'forbidden', 'You cannot change this relationship to that status');
      return;
    }

    if (account.role !== USER_ROLE.admin && !MEMBER_STATUSES.has(nextStatus)) {
      sendApiError(res, 403, 'forbidden', 'Only an admin can terminate a relationship');
      return;
    }

    const now = new Date().toISOString();
    const closed =
      nextStatus === RELATIONSHIP_STATUS.ended || nextStatus === RELATIONSHIP_STATUS.terminated;
    const relationship: MentorshipRelationship = {
      ...current,
      status: nextStatus,
      updatedAt: now,
      endedAt: closed ? now : null,
      startedAt:
        nextStatus === RELATIONSHIP_STATUS.active && current.status === RELATIONSHIP_STATUS.paused
          ? current.startedAt
          : current.startedAt,
    };

    await ref.set(relationship);
    await recordAudit({
      actorId: account.uid,
      action,
      targetUserId:
        account.uid === relationship.learnerId ? relationship.mentorId : relationship.learnerId,
      metadata: {
        relationshipId: relationship.id,
        from: current.status,
        to: nextStatus,
      },
    });

    res.json({ relationship });
  } catch (error) {
    next(error);
  }
});
