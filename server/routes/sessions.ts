import { Router } from 'express';
import { AUDIT_EVENT } from '@apprentorbay/shared';
import { recordAudit } from '../lib/audit.js';
import {
  SessionServiceError,
  cancelMentorshipSession,
  completeMentorshipSession,
  createMentorshipSession,
  getMentorshipSession,
  joinMentorshipSession,
  listMentorshipSessions,
  type CreateSessionInput,
} from '../lib/sessionService.js';
import {
  getRelationshipById,
  getBookingForSession,
  getSessionById,
  listSessionsForRelationship,
  newSessionRef,
  saveSession,
} from '../lib/sessionsRepository.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';
import type { SessionStore } from '../lib/sessionService.js';

const firestoreStore: SessionStore = {
  getRelationship: getRelationshipById,
  getSession: getSessionById,
  saveSession,
  listSessions: listSessionsForRelationship,
  newSessionId: () => newSessionRef().id,
  getBookingForSession,
};

export const sessionsRouter = Router();

sessionsRouter.use(requireAccount);

function handleServiceError(res: Parameters<typeof sendApiError>[0], error: unknown): boolean {
  if (error instanceof SessionServiceError) {
    sendApiError(res, error.status, error.code, error.message);
    return true;
  }
  return false;
}

sessionsRouter.post('/', async (req: AccountRequest, res, next) => {
  try {
    const session = await createMentorshipSession(
      firestoreStore,
      req.account,
      req.body as CreateSessionInput,
    );
    await recordAudit({
      actorId: req.account!.uid,
      action: AUDIT_EVENT.sessionScheduled,
      targetUserId:
        req.account!.uid === session.learnerId ? session.mentorId : session.learnerId,
      metadata: {
        sessionId: session.id,
        relationshipId: session.relationshipId,
      },
    });
    res.status(201).json({ session });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});

sessionsRouter.get('/', async (req: AccountRequest, res, next) => {
  try {
    const relationshipId =
      typeof req.query.relationshipId === 'string' ? req.query.relationshipId.trim() : '';
    if (!relationshipId) {
      sendApiError(res, 400, 'invalid', 'relationshipId query parameter is required');
      return;
    }
    const sessions = await listMentorshipSessions(firestoreStore, req.account, relationshipId);
    res.json({ sessions });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});

sessionsRouter.get('/:id', async (req: AccountRequest, res, next) => {
  try {
    const session = await getMentorshipSession(
      firestoreStore,
      req.account,
      String(req.params.id ?? ''),
    );
    res.json({ session });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});

sessionsRouter.post('/:id/join', async (req: AccountRequest, res, next) => {
  try {
    const join = await joinMentorshipSession(
      firestoreStore,
      req.account,
      String(req.params.id ?? ''),
    );
    res.json({ join });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});

sessionsRouter.post('/:id/cancel', async (req: AccountRequest, res, next) => {
  try {
    const { session, changed } = await cancelMentorshipSession(
      firestoreStore,
      req.account,
      String(req.params.id ?? ''),
    );
    if (changed) {
      await recordAudit({
        actorId: req.account!.uid,
        action: AUDIT_EVENT.sessionCancelled,
        targetUserId:
          req.account!.uid === session.learnerId ? session.mentorId : session.learnerId,
        metadata: {
          sessionId: session.id,
          relationshipId: session.relationshipId,
        },
      });
    }
    res.json({ session });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});

sessionsRouter.post('/:id/complete', async (req: AccountRequest, res, next) => {
  try {
    const { session, changed } = await completeMentorshipSession(
      firestoreStore,
      req.account,
      String(req.params.id ?? ''),
    );
    if (changed) {
      await recordAudit({
        actorId: req.account!.uid,
        action: AUDIT_EVENT.sessionCompleted,
        targetUserId:
          req.account!.uid === session.learnerId ? session.mentorId : session.learnerId,
        metadata: {
          sessionId: session.id,
          relationshipId: session.relationshipId,
        },
      });
    }
    res.json({ session });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
});
