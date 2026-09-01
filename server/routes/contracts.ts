import { Router } from 'express';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  buildShowcase,
  createDraftContract,
  deliverableRefFromShowcase,
  mergeShowcaseRecord,
  normalizeContract,
  reduceContract,
  type ApiError,
  type ContractAction,
  type ContractActor,
  type LearningContract,
  type MentorshipRelationship,
  type Showcase,
  type User,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { writePublicProfile } from '../lib/profiles.js';
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

    for (const effect of result.effects) {
      if (effect.type === 'publish_showcase') {
        await publishShowcase(result.contract);
      }
      if (effect.type === 'set_showcase_published') {
        await setShowcasePublished(result.contract, effect.published);
      }
    }

    res.json({ contract: result.contract });
  } catch (error) {
    next(error);
  }
});

async function publishShowcase(contract: LearningContract) {
  const [learnerName, mentorName] = await Promise.all([
    displayName(contract.learnerId, 'Learner'),
    displayName(contract.mentorId, 'Mentor'),
  ]);
  const next = buildShowcase({
    contract,
    learnerDisplayName: learnerName,
    mentorDisplayName: mentorName,
    now: contract.updatedAt,
    published: contract.showcasePublished,
  });
  const ref = adminDb().collection(COLLECTIONS.showcases).doc(next.id);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? (existingSnap.data() as Showcase) : null;
  await ref.set(mergeShowcaseRecord(existing, next));
  await attachDeliverableRefs(contract, next);
  await Promise.all([
    writePublicProfile(contract.learnerId, USER_ROLE.learner),
    writePublicProfile(contract.mentorId, USER_ROLE.mentor),
  ]);
}

async function setShowcasePublished(contract: LearningContract, published: boolean) {
  const id = contract.showcaseId ?? contract.id;
  const ref = adminDb().collection(COLLECTIONS.showcases).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await publishShowcase({ ...contract, showcasePublished: published });
    return;
  }
  await ref.set(
    {
      published,
      publishedAt: published ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  await Promise.all([
    writePublicProfile(contract.learnerId, USER_ROLE.learner),
    writePublicProfile(contract.mentorId, USER_ROLE.mentor),
  ]);
}

async function attachDeliverableRefs(
  contract: LearningContract,
  showcase: { id: string; contractId: string; title: string; description: string },
) {
  const entry = deliverableRefFromShowcase(showcase);
  const learnerRef = adminDb().collection(COLLECTIONS.learnerProfiles).doc(contract.learnerId);
  const mentorRef = adminDb().collection(COLLECTIONS.mentorProfiles).doc(contract.mentorId);
  await Promise.all([
    unionDeliverable(learnerRef, entry),
    unionDeliverable(mentorRef, entry),
  ]);
}

async function unionDeliverable(
  ref: DocumentReference,
  entry: { id: string; contractId: string; title: string; description: string },
) {
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ deliverables: FieldValue.arrayUnion(entry) });
}

async function displayName(uid: string, fallback: string): Promise<string> {
  const userSnap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  const fromUser = (userSnap.data() as { displayName?: string } | undefined)?.displayName?.trim();
  if (fromUser) return fromUser;
  const learner = await adminDb().collection(COLLECTIONS.learnerProfiles).doc(uid).get();
  const fromLearner = (learner.data() as { displayName?: string } | undefined)?.displayName?.trim();
  if (fromLearner) return fromLearner;
  const mentor = await adminDb().collection(COLLECTIONS.mentorProfiles).doc(uid).get();
  const fromMentor = (mentor.data() as { displayName?: string } | undefined)?.displayName?.trim();
  return fromMentor || fallback;
}
