import {
  ACCOUNT_STATUS,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  isMentorReviewStatus,
  isNegotiationOpen,
  type AccountStatus,
} from './statuses.js';
import type { MentorshipApplication } from './applications.js';
import type { LearningContract } from './learningContracts.js';
import {
  contractProgress,
  contractTitle,
  nextActionCopy,
  workspaceFocus,
} from './learningContracts.js';
import type { MentorshipRelationship } from './relationships.js';
import { isOpenRelationship } from './relationships.js';
import type { LearnerProfile, MentorProfile, User } from './users.js';

export const LEARNER_JOURNEY = [
  { id: 'discover', label: 'Discover', description: 'Find a mentor whose practice matches your ambition.' },
  { id: 'connect', label: 'Connect', description: 'Apply and wait for the mentor to accept.' },
  { id: 'agree', label: 'Agree', description: 'Write the learning contract together.' },
  { id: 'learn', label: 'Learn', description: 'Begin the first active milestone.' },
  { id: 'build', label: 'Build', description: 'Ship evidence against later milestones.' },
  { id: 'prove', label: 'Prove', description: 'Submit the final deliverable for review.' },
  { id: 'showcase', label: 'Showcase', description: 'Publish completed work on your public profile.' },
] as const;

export const MENTOR_JOURNEY = [
  { id: 'be_discovered', label: 'Be discovered', description: 'Publish a mentoring profile people can find.' },
  { id: 'connect', label: 'Connect', description: 'Review applications and open a pairing.' },
  { id: 'guide', label: 'Guide', description: 'Keep an active learner moving through milestones.' },
  { id: 'review', label: 'Review', description: 'Shape the contract before work starts.' },
  { id: 'validate', label: 'Validate', description: 'Judge evidence and confirm completion.' },
  { id: 'build_legacy', label: 'Build legacy', description: 'Completed pairings become public proof of your guidance.' },
] as const;

export type LearnerJourneyStage = (typeof LEARNER_JOURNEY)[number]['id'];
export type MentorJourneyStage = (typeof MENTOR_JOURNEY)[number]['id'];

export type LifecycleProfile = {
  displayName: string;
  professionalIdentity: string;
  expertise: string;
  careerAspirations: string;
  mentoringInterests: string;
  slug: string | null;
  public: boolean;
  accountStatus: AccountStatus;
};

export function lifecycleProfileFrom(
  account: Pick<User, 'displayName' | 'accountStatus' | 'profileSlug'>,
  profile: LearnerProfile | MentorProfile | null,
): LifecycleProfile {
  return {
    displayName: (profile?.displayName || account.displayName).trim(),
    professionalIdentity: profile?.professionalIdentity.trim() ?? '',
    expertise: profile && 'expertise' in profile ? profile.expertise.trim() : '',
    careerAspirations: profile && 'careerAspirations' in profile ? profile.careerAspirations.trim() : '',
    mentoringInterests: profile && 'mentoringInterests' in profile ? profile.mentoringInterests.trim() : '',
    slug: profile?.slug ?? account.profileSlug ?? null,
    public: profile?.public ?? false,
    accountStatus: account.accountStatus ?? ACCOUNT_STATUS.active,
  };
}

export function isLearnerProfileReady(profile: LifecycleProfile): boolean {
  return Boolean(
    profile.displayName &&
      profile.professionalIdentity &&
      profile.careerAspirations,
  );
}

export function isMentorProfileReady(profile: LifecycleProfile): boolean {
  return Boolean(
    profile.displayName &&
      (profile.professionalIdentity || profile.expertise) &&
      profile.mentoringInterests &&
      profile.slug?.trim(),
  );
}

export function learnerJourneyStage(input: {
  applications: MentorshipApplication[];
  relationships: MentorshipRelationship[];
  contracts: LearningContract[];
}): LearnerJourneyStage {
  const { applications, relationships, contracts } = input;
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.completionPending)) {
    return 'prove';
  }
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.inProgress && hasApprovedMilestone(contract))) {
    return 'build';
  }
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.inProgress)) {
    return 'learn';
  }
  if (hasAgreementWork(relationships, contracts)) return 'agree';
  if (applications.some((application) => application.status === 'pending')) return 'connect';
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.completed)) {
    return 'showcase';
  }
  return 'discover';
}

export function mentorJourneyStage(input: {
  applications: MentorshipApplication[];
  relationships: MentorshipRelationship[];
  contracts: LearningContract[];
}): MentorJourneyStage {
  const { applications, relationships, contracts } = input;
  if (
    contracts.some(
      (contract) =>
        contract.status === LEARNING_CONTRACT_STATUS.completionPending ||
        hasSubmittedEvidence(contract),
    )
  ) {
    return 'validate';
  }
  if (hasAgreementWork(relationships, contracts)) return 'review';
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.inProgress)) {
    return 'guide';
  }
  if (applications.some((application) => application.status === 'pending')) return 'connect';
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.completed)) {
    return 'build_legacy';
  }
  return 'be_discovered';
}

export type DashboardAction = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type LearnerDashboardModel = {
  stage: LearnerJourneyStage;
  next: DashboardAction;
  waitingFor: string;
  milestoneNeedingAttention: string;
  achievements: string[];
  onboarding: DashboardAction[];
  hasActivity: boolean;
};

export type MentorQueueItem = {
  kind: 'application' | 'learner' | 'contract' | 'evidence' | 'outcome';
  title: string;
  detail: string;
  href: string;
};

export type MentorDashboardModel = {
  stage: MentorJourneyStage;
  next: DashboardAction;
  pendingApplications: number;
  learnersNeedingAttention: number;
  contractsAwaitingReview: number;
  evidenceAwaitingReview: number;
  completedOutcomes: number;
  queue: MentorQueueItem[];
  onboarding: DashboardAction[];
  hasActivity: boolean;
};

export function learnerDashboardModel(input: {
  profile: LifecycleProfile;
  applications: MentorshipApplication[];
  relationships: MentorshipRelationship[];
  contracts: LearningContract[];
}): LearnerDashboardModel {
  const stage = learnerJourneyStage(input);
  const { profile, applications, relationships, contracts } = input;
  const hasActivity = applications.length > 0 || relationships.length > 0 || contracts.length > 0;
  const focus = pickFocusContract(contracts);
  const achievements = learnerAchievements(profile, contracts);
  const onboarding = learnerOnboarding(profile);

  if (!hasActivity) {
    return {
      stage,
      next: onboarding[0] ?? browseMentorsAction(),
      waitingFor: 'Nobody yet. Start by making yourself easy to mentor.',
      milestoneNeedingAttention: 'None yet. A milestone appears once you agree a learning contract.',
      achievements,
      onboarding,
      hasActivity,
    };
  }

  return {
    stage,
    next: learnerNextAction(profile, applications, relationships, contracts, focus),
    waitingFor: learnerWaitingFor(applications, focus),
    milestoneNeedingAttention: learnerMilestoneAttention(focus),
    achievements,
    onboarding,
    hasActivity,
  };
}

export function mentorDashboardModel(input: {
  profile: LifecycleProfile;
  applications: MentorshipApplication[];
  relationships: MentorshipRelationship[];
  contracts: LearningContract[];
}): MentorDashboardModel {
  const stage = mentorJourneyStage(input);
  const { profile, applications, relationships, contracts } = input;
  const pendingApplications = applications.filter((application) => application.status === 'pending');
  const reviewContracts = contracts.filter(isContractAwaitingMentorReview);
  const evidenceContracts = contracts.filter(
    (contract) => hasSubmittedEvidence(contract) || isMentorValidatingCompletion(contract),
  );
  const attentionContracts = contracts.filter(isLearnerNeedingMentor);
  const completed = contracts.filter((contract) => contract.status === LEARNING_CONTRACT_STATUS.completed);
  const hasActivity = applications.length > 0 || relationships.length > 0 || contracts.length > 0;
  const onboarding = mentorOnboarding(profile);

  return {
    stage,
    next: mentorNextAction({
      profile,
      pendingApplications,
      attentionContracts,
      reviewContracts,
      evidenceContracts,
      completed,
    }),
    pendingApplications: pendingApplications.length,
    learnersNeedingAttention: attentionContracts.length,
    contractsAwaitingReview: reviewContracts.length,
    evidenceAwaitingReview: evidenceContracts.length,
    completedOutcomes: completed.length,
    queue: mentorQueue({
      pendingApplications,
      attentionContracts,
      reviewContracts,
      evidenceContracts,
      completed,
    }),
    onboarding,
    hasActivity,
  };
}

function hasApprovedMilestone(contract: LearningContract): boolean {
  return contract.milestones.some((milestone) => milestone.status === MILESTONE_STATUS.approved);
}

function hasSubmittedEvidence(contract: LearningContract): boolean {
  return contract.milestones.some(
    (milestone) =>
      milestone.status === MILESTONE_STATUS.submitted ||
      milestone.status === MILESTONE_STATUS.underReview,
  );
}

function isContractAwaitingMentorReview(contract: LearningContract): boolean {
  return (
    isMentorReviewStatus(contract.status) ||
    contract.status === LEARNING_CONTRACT_STATUS.mutuallyApproved ||
    contract.status === LEARNING_CONTRACT_STATUS.agreed
  );
}

function isMentorValidatingCompletion(contract: LearningContract): boolean {
  return (
    contract.status === LEARNING_CONTRACT_STATUS.completionPending &&
    workspaceFocus(contract).who === 'mentor'
  );
}

function isLearnerNeedingMentor(contract: LearningContract): boolean {
  return (
    (contract.status === LEARNING_CONTRACT_STATUS.inProgress ||
      contract.status === LEARNING_CONTRACT_STATUS.completionPending ||
      contract.status === LEARNING_CONTRACT_STATUS.paused) &&
    workspaceFocus(contract).who === 'mentor'
  );
}

function hasAgreementWork(
  relationships: MentorshipRelationship[],
  contracts: LearningContract[],
): boolean {
  if (!relationships.some((relationship) => isOpenRelationship(relationship))) return false;
  if (contracts.length === 0) return true;
  return contracts.some(
    (contract) =>
      isNegotiationOpen(contract.status) &&
      contract.status !== LEARNING_CONTRACT_STATUS.inProgress,
  );
}

function pickFocusContract(contracts: LearningContract[]): LearningContract | null {
  const rank = (status: LearningContract['status']): number => {
    if (status === LEARNING_CONTRACT_STATUS.completionPending) return 0;
    if (status === LEARNING_CONTRACT_STATUS.inProgress) return 1;
    if (isNegotiationOpen(status)) return 2;
    if (status === LEARNING_CONTRACT_STATUS.paused) return 3;
    return 4;
  };
  return [...contracts].sort((left, right) => rank(left.status) - rank(right.status))[0] ?? null;
}

function journeyHref(contract: LearningContract): string {
  return `/dashboard/journey/${contract.relationshipId}`;
}

function browseMentorsAction(): DashboardAction {
  return {
    title: 'Browse Mentors',
    detail: 'Find someone whose practice matches the skill you want to build.',
    href: '/mentors',
    cta: 'Browse mentors',
  };
}

function learnerOnboarding(profile: LifecycleProfile): DashboardAction[] {
  const actions: DashboardAction[] = [];
  if (!profile.displayName || !profile.professionalIdentity) {
    actions.push({
      title: 'Complete your profile',
      detail: 'A clear name and professional identity help mentors understand who they are guiding.',
      href: '/learners/me',
      cta: 'Edit profile',
    });
  }
  actions.push(browseMentorsAction());
  actions.push({
    title: 'Define your learning ambition',
    detail: profile.careerAspirations
      ? profile.careerAspirations
      : 'Write the career or craft outcome you want a mentor to help you reach.',
    href: '/learners/me',
    cta: profile.careerAspirations ? 'Review ambition' : 'Add ambition',
  });
  return actions.slice(0, 3);
}

function mentorOnboarding(profile: LifecycleProfile): DashboardAction[] {
  return [
    {
      title: 'Complete your professional profile',
      detail: isMentorProfileReady(profile)
        ? 'Keep identity and expertise accurate so learners can trust the listing.'
        : 'Mentors are discovered by identity, expertise, and a public profile people can trust.',
      href: '/mentors/me',
      cta: 'Edit profile',
    },
    {
      title: 'Set availability',
      detail: profile.mentoringInterests
        ? 'Keep mentoring interests current so learners know what you will take on.'
        : 'Say what you will mentor. ApprentorBay uses mentoring interests as your availability signal.',
      href: '/mentors/me',
      cta: profile.mentoringInterests ? 'Update interests' : 'Set interests',
    },
    {
      title: 'Prepare your mentoring profile',
      detail: profile.public
        ? 'Your public profile can be listed. Keep the story of your practice accurate.'
        : 'Publish a public profile so learners can find and apply to you.',
      href: '/mentors/me',
      cta: profile.public ? 'Review profile' : 'Prepare profile',
    },
  ];
}

function learnerNextAction(
  profile: LifecycleProfile,
  applications: MentorshipApplication[],
  relationships: MentorshipRelationship[],
  contracts: LearningContract[],
  focus: LearningContract | null,
): DashboardAction {
  if (profile.accountStatus !== ACCOUNT_STATUS.active) {
    return {
      title: 'Your account cannot participate right now',
      detail: 'You can still read your records. Contact support if you believe this is a mistake.',
      href: '/support',
      cta: 'Contact support',
    };
  }
  if (!isLearnerProfileReady(profile) && contracts.length === 0 && relationships.length === 0) {
    return learnerOnboarding(profile)[0];
  }
  const pending = applications.find((application) => application.status === 'pending');
  if (pending && !focus) {
    return {
      title: 'Wait for the mentor to respond',
      detail: pending.message,
      href: '/dashboard/mentorships',
      cta: 'View pairings',
    };
  }
  if (focus) {
    const focusText = workspaceFocus(focus);
    return {
      title: focusText.next,
      detail: nextActionCopy(focus),
      href: journeyHref(focus),
      cta: 'Open journey',
    };
  }
  const open = relationships.find((item) => isOpenRelationship(item));
  if (open) {
    return {
      title: 'Start the learning contract',
      detail: 'You are paired. Write the goal, scope, and first milestone together.',
      href: `/dashboard/mentorships/${open.id}`,
      cta: 'Open pairing',
    };
  }
  if (contracts.some((contract) => contract.status === LEARNING_CONTRACT_STATUS.completed)) {
    return {
      title: 'Show what you finished',
      detail: 'A completed contract can live on your public profile as proof of the work.',
      href: '/learners/me',
      cta: 'Review showcase',
    };
  }
  return browseMentorsAction();
}

function learnerWaitingFor(applications: MentorshipApplication[], focus: LearningContract | null): string {
  if (focus) {
    const party = workspaceFocus(focus).who;
    if (party === 'learner') return 'You. The next contract or milestone step is yours.';
    if (party === 'mentor') return 'Your mentor. They need to review or respond before you can continue.';
    if (party === 'either') return 'Either of you. The next step can be taken by learner or mentor.';
    return 'Nobody. This pairing is complete.';
  }
  if (applications.some((application) => application.status === 'pending')) {
    return 'The mentor you applied to. They have not accepted or declined yet.';
  }
  return 'Nobody yet.';
}

function learnerMilestoneAttention(focus: LearningContract | null): string {
  if (!focus) return 'None yet.';
  const submitted = focus.milestones.find(
    (milestone) =>
      milestone.status === MILESTONE_STATUS.submitted ||
      milestone.status === MILESTONE_STATUS.underReview,
  );
  if (submitted) return `${submitted.title} — waiting for mentor review.`;
  const current = focus.milestones.find(
    (milestone) =>
      milestone.status === MILESTONE_STATUS.active ||
      milestone.status === MILESTONE_STATUS.rejected,
  );
  if (current?.status === MILESTONE_STATUS.rejected) {
    return `${current.title} — needs a stronger resubmission.`;
  }
  if (current) return `${current.title} — this is the active milestone.`;
  if (focus.status === LEARNING_CONTRACT_STATUS.inProgress && focus.milestones.length === 0) {
    return 'No milestones yet. Add the first proof point to the contract.';
  }
  if (focus.status === LEARNING_CONTRACT_STATUS.completionPending) {
    return 'Final deliverable — this is the proof that closes the contract.';
  }
  const progress = contractProgress(focus);
  return progress.total
    ? `${progress.approved} of ${progress.total} milestones approved.`
    : 'No milestone needs you right now.';
}

function learnerAchievements(profile: LifecycleProfile, contracts: LearningContract[]): string[] {
  const approved = contracts.reduce(
    (count, contract) =>
      count + contract.milestones.filter((milestone) => milestone.status === MILESTONE_STATUS.approved).length,
    0,
  );
  const completed = contracts.filter((contract) => contract.status === LEARNING_CONTRACT_STATUS.completed).length;
  const items: string[] = [];
  if (profile.public && profile.slug) items.push('Public profile published');
  if (approved) items.push(`${approved} milestone${approved === 1 ? '' : 's'} approved`);
  if (completed) items.push(`${completed} learning contract${completed === 1 ? '' : 's'} completed`);
  if (items.length === 0) items.push('Nothing recorded yet — your first approved milestone will appear here.');
  return items;
}

function mentorNextAction(input: {
  profile: LifecycleProfile;
  pendingApplications: MentorshipApplication[];
  attentionContracts: LearningContract[];
  reviewContracts: LearningContract[];
  evidenceContracts: LearningContract[];
  completed: LearningContract[];
}): DashboardAction {
  const { profile, pendingApplications, attentionContracts, reviewContracts, evidenceContracts, completed } =
    input;
  if (profile.accountStatus !== ACCOUNT_STATUS.active) {
    return {
      title: 'Your account cannot participate right now',
      detail: 'You can still read mentoring records. Contact support if you believe this is a mistake.',
      href: '/support',
      cta: 'Contact support',
    };
  }
  if (pendingApplications[0]) {
    return {
      title: 'Review a pending application',
      detail: pendingApplications[0].message,
      href: '/dashboard/applications',
      cta: 'Open applications',
    };
  }
  if (evidenceContracts[0]) {
    const milestone = evidenceContracts[0].milestones.find(
      (item) =>
        item.status === MILESTONE_STATUS.submitted || item.status === MILESTONE_STATUS.underReview,
    );
    return {
      title: 'Review submitted evidence',
      detail: milestone
        ? `${milestone.title} on ${contractTitle(evidenceContracts[0])}`
        : contractTitle(evidenceContracts[0]),
      href: journeyHref(evidenceContracts[0]),
      cta: 'Open journey',
    };
  }
  if (reviewContracts[0]) {
    return {
      title: 'A contract is waiting for you',
      detail: nextActionCopy(reviewContracts[0]),
      href: journeyHref(reviewContracts[0]),
      cta: 'Open journey',
    };
  }
  if (attentionContracts[0]) {
    return {
      title: workspaceFocus(attentionContracts[0]).next,
      detail: nextActionCopy(attentionContracts[0]),
      href: journeyHref(attentionContracts[0]),
      cta: 'Open journey',
    };
  }
  if (completed[0]) {
    return {
      title: 'A completed pairing is part of your legacy',
      detail: contractTitle(completed[0]),
      href: '/dashboard/mentorships',
      cta: 'View pairings',
    };
  }
  return mentorOnboarding(profile)[0];
}

function mentorQueue(input: {
  pendingApplications: MentorshipApplication[];
  attentionContracts: LearningContract[];
  reviewContracts: LearningContract[];
  evidenceContracts: LearningContract[];
  completed: LearningContract[];
}): MentorQueueItem[] {
  const items: MentorQueueItem[] = [];
  for (const application of input.pendingApplications) {
    items.push({
      kind: 'application',
      title: 'Pending application',
      detail: application.message,
      href: '/dashboard/applications',
    });
  }
  for (const contract of input.evidenceContracts) {
    const milestone = contract.milestones.find(
      (item) =>
        item.status === MILESTONE_STATUS.submitted || item.status === MILESTONE_STATUS.underReview,
    );
    items.push({
      kind: 'evidence',
      title: 'Evidence awaiting review',
      detail: milestone ? `${milestone.title} · ${contractTitle(contract)}` : contractTitle(contract),
      href: journeyHref(contract),
    });
  }
  for (const contract of input.reviewContracts) {
    items.push({
      kind: 'contract',
      title: 'Contract awaiting review',
      detail: nextActionCopy(contract),
      href: journeyHref(contract),
    });
  }
  for (const contract of input.attentionContracts) {
    if (input.evidenceContracts.includes(contract) || input.reviewContracts.includes(contract)) continue;
    items.push({
      kind: 'learner',
      title: 'Learner needs attention',
      detail: workspaceFocus(contract).next,
      href: journeyHref(contract),
    });
  }
  for (const contract of input.completed) {
    items.push({
      kind: 'outcome',
      title: 'Completed mentoring outcome',
      detail: contractTitle(contract),
      href: '/dashboard/mentorships',
    });
  }
  return items.slice(0, 8);
}
