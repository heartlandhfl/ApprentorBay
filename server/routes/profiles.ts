import { Router } from 'express';
import {
  COLLECTIONS,
  USER_ROLE,
  VERIFICATION_CASE_STATUS,
  type MentorshipApplication,
  type PublicProfile,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import {
  applyProfileUpdate,
  bootstrapProfile,
  loadPrivateProfile,
  resolveSlug,
  writePublicProfile,
} from '../lib/profiles.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const profilesRouter = Router();

profilesRouter.post('/me/bootstrap', requireAccount, async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    if (account.role !== USER_ROLE.learner && account.role !== USER_ROLE.mentor) {
      sendApiError(res, 403, 'forbidden', 'Only learners and mentors have public profiles');
      return;
    }
    const result = await bootstrapProfile(account);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

profilesRouter.get('/me', requireAccount, async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const loaded = await loadPrivateProfile(account.uid, account.role);
    if (!loaded) {
      sendApiError(res, 404, 'not_found', 'Profile not found');
      return;
    }
    res.json({ profile: loaded.profile, slug: loaded.profile.slug });
  } catch (error) {
    next(error);
  }
});

profilesRouter.put('/me', requireAccount, async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    if (account.role !== USER_ROLE.learner && account.role !== USER_ROLE.mentor) {
      sendApiError(res, 403, 'forbidden', 'Only learners and mentors can edit a public profile');
      return;
    }
    const result = await applyProfileUpdate(account, req.body ?? {});
    res.json(result);
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 400 || status === 409) {
      sendApiError(res, status, status === 409 ? 'conflict' : 'invalid', (error as Error).message);
      return;
    }
    next(error);
  }
});

profilesRouter.post('/me/verification/submit', requireAccount, async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    if (account.role !== USER_ROLE.mentor) {
      sendApiError(res, 403, 'forbidden', 'Only a mentor can submit verification');
      return;
    }
    const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(account.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      sendApiError(res, 404, 'not_found', 'Profile not found');
      return;
    }
    await ref.update({ verificationCaseStatus: VERIFICATION_CASE_STATUS.submitted });
    res.json({ verificationCaseStatus: VERIFICATION_CASE_STATUS.submitted });
  } catch (error) {
    next(error);
  }
});

profilesRouter.get('/public/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? '');
    const snap = await adminDb().collection(COLLECTIONS.publicProfiles).doc(slug).get();
    if (!snap.exists) {
      sendApiError(res, 404, 'not_found', 'No public profile');
      return;
    }
    const profile = snap.data() as PublicProfile;
    if (!profile.published) {
      sendApiError(res, 404, 'not_found', 'No public profile');
      return;
    }
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

profilesRouter.get(
  '/mentors/:slug/apply-target',
  requireAccount,
  async (req: AccountRequest, res, next) => {
    try {
      const account = req.account;
      if (!account) {
        sendApiError(res, 401, 'unauthenticated', 'Sign in required');
        return;
      }
      if (account.role !== USER_ROLE.learner) {
        sendApiError(res, 403, 'forbidden', 'Only a learner can apply');
        return;
      }
      const slug = String(req.params.slug ?? '');
      const record = await resolveSlug(slug);
      if (!record || record.role !== USER_ROLE.mentor) {
        sendApiError(res, 404, 'not_found', 'Mentor not found');
        return;
      }
      const loaded = await loadPrivateProfile(record.userId, USER_ROLE.mentor);
      if (!loaded || loaded.role !== USER_ROLE.mentor) {
        sendApiError(res, 404, 'not_found', 'Mentor not found');
        return;
      }
      if (loaded.profile.verificationStatus !== 'approved' || loaded.profile.public === false) {
        sendApiError(res, 403, 'forbidden', 'This mentor is not open for applications');
        return;
      }
      res.json({ mentorId: record.userId, slug: record.slug });
    } catch (error) {
      next(error);
    }
  },
);

profilesRouter.get(
  '/applications/with-mentor/:slug',
  requireAccount,
  async (req: AccountRequest, res, next) => {
    try {
      const account = req.account;
      if (!account) {
        sendApiError(res, 401, 'unauthenticated', 'Sign in required');
        return;
      }
      if (account.role !== USER_ROLE.learner) {
        sendApiError(res, 403, 'forbidden', 'Only a learner can look up an application target');
        return;
      }
      const slug = String(req.params.slug ?? '');
      const record = await resolveSlug(slug);
      if (!record) {
        sendApiError(res, 404, 'not_found', 'Profile not found');
        return;
      }
      const apps = await adminDb()
        .collection(COLLECTIONS.applications)
        .where('learnerId', '==', account.uid)
        .where('mentorId', '==', record.userId)
        .limit(8)
        .get();
      const application = (apps.docs[0]?.data() as MentorshipApplication | undefined) ?? null;
      res.json({ mentorId: record.userId, application });
    } catch (error) {
      next(error);
    }
  },
);

export async function refreshPublicProfile(userId: string, role: 'learner' | 'mentor') {
  return writePublicProfile(userId, role);
}
