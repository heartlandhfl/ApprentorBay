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
  APPLICATION_STATUS,
  DELIVERABLE_STATUS,
  LEARNING_CONTRACT_STATUS,
  LEARNING_CONTRACT_STATUS_LABEL,
  LEGACY_MENTORSHIP_STATUS,
  MILESTONE_STATUS,
  NOTIFICATION_STATUS,
  RELATIONSHIP_STATUS,
  STEP_OWNER,
  VERIFICATION_STATUS,
  isApplicationStatus,
  isContractActiveStatus,
  isDeliverableStatus,
  isLearnerReviewStatus,
  isLearningContractStatus,
  isMentorReviewStatus,
  isMilestoneStatus,
  isNegotiationOpen,
  isOperationalContractStatus,
  isRelationshipStatus,
  isStepOwner,
  isVerificationStatus,
} from './statuses.js';
export type {
  ApplicationStatus,
  DeliverableStatus,
  LearningContractStatus,
  MentorshipStatus,
  MilestoneStatus,
  NotificationStatus,
  RelationshipStatus,
  StepOwner,
  VerificationStatus,
} from './statuses.js';

export { COLLECTIONS, RESERVED_COLLECTIONS } from './collections.js';
export type { CollectionName, ReservedCollectionName } from './collections.js';

export {
  emptyLearnerProfile,
  emptyMentorProfile,
  isAccountActive,
  profileCollectionForRole,
} from './users.js';
export type {
  AccountRow,
  AdminCounts,
  CompetencyGoal,
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

export { APPLICATION_MESSAGE, isPendingApplication } from './applications.js';
export type { MentorApplication, MentorshipApplication } from './applications.js';

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
  evidenceFromMilestone,
  isEvidenceComplete,
} from './evidence.js';
export type { Evidence } from './evidence.js';

export {
  findMilestoneByStatus,
  isActionableEvidenceMilestone,
  isSubmittedMilestone,
  milestoneEvidence,
  sortMilestones,
} from './milestones.js';
export type { Milestone } from './milestones.js';

export { isCompletedDeliverable } from './deliverables.js';
export type { Deliverable, DeliverableRef } from './deliverables.js';

export {
  combineGoalText,
  contractEvidenceItems,
  contractProgress,
  contractTitle,
  firstLine,
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

export { SHOWCASE_SOURCE, showcaseFromDeliverableRef, showcasesFromProfile } from './showcases.js';
export type { ShowcaseItem, ShowcaseSource } from './showcases.js';

export { NOTIFICATION_TYPE, isUnreadNotification } from './notifications.js';
export type { Notification, NotificationType } from './notifications.js';

export { ADMIN_AUDIT_ACTION, AUDIT_EVENT, buildAuditLog } from './auditLog.js';
export type { AdminAuditAction, AdminAuditLog, AuditEvent } from './auditLog.js';

export type { Mentorship } from './legacy.js';

export {
  canAccessContractWorkspace,
  canAcceptApplication,
  canAdminister,
  canApplyForMentorship,
  canDecideVerification,
  canDeclineApplication,
  canEndRelationship,
  canPauseRelationship,
  canReadPairing,
  canResumeRelationship,
  canSendMessage,
  canStartLearningJourney,
  canSuspendAccount,
  canTerminateRelationship,
} from './permissions.js';
export type { PermissionActor } from './permissions.js';

export {
  validateApplicationMessage,
  validateChangeRequestReason,
  validateEvidenceSubmission,
  validateGoalDraft,
  validateMentorPlan,
  validateMessageText,
  validateMilestoneFeedback,
} from './validation.js';
export type { ValidationResult } from './validation.js';

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
