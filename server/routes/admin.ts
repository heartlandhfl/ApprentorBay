import { Router } from 'express';
import {
  COLLECTIONS,
  type ApiError,
  type MentorProfile,
  type PendingMentorRow,
  type User,
  type VerificationDecision,
  type VerificationStatus,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/mentors/pending', async (_req, res, next) => {
  try {
    const snaps = await adminDb()
      .collection(COLLECTIONS.mentorProfiles)
      .where('verificationStatus', '==', 'pending')
      .get();

    const rows: PendingMentorRow[] = [];

    for (const doc of snaps.docs) {
      const profile = doc.data() as MentorProfile;
      const userSnap = await adminDb().collection(COLLECTIONS.users).doc(profile.userId).get();
      const user = userSnap.data() as User | undefined;
      if (!user) continue;
      rows.push({ user, profile });
    }

    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/mentors/:userId/verification', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const status = (req.body as VerificationDecision | undefined)?.status;
    const allowed: VerificationStatus[] = ['approved', 'rejected'];

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
