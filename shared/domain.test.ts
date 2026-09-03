import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPLICATION_STATUS,
  CANONICAL_LEARNER_ID_FIELD,
  COLLECTIONS,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  PUBLIC_LEARNER_LABEL,
  RELATIONSHIP_STATUS,
  RESERVED_COLLECTIONS,
  USER_ROLE,
  ACCOUNT_STATUS,
  ADMIN_ACTION,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_STATUS,
  buildActiveRelationship,
  canAcceptApplication,
  canApplyForMentorship,
  canEndRelationship,
  canPauseRelationship,
  canReadEvidenceObject,
  canResumeRelationship,
  canSendMessage,
  canStartLearningJourney,
  canWriteEvidenceObject,
  buildAuditLog,
  canTransitionApplication,
  canTransitionContract,
  canTransitionMilestone,
  canTransitionRelationship,
  canTransitionVerification,
  validateAdminReason,
  evidenceStoragePath,
  isAccountActive,
  isLearnerRole,
  isOpenRelationship,
  normalizeRelationship,
  pairingIdFieldForRole,
  relationshipDocId,
  MENTOR_CONTRIBUTION,
  APPROVAL_DISCLAIMER,
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABEL,
  VERIFIED_CLAIM_TYPE,
  buildPublicLearnerProfile,
  buildPublicMentorProfile,
  canListPublicMentor,
  canChangeAccountStatus,
  canChangeOwnRole,
  canGovernAccounts,
  canParticipate,
  canReadPrivateProfile,
  canSelfApprove,
  deriveVerificationCase,
  emptyLearnerProfile,
  emptyMentorProfile,
  LEARNER_JOURNEY,
  lifecycleProfileFrom,
  learnerDashboardModel,
  learnerJourneyStage,
  mentorDashboardModel,
  mentorJourneyStage,
  MENTOR_JOURNEY,
  normalizeContract,
  isPublicPhotoPath,
  looksLikeFirebaseUid,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  commercialModeAllowedForMentorType,
  centsToDisplayDollars,
  formatMentorPriceDisplay,
  formatUsdCents,
  mentorPrimaryActionLabel,
  parseUsdToCents,
  readSessionPriceCents,
  normalizeLearnerProfile,
  normalizeMentorProfile,
  ownPublicProfilePath,
  profilePhotoStoragePath,
  publicProfileOmitsPrivateFields,
  publicProfilePath,
  suggestSlug,
  toStoredPublicProfile,
  validateMentorOffering,
  validateProfileSlug,
  canConfirmCompletion,
  completionRequirements,
  showcaseFromDeliverableRef,
  validateApplicationMessage,
  validateEvidenceDrafts,
  validateEvidenceSubmission,
  parsePasswordResetAction,
  validateNewPassword,
  validatePasswordResetEmail,
  EMPTY_MENTOR_DISCOVERY_FILTERS,
  filterListedMentors,
  hasActiveDiscoveryFilters,
  mentorDiscoveryExpertiseLabel,
  REQUEST_TYPE,
  applicationCommercialFieldsFromSnapshot,
  buildMentorshipCommercialSnapshot,
  buildMentorshipCommercialSnapshotFromProfile,
  canAccessPaidMentorshipServices,
  normalizeApplicationCommercialFields,
  paidMentorshipServicesBlocked,
  relationshipCommercialFromApplication,
  requestTypeFromCommercialMode,
  validateMentorApplicationTarget,
} from './domain/index.js';

describe('domain identities', () => {
  it('keeps learner as the persisted role and field', () => {
    assert.equal(USER_ROLE.learner, 'learner');
    assert.equal(CANONICAL_LEARNER_ID_FIELD, 'learnerId');
    assert.equal(pairingIdFieldForRole(USER_ROLE.mentor), 'mentorId');
    assert.equal(pairingIdFieldForRole(USER_ROLE.learner), 'learnerId');
    assert.equal(isLearnerRole(USER_ROLE.learner), true);
    assert.equal(PUBLIC_LEARNER_LABEL, 'Apprentice/Learner');
  });

  it('does not rename live Firestore collections', () => {
    assert.equal(COLLECTIONS.applications, 'mentorshipApplications');
    assert.equal(COLLECTIONS.relationships, 'mentorshipRelationships');
    assert.equal(COLLECTIONS.contracts, 'learningContracts');
    assert.equal(COLLECTIONS.showcases, 'showcases');
    assert.equal(COLLECTIONS.publicProfiles, 'publicProfiles');
    assert.equal(COLLECTIONS.profileSlugs, 'profileSlugs');
    assert.equal(COLLECTIONS.auditLogs, 'adminAuditLogs');
    assert.equal(COLLECTIONS.supportIssues, 'supportIssues');
    assert.equal(COLLECTIONS.bookings, 'mentorshipBookings');
    assert.equal(COLLECTIONS.operatorAdmins, 'admins');
    assert.equal(RESERVED_COLLECTIONS.legacyMentorships, 'mentorships');
    assert.equal(RESERVED_COLLECTIONS.notifications, 'notifications');
    assert.equal(RESERVED_COLLECTIONS.adminAuditLogs, 'adminAuditLogs');
  });
});

describe('domain transitions', () => {
  it('allows only the documented application and relationship moves', () => {
    assert.equal(
      canTransitionApplication(APPLICATION_STATUS.pending, APPLICATION_STATUS.accepted),
      true,
    );
    assert.equal(
      canTransitionApplication(APPLICATION_STATUS.accepted, APPLICATION_STATUS.declined),
      false,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.active, RELATIONSHIP_STATUS.ended),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.active, RELATIONSHIP_STATUS.paused),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.paused, RELATIONSHIP_STATUS.active),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.ended, RELATIONSHIP_STATUS.active),
      false,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.terminated, RELATIONSHIP_STATUS.active),
      false,
    );
  });

  it('documents the Learning Goal Builder path and forbids skipping mutual approval', () => {
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.draft,
        LEARNING_CONTRACT_STATUS.submittedByLearner,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.underLearnerReview,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      false,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.proposedByMentor,
        LEARNING_CONTRACT_STATUS.mutuallyApproved,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.mutuallyApproved,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(LEARNING_CONTRACT_STATUS.agreed, LEARNING_CONTRACT_STATUS.inProgress),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.completed,
      ),
      false,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.paused,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.completionPending,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.paused,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.completionPending,
        LEARNING_CONTRACT_STATUS.completed,
      ),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.rejected, MILESTONE_STATUS.submitted),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.submitted, MILESTONE_STATUS.underReview),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.approved, MILESTONE_STATUS.submitted),
      false,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.declined, MILESTONE_STATUS.active),
      false,
    );
  });
});

describe('domain permissions and validation', () => {
  const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true };
  const mentor = { uid: 'mentor-1', role: USER_ROLE.mentor, active: true };
  const approvedMentor = {
    userId: 'mentor-1',
    verificationStatus: VERIFICATION_STATUS.approved,
    public: true,
    acceptsNewLearners: true,
  };

  it('lets a learner apply to an approved mentor with a message', () => {
    assert.equal(canApplyForMentorship(learner, approvedMentor, 'I want to learn joinery'), true);
    assert.equal(canApplyForMentorship(mentor, approvedMentor, 'I want to learn joinery'), false);
    assert.equal(
      canApplyForMentorship(learner, { ...approvedMentor, verificationStatus: VERIFICATION_STATUS.pending }, 'Hi'),
      false,
    );
    assert.equal(
      canApplyForMentorship(learner, { ...approvedMentor, public: false }, 'Hi'),
      false,
    );
    assert.equal(
      canApplyForMentorship(learner, { ...approvedMentor, acceptsNewLearners: false }, 'Hi'),
      false,
    );
  });

  it('lets only the assigned mentor accept a pending application', () => {
    assert.equal(
      canAcceptApplication(mentor, { mentorId: 'mentor-1', status: APPLICATION_STATUS.pending }),
      true,
    );
    assert.equal(
      canAcceptApplication(learner, { mentorId: 'mentor-1', status: APPLICATION_STATUS.pending }),
      false,
    );
  });

  it('blocks restricted accounts from messaging and resuming, not from pausing', () => {
    const relationship = {
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const restricted = {
      uid: 'learner-1',
      role: USER_ROLE.learner,
      active: true,
      accountStatus: ACCOUNT_STATUS.restricted,
    };
    assert.equal(canSendMessage(restricted, relationship, 'Hello there'), false);
    assert.equal(canPauseRelationship(restricted, relationship), true);
    assert.equal(
      canResumeRelationship(restricted, { ...relationship, status: RELATIONSHIP_STATUS.paused }),
      false,
    );
    assert.equal(canStartLearningJourney(restricted, relationship), false);
  });

  it('lets only the learner start a journey on an active relationship', () => {
    const relationship = {
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    assert.equal(canStartLearningJourney(learner, relationship), true);
    assert.equal(canStartLearningJourney(mentor, relationship), false);
  });

  it('validates application and evidence the same way the product already does', () => {
    assert.equal(validateApplicationMessage('').ok, false);
    assert.equal(validateApplicationMessage('Hello').ok, true);
    assert.equal(validateEvidenceSubmission({ text: '', link: '' }).ok, false);
    assert.equal(validateEvidenceSubmission({ text: 'Photo of the joint', link: '' }).ok, true);
  });

  it('still treats a missing active flag as an active account', () => {
    assert.equal(isAccountActive({ active: true }), true);
    assert.equal(isAccountActive({} as { active: boolean }), true);
    assert.equal(isAccountActive({ active: false }), false);
  });

  it('keeps evidence files private to the pairing and the owning learner', () => {
    const contract = { learnerId: 'learner-1', mentorId: 'mentor-1' };
    const stranger = { uid: 'other', role: USER_ROLE.learner, active: true };
    assert.equal(canReadEvidenceObject(learner, contract), true);
    assert.equal(canReadEvidenceObject(mentor, contract), true);
    assert.equal(canReadEvidenceObject(stranger, contract), false);
    assert.equal(canWriteEvidenceObject(learner, contract, 'learner-1'), true);
    assert.equal(canWriteEvidenceObject(mentor, contract, 'learner-1'), false);
    assert.equal(canWriteEvidenceObject(learner, contract, 'other'), false);

    const owned = evidenceStoragePath({
      contractId: 'c-1',
      milestoneId: 'm-1',
      userId: 'learner-1',
      fileId: 'shot.jpg',
    });
    assert.equal(
      validateEvidenceDrafts(
        [{ type: 'file', content: 'shot.jpg', storagePath: owned }],
        { contractId: 'c-1', milestoneId: 'm-1', userId: 'learner-1' },
      ).ok,
      true,
    );
    assert.equal(
      validateEvidenceDrafts(
        [{ type: 'file', content: 'shot.jpg', storagePath: `portfolios/learner-1/shot.jpg` }],
        { contractId: 'c-1', milestoneId: 'm-1', userId: 'learner-1' },
      ).ok,
      false,
    );
  });
});

describe('showcase projection', () => {
  it('derives showcase items from profile deliverable refs', () => {
    const item = showcaseFromDeliverableRef({
      id: 'del-1',
      contractId: 'c-1',
      title: 'A sawhorse',
      description: 'Square and load-bearing',
    });
    assert.equal(item.source, 'profile_deliverable_ref');
    assert.equal(item.contractId, 'c-1');
    assert.equal(item.title, 'A sawhorse');
  });

  it('blocks completion until milestones, final deliverable, and mentor review are done', () => {
    const empty = {
      milestones: [{ status: 'approved' }, { status: 'locked' }],
      finalDeliverable: {
        title: '',
        description: '',
        files: [],
        links: [],
        evidenceItemIds: [],
        skillsDemonstrated: [],
        submittedAt: null,
        submittedBy: null,
        reviewStatus: 'not_submitted' as const,
        reviewComment: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    };
    assert.equal(completionRequirements(empty).milestonesApproved, false);
    assert.equal(canConfirmCompletion(empty), false);

    const ready = {
      milestones: [{ status: 'approved' }, { status: 'approved' }],
      finalDeliverable: {
        ...empty.finalDeliverable,
        title: 'A sawhorse',
        description: 'Done',
        links: ['https://example.com'],
        reviewStatus: 'reviewed' as const,
      },
    };
    assert.equal(canConfirmCompletion(ready), true);
    assert.match(MENTOR_CONTRIBUTION, /learner remains the creator/i);
  });
});

describe('mentorship relationship engine', () => {
  it('uses a deterministic id so accept retries hit the same document', () => {
    assert.equal(relationshipDocId('learner-1', 'mentor-1'), 'learner-1_mentor-1');
  });

  it('fills missing fields on older relationship documents', () => {
    const normalized = normalizeRelationship({
      id: 'rel-old',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(normalized.applicationId, null);
    assert.equal(normalized.startedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(normalized.endedAt, null);
    assert.equal(isOpenRelationship(normalized), true);
  });

  it('builds a complete active relationship from an accepted application', () => {
    const relationship = buildActiveRelationship({
      id: relationshipDocId('learner-1', 'mentor-1'),
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      applicationId: 'app-1',
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(relationship.status, RELATIONSHIP_STATUS.active);
    assert.equal(relationship.applicationId, 'app-1');
    assert.equal(relationship.startedAt, relationship.createdAt);
    assert.equal(relationship.endedAt, null);
  });

  it('lets either pairing member pause or end an active relationship', () => {
    const relationship = buildActiveRelationship({
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      applicationId: 'app-1',
      now: '2026-09-01T00:00:00.000Z',
    });
    const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true };
    const stranger = { uid: 'other', role: USER_ROLE.learner, active: true };
    assert.equal(canPauseRelationship(learner, relationship), true);
    assert.equal(canEndRelationship(learner, relationship), true);
    assert.equal(canPauseRelationship(stranger, relationship), false);
  });
});

describe('public profile system', () => {
  it('assigns safe slugs and rejects reserved or uid-like public URLs', () => {
    assert.equal(suggestSlug('Ada Lovelace'), 'ada-lovelace');
    assert.equal(validateProfileSlug('ada-lovelace').ok, true);
    assert.equal(validateProfileSlug('admin').ok, false);
    assert.equal(validateProfileSlug('login').ok, false);
    assert.equal(validateProfileSlug('forgot-password').ok, false);
    assert.equal(validateProfileSlug('reset-password').ok, false);
    assert.equal(validateProfileSlug('Ada Lovelace').ok, true);
    assert.equal(looksLikeFirebaseUid('dWy0NfpQvdkBcN8TGGaygsuohKO5'), true);
    assert.equal(looksLikeFirebaseUid('ada-lovelace'), false);
    assert.equal(validateProfileSlug('dWy0NfpQvdkBcN8TGGaygsuohKO5').ok, false);
    assert.equal(publicProfilePath(USER_ROLE.learner, 'ada-lovelace'), '/learners/ada-lovelace');
    assert.equal(ownPublicProfilePath(USER_ROLE.mentor, null), '/mentors/me');
    assert.equal(profilePhotoStoragePath('ada-lovelace', 'photo.jpg').includes('dWy0NfpQvdkBcN8TGGaygsuohKO5'), false);
    assert.equal(isPublicPhotoPath('profile-photos/ada-lovelace/1.jpg', 'ada-lovelace'), true);
    assert.equal(isPublicPhotoPath('profile-photos/dWy0NfpQvdkBcN8TGGaygsuohKO5/1.jpg', 'ada-lovelace'), false);
  });

  it('projects a learner profile without private fields or a hidden location', () => {
    const profile = normalizeLearnerProfile({
      ...emptyLearnerProfile('learner-1', 'Ada'),
      slug: 'ada',
      location: 'Detroit',
      locationPublic: false,
      jobStatus: 'Apprentice joiner',
      skillsDeveloping: ['Joinery'],
    });
    const publicProfile = buildPublicLearnerProfile({
      profile,
      portfolio: [
        {
          id: 'c1',
          title: 'A sawhorse',
          description: 'Done',
          skillsDemonstrated: ['Layout'],
          links: [],
          publicEvidence: [],
          completedAt: '2026-09-01T00:00:00.000Z',
          learnerDisplayName: 'Ada',
          mentorDisplayName: 'Ben',
          mentorContribution: 'Mentored this work. The learner remains the creator.',
        },
      ],
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(publicProfile.location, null);
    assert.equal(publicProfile.careerStatus, 'Apprentice joiner');
    assert.ok(publicProfile.skillsDemonstrated.includes('Layout'));
    assert.deepEqual(publicProfileOmitsPrivateFields(publicProfile as unknown as Record<string, unknown>), []);
    assert.equal('userId' in publicProfile, false);
    assert.equal('email' in publicProfile, false);
    assert.equal(publicProfile.portfolio.length, 1);
    const stored = toStoredPublicProfile({
      ...publicProfile,
      userId: 'learner-1',
      email: 'ada@example.com',
    } as unknown as typeof publicProfile);
    assert.equal('userId' in stored, false);
    assert.equal('email' in stored, false);

    const withUidPhoto = buildPublicLearnerProfile({
      profile: { ...profile, photoPath: 'profile-photos/learner-1/headshot.jpg' },
      portfolio: [],
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(withUidPhoto.photoPath, null);
  });

  it('lists approved mentors only and does not treat approval as a background check', () => {
    const pending = emptyMentorProfile('mentor-1', 'Ben');
    pending.slug = 'ben';
    pending.verificationStatus = APPROVAL_STATUS.pending;
    const pendingPublic = buildPublicMentorProfile({
      profile: pending,
      mentoredDeliverables: [],
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(pendingPublic.published, false);
    assert.equal(canListPublicMentor(pendingPublic), false);
    assert.equal(APPROVAL_STATUS_LABEL[APPROVAL_STATUS.approved], 'Approved');
    assert.match(APPROVAL_DISCLAIMER, /not a comprehensive background check/i);

    const approved = {
      ...pending,
      public: true,
      verificationStatus: APPROVAL_STATUS.approved,
      verifiedClaims: [
        { type: VERIFIED_CLAIM_TYPE.identity, verified: true, verifiedAt: '2026-09-01T00:00:00.000Z' },
        { type: VERIFIED_CLAIM_TYPE.education, verified: false, verifiedAt: null },
      ],
    };
    const listed = buildPublicMentorProfile({
      profile: approved,
      mentoredDeliverables: [],
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(canListPublicMentor(listed), true);
    assert.equal(listed.verifiedClaims.length, 1);
    assert.equal(listed.verifiedClaims[0]?.type, VERIFIED_CLAIM_TYPE.identity);
    assert.notEqual(APPROVAL_STATUS_LABEL[APPROVAL_STATUS.approved], 'Verified');
  });

  it('projects mentor offering fields without private verification metadata', () => {
    const profile = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Ben'),
      slug: 'ben',
      public: true,
      verificationStatus: APPROVAL_STATUS.approved,
      mentorType: MENTOR_TYPE.competencyCoach,
      commercialMode: COMMERCIAL_MODE.professional,
      serviceDescription: 'Weekly shop coaching',
      baseSessionPriceUsd: 7500,
      sessionDurationMinutes: 60,
      offersVideoSessions: true,
      includedMessaging: true,
      acceptsNewLearners: true,
    });
    const publicProfile = buildPublicMentorProfile({
      profile,
      mentoredDeliverables: [],
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(publicProfile.mentorType, MENTOR_TYPE.competencyCoach);
    assert.equal(publicProfile.commercialMode, COMMERCIAL_MODE.professional);
    assert.equal(publicProfile.baseSessionPriceUsd, 7500);
    assert.equal(publicProfile.acceptsNewLearners, true);
    assert.equal('verificationStatus' in publicProfile, false);
    assert.equal('verificationCaseStatus' in publicProfile, false);
  });

  it('keeps approval separate from verification and blocks self-governance', () => {
    assert.equal(APPROVAL_STATUS_LABEL[VERIFICATION_STATUS.approved], 'Approved');
    assert.notEqual(APPROVAL_STATUS_LABEL[VERIFICATION_STATUS.approved], 'Verified');
    assert.equal(VERIFICATION_CASE_STATUS.verified, 'verified');
    assert.equal(
      deriveVerificationCase([]),
      VERIFICATION_CASE_STATUS.notSubmitted,
    );
    assert.equal(
      deriveVerificationCase([
        { type: VERIFIED_CLAIM_TYPE.identity, verified: true, verifiedAt: '2026-09-01T00:00:00.000Z' },
      ]),
      VERIFICATION_CASE_STATUS.partiallyVerified,
    );
    const admin = { uid: 'admin-1', role: USER_ROLE.admin, active: true, accountStatus: ACCOUNT_STATUS.active };
    const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true, accountStatus: ACCOUNT_STATUS.active };
    const restricted = { ...learner, accountStatus: ACCOUNT_STATUS.restricted as const };
    assert.equal(canGovernAccounts(admin), true);
    assert.equal(canGovernAccounts(learner), false);
    assert.equal(canChangeOwnRole(learner), false);
    assert.equal(canSelfApprove(learner), false);
    assert.equal(canParticipate(restricted), false);
    assert.equal(isAccountActive(restricted), true);
    assert.equal(
      canChangeAccountStatus(admin, learner, ACCOUNT_STATUS.suspended),
      true,
    );
    assert.equal(
      canChangeAccountStatus(learner, admin, ACCOUNT_STATUS.suspended),
      false,
    );
    assert.equal(canChangeAccountStatus(admin, admin, ACCOUNT_STATUS.suspended), false);
    assert.equal(ADMIN_ACTION.approveMentor, 'APPROVE_MENTOR');
  });

  it('refuses ordinary users every administrative privilege', () => {
    const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true, accountStatus: ACCOUNT_STATUS.active };
    const mentor = { uid: 'mentor-1', role: USER_ROLE.mentor, active: true, accountStatus: ACCOUNT_STATUS.active };
    const admin = { uid: 'admin-1', role: USER_ROLE.admin, active: true, accountStatus: ACCOUNT_STATUS.active };
    const restrictedAdmin = { ...admin, accountStatus: ACCOUNT_STATUS.restricted as const };
    const terminated = { ...learner, accountStatus: ACCOUNT_STATUS.terminated as const, active: false };

    assert.equal(canGovernAccounts(learner), false);
    assert.equal(canGovernAccounts(mentor), false);
    assert.equal(canGovernAccounts(restrictedAdmin), false);
    assert.equal(canChangeOwnRole(learner), false);
    assert.equal(canChangeOwnRole(mentor), false);
    assert.equal(canChangeOwnRole(admin), false);
    assert.equal(canSelfApprove(mentor), false);
    assert.equal(canSelfApprove(admin), false);
    assert.equal(canChangeAccountStatus(learner, mentor, ACCOUNT_STATUS.suspended), false);
    assert.equal(canChangeAccountStatus(mentor, learner, ACCOUNT_STATUS.restricted), false);
    assert.equal(canChangeAccountStatus(learner, learner, ACCOUNT_STATUS.terminated), false);
    assert.equal(canChangeAccountStatus(admin, { ...admin, uid: 'admin-2' }, ACCOUNT_STATUS.suspended), false);
    assert.equal(canChangeAccountStatus(admin, terminated, ACCOUNT_STATUS.active), false);
    assert.equal(canTransitionVerification(VERIFICATION_STATUS.pending, VERIFICATION_STATUS.suspended), true);
    assert.equal(canTransitionVerification(VERIFICATION_STATUS.approved, VERIFICATION_STATUS.pending), false);

    const reason = validateAdminReason('', true);
    assert.equal(reason.ok, false);
    const optional = validateAdminReason('', false);
    assert.equal(optional.ok, true);

    const log = buildAuditLog({
      id: 'log-1',
      actorId: 'admin-1',
      action: ADMIN_ACTION.approveMentor,
      targetUserId: 'mentor-1',
      reason: 'Looks complete',
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(log.adminId, 'admin-1');
    assert.equal(log.action, 'APPROVE_MENTOR');
    assert.equal(log.targetUserId, 'mentor-1');
    assert.equal(log.reason, 'Looks complete');
    assert.equal(log.timestamp, '2026-09-01T00:00:00.000Z');
  });

  it('keeps private profiles to the owner, pairing, or admin', () => {
    const pairing = { learnerId: 'learner-1', mentorId: 'mentor-1' };
    const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true };
    const mentor = { uid: 'mentor-1', role: USER_ROLE.mentor, active: true };
    const visitor = { uid: 'visitor', role: USER_ROLE.learner, active: true };
    const admin = { uid: 'admin-1', role: USER_ROLE.admin, active: true };
    assert.equal(canReadPrivateProfile(learner, 'learner-1'), true);
    assert.equal(canReadPrivateProfile(mentor, 'learner-1', pairing), true);
    assert.equal(canReadPrivateProfile(visitor, 'learner-1', pairing), false);
    assert.equal(canReadPrivateProfile(admin, 'learner-1'), true);
    assert.equal(canReadPrivateProfile(null, 'learner-1'), false);
  });
});

describe('lifecycle dashboards', () => {
  const now = '2026-09-01T12:00:00.000Z';

  function draftContract() {
    return normalizeContract({
      id: 'c1',
      relationshipId: 'r1',
      learnerId: 'l1',
      mentorId: 'm1',
      status: LEARNING_CONTRACT_STATUS.draft,
      currentStepOwner: 'learner',
      createdAt: now,
      updatedAt: now,
      goal: null,
      goalHistory: [],
      objectives: [],
      milestones: [],
      deliverable: null,
      changeRequestReason: null,
      context: null,
      mentorComment: null,
      revisionHistory: [],
      evidenceItems: [],
      showcaseId: null,
      showcasePublished: false,
    });
  }

  function relationship(status: (typeof RELATIONSHIP_STATUS)[keyof typeof RELATIONSHIP_STATUS] = RELATIONSHIP_STATUS.active) {
    return {
      ...buildActiveRelationship({
        id: 'r1',
        learnerId: 'l1',
        mentorId: 'm1',
        applicationId: 'a1',
        now,
      }),
      status,
    };
  }

  it('names the learner and mentor journeys', () => {
    assert.deepEqual(
      LEARNER_JOURNEY.map((step) => step.label),
      ['Discover', 'Connect', 'Agree', 'Learn', 'Build', 'Prove', 'Showcase'],
    );
    assert.deepEqual(
      MENTOR_JOURNEY.map((step) => step.label),
      ['Be discovered', 'Connect', 'Guide', 'Review', 'Validate', 'Build legacy'],
    );
  });

  it('keeps an empty learner on Discover with onboarding actions', () => {
    const profile = lifecycleProfileFrom(
      { displayName: 'Ada', accountStatus: ACCOUNT_STATUS.active, profileSlug: null },
      emptyLearnerProfile('l1', 'Ada'),
    );
    const model = learnerDashboardModel({
      profile,
      applications: [],
      relationships: [],
      contracts: [],
    });
    assert.equal(model.stage, 'discover');
    assert.equal(model.hasActivity, false);
    assert.equal(model.next.title, 'Complete your profile');
    assert.equal(model.onboarding[1]?.title, 'Browse Mentors');
    assert.match(model.onboarding[2]?.title ?? '', /ambition/i);
  });

  it('moves the learner from Connect through Showcase', () => {
    const pending = [
      {
        id: 'a1',
        learnerId: 'l1',
        mentorId: 'm1',
        message: 'I want to learn framing',
        status: APPLICATION_STATUS.pending,
        createdAt: now,
      },
    ];
    assert.equal(
      learnerJourneyStage({ applications: pending, relationships: [], contracts: [] }),
      'connect',
    );
    assert.equal(
      learnerJourneyStage({
        applications: [],
        relationships: [relationship()],
        contracts: [draftContract()],
      }),
      'agree',
    );

    const learning = normalizeContract({
      ...draftContract(),
      status: LEARNING_CONTRACT_STATUS.inProgress,
      milestones: [
        {
          id: 'ms-1',
          order: 1,
          title: 'Stock prep',
          description: 'Mill the stock',
          evidenceRequired: 'Photo',
          successCriteria: 'Photo',
          status: MILESTONE_STATUS.active,
          evidenceText: '',
          evidenceLink: '',
          lastFeedback: null,
        },
      ],
    });
    assert.equal(
      learnerJourneyStage({ applications: [], relationships: [relationship()], contracts: [learning] }),
      'learn',
    );

    const building = normalizeContract({
      ...learning,
      milestones: [
        { ...learning.milestones[0], status: MILESTONE_STATUS.approved },
        {
          ...learning.milestones[0],
          id: 'ms-2',
          order: 2,
          title: 'Assembly',
          status: MILESTONE_STATUS.active,
        },
      ],
    });
    assert.equal(
      learnerJourneyStage({ applications: [], relationships: [relationship()], contracts: [building] }),
      'build',
    );

    const proving = normalizeContract({
      ...building,
      status: LEARNING_CONTRACT_STATUS.completionPending,
    });
    assert.equal(
      learnerJourneyStage({ applications: [], relationships: [relationship()], contracts: [proving] }),
      'prove',
    );

    const done = normalizeContract({
      ...building,
      status: LEARNING_CONTRACT_STATUS.completed,
    });
    assert.equal(
      learnerJourneyStage({ applications: [], relationships: [], contracts: [done] }),
      'showcase',
    );
  });

  it('answers the five learner dashboard questions from a live contract', () => {
    const profile = lifecycleProfileFrom(
      { displayName: 'Ada', accountStatus: ACCOUNT_STATUS.active, profileSlug: 'ada' },
      { ...emptyLearnerProfile('l1', 'Ada'), professionalIdentity: 'Apprentice', careerAspirations: 'Frame houses', public: true, slug: 'ada' },
    );
    const contract = normalizeContract({
      ...draftContract(),
      status: LEARNING_CONTRACT_STATUS.inProgress,
      currentStepOwner: 'learner',
      milestones: [
        {
          id: 'ms-1',
          order: 1,
          title: 'Stock prep',
          description: 'Mill the stock',
          evidenceRequired: 'Photo',
          successCriteria: 'Photo',
          status: MILESTONE_STATUS.active,
          evidenceText: '',
          evidenceLink: '',
          lastFeedback: null,
        },
      ],
    });
    const model = learnerDashboardModel({
      profile,
      applications: [],
      relationships: [relationship()],
      contracts: [contract],
    });
    assert.equal(model.stage, 'learn');
    assert.match(model.next.title, /Stock prep/);
    assert.match(model.waitingFor, /You/);
    assert.match(model.milestoneNeedingAttention, /Stock prep/);
    assert.ok(model.achievements.some((item) => /Public profile/.test(item)));
  });

  it('keeps an empty mentor on Be discovered with onboarding actions', () => {
    const profile = lifecycleProfileFrom(
      { displayName: 'Mo', accountStatus: ACCOUNT_STATUS.active, profileSlug: null },
      emptyMentorProfile('m1', 'Mo'),
    );
    const model = mentorDashboardModel({
      profile,
      applications: [],
      relationships: [],
      contracts: [],
    });
    assert.equal(model.stage, 'be_discovered');
    assert.equal(model.hasActivity, false);
    assert.equal(model.next.title, 'Complete your professional profile');
    assert.equal(model.onboarding[1]?.title, 'Set availability');
    assert.equal(model.onboarding[2]?.title, 'Prepare your mentoring profile');
    assert.equal(model.pendingApplications, 0);
  });

  it('queues mentor applications, reviews, evidence, and outcomes', () => {
    const profile = lifecycleProfileFrom(
      { displayName: 'Mo', accountStatus: ACCOUNT_STATUS.active, profileSlug: 'mo' },
      {
        ...emptyMentorProfile('m1', 'Mo'),
        professionalIdentity: 'Framer',
        mentoringInterests: 'Joinery',
        slug: 'mo',
        public: true,
      },
    );
    const pending = [
      {
        id: 'a1',
        learnerId: 'l1',
        mentorId: 'm1',
        message: 'Please take me on',
        status: APPLICATION_STATUS.pending,
        createdAt: now,
      },
    ];
    const submitted = normalizeContract({
      ...draftContract(),
      status: LEARNING_CONTRACT_STATUS.inProgress,
      milestones: [
        {
          id: 'ms-1',
          order: 1,
          title: 'Stock prep',
          description: 'Mill the stock',
          evidenceRequired: 'Photo',
          successCriteria: 'Photo',
          status: MILESTONE_STATUS.submitted,
          evidenceText: 'Done',
          evidenceLink: '',
          lastFeedback: null,
        },
      ],
    });
    const model = mentorDashboardModel({
      profile,
      applications: pending,
      relationships: [relationship()],
      contracts: [submitted],
    });
    assert.equal(model.stage, 'validate');
    assert.equal(model.pendingApplications, 1);
    assert.equal(model.evidenceAwaitingReview, 1);
    assert.equal(model.learnersNeedingAttention, 1);
    assert.equal(model.next.href, '/dashboard/applications');
    assert.ok(model.queue.some((item) => item.kind === 'application'));
    assert.ok(model.queue.some((item) => item.kind === 'evidence'));

    const reviewing = mentorDashboardModel({
      profile,
      applications: [],
      relationships: [relationship()],
      contracts: [
        normalizeContract({
          ...draftContract(),
          status: LEARNING_CONTRACT_STATUS.underMentorReview,
        }),
      ],
    });
    assert.equal(reviewing.stage, 'review');
    assert.equal(reviewing.contractsAwaitingReview, 1);

    const legacy = mentorJourneyStage({
      applications: [],
      relationships: [],
      contracts: [normalizeContract({ ...draftContract(), status: LEARNING_CONTRACT_STATUS.completed })],
    });
    assert.equal(legacy, 'build_legacy');
  });
});

describe('mentor offering', () => {
  it('allows premium only for accomplished mentors', () => {
    assert.equal(
      commercialModeAllowedForMentorType(MENTOR_TYPE.accomplished, COMMERCIAL_MODE.premium),
      true,
    );
    assert.equal(
      commercialModeAllowedForMentorType(MENTOR_TYPE.competencyCoach, COMMERCIAL_MODE.premium),
      false,
    );
    assert.equal(
      commercialModeAllowedForMentorType(MENTOR_TYPE.learningGuide, COMMERCIAL_MODE.premium),
      false,
    );
  });

  it('defaults legacy mentor documents to accomplished + giving back', () => {
    const profile = normalizeMentorProfile(emptyMentorProfile('mentor-1', 'Ben'));
    assert.equal(profile.mentorType, MENTOR_TYPE.accomplished);
    assert.equal(profile.commercialMode, COMMERCIAL_MODE.givingBack);
    assert.equal(profile.baseSessionPriceUsd, null);
    assert.equal(profile.includedMessaging, true);
  });

  it('validates paid modes and rejects premium for coaches', () => {
    assert.equal(
      validateMentorOffering({
        mentorType: MENTOR_TYPE.learningGuide,
        commercialMode: COMMERCIAL_MODE.premium,
      }).ok,
      false,
    );
    assert.equal(
      validateMentorOffering({
        mentorType: MENTOR_TYPE.accomplished,
        commercialMode: COMMERCIAL_MODE.professional,
        baseSessionPriceUsd: 12_000,
      }).ok,
      true,
    );
    assert.equal(
      validateMentorOffering({
        mentorType: MENTOR_TYPE.accomplished,
        commercialMode: COMMERCIAL_MODE.givingBack,
        baseSessionPriceUsd: 5000,
      }).ok,
      false,
    );
    assert.equal(
      validateMentorOffering({
        mentorType: MENTOR_TYPE.accomplished,
        commercialMode: COMMERCIAL_MODE.premium,
        baseSessionPriceUsd: 0,
      }).ok,
      false,
    );
    assert.equal(
      validateMentorOffering({
        mentorType: MENTOR_TYPE.accomplished,
        commercialMode: COMMERCIAL_MODE.professional,
        baseSessionPriceUsd: Number.NaN,
      }).ok,
      false,
    );
  });
});

describe('mentor money', () => {
  it('parses and formats USD amounts as integer cents', () => {
    assert.equal(parseUsdToCents('75'), 7500);
    assert.equal(parseUsdToCents('$75.50'), 7550);
    assert.equal(parseUsdToCents('1,200.00'), 120_000);
    assert.equal(parseUsdToCents(''), null);
    assert.equal(parseUsdToCents('abc'), null);
    assert.equal(formatUsdCents(7500), '$75');
    assert.equal(formatUsdCents(7550), '$75.50');
    assert.equal(centsToDisplayDollars(7500), '75');
    assert.equal(centsToDisplayDollars(7550), '75.50');
  });

  it('reads legacy whole-dollar session prices as cents', () => {
    assert.equal(readSessionPriceCents({ sessionPriceUsd: 75 }), 7500);
    assert.equal(readSessionPriceCents({ baseSessionPriceUsd: 7500 }), 7500);
    assert.equal(readSessionPriceCents({ baseSessionPriceUsd: null }), null);
  });

  it('normalizes legacy mentor documents with old field names', () => {
    const profile = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Ben'),
      commercialMode: COMMERCIAL_MODE.professional,
      servicesDescription: 'Shop coaching',
      sessionPriceUsd: 120,
      messagingIncluded: false,
      verificationStatus: APPROVAL_STATUS.approved,
    });
    assert.equal(profile.serviceDescription, 'Shop coaching');
    assert.equal(profile.baseSessionPriceUsd, 12_000);
    assert.equal(profile.includedMessaging, false);
  });
});

describe('mentor presentation', () => {
  it('formats free and paid prices from configured mentor data only', () => {
    assert.equal(
      formatMentorPriceDisplay({
        commercialMode: COMMERCIAL_MODE.givingBack,
        baseSessionPriceUsd: null,
      }),
      'Free mentorship',
    );
    assert.equal(
      formatMentorPriceDisplay({
        commercialMode: COMMERCIAL_MODE.professional,
        baseSessionPriceUsd: 7500,
      }),
      '$75 / session',
    );
    assert.equal(
      formatMentorPriceDisplay({
        commercialMode: COMMERCIAL_MODE.premium,
        baseSessionPriceUsd: 15_000,
        sessionDurationMinutes: 60,
      }),
      '$150 / 60 min',
    );
    assert.equal(
      formatMentorPriceDisplay({
        commercialMode: COMMERCIAL_MODE.premium,
        baseSessionPriceUsd: null,
      }),
      'Paid mentorship',
    );
  });

  it('chooses primary actions by commercial mode', () => {
    assert.equal(mentorPrimaryActionLabel(COMMERCIAL_MODE.givingBack), 'Request mentorship');
    assert.equal(mentorPrimaryActionLabel(COMMERCIAL_MODE.premium), 'View mentorship options');
  });
});

describe('mentor discovery', () => {
  const mentors = [
    buildPublicMentorProfile({
      profile: normalizeMentorProfile({
        ...emptyMentorProfile('mentor-1', 'Alex Rivera'),
        slug: 'alex',
        public: true,
        verificationStatus: APPROVAL_STATUS.approved,
        mentorType: MENTOR_TYPE.accomplished,
        commercialMode: COMMERCIAL_MODE.premium,
        serviceDescription: 'Executive coaching for product leaders',
        baseSessionPriceUsd: 20_000,
        offersVideoSessions: true,
        acceptsNewLearners: true,
        areasOfExpertise: ['Product strategy', 'Leadership'],
      }),
      mentoredDeliverables: [],
      now: '2026-09-01T00:00:00.000Z',
    }),
    buildPublicMentorProfile({
      profile: normalizeMentorProfile({
        ...emptyMentorProfile('mentor-2', 'Sam Chen'),
        slug: 'sam',
        public: true,
        verificationStatus: APPROVAL_STATUS.approved,
        mentorType: MENTOR_TYPE.learningGuide,
        commercialMode: COMMERCIAL_MODE.givingBack,
        serviceDescription: 'Accountability for early-career writers',
        offersVideoSessions: false,
        acceptsNewLearners: true,
        areasOfExpertise: ['Writing', 'Editing'],
      }),
      mentoredDeliverables: [],
      now: '2026-09-01T00:00:00.000Z',
    }),
  ];

  it('filters by mentor type, commercial model, and availability flags', () => {
    assert.equal(
      filterListedMentors(mentors, {
        ...EMPTY_MENTOR_DISCOVERY_FILTERS,
        mentorTypes: [MENTOR_TYPE.learningGuide],
      }).length,
      1,
    );
    assert.equal(
      filterListedMentors(mentors, {
        ...EMPTY_MENTOR_DISCOVERY_FILTERS,
        commercialModes: [COMMERCIAL_MODE.premium],
      })[0]?.displayName,
      'Alex Rivera',
    );
    assert.equal(
      filterListedMentors(mentors, {
        ...EMPTY_MENTOR_DISCOVERY_FILTERS,
        videoSessionsOnly: true,
      }).length,
      1,
    );
  });

  it('searches names, service descriptions, and demonstrated skills', () => {
    assert.equal(
      filterListedMentors(mentors, {
        ...EMPTY_MENTOR_DISCOVERY_FILTERS,
        query: 'product leaders',
      }).length,
      1,
    );
    assert.equal(
      filterListedMentors(mentors, {
        ...EMPTY_MENTOR_DISCOVERY_FILTERS,
        skillsQuery: 'writing',
      })[0]?.displayName,
      'Sam Chen',
    );
    assert.equal(hasActiveDiscoveryFilters(EMPTY_MENTOR_DISCOVERY_FILTERS), false);
    assert.equal(
      hasActiveDiscoveryFilters({ ...EMPTY_MENTOR_DISCOVERY_FILTERS, query: 'sam' }),
      true,
    );
  });

  it('summarises expertise for mentor cards', () => {
    assert.equal(
      mentorDiscoveryExpertiseLabel(mentors[0]!),
      'Product strategy · Leadership',
    );
  });
});

describe('mentorship commercial requests', () => {
  const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true, accountStatus: ACCOUNT_STATUS.active };
  const approvedMentorBase = {
    userId: 'mentor-1',
    verificationStatus: VERIFICATION_STATUS.approved,
    public: true,
    acceptsNewLearners: true,
  };

  it('derives free and paid request types from mentor commercial mode', () => {
    const freeProfile = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Sam'),
      ...approvedMentorBase,
      commercialMode: COMMERCIAL_MODE.givingBack,
    });
    const paidProfile = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-2', 'Alex'),
      ...approvedMentorBase,
      userId: 'mentor-2',
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 7500,
    });
    assert.equal(requestTypeFromCommercialMode(COMMERCIAL_MODE.givingBack), REQUEST_TYPE.freeRequest);
    assert.equal(requestTypeFromCommercialMode(COMMERCIAL_MODE.premium), REQUEST_TYPE.paidRequest);
    assert.equal(buildMentorshipCommercialSnapshotFromProfile(freeProfile).requestType, REQUEST_TYPE.freeRequest);
    assert.equal(buildMentorshipCommercialSnapshotFromProfile(paidProfile).requestType, REQUEST_TYPE.paidRequest);
    assert.equal(
      applicationCommercialFieldsFromSnapshot(buildMentorshipCommercialSnapshotFromProfile(paidProfile))
        .baseSessionPriceUsd,
      7500,
    );
  });

  it('allows free mentor applications and rejects invalid paid targets', () => {
    const freeMentor = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Sam'),
      ...approvedMentorBase,
      commercialMode: COMMERCIAL_MODE.givingBack,
    });
    const unpaidPaidMentor = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-2', 'Alex'),
      ...approvedMentorBase,
      userId: 'mentor-2',
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: null,
    });
    assert.equal(canApplyForMentorship(learner, freeMentor, 'I want to learn joinery'), true);
    assert.equal(validateMentorApplicationTarget(freeMentor).ok, true);
    assert.equal(canApplyForMentorship(learner, unpaidPaidMentor, 'Please mentor me'), false);
    assert.equal(validateMentorApplicationTarget(unpaidPaidMentor).ok, false);
  });

  it('snapshots paid requests even if the mentor later switches to free', () => {
    const paidSnapshot = buildMentorshipCommercialSnapshot({
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 12_000,
      sessionDurationMinutes: 60,
    });
    const application = {
      id: 'app-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      message: 'Please mentor me',
      status: APPLICATION_STATUS.pending,
      createdAt: '2026-09-01T00:00:00.000Z',
      ...applicationCommercialFieldsFromSnapshot(paidSnapshot),
    };
    const laterFreeMentor = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Alex'),
      ...approvedMentorBase,
      commercialMode: COMMERCIAL_MODE.givingBack,
    });
    assert.equal(normalizeApplicationCommercialFields(application).requestType, REQUEST_TYPE.paidRequest);
    assert.equal(buildMentorshipCommercialSnapshotFromProfile(laterFreeMentor).requestType, REQUEST_TYPE.freeRequest);
    assert.equal(
      relationshipCommercialFromApplication(application).paymentRequired,
      true,
    );
    assert.equal(
      relationshipCommercialFromApplication(application).paymentSatisfied,
      false,
    );
  });

  it('treats legacy applications and relationships without commercial fields as free', () => {
    const legacyApplication = {
      id: 'legacy-app',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      message: 'Hello',
      status: APPLICATION_STATUS.pending,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const legacyRelationship = normalizeRelationship({
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(normalizeApplicationCommercialFields(legacyApplication).requestType, REQUEST_TYPE.freeRequest);
    assert.equal(canStartLearningJourney(learner, legacyRelationship), true);
    assert.equal(paidMentorshipServicesBlocked(legacyRelationship), false);
    assert.equal(canAccessPaidMentorshipServices(legacyRelationship), true);
  });

  it('blocks learning journeys for paid requests until payment is satisfied', () => {
    const paidRelationship = normalizeRelationship({
      id: 'rel-paid',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-09-01T00:00:00.000Z',
      requestType: REQUEST_TYPE.paidRequest,
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 7500,
      paymentRequired: true,
      paymentSatisfied: false,
    });
    assert.equal(paidMentorshipServicesBlocked(paidRelationship), true);
    assert.equal(canStartLearningJourney(learner, paidRelationship), false);
    assert.equal(
      canStartLearningJourney(learner, { ...paidRelationship, paymentSatisfied: true }),
      true,
    );
  });
});

describe('password reset', () => {
  it('requires a usable login email before sending a reset link', () => {
    assert.equal(validatePasswordResetEmail('').ok, false);
    assert.equal(validatePasswordResetEmail('   ').ok, false);
    assert.equal(validatePasswordResetEmail('not-an-email').ok, false);
    const valid = validatePasswordResetEmail('  ada@example.com  ');
    assert.equal(valid.ok, true);
    if (valid.ok) assert.equal(valid.email, 'ada@example.com');
  });

  it('requires a matching password of at least 6 characters', () => {
    assert.equal(validateNewPassword('short', 'short').ok, false);
    assert.equal(validateNewPassword('long-enough', 'different').ok, false);
    assert.equal(validateNewPassword('long-enough', 'long-enough').ok, true);
  });

  it('reads a Firebase reset action from the query or hash', () => {
    assert.deepEqual(parsePasswordResetAction({}), { kind: 'none' });
    assert.deepEqual(
      parsePasswordResetAction({ search: '?mode=resetPassword&oobCode=abc123' }),
      { kind: 'reset', oobCode: 'abc123' },
    );
    assert.deepEqual(
      parsePasswordResetAction({ hash: '#mode=resetPassword&oobCode=from-hash' }),
      { kind: 'reset', oobCode: 'from-hash' },
    );
    assert.deepEqual(
      parsePasswordResetAction({ search: '?oobCode=bare-code' }),
      { kind: 'reset', oobCode: 'bare-code' },
    );
    assert.deepEqual(
      parsePasswordResetAction({ search: '?mode=verifyEmail&oobCode=xyz' }),
      { kind: 'other', mode: 'verifyEmail' },
    );
  });
});

