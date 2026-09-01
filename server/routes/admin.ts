import { Router } from 'express';
import {
  COLLECTIONS,
  LEARNING_CONTRACT_STATUS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  VERIFICATION_STATUS,
  isAccountActive,
  type AccountRow,
  type ApiError,
  type AdminCounts,
  type LearningContract,
  type MentorProfile,
  type MentorshipRelationship,
  type PendingMentorRow,
  type User,
  type VerificationDecision,
  type VerificationStatus,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { requireAdmin, type AdminRequest } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [usersSnap, relationshipsSnap, contractsSnap] = await Promise.all([
      adminDb().collection(COLLECTIONS.users).get(),
      adminDb().collection(COLLECTIONS.relationships).get(),
      adminDb().collection(COLLECTIONS.contracts).get(),
    ]);

    const users = usersSnap.docs.map((doc) => doc.data() as User);
    const relationships = relationshipsSnap.docs.map(
      (doc) => doc.data() as MentorshipRelationship,
    );
    const contracts = contractsSnap.docs.map((doc) => doc.data() as LearningContract);

    const counts: AdminCounts = {
      mentors: users.filter((user) => user.role === USER_ROLE.mentor).length,
      learners: users.filter((user) => user.role === USER_ROLE.learner).length,
      activeRelationships: relationships.filter((row) => row.status === RELATIONSHIP_STATUS.active)
        .length,
      contractsInProgress: contracts.filter(
        (row) => row.status === LEARNING_CONTRACT_STATUS.inProgress,
      ).length,
      completedDeliverables: contracts.filter(
        (row) => row.status === LEARNING_CONTRACT_STATUS.completed,
      ).length,
    };

    res.json({ counts });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/accounts', async (_req, res, next) => {
  try {
    const snap = await adminDb().collection(COLLECTIONS.users).get();
    const rows: AccountRow[] = snap.docs
      .map((doc) => ({ user: doc.data() as User }))
      .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/accounts/:userId/active', async (req: AdminRequest, res, next) => {
  try {
    const userId = String(req.params.userId ?? '');
    const active = (req.body as { active?: unknown } | undefined)?.active;
    if (!userId || typeof active !== 'boolean') {
      const error: ApiError = {
        code: 'invalid',
        message: 'active must be true or false',
      };
      res.status(400).json({ error });
      return;
    }

    if (req.account?.uid === userId) {
      const error: ApiError = {
        code: 'forbidden',
        message: 'You cannot suspend your own admin account',
      };
      res.status(403).json({ error });
      return;
    }

    const userRef = adminDb().collection(COLLECTIONS.users).doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      const error: ApiError = { code: 'not_found', message: 'Account not found' };
      res.status(404).json({ error });
      return;
    }

    const user = userSnap.data() as User;
    if (user.role === USER_ROLE.admin) {
      const error: ApiError = {
        code: 'forbidden',
        message: 'Admin accounts cannot be suspended from here',
      };
      res.status(403).json({ error });
      return;
    }

    const batch = adminDb().batch();
    batch.update(userRef, { active });

    const profileCollection =
      user.role === USER_ROLE.mentor ? COLLECTIONS.mentorProfiles : COLLECTIONS.learnerProfiles;
    const profileRef = adminDb().collection(profileCollection).doc(userId);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      batch.update(profileRef, { public: active });
    }

    await batch.commit();
    const next: User = { ...user, active };
    res.json({ user: next });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/mentors/pending', async (_req, res, next) => {
  try {
    const snaps = await adminDb()
      .collection(COLLECTIONS.mentorProfiles)
      .where('verificationStatus', '==', VERIFICATION_STATUS.pending)
      .get();

    const rows: PendingMentorRow[] = [];

    for (const doc of snaps.docs) {
      const profile = doc.data() as MentorProfile;
      const userSnap = await adminDb().collection(COLLECTIONS.users).doc(profile.userId).get();
      const user = userSnap.data() as User | undefined;
      if (!user || !isAccountActive(user)) continue;
      rows.push({ user, profile });
    }

    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/mentors/:userId/verification', async (req, res, next) => {
  try {
    const userId = String(req.params.userId ?? '');
    const status = (req.body as VerificationDecision | undefined)?.status;
    const allowed: VerificationStatus[] = [
      VERIFICATION_STATUS.approved,
      VERIFICATION_STATUS.rejected,
    ];

    if (!userId || !status || !allowed.includes(status)) {
      const error: ApiError = {
        code: 'invalid_decision',
        message: 'status must be approved or rejected',
      };
      res.status(400).json({ error });
      return;
    }

    const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      const error: ApiError = { code: 'not_found', message: 'Mentor profile not found' };
      res.status(404).json({ error });
      return;
    }

    await ref.update({ verificationStatus: status });
    const profile = { ...(snap.data() as MentorProfile), verificationStatus: status };

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});
