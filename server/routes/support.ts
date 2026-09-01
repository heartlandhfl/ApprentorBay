import { Router } from 'express';
import {
  COLLECTIONS,
  SUPPORT_ISSUE_STATUS,
  validateSupportIssue,
  type SupportIssue,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const supportRouter = Router();

supportRouter.use(requireAccount);

supportRouter.post('/', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const parsed = validateSupportIssue(req.body ?? {});
    if (!parsed.ok) {
      sendApiError(res, 400, 'invalid', parsed.error);
      return;
    }
    const ref = adminDb().collection(COLLECTIONS.supportIssues).doc();
    const issue: SupportIssue = {
      id: ref.id,
      reporterId: account.uid,
      reporterRole: account.role,
      reporterName: account.displayName,
      subject: parsed.subject,
      body: parsed.body,
      status: SUPPORT_ISSUE_STATUS.open,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    };
    await ref.set(issue);
    res.status(201).json({ issue });
  } catch (error) {
    next(error);
  }
});

supportRouter.get('/mine', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const snap = await adminDb()
      .collection(COLLECTIONS.supportIssues)
      .where('reporterId', '==', account.uid)
      .get();
    const rows = snap.docs
      .map((doc) => doc.data() as SupportIssue)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});
