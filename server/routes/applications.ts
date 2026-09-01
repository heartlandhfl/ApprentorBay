import { Router } from 'express';
import {
  APPLICATION_STATUS,
  AUDIT_EVENT,
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  buildActiveRelationship,
  canAcceptApplication,
  canDeclineApplication,
  isClosedRelationship,
  isOpenRelationship,
  normalizeRelationship,
  relationshipDocId,
  type MentorshipApplication,
  type MentorshipRelationship,
} from '@apprentorbay/shared';
import { recordAudit } from '../lib/audit.js';
import { adminDb } from '../lib/firebase.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const applicationsRouter = Router();

applicationsRouter.use(requireAccount);

async function loadApplication(applicationId: string) {
  const snap = await adminDb().collection(COLLECTIONS.applications).doc(applicationId).get();
  if (!snap.exists) return null;
  return { ref: snap.ref, data: snap.data() as MentorshipApplication };
}

applicationsRouter.post('/:id/accept', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const applicationId = String(req.params.id ?? '');
    const loaded = await loadApplication(applicationId);
    if (!loaded) {
      sendApiError(res, 404, 'not_found', 'Application not found');
      return;
    }

    if (!canAcceptApplication(account, loaded.data) && loaded.data.status !== APPLICATION_STATUS.accepted) {
      sendApiError(res, 403, 'forbidden', 'Only the mentor can accept this application');
      return;
    }
    if (loaded.data.mentorId !== account.uid && account.role !== USER_ROLE.admin) {
      sendApiError(res, 403, 'forbidden', 'This application is not yours');
      return;
    }
    if (loaded.data.status === APPLICATION_STATUS.declined) {
      sendApiError(res, 400, 'invalid', 'This application was declined');
      return;
    }

    const existingPair = await adminDb()
      .collection(COLLECTIONS.relationships)
      .where('learnerId', '==', loaded.data.learnerId)
      .where('mentorId', '==', loaded.data.mentorId)
      .limit(8)
      .get();
    const existingRows = existingPair.docs.map((item) =>
      normalizeRelationship({ ...(item.data() as MentorshipRelationship), id: item.id }),
    );
    const relationshipId =
      existingRows.find((row) => isOpenRelationship(row))?.id ??
      existingRows[0]?.id ??
      relationshipDocId(loaded.data.learnerId, loaded.data.mentorId);
    const now = new Date().toISOString();

    const result = await adminDb().runTransaction(async (tx) => {
      const appRef = loaded.ref;
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) {
        throw Object.assign(new Error('Application is gone'), { status: 404 });
      }
      const current = appSnap.data() as MentorshipApplication;

      if (current.mentorId !== account.uid && account.role !== USER_ROLE.admin) {
        throw Object.assign(new Error('This application is not yours'), { status: 403 });
      }
      if (current.status === APPLICATION_STATUS.declined) {
        throw Object.assign(new Error('This application was declined'), { status: 400 });
      }

      const relRef = adminDb().collection(COLLECTIONS.relationships).doc(relationshipId);
      const relSnap = await tx.get(relRef);
      const existing = relSnap.exists
        ? normalizeRelationship({ ...(relSnap.data() as MentorshipRelationship), id: relSnap.id })
        : null;

      if (existing && isOpenRelationship(existing)) {
        if (current.status !== APPLICATION_STATUS.accepted) {
          tx.update(appRef, { status: APPLICATION_STATUS.accepted });
        }
        return { relationship: existing, created: false, accepted: current.status !== APPLICATION_STATUS.accepted };
      }

      if (current.status !== APPLICATION_STATUS.pending && current.status !== APPLICATION_STATUS.accepted) {
        throw Object.assign(new Error('This application is no longer pending'), { status: 400 });
      }

      let relationship: MentorshipRelationship;
      let created = false;

      if (existing && isClosedRelationship(existing)) {
        if (existing.status === RELATIONSHIP_STATUS.terminated) {
          throw Object.assign(new Error('This pairing was terminated'), { status: 403 });
        }
        relationship = {
          ...existing,
          applicationId: current.id,
          status: RELATIONSHIP_STATUS.active,
          startedAt: now,
          updatedAt: now,
          endedAt: null,
        };
        tx.set(relRef, relationship);
      } else {
        relationship = buildActiveRelationship({
          id: relationshipId,
          learnerId: current.learnerId,
          mentorId: current.mentorId,
          applicationId: current.id,
          now,
        });
        tx.set(relRef, relationship);
        created = true;
      }

      if (current.status !== APPLICATION_STATUS.accepted) {
        tx.update(appRef, { status: APPLICATION_STATUS.accepted });
      }

      return { relationship, created, accepted: current.status !== APPLICATION_STATUS.accepted };
    });

    if (result.accepted) {
      await recordAudit({
        actorId: account.uid,
        action: AUDIT_EVENT.applicationAccepted,
        targetUserId: result.relationship.learnerId,
        metadata: {
          applicationId,
          relationshipId: result.relationship.id,
        },
      });
    }
    if (result.created) {
      await recordAudit({
        actorId: account.uid,
        action: AUDIT_EVENT.relationshipCreated,
        targetUserId: result.relationship.learnerId,
        metadata: {
          applicationId,
          relationshipId: result.relationship.id,
        },
      });
    }

    res.status(result.created ? 201 : 200).json({ relationship: result.relationship });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status && error instanceof Error) {
      sendApiError(res, status, 'invalid', error.message);
      return;
    }
    next(error);
  }
});

applicationsRouter.post('/:id/decline', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const applicationId = String(req.params.id ?? '');
    const loaded = await loadApplication(applicationId);
    if (!loaded) {
      sendApiError(res, 404, 'not_found', 'Application not found');
      return;
    }

    if (loaded.data.status === APPLICATION_STATUS.declined) {
      res.json({ application: loaded.data });
      return;
    }

    if (!canDeclineApplication(account, loaded.data) && account.role !== USER_ROLE.admin) {
      sendApiError(res, 403, 'forbidden', 'Only the mentor can decline this application');
      return;
    }

    const nextApp: MentorshipApplication = {
      ...loaded.data,
      status: APPLICATION_STATUS.declined,
    };
    await loaded.ref.update({ status: APPLICATION_STATUS.declined });
    await recordAudit({
      actorId: account.uid,
      action: AUDIT_EVENT.applicationDeclined,
      targetUserId: loaded.data.learnerId,
      metadata: { applicationId },
    });

    res.json({ application: nextApp });
  } catch (error) {
    next(error);
  }
});
