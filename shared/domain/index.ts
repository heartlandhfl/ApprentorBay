export {
  CANONICAL_LEARNER_ID_FIELD,
  CANONICAL_LEARNER_ROLE,
  PAIRING_ID_FIELD,
  PUBLIC_LEARNER_LABEL,
  USER_ROLE,
  isAdminRole,
  isLearnerRole,
  isMentorRole,
  isSignupRole,
  isUserRole,
  pairingIdFieldForRole,
} from './identities.js';
export type { PairingIdField, SignupRole, UserRole } from './identities.js';

export {
  ACCOUNT_STATUS,
  APPLICATION_STATUS,
  DELIVERABLE_STATUS,
  LEARNING_CONTRACT_STATUS,
  LEARNING_CONTRACT_STATUS_LABEL,
  LEGACY_MENTORSHIP_STATUS,
  MILESTONE_STATUS,
  MILESTONE_STATUS_LABEL,
  NOTIFICATION_STATUS,
  RELATIONSHIP_STATUS,
  STEP_OWNER,
  SUPPORT_ISSUE_STATUS,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_TYPE,
  isApplicationStatus,
  isContractActiveStatus,
  isDeliverableStatus,
  isLearnerReviewStatus,
  isLearningContractStatus,
  isMentorReviewStatus,
  isApprovedMilestoneStatus,
  isMilestoneStatus,
  isNegotiationOpen,
  isReviewableMilestoneStatus,
  isOperationalContractStatus,
  isRelationshipStatus,
  isStepOwner,
  isAccountStatus,
  isVerificationCaseStatus,
  isVerificationStatus,
} from './statuses.js';
export type {
  AccountStatus,
  ApplicationStatus,
  DeliverableStatus,
  LearningContractStatus,
  MentorshipStatus,
  MilestoneStatus,
  NotificationStatus,
  RelationshipStatus,
  StepOwner,
  SupportIssueStatus,
  VerificationCaseStatus,
  VerificationStatus,
  VerifiedClaim,
  VerifiedClaimType,
} from './statuses.js';

export { COLLECTIONS, RESERVED_COLLECTIONS } from './collections.js';
export type { CollectionName, ReservedCollectionName } from './collections.js';

export {
  COMMERCIAL_MODE,
  COMMERCIAL_MODE_DESCRIPTION,
  COMMERCIAL_MODE_EDITOR_DESCRIPTION,
  COMMERCIAL_MODE_LABEL,
  COMMERCIAL_MODES_FOR_MENTOR_TYPE,
  MENTOR_SERVICE_DESCRIPTION,
  MENTOR_SERVICES_DESCRIPTION,
  MENTOR_TYPE,
  MENTOR_TYPE_DESCRIPTION,
  MENTOR_TYPE_LABEL,
  SESSION_DURATION,
  commercialModeAllowedForMentorType,
  isCommercialMode,
  isMentorType,
  normalizeMentorOfferingFields,
  resolveMentorOffering,
} from './mentorOffering.js';
export type {
  CommercialMode,
  MentorOfferingFields,
  MentorType,
  ResolvedMentorOffering,
} from './mentorOffering.js';

export {
  BASE_SESSION_PRICE_USD,
  centsToDisplayDollars,
  formatUsdCents,
  isValidPriceCents,
  parseUsdToCents,
  readSessionPriceCents,
} from './money.js';

export {
  COMMERCIAL_MODE_DISCOVERY_LABEL,
  COMMERCIAL_MODE_PUBLIC_LABEL,
  MENTOR_TYPE_PUBLIC_LABEL,
  commercialModeDescription,
  commercialModeDiscoveryLabel,
  commercialModePublicTitle,
  commercialModeTitle,
  formatMentorPriceDisplay,
  isPaidCommercialMode,
  mentorAvailabilityCopy,
  mentorHelpSummary,
  mentorMessagingCopy,
  mentorCardServiceDescription,
  mentorPrimaryActionLabel,
  mentorTypeDescription,
  mentorTypePublicTitle,
  mentorTypeTitle,
  mentorVideoSessionCopy,
} from './mentorPresentation.js';

export {
  EMPTY_MENTOR_DISCOVERY_FILTERS,
  MENTOR_DISCOVERY_COMMERCIAL_MODES,
  MENTOR_DISCOVERY_MENTOR_TYPES,
  filterListedMentors,
  hasActiveDiscoveryFilters,
  mentorDiscoveryExpertiseLabel,
  mentorDiscoverySearchHaystack,
  mentorDiscoverySkillsHaystack,
  mentorMatchesDiscoveryFilters,
} from './mentorDiscovery.js';
export type { MentorDiscoveryFilters } from './mentorDiscovery.js';

export {
  emptyLearnerProfile,
  emptyMentorProfile,
  isAccountActive,
  normalizeLearnerProfile,
  normalizeMentorProfile,
  profileCollectionForRole,
} from './users.js';
export type {
  AccountRow,
  AdminCounts,
  CompetencyGoal,
  CredentialEntry,
  EducationEntry,
  ExperienceEntry,
  IsoDateString,
  LearnerProfile,
  MentorProfile,
  PendingMentorRow,
  Review,
  User,
  VerificationDecision,
} from './users.js';

export {
  APPLICATION_MESSAGE,
  isPendingApplication,
} from './applications.js';
export type { MentorApplication, MentorshipApplication } from './applications.js';

export {
  REQUEST_TYPE,
  REQUEST_TYPE_PUBLIC_LABEL,
  applicationCommercialFieldsFromSnapshot,
  buildMentorshipCommercialSnapshot,
  buildMentorshipCommercialSnapshotFromProfile,
  canAccessPaidMentorshipServices,
  isRequestType,
  normalizeApplicationCommercialFields,
  paidMentorshipServicesBlocked,
  relationshipCommercialFromApplication,
  requestTypeFromCommercialMode,
  requestTypePublicLabel,
  validateMentorApplicationTarget,
} from './mentorshipRequest.js';
export type { MentorshipCommercialSnapshot, RequestType } from './mentorshipRequest.js';

export {
  RELATIONSHIP_STATUS_LABEL,
  buildActiveRelationship,
  counterpartField,
  isActiveRelationship,
  isClosedRelationship,
  isOpenRelationship,
  isPairingMember,
  normalizeRelationship,
  otherPartyId,
  pairingIdForAccount,
  relationshipDocId,
} from './relationships.js';
export type { MentorshipRelationship, PairingMemberIds } from './relationships.js';

export { MESSAGE_TEXT } from './messages.js';
export type { Message } from './messages.js';

export {
  EVIDENCE,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_LABEL,
  evidenceFromMilestone,
  evidenceItemsForMilestone,
  evidenceStoragePath,
  isEvidenceComplete,
  isEvidenceType,
  isPrivateEvidencePath,
  latestMilestoneProjection,
  normalizeEvidenceItem,
  parseEvidenceStoragePath,
} from './evidence.js';
export type { Evidence, EvidenceDraft, EvidenceItem, EvidenceType } from './evidence.js';

export {
  findMilestoneByStatus,
  isActionableEvidenceMilestone,
  isReviewableMilestone,
  isSubmittedMilestone,
  milestoneEvidence,
  milestoneEvidenceItems,
  milestoneNextAction,
  milestoneResponsibleParty,
  milestoneStatusLabel,
  nextBeginWorkMilestone,
  sortMilestones,
} from './milestones.js';
export type { Milestone, MilestoneParty } from './milestones.js';

export { isCompletedDeliverable } from './deliverables.js';
export type { Deliverable, DeliverableRef } from './deliverables.js';

export {
  FINAL_DELIVERABLE_MILESTONE_ID,
  FINAL_DELIVERABLE_REVIEW,
  allRequiredMilestonesApproved,
  emptyFinalDeliverable,
  isFinalDeliverableReviewed,
  isFinalDeliverableSubmitted,
  normalizeFinalDeliverable,
  publicEvidenceFromFinal,
} from './finalDeliverable.js';
export type {
  FinalDeliverable,
  FinalDeliverableFile,
  FinalDeliverableReviewStatus,
} from './finalDeliverable.js';

export {
  combineGoalText,
  contractEvidenceItems,
  contractProgress,
  contractTitle,
  firstLine,
  hydrateEvidenceItems,
  isContractCompleted,
  isContractInProgress,
  isContractWorkspaceView,
  isLearnerStep,
  isMentorStep,
  isOperationalContract,
  learningGoalBuilderFromContract,
  milestoneEvidenceCount,
  nextActionCopy,
  workspaceFocus,
  workspacePartyLabel,
  normalizeContract,
  normalizeDeliverable,
  normalizeGoal,
  normalizeMilestone,
  normalizeObjective,
  restLines,
} from './learningContracts.js';
export type {
  ContractEvidenceItem,
  ContractRevision,
  Goal,
  LearningContract,
  LearningGoalBuilder,
  Objective,
  WorkspaceFocus,
  WorkspacePartyNeeded,
} from './learningContracts.js';


export {
  MENTOR_CONTRIBUTION,
  SHOWCASE_SOURCE,
  buildShowcase,
  canConfirmCompletion,
  canPublishShowcase,
  canReadShowcase,
  completionBlockers,
  completionRequirements,
  deliverableRefFromShowcase,
  mergeShowcaseRecord,
  publicEvidenceForShowcase,
  showcaseDocId,
  showcaseFromDeliverableRef,
  showcasesFromProfile,
} from './showcases.js';
export type {
  CompletionRequirement,
  Showcase,
  ShowcaseContract,
  ShowcaseEvidence,
  ShowcaseItem,
  ShowcaseSource,
} from './showcases.js';

export { NOTIFICATION_TYPE, isUnreadNotification } from './notifications.js';
export type { Notification, NotificationType } from './notifications.js';

export {
  APPROVAL_DISCLAIMER,
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABEL,
  VERIFIED_CLAIM_LABEL,
  buildPublicLearnerProfile,
  buildPublicMentorProfile,
  canListPublicMentor,
  isPublicPhotoPath,
  portfolioItemFromShowcase,
  profilePhotoStoragePath,
  ownPublicProfilePath,
  publicProfileOmitsPrivateFields,
  publicProfilePath,
  publicReviewsFrom,
  toStoredPublicProfile,
  verifiedClaimsPublic,
} from './publicProfiles.js';
export type {
  ApprovalStatus,
  PublicPortfolioItem,
  PublicProfile,
  PublicReview,
  ProfileSlugRecord,
} from './publicProfiles.js';

export {
  PROFILE_SLUG,
  RESERVED_PROFILE_SLUGS,
  looksLikeFirebaseUid,
  nextSlugCandidate,
  normalizeSlugInput,
  suggestSlug,
  validateProfileSlug,
} from './slugs.js';
export type { SlugValidation } from './slugs.js';

export { ADMIN_AUDIT_ACTION, AUDIT_EVENT, buildAuditLog } from './auditLog.js';
export type { AdminAuditAction, AdminAuditLog, AuditEvent } from './auditLog.js';

export {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TRANSITIONS,
  ADMIN_ACTION,
  VERIFICATION_CASE_STATUS_LABEL,
  accountActiveFlag,
  accountStatusOf,
  allClaimTypesVerified,
  canApproveMentor,
  canChangeAccountStatus,
  canGovernAccounts,
  canParticipate,
  canSignIn,
  canTransitionAccountStatus,
  canVerifyMentor,
  deriveVerificationCase,
  isAccountRestricted,
  isPendingVerificationCase,
  reasonRequiredForAccountStatus,
  validateAdminReason,
  validateSupportIssue,
  verifiedClaimSet,
} from './administration.js';
export type { AdminAction, GovernanceActor, SupportIssue } from './administration.js';

export {
  LEARNER_JOURNEY,
  MENTOR_JOURNEY,
  isLearnerProfileReady,
  isMentorProfileReady,
  learnerDashboardModel,
  learnerJourneyStage,
  lifecycleProfileFrom,
  mentorDashboardModel,
  mentorJourneyStage,
} from './lifecycle.js';
export type {
  DashboardAction,
  LearnerDashboardModel,
  LearnerJourneyStage,
  LifecycleProfile,
  MentorDashboardModel,
  MentorJourneyStage,
  MentorQueueItem,
} from './lifecycle.js';

export type { Mentorship } from './legacy.js';

export {
  canAccessContractWorkspace,
  canPublishContractShowcase,
  canReadEvidenceObject,
  canWriteEvidenceObject,
  canAcceptApplication,
  canAdminister,
  canApplyForMentorship,
  canDecideVerification,
  canDeclineApplication,
  canEndRelationship,
  canPauseRelationship,
  canReadPairing,
  canReadPrivateProfile,
  canEditOwnProfile,
  canResumeRelationship,
  canSendMessage,
  canStartLearningJourney,
  canChangeOwnRole,
  canRestrictAccount,
  canSelfApprove,
  canSuspendAccount,
  canTerminateAccount,
  canTerminateRelationship,
} from './permissions.js';
export type { PermissionActor } from './permissions.js';

export {
  PASSWORD,
  parsePasswordResetAction,
  validateApplicationMessage,
  validateChangeRequestReason,
  validateEvidenceDrafts,
  validateEvidenceSubmission,
  validateFinalDeliverable,
  validateGoalDraft,
  validateMentorPlan,
  validateMentorOffering,
  validateMessageText,
  validateMilestoneFeedback,
  validateNewPassword,
  validatePasswordResetEmail,
} from './validation.js';
export type { EmailValidation, PasswordResetAction, ValidationResult } from './validation.js';

export {
  APPLICATION_TRANSITIONS,
  LEARNING_CONTRACT_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  RELATIONSHIP_TRANSITIONS,
  VERIFICATION_TRANSITIONS,
  canTransition,
  canTransitionApplication,
  canTransitionContract,
  canTransitionMilestone,
  canTransitionRelationship,
  canTransitionVerification,
} from './transitions.js';
export type { TransitionMap } from './transitions.js';
