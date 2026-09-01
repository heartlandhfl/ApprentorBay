import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  createDraftContract,
  normalizeContract,
  reduceContract,
  type ApiError,
  type ContractAction,
  type ContractActor,
  type DeliverableRef,
  type LearningContract,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const contractsRouter = Router();

contractsRouter.use(requireAccount);

function asActor(account: User): ContractActor | null {
  if (
    account.role !== USER_ROLE.learner &&
    account.role !== USER_ROLE.mentor &&
    account.role !== USER_ROLE.admin
  ) {
    return null;
  }
  return { uid: account.uid, role: account.role };
}

async function contractByRelationship(relationshipId: string) {
  const snap = await adminDb()
    .collection(COLLECTIONS.contracts)
    .where('relationshipId', '==', relationshipId)
    .limit(1)
    .get();
  return snap.docs[0] ?? null;
}

contractsRouter.post('/', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    if (account.role !== USER_ROLE.learner) {
      sendApiError(res, 403, 'forbidden', 'Only the learner can start a learning journey');
      return;
    }

    const relationshipId =
      typeof req.body?.relationshipId === 'string' ? req.body.relationshipId : '';
    if (!relationshipId) {
      sendApiError(res, 400, 'invalid', 'relationshipId is required');
      return;
    }

    const relSnap = await adminDb().collection(COLLECTIONS.relationships).doc(relationshipId).get();
    const relationship = relSnap.data() as MentorshipRelationship | undefined;
    if (!relationship || relationship.status !== RELATIONSHIP_STATUS.active) {
      sendApiError(res, 404, 'not_found', 'Active relationship not found');
      return;
    }
    if (relationship.learnerId !== account.uid) {
      sendApiError(res, 403, 'forbidden', 'This is not your relationship');
      return;
    }

    const existing = await contractByRelationship(relationshipId);
    if (existing) {
      res.json({ contract: normalizeContract(existing.data() as LearningContract) });
      return;
    }

    const ref = adminDb().collection(COLLECTIONS.contracts).doc();
    const contract = createDraftContract({
      id: ref.id,
      relationshipId,
      learnerId: relationship.learnerId,
      mentorId: relationship.mentorId,
      now: new Date().toISOString(),
    });
    await ref.set(contract);
    res.status(201).json({ contract });
  } catch (error) {
    next(error);
  }
});

contractsRouter.post('/:id/action', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const actor = asActor(account);
    if (!actor) {
      sendApiError(res, 403, 'forbidden', 'Only the learner, mentor, or an admin can act');
      return;
    }

    const id = String(req.params.id ?? '');
    const ref = adminDb().collection(COLLECTIONS.contracts).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      sendApiError(res, 404, 'not_found', 'Learning contract not found');
      return;
    }

    const current = normalizeContract(snap.data() as LearningContract);
    const action = { ...(req.body as Omit<ContractAction, 'now'>), now: new Date().toISOString() } as ContractAction;
    const result = reduceContract(current, action, actor);
    if (!result.ok) {
      const error: ApiError = { code: 'invalid_transition', message: result.error };
      res.status(400).json({ error });
      return;
    }

    await ref.set(result.contract);

    if (result.effects.some((effect) => effect.type === 'publish_deliverable_refs')) {
      await publishDeliverableRefs(result.contract);
    }

    res.json({ contract: result.contract });
  } catch (error) {
    next(error);
  }
});

async function publishDeliverableRefs(contract: LearningContract) {
  if (!contract.deliverable) return;

  const entry: DeliverableRef = {
    id: contract.deliverable.id,
    contractId: contract.id,
    title: contract.deliverable.title,
    description: contract.deliverable.description,
  };

  const learnerRef = adminDb().collection(COLLECTIONS.learnerProfiles).doc(contract.learnerId);
  const mentorRef = adminDb().collection(COLLECTIONS.mentorProfiles).doc(contract.mentorId);

  await Promise.all([
    learnerRef.update({ deliverables: FieldValue.arrayUnion(entry) }),
    mentorRef.update({ deliverables: FieldValue.arrayUnion(entry) }),
  ]);
}
