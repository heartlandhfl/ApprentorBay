import { Router } from 'express';
import {
  ACCOUNT_STATUS,
  AUDIT_EVENT,
  COLLECTIONS,
  LEARNING_CONTRACT_STATUS,
  RELATIONSHIP_STATUS,
  SUPPORT_ISSUE_STATUS,
  USER_ROLE,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_TYPE,
  accountStatusOf,
  deriveVerificationCase,
  isAccountActive,
  isPendingVerificationCase,
  isVerificationStatus,
  normalizeMentorProfile,
  type AccountRow,
  type AccountStatus,
  type AdminAuditLog,
  type AdminCounts,
  type ApiError,
  type LearningContract,
  type MentorProfile,
  type MentorshipRelationship,
  type PendingMentorRow,
  type SupportIssue,
  type User,
  type VerificationStatus,
} from '@apprentorbay/shared';
import { recordAudit } from '../lib/audit.js';
import { adminDb } from '../lib/firebase.js';
import {
  applyAccountStatus,
  applyMentorApproval,
  applyMentorVerification,
  applyVerificationCase,
} from '../lib/governance.js';
import { writePublicProfile } from '../lib/profiles.js';
import { requireAdmin, type AdminRequest } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

function sendError(res: { status: (code: number) => { json: (body: unknown) => void } }, status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  res.status(status).json({ error });
}

function adminOf(req: AdminRequest): User | null {
  return req.account ?? null;
}

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [usersSnap, mentorsSnap, relationshipsSnap, contractsSnap, issuesSnap] = await Promise.all([
      adminDb().collection(COLLECTIONS.users).get(),
      adminDb().collection(COLLECTIONS.mentorProfiles).get(),
      adminDb().collection(COLLECTIONS.relationships).get(),
      adminDb().collection(COLLECTIONS.contracts).get(),
      adminDb().collection(COLLECTIONS.supportIssues).get(),
    ]);

    const users = usersSnap.docs.map((doc) => doc.data() as User);
    const mentors = mentorsSnap.docs.map((doc) =>
      normalizeMentorProfile({ ...(doc.data() as MentorProfile), userId: doc.id }),
    );
    const relationships = relationshipsSnap.docs.map((doc) => doc.data() as MentorshipRelationship);
    const contracts = contractsSnap.docs.map((doc) => doc.data() as LearningContract);
    const issues = issuesSnap.docs.map((doc) => doc.data() as SupportIssue);

    const counts: AdminCounts = {
      totalUsers: users.length,
      mentors: users.filter((user) => user.role === USER_ROLE.mentor).length,
      learners: users.filter((user) => user.role === USER_ROLE.learner).length,
      pendingMentorApprovals: mentors.filter(
        (profile) => profile.verificationStatus === VERIFICATION_STATUS.pending,
      ).length,
      pendingVerification: mentors.filter((profile) =>
        isPendingVerificationCase(deriveVerificationCase(profile.verifiedClaims, profile.verificationCaseStatus)),
      ).length,
      activeRelationships: relationships.filter((row) => row.status === RELATIONSHIP_STATUS.active)
        .length,
      activeLearningContracts: contracts.filter(
        (row) => row.status === LEARNING_CONTRACT_STATUS.inProgress,
      ).length,
      completedDeliverables: contracts.filter(
        (row) => row.status === LEARNING_CONTRACT_STATUS.completed,
      ).length,
      supportIssues: issues.filter((row) => row.status !== SUPPORT_ISSUE_STATUS.resolved).length,
    };

    res.json({ counts });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/accounts', async (_req, res, next) => {
  try {
    const snaps = await adminDb().collection(COLLECTIONS.users).get();
    const rows: AccountRow[] = [];
    for (const doc of snaps.docs) {
      const user = { ...(doc.data() as User), accountStatus: accountStatusOf(doc.data() as User) };
      if (user.role === USER_ROLE.mentor) {
        const profileSnap = await adminDb().collection(COLLECTIONS.mentorProfiles).doc(user.uid).get();
        const profile = profileSnap.exists
          ? normalizeMentorProfile({ ...(profileSnap.data() as MentorProfile), userId: user.uid })
          : null;
        rows.push({
          user,
          publicSlug: user.profileSlug ?? profile?.slug ?? null,
          approvalStatus: profile?.verificationStatus ?? null,
          verificationCaseStatus: profile
            ? deriveVerificationCase(profile.verifiedClaims, profile.verificationCaseStatus)
            : null,
          verifiedClaims: profile?.verifiedClaims ?? [],
        });
      } else {
        rows.push({
          user,
          publicSlug: user.profileSlug ?? null,
          approvalStatus: null,
          verificationCaseStatus: null,
          verifiedClaims: [],
        });
      }
    }
    rows.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/audit', async (_req, res, next) => {
  try {
    const snap = await adminDb()
      .collection(COLLECTIONS.auditLogs)
      .orderBy('timestamp', 'desc')
      .limit(40)
      .get()
      .catch(async () =>
        adminDb().collection(COLLECTIONS.auditLogs).orderBy('createdAt', 'desc').limit(40).get(),
      );
    const rows = snap.docs.map((doc) => doc.data() as AdminAuditLog);
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/support', async (_req, res, next) => {
  try {
    const snap = await adminDb().collection(COLLECTIONS.supportIssues).get();
    const rows = snap.docs
      .map((doc) => doc.data() as SupportIssue)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/support/:issueId/resolve', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const issueId = String(req.params.issueId ?? '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    const ref = adminDb().collection(COLLECTIONS.supportIssues).doc(issueId);
    const snap = await ref.get();
    if (!snap.exists) {
      sendError(res, 404, 'not_found', 'Support issue not found');
      return;
    }
    const issue = snap.data() as SupportIssue;
    const next: SupportIssue = {
      ...issue,
      status: SUPPORT_ISSUE_STATUS.resolved,
      resolvedAt: new Date().toISOString(),
      resolvedBy: admin.uid,
    };
    await ref.set(next);
    await recordAudit({
      actorId: admin.uid,
      adminId: admin.uid,
      action: AUDIT_EVENT.supportIssueResolved,
      targetUserId: issue.reporterId,
      reason: reason.trim() || null,
      metadata: { issueId },
    });
    res.json({ issue: next });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/accounts/:userId/status', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const status = (req.body as { status?: AccountStatus } | undefined)?.status;
    const reason = (req.body as { reason?: string } | undefined)?.reason;
    if (!userId || !status) {
      sendError(res, 400, 'invalid', 'status is required');
      return;
    }
    const user = await applyAccountStatus({ admin, userId, status, reason });
    res.json({ user });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 400 || status === 403 || status === 404) {
      sendError(res, status, status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'invalid', (error as Error).message);
      return;
    }
    next(error);
  }
});

/** @deprecated Use /accounts/:userId/status */
adminRouter.post('/accounts/:userId/active', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const active = (req.body as { active?: unknown } | undefined)?.active;
    if (!userId || typeof active !== 'boolean') {
      sendError(res, 400, 'invalid', 'active must be true or false');
      return;
    }
    const user = await applyAccountStatus({
      admin,
      userId,
      status: active ? ACCOUNT_STATUS.active : ACCOUNT_STATUS.suspended,
      reason: active ? 'Restored from the admin dashboard' : 'Suspended from the admin dashboard',
    });
    res.json({ user });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 400 || status === 403 || status === 404) {
      sendError(res, status, status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'invalid', (error as Error).message);
      return;
    }
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
      const profile = normalizeMentorProfile({ ...(doc.data() as MentorProfile), userId: doc.id });
      const userSnap = await adminDb().collection(COLLECTIONS.users).doc(profile.userId).get();
      const user = userSnap.data() as User | undefined;
      if (!user || !isAccountActive(user)) continue;
      rows.push({ user: { ...user, accountStatus: accountStatusOf(user) }, profile });
    }
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/mentors/verification', async (_req, res, next) => {
  try {
    const snaps = await adminDb().collection(COLLECTIONS.mentorProfiles).get();
    const rows: PendingMentorRow[] = [];
    for (const doc of snaps.docs) {
      const profile = normalizeMentorProfile({ ...(doc.data() as MentorProfile), userId: doc.id });
      const caseStatus = deriveVerificationCase(profile.verifiedClaims, profile.verificationCaseStatus);
      if (!isPendingVerificationCase(caseStatus)) continue;
      const userSnap = await adminDb().collection(COLLECTIONS.users).doc(profile.userId).get();
      const user = userSnap.data() as User | undefined;
      if (!user || !isAccountActive(user)) continue;
      rows.push({
        user: { ...user, accountStatus: accountStatusOf(user) },
        profile: { ...profile, verificationCaseStatus: caseStatus },
      });
    }
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/mentors/:userId/verification', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const status = (req.body as { status?: VerificationStatus } | undefined)?.status;
    const reason = (req.body as { reason?: string } | undefined)?.reason;
    if (!userId || !status || !isVerificationStatus(status) || status === VERIFICATION_STATUS.pending) {
      sendError(res, 400, 'invalid_decision', 'status must be approved, rejected, or suspended');
      return;
    }
    const profile = await applyMentorApproval({ admin, userId, status, reason });
    res.json({ profile });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 400 || status === 403 || status === 404) {
      sendError(res, status, status === 404 ? 'not_found' : 'invalid', (error as Error).message);
      return;
    }
    next(error);
  }
});

adminRouter.post('/mentors/:userId/verify', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const verified = (req.body as { verified?: boolean } | undefined)?.verified !== false;
    const reason = (req.body as { reason?: string } | undefined)?.reason;
    const profile = await applyMentorVerification({ admin, userId, verified, reason });
    res.json({ profile });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 400 || status === 404) {
      sendError(res, status, status === 404 ? 'not_found' : 'invalid', (error as Error).message);
      return;
    }
    next(error);
  }
});

adminRouter.post('/mentors/:userId/verification-case', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const status = (req.body as { status?: string } | undefined)?.status;
    if (status !== VERIFICATION_CASE_STATUS.underReview && status !== VERIFICATION_CASE_STATUS.submitted) {
      sendError(res, 400, 'invalid', 'status must be submitted or under_review');
      return;
    }
    const profile = await applyVerificationCase({
      admin,
      userId,
      status,
      reason: (req.body as { reason?: string } | undefined)?.reason,
    });
    res.json({ profile });
  } catch (error) {
    const code = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (code === 404) {
      sendError(res, 404, 'not_found', (error as Error).message);
      return;
    }
    next(error);
  }
});

adminRouter.post('/mentors/:userId/claims', async (req: AdminRequest, res, next) => {
  try {
    const admin = adminOf(req);
    if (!admin) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    const userId = String(req.params.userId ?? '');
    const type = (req.body as { type?: string } | undefined)?.type;
    const verified = (req.body as { verified?: boolean } | undefined)?.verified === true;
    const allowed = new Set(Object.values(VERIFIED_CLAIM_TYPE));
    if (!userId || !type || !allowed.has(type as never)) {
      sendError(res, 400, 'invalid', 'type must be identity, education, or professional_experience');
      return;
    }

    const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      sendError(res, 404, 'not_found', 'Mentor profile not found');
      return;
    }
    const profile = normalizeMentorProfile({ ...(snap.data() as MentorProfile), userId });
    const nextClaims = profile.verifiedClaims.filter((item) => item.type !== type);
    nextClaims.push({
      type: type as MentorProfile['verifiedClaims'][number]['type'],
      verified,
      verifiedAt: verified ? new Date().toISOString() : null,
    });
    const verificationCaseStatus = deriveVerificationCase(nextClaims, profile.verificationCaseStatus);
    await ref.update({ verifiedClaims: nextClaims, verificationCaseStatus });
    await writePublicProfile(userId, USER_ROLE.mentor);
    await recordAudit({
      actorId: admin.uid,
      adminId: admin.uid,
      action: verified ? AUDIT_EVENT.mentorVerified : AUDIT_EVENT.verificationRemoved,
      targetUserId: userId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : null,
      metadata: { type, verified: String(verified) },
    });
    res.json({ profile: { ...profile, verifiedClaims: nextClaims, verificationCaseStatus } });
  } catch (error) {
    next(error);
  }
});
