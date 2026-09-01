import {
  DELIVERABLE_STATUS,
  FINAL_DELIVERABLE_REVIEW,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  STEP_OWNER,
  USER_ROLE,
  canConfirmCompletion,
  canTransitionContract,
  canTransitionMilestone,
  combineGoalText,
  completionBlockers,
  emptyFinalDeliverable,
  EVIDENCE_TYPE,
  isLearnerReviewStatus,
  isMentorReviewStatus,
  latestMilestoneProjection,
  nextBeginWorkMilestone,
  normalizeContract,
  normalizeDeliverable,
  normalizeEvidenceItem,
  normalizeFinalDeliverable,
  normalizeGoal,
  normalizeMilestone,
  normalizeObjective,
  restLines,
  firstLine,
  showcaseDocId,
  validateChangeRequestReason,
  validateEvidenceDrafts,
  validateFinalDeliverable,
  validateGoalDraft,
  validateMentorPlan,
  type EvidenceDraft,
  type EvidenceItem,
  type FinalDeliverableFile,
} from './domain/index.js';
import type {
  ContractRevision,
  Deliverable,
  Goal,
  LearningContract,
  LearningContractStatus,
  Milestone,
  Objective,
  StepOwner,
} from './domain/index.js';

export type ContractActor = {
  uid: string;
  role: typeof USER_ROLE.learner | typeof USER_ROLE.mentor | typeof USER_ROLE.admin;
};

export type ContractAction =
  | {
      type: 'SAVE_DRAFT';
      goalText: string;
      goalTitle?: string;
      goalDescription?: string;
      context?: string;
      deliverableTitle: string;
      deliverableDescription: string;
      expectedEvidence?: string;
      now: IsoNow;
    }
  | { type: 'SEND_TO_MENTOR'; now: IsoNow }
  | {
      type: 'SAVE_MENTOR_REVIEW';
      goalText: string;
      goalTitle?: string;
      goalDescription?: string;
      objectives: { text?: string; title?: string; description?: string }[];
      milestones: {
        title: string;
        description: string;
        evidenceRequired?: string;
        successCriteria?: string;
      }[];
      deliverableTitle: string;
      deliverableDescription: string;
      expectedEvidence?: string;
      comment?: string;
      now: IsoNow;
    }
  | { type: 'SEND_TO_LEARNER'; now: IsoNow }
  | { type: 'APPROVE_PLAN'; now: IsoNow }
  | { type: 'REQUEST_CHANGES'; reason: string; now: IsoNow }
  | { type: 'ACTIVATE'; now: IsoNow }
  | { type: 'PAUSE_CONTRACT'; now: IsoNow }
  | { type: 'RESUME_CONTRACT'; now: IsoNow }
  | { type: 'CONFIRM_COMPLETION'; now: IsoNow }
  | { type: 'REOPEN_COMPLETION'; now: IsoNow }
  | {
      type: 'SUBMIT_FINAL_DELIVERABLE';
      title: string;
      description: string;
      links?: string[];
      files?: FinalDeliverableFile[];
      evidenceItemIds?: string[];
      skillsDemonstrated?: string[];
      now: IsoNow;
    }
  | { type: 'REVIEW_FINAL_DELIVERABLE'; comment?: string; now: IsoNow }
  | { type: 'REQUEST_FINAL_REVISION'; comment: string; now: IsoNow }
  | { type: 'PUBLISH_SHOWCASE'; now: IsoNow }
  | { type: 'UNPUBLISH_SHOWCASE'; now: IsoNow }
  | { type: 'REJECT_PROPOSAL'; reason: string; now: IsoNow }
  | { type: 'CANCEL'; reason?: string; now: IsoNow }
  | {
      type: 'SUBMIT_EVIDENCE';
      text?: string;
      link?: string;
      items?: EvidenceDraft[];
      now: IsoNow;
    }
  | { type: 'BEGIN_WORK'; now: IsoNow }
  | { type: 'START_REVIEW'; now: IsoNow }
  | { type: 'APPROVE_MILESTONE'; now: IsoNow }
  | { type: 'REQUEST_REVISION'; feedback: string; now: IsoNow }
  | { type: 'REJECT_MILESTONE'; feedback: string; now: IsoNow }
  | { type: 'DECLINE_MILESTONE'; feedback: string; now: IsoNow };

export type ContractActionType = ContractAction['type'];

export type ClientContractAction = {
  [Type in ContractAction['type']]: Omit<Extract<ContractAction, { type: Type }>, 'now'>;
}[ContractAction['type']];

export type ContractEffect =
  | { type: 'publish_showcase' }
  | { type: 'set_showcase_published'; published: boolean };

export type ReduceResult =
  | { ok: true; contract: LearningContract; effects: ContractEffect[] }
  | { ok: false; error: string };

type IsoNow = string;

export const LEARNING_JOURNEY_STEPS = [
  {
    id: LEARNING_CONTRACT_STATUS.draft,
    label: 'Learner proposal',
    description: 'Learner writes the draft goal and deliverable.',
  },
  {
    id: LEARNING_CONTRACT_STATUS.underMentorReview,
    label: 'Mentor review',
    description: 'Mentor revises the plan and adds objectives and milestones.',
  },
  {
    id: LEARNING_CONTRACT_STATUS.underLearnerReview,
    label: 'Learner review',
    description: 'Learner approves or requests a revision.',
  },
  {
    id: LEARNING_CONTRACT_STATUS.mutuallyApproved,
    label: 'Mutual approval',
    description: 'Both sides agreed. The contract is not active yet.',
  },
  {
    id: LEARNING_CONTRACT_STATUS.inProgress,
    label: 'Active',
    description: 'The agreed contract is active. One milestone at a time.',
  },
  {
    id: LEARNING_CONTRACT_STATUS.completed,
    label: 'Completed',
    description: 'The showcase is created. Ordinary editing is closed.',
  },
] as const;

export function journeyStepIndex(status: LearningContractStatus): number {
  if (status === LEARNING_CONTRACT_STATUS.draft) return 0;
  if (isMentorReviewStatus(status)) return 1;
  if (isLearnerReviewStatus(status)) return 2;
  if (
    status === LEARNING_CONTRACT_STATUS.mutuallyApproved ||
    status === LEARNING_CONTRACT_STATUS.agreed
  ) {
    return 3;
  }
  if (
    status === LEARNING_CONTRACT_STATUS.inProgress ||
    status === LEARNING_CONTRACT_STATUS.paused
  ) {
    return 4;
  }
  if (
    status === LEARNING_CONTRACT_STATUS.completionPending ||
    status === LEARNING_CONTRACT_STATUS.completed
  ) {
    return 5;
  }
  return 1;
}

export function createDraftContract(input: {
  id: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  now: string;
}): LearningContract {
  return {
    id: input.id,
    relationshipId: input.relationshipId,
    learnerId: input.learnerId,
    mentorId: input.mentorId,
    status: LEARNING_CONTRACT_STATUS.draft,
    currentStepOwner: STEP_OWNER.learner,
    createdAt: input.now,
    updatedAt: input.now,
    goal: null,
    goalHistory: [],
    objectives: [],
    milestones: [],
    deliverable: null,
    changeRequestReason: null,
    context: null,
    mentorComment: null,
    revisionHistory: [
      {
        id: newId(),
        actorId: input.learnerId,
        actorRole: USER_ROLE.learner,
        stage: LEARNING_CONTRACT_STATUS.draft,
        action: 'CONTRACT_CREATED',
        timestamp: input.now,
        comment: null,
        summary: 'Learner opened the Learning Goal Builder.',
      },
    ],
    evidenceItems: [],
    finalDeliverable: emptyFinalDeliverable(),
    showcaseId: null,
    showcasePublished: false,
  };
}

export function reduceContract(
  contract: LearningContract,
  action: ContractAction,
  actor: ContractActor,
): ReduceResult {
  const current = normalizeContract(contract);
  switch (action.type) {
    case 'SAVE_DRAFT':
      return saveDraft(current, action, actor);
    case 'SEND_TO_MENTOR':
      return sendToMentor(current, action, actor);
    case 'SAVE_MENTOR_REVIEW':
      return saveMentorReview(current, action, actor);
    case 'SEND_TO_LEARNER':
      return sendToLearner(current, action, actor);
    case 'APPROVE_PLAN':
      return approvePlan(current, action, actor);
    case 'REQUEST_CHANGES':
      return requestChanges(current, action, actor);
    case 'ACTIVATE':
      return activateContract(current, action, actor);
    case 'PAUSE_CONTRACT':
      return pauseContract(current, action, actor);
    case 'RESUME_CONTRACT':
      return resumeContract(current, action, actor);
    case 'CONFIRM_COMPLETION':
      return confirmCompletion(current, action, actor);
    case 'REOPEN_COMPLETION':
      return reopenCompletion(current, action, actor);
    case 'SUBMIT_FINAL_DELIVERABLE':
      return submitFinalDeliverable(current, action, actor);
    case 'REVIEW_FINAL_DELIVERABLE':
      return reviewFinalDeliverable(current, action, actor);
    case 'REQUEST_FINAL_REVISION':
      return requestFinalRevision(current, action, actor);
    case 'PUBLISH_SHOWCASE':
      return publishShowcaseAction(current, action, actor, true);
    case 'UNPUBLISH_SHOWCASE':
      return publishShowcaseAction(current, action, actor, false);
    case 'REJECT_PROPOSAL':
      return rejectProposal(current, action, actor);
    case 'CANCEL':
      return cancelContract(current, action, actor);
    case 'SUBMIT_EVIDENCE':
      return submitEvidence(current, action, actor);
    case 'BEGIN_WORK':
      return beginWork(current, action, actor);
    case 'START_REVIEW':
      return startReview(current, action, actor);
    case 'APPROVE_MILESTONE':
      return approveMilestone(current, action, actor);
    case 'REQUEST_REVISION':
    case 'REJECT_MILESTONE':
      return requestRevision(current, action, actor);
    case 'DECLINE_MILESTONE':
      return declineMilestone(current, action, actor);
  }
}

export function availableActions(
  contract: LearningContract,
  actor: ContractActor,
): ContractActionType[] {
  const current = normalizeContract(contract);
  const workspace = workspaceActions(current, actor);
  if (!isStepActor(current, actor)) {
    return workspace;
  }

  switch (current.status) {
    case LEARNING_CONTRACT_STATUS.draft:
      return ['SAVE_DRAFT', 'SEND_TO_MENTOR', 'CANCEL'];
    case LEARNING_CONTRACT_STATUS.submittedByLearner:
    case LEARNING_CONTRACT_STATUS.underMentorReview:
    case LEARNING_CONTRACT_STATUS.revisionRequested:
      return ['SAVE_MENTOR_REVIEW', 'SEND_TO_LEARNER', 'REJECT_PROPOSAL', 'CANCEL'];
    case LEARNING_CONTRACT_STATUS.proposedByMentor:
    case LEARNING_CONTRACT_STATUS.underLearnerReview:
      return ['APPROVE_PLAN', 'REQUEST_CHANGES', 'CANCEL'];
    case LEARNING_CONTRACT_STATUS.mutuallyApproved:
    case LEARNING_CONTRACT_STATUS.agreed:
      return ['ACTIVATE'];
    case LEARNING_CONTRACT_STATUS.inProgress: {
      const actions: ContractActionType[] = [...workspace];
      if (actor.role === USER_ROLE.learner && nextBeginWorkMilestone(current.milestones)) {
        actions.push('BEGIN_WORK');
      }
      if (
        actor.role === USER_ROLE.learner &&
        actionableMilestone(current, [MILESTONE_STATUS.active, MILESTONE_STATUS.rejected])
      ) {
        actions.push('SUBMIT_EVIDENCE');
      }
      if (
        actor.role === USER_ROLE.mentor &&
        actionableMilestone(current, [MILESTONE_STATUS.submitted])
      ) {
        actions.push('START_REVIEW', 'APPROVE_MILESTONE', 'REQUEST_REVISION', 'REJECT_MILESTONE', 'DECLINE_MILESTONE');
      }
      if (
        actor.role === USER_ROLE.mentor &&
        actionableMilestone(current, [MILESTONE_STATUS.underReview])
      ) {
        actions.push('APPROVE_MILESTONE', 'REQUEST_REVISION', 'REJECT_MILESTONE', 'DECLINE_MILESTONE');
      }
      return actions;
    }
    case LEARNING_CONTRACT_STATUS.paused:
    case LEARNING_CONTRACT_STATUS.completionPending:
    case LEARNING_CONTRACT_STATUS.completed:
      return workspace;
    case LEARNING_CONTRACT_STATUS.rejected:
    case LEARNING_CONTRACT_STATUS.cancelled:
      return [];
  }
}

function workspaceActions(
  contract: LearningContract,
  actor: ContractActor,
): ContractActionType[] {
  if (!isPairingActor(contract, actor) && actor.role !== USER_ROLE.admin) return [];
  if (
    (contract.status === LEARNING_CONTRACT_STATUS.mutuallyApproved ||
      contract.status === LEARNING_CONTRACT_STATUS.agreed) &&
    isPairingActor(contract, actor)
  ) {
    return ['ACTIVATE'];
  }
  if (contract.status === LEARNING_CONTRACT_STATUS.inProgress) {
    return ['PAUSE_CONTRACT', 'CANCEL'];
  }
  if (contract.status === LEARNING_CONTRACT_STATUS.paused) {
    return ['RESUME_CONTRACT', 'CANCEL'];
  }
  if (contract.status === LEARNING_CONTRACT_STATUS.completionPending) {
    const actions: ContractActionType[] = ['REOPEN_COMPLETION'];
    if (
      actor.role === USER_ROLE.learner &&
      actor.uid === contract.learnerId &&
      contract.currentStepOwner === STEP_OWNER.learner
    ) {
      actions.push('SUBMIT_FINAL_DELIVERABLE');
    }
    if (actor.role === USER_ROLE.mentor && actor.uid === contract.mentorId) {
      const status = contract.finalDeliverable.reviewStatus;
      if (
        status === FINAL_DELIVERABLE_REVIEW.submitted ||
        status === FINAL_DELIVERABLE_REVIEW.reviewed
      ) {
        actions.push('REVIEW_FINAL_DELIVERABLE', 'REQUEST_FINAL_REVISION');
      }
      if (canConfirmCompletion(contract)) {
        actions.push('CONFIRM_COMPLETION');
      }
    }
    return actions;
  }
  if (contract.status === LEARNING_CONTRACT_STATUS.completed) {
    if (actor.role === USER_ROLE.learner && actor.uid === contract.learnerId) {
      return contract.showcasePublished ? ['UNPUBLISH_SHOWCASE'] : ['PUBLISH_SHOWCASE'];
    }
    return [];
  }
  return [];
}

export function isStepActor(contract: LearningContract, actor: ContractActor): boolean {
  if (actor.role === USER_ROLE.admin) return false;
  if (actor.role === USER_ROLE.learner) {
    return actor.uid === contract.learnerId && contract.currentStepOwner === STEP_OWNER.learner;
  }
  if (actor.role === USER_ROLE.mentor) {
    return actor.uid === contract.mentorId && contract.currentStepOwner === STEP_OWNER.mentor;
  }
  return false;
}

export function waitingOn(contract: LearningContract): StepOwner {
  return contract.currentStepOwner;
}

export function activeMilestoneCount(contract: LearningContract): number {
  return contract.milestones.filter((item) => item.status === MILESTONE_STATUS.active).length;
}

function fail(error: string): ReduceResult {
  return { ok: false, error };
}

function ok(contract: LearningContract, effects: ContractEffect[] = []): ReduceResult {
  return { ok: true, contract: normalizeContract(contract), effects };
}

function isPairingActor(contract: LearningContract, actor: ContractActor): boolean {
  if (actor.role === USER_ROLE.admin) return true;
  if (actor.role === USER_ROLE.learner) return actor.uid === contract.learnerId;
  if (actor.role === USER_ROLE.mentor) return actor.uid === contract.mentorId;
  return false;
}

function requireStatuses(
  contract: LearningContract,
  statuses: LearningContractStatus[],
): ReduceResult | null {
  if (!statuses.includes(contract.status)) {
    return fail(`This action is not available in the ${contract.status} state`);
  }
  return null;
}

function requireActor(
  contract: LearningContract,
  actor: ContractActor,
  owner: StepOwner,
): ReduceResult | null {
  if (contract.currentStepOwner !== owner) {
    return fail(`Waiting on the ${contract.currentStepOwner}`);
  }
  const expectedUid = owner === STEP_OWNER.learner ? contract.learnerId : contract.mentorId;
  if (actor.role !== owner || actor.uid !== expectedUid) {
    return fail('You cannot act on this step');
  }
  return null;
}

function moveTo(
  contract: LearningContract,
  next: LearningContractStatus,
): ReduceResult | null {
  if (contract.status === next) return null;
  if (!canTransitionContract(contract.status, next)) {
    return fail(`Cannot move from ${contract.status} to ${next}`);
  }
  return null;
}

function appendRevision(
  contract: LearningContract,
  input: {
    actor: ContractActor;
    action: string;
    now: string;
    comment?: string | null;
    summary: string;
    stage?: LearningContractStatus;
  },
): ContractRevision[] {
  const entry: ContractRevision = {
    id: newId(),
    actorId: input.actor.uid,
    actorRole: input.actor.role,
    stage: input.stage ?? contract.status,
    action: input.action,
    timestamp: input.now,
    comment: input.comment?.trim() || null,
    summary: input.summary,
  };
  return [...contract.revisionHistory, entry];
}

function resolveGoalFields(input: {
  goalText?: string;
  goalTitle?: string;
  goalDescription?: string;
}): { title: string; description: string; text: string } {
  const title = (input.goalTitle ?? '').trim() || firstLine(input.goalText ?? '');
  const description = (input.goalDescription ?? '').trim() || restLines(input.goalText ?? '');
  const text = (input.goalText ?? '').trim() || combineGoalText(title, description);
  return { title, description, text };
}

function saveDraft(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SAVE_DRAFT' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.draft]) ??
    requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;

  const goalFields = resolveGoalFields(action);
  return ok({
    ...contract,
    updatedAt: action.now,
    context: action.context?.trim() || contract.context,
    goal: upsertGoal(contract.goal, goalFields),
    deliverable: upsertDeliverable(contract.deliverable, {
      title: action.deliverableTitle,
      description: action.deliverableDescription,
      expectedEvidence: action.expectedEvidence ?? contract.deliverable?.expectedEvidence ?? '',
      status: DELIVERABLE_STATUS.draft,
    }),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'SAVE_DRAFT',
      now: action.now,
      summary: 'Learner saved a draft goal and deliverable.',
    }),
  });
}

function sendToMentor(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SEND_TO_MENTOR' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.draft]) ??
    requireActor(contract, actor, STEP_OWNER.learner) ??
    moveTo(contract, LEARNING_CONTRACT_STATUS.submittedByLearner);
  if (blocked) return blocked;

  const check = validateGoalDraft({
    goalText: contract.goal?.text ?? '',
    goalTitle: contract.goal?.title ?? '',
    goalDescription: contract.goal?.description ?? '',
    deliverableTitle: contract.deliverable?.title ?? '',
    deliverableDescription: contract.deliverable?.description ?? '',
  });
  if (!check.ok) return fail(check.error);

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.submittedByLearner,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    changeRequestReason: null,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'SUBMITTED_BY_LEARNER',
      now: action.now,
      comment: contract.context,
      summary: 'Learner submitted the draft goal and deliverable.',
    }),
  });
}

function saveMentorReview(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SAVE_MENTOR_REVIEW' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [
      LEARNING_CONTRACT_STATUS.submittedByLearner,
      LEARNING_CONTRACT_STATUS.underMentorReview,
      LEARNING_CONTRACT_STATUS.revisionRequested,
    ]) ?? requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;

  const nextStatus =
    contract.status === LEARNING_CONTRACT_STATUS.submittedByLearner
      ? LEARNING_CONTRACT_STATUS.underMentorReview
      : contract.status === LEARNING_CONTRACT_STATUS.revisionRequested
        ? LEARNING_CONTRACT_STATUS.underMentorReview
        : contract.status;
  const transitionBlock = moveTo(contract, nextStatus);
  if (nextStatus !== contract.status && transitionBlock) return transitionBlock;

  const goalFields = resolveGoalFields(action);
  const nextGoal = reviseGoal(contract, goalFields);
  return ok({
    ...contract,
    status: nextStatus,
    updatedAt: action.now,
    mentorComment: action.comment?.trim() || contract.mentorComment,
    goal: nextGoal.goal,
    goalHistory: nextGoal.goalHistory,
    objectives: action.objectives.map((item, index) =>
      normalizeObjective(
        {
          id: contract.objectives[index]?.id ?? newId(),
          title: item.title,
          description: item.description,
          text: item.text,
          order: index,
        },
        index,
      ),
    ),
    milestones: action.milestones.map((item, index) =>
      mergeMilestone(contract.milestones[index], item, index),
    ),
    deliverable: upsertDeliverable(contract.deliverable, {
      title: action.deliverableTitle,
      description: action.deliverableDescription,
      expectedEvidence:
        action.expectedEvidence ?? contract.deliverable?.expectedEvidence ?? '',
      status: DELIVERABLE_STATUS.draft,
    }),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'MENTOR_REVISED',
      now: action.now,
      comment: action.comment,
      summary: 'Mentor revised the goal, objectives, milestones, or deliverable.',
    }),
  });
}

function sendToLearner(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SEND_TO_LEARNER' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [
      LEARNING_CONTRACT_STATUS.submittedByLearner,
      LEARNING_CONTRACT_STATUS.underMentorReview,
      LEARNING_CONTRACT_STATUS.revisionRequested,
    ]) ?? requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;

  const check = validateMentorPlan({
    goalText: contract.goal?.text ?? '',
    goalTitle: contract.goal?.title ?? '',
    goalDescription: contract.goal?.description ?? '',
    deliverableDescription: contract.deliverable?.description ?? '',
    objectives: contract.objectives,
    milestones: contract.milestones,
  });
  if (!check.ok) return fail(check.error);

  const viaProposed = moveTo(contract, LEARNING_CONTRACT_STATUS.proposedByMentor);
  if (viaProposed) return viaProposed;

  const ordered = [...contract.milestones]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index,
      status: MILESTONE_STATUS.locked,
    }));

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.proposedByMentor,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    milestones: ordered,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'PROPOSED_BY_MENTOR',
      now: action.now,
      comment: contract.mentorComment,
      summary: 'Mentor proposed the learning contract for learner review.',
    }),
  });
}

function approvePlan(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'APPROVE_PLAN' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [
      LEARNING_CONTRACT_STATUS.proposedByMentor,
      LEARNING_CONTRACT_STATUS.underLearnerReview,
    ]) ?? requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;
  if (contract.milestones.length === 0) return fail('This plan has no milestones');

  const toApproved = moveTo(contract, LEARNING_CONTRACT_STATUS.mutuallyApproved);
  if (toApproved) return toApproved;

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.mutuallyApproved,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    changeRequestReason: null,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'MUTUALLY_APPROVED',
      now: action.now,
      summary: 'Learner approved the mentor proposal. Both sides have agreed.',
    }),
  });
}

function requestChanges(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REQUEST_CHANGES' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [
      LEARNING_CONTRACT_STATUS.proposedByMentor,
      LEARNING_CONTRACT_STATUS.underLearnerReview,
    ]) ?? requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;
  const reason = validateChangeRequestReason(action.reason);
  if (!reason.ok) return fail(reason.error);

  const toRevision = moveTo(contract, LEARNING_CONTRACT_STATUS.revisionRequested);
  if (toRevision) return toRevision;

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.revisionRequested,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    changeRequestReason: action.reason.trim(),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REVISION_REQUESTED',
      now: action.now,
      comment: action.reason,
      summary: 'Learner requested a revision.',
    }),
  });
}

function activateContract(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'ACTIVATE' }>,
  actor: ContractActor,
): ReduceResult {
  const allowedStatuses: LearningContractStatus[] = [
    LEARNING_CONTRACT_STATUS.mutuallyApproved,
    LEARNING_CONTRACT_STATUS.agreed,
  ];
  if (!allowedStatuses.includes(contract.status)) {
    return fail('A contract cannot become ACTIVE until it is mutually approved');
  }
  if (!isPairingActor(contract, actor)) {
    return fail('You cannot act on this step');
  }
  if (contract.milestones.length === 0) return fail('This plan has no milestones');

  const toActive = moveTo(contract, LEARNING_CONTRACT_STATUS.inProgress);
  if (toActive) return toActive;

  const started = [...contract.milestones]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index,
      status: index === 0 ? MILESTONE_STATUS.active : MILESTONE_STATUS.locked,
    }));

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.inProgress,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    changeRequestReason: null,
    milestones: started,
    deliverable: contract.deliverable
      ? { ...contract.deliverable, status: DELIVERABLE_STATUS.inProgress }
      : contract.deliverable,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'ACTIVATED',
      now: action.now,
      summary: 'The mutually approved contract is now ACTIVE.',
    }),
  });
}

function pauseContract(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'PAUSE_CONTRACT' }>,
  actor: ContractActor,
): ReduceResult {
  if (contract.status !== LEARNING_CONTRACT_STATUS.inProgress) {
    return fail('Only an ACTIVE contract can be paused');
  }
  if (!isPairingActor(contract, actor)) {
    return fail('You cannot act on this step');
  }
  const blocked = moveTo(contract, LEARNING_CONTRACT_STATUS.paused);
  if (blocked) return blocked;
  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.paused,
    updatedAt: action.now,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'PAUSED',
      now: action.now,
      summary: 'The contract was paused. Evidence work is locked until resume.',
    }),
  });
}

function resumeContract(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'RESUME_CONTRACT' }>,
  actor: ContractActor,
): ReduceResult {
  if (contract.status !== LEARNING_CONTRACT_STATUS.paused) {
    return fail('Only a paused contract can be resumed');
  }
  if (!isPairingActor(contract, actor)) {
    return fail('You cannot act on this step');
  }
  const blocked = moveTo(contract, LEARNING_CONTRACT_STATUS.inProgress);
  if (blocked) return blocked;
  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.inProgress,
    updatedAt: action.now,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'RESUMED',
      now: action.now,
      summary: 'The contract is ACTIVE again.',
    }),
  });
}

function confirmCompletion(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'CONFIRM_COMPLETION' }>,
  actor: ContractActor,
): ReduceResult {
  if (contract.status !== LEARNING_CONTRACT_STATUS.completionPending) {
    return fail('Completion can only be confirmed when it is pending');
  }
  if (actor.role !== USER_ROLE.mentor || actor.uid !== contract.mentorId) {
    return fail('Only the mentor can confirm completion');
  }
  const missing = completionBlockers(contract);
  if (missing.length > 0) {
    return fail(missing[0] ?? 'Completion requirements are not satisfied');
  }
  const blocked = moveTo(contract, LEARNING_CONTRACT_STATUS.completed);
  if (blocked) return blocked;

  const last = [...contract.milestones].sort((a, b) => a.order - b.order).at(-1);
  const deliverable: Deliverable | null = contract.deliverable
    ? {
        ...contract.deliverable,
        status: DELIVERABLE_STATUS.completed,
        finalEvidenceUrl:
          contract.finalDeliverable.links[0] ||
          last?.evidenceLink ||
          last?.evidenceText ||
          contract.deliverable.finalEvidenceUrl,
      }
    : contract.deliverable;

  const showcaseId = showcaseDocId(contract.id);
  const withCompleted: LearningContract = {
    ...contract,
    status: LEARNING_CONTRACT_STATUS.completed,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    deliverable,
    showcaseId,
    showcasePublished: true,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'CONTRACT_COMPLETED',
      now: action.now,
      summary: 'Completion confirmed. The showcase was created and published.',
    }),
  };
  const withShowcase = {
    ...withCompleted,
    revisionHistory: [
      ...withCompleted.revisionHistory,
      {
        id: newId(),
        actorId: actor.uid,
        actorRole: actor.role,
        stage: LEARNING_CONTRACT_STATUS.completed,
        action: 'SHOWCASE_CREATED',
        timestamp: action.now,
        comment: null,
        summary: 'Showcase record created for this completed contract.',
      },
      {
        id: newId(),
        actorId: actor.uid,
        actorRole: actor.role,
        stage: LEARNING_CONTRACT_STATUS.completed,
        action: 'SHOWCASE_PUBLISHED',
        timestamp: action.now,
        comment: null,
        summary: 'Showcase published on the learner and mentor profiles.',
      },
    ],
  };

  return ok(withShowcase, [{ type: 'publish_showcase' }]);
}

function reopenCompletion(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REOPEN_COMPLETION' }>,
  actor: ContractActor,
): ReduceResult {
  if (contract.status !== LEARNING_CONTRACT_STATUS.completionPending) {
    return fail('Only a pending completion can be reopened');
  }
  if (!isPairingActor(contract, actor)) {
    return fail('You cannot act on this step');
  }
  const blocked = moveTo(contract, LEARNING_CONTRACT_STATUS.inProgress);
  if (blocked) return blocked;

  const ordered = [...contract.milestones].sort((a, b) => a.order - b.order);
  const last = ordered.at(-1);
  const milestones = contract.milestones.map((item) =>
    last && item.id === last.id
      ? { ...item, status: MILESTONE_STATUS.active }
      : item,
  );

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.inProgress,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    milestones,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REOPENED',
      now: action.now,
      summary: 'Completion was reopened. The last milestone is active again.',
    }),
  });
}

function submitFinalDeliverable(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SUBMIT_FINAL_DELIVERABLE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.completionPending]) ??
    requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;

  const valid = validateFinalDeliverable({
    title: action.title,
    description: action.description,
    links: action.links,
    files: action.files,
    evidenceItemIds: action.evidenceItemIds,
    skillsDemonstrated: action.skillsDemonstrated,
    contractId: contract.id,
    userId: actor.uid,
  });
  if (!valid.ok) return fail(valid.error);

  const allowedEvidence = new Set(contract.evidenceItems.map((item) => item.id));
  const evidenceItemIds = (action.evidenceItemIds ?? []).filter((id) => allowedEvidence.has(id));

  const revised =
    contract.finalDeliverable.reviewStatus === FINAL_DELIVERABLE_REVIEW.revisionRequested;
  const finalDeliverable = normalizeFinalDeliverable({
    title: action.title,
    description: action.description,
    links: action.links,
    files: action.files,
    evidenceItemIds,
    skillsDemonstrated: action.skillsDemonstrated,
    submittedAt: action.now,
    submittedBy: actor.uid,
    reviewStatus: FINAL_DELIVERABLE_REVIEW.submitted,
    reviewComment: contract.finalDeliverable.reviewComment,
    reviewedAt: null,
    reviewedBy: null,
  });

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    finalDeliverable,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'FINAL_DELIVERABLE_SUBMITTED',
      now: action.now,
      summary: revised
        ? 'Learner resubmitted the final deliverable.'
        : 'Learner submitted the final deliverable.',
    }),
  });
}

function reviewFinalDeliverable(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REVIEW_FINAL_DELIVERABLE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.completionPending]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;
  if (
    contract.finalDeliverable.reviewStatus !== FINAL_DELIVERABLE_REVIEW.submitted &&
    contract.finalDeliverable.reviewStatus !== FINAL_DELIVERABLE_REVIEW.reviewed
  ) {
    return fail('There is no submitted final deliverable to review');
  }

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    finalDeliverable: {
      ...contract.finalDeliverable,
      reviewStatus: FINAL_DELIVERABLE_REVIEW.reviewed,
      reviewComment: action.comment?.trim() || contract.finalDeliverable.reviewComment,
      reviewedAt: action.now,
      reviewedBy: actor.uid,
    },
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'FINAL_DELIVERABLE_REVIEWED',
      now: action.now,
      comment: action.comment,
      summary: 'Mentor completed the final deliverable review.',
    }),
  });
}

function requestFinalRevision(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REQUEST_FINAL_REVISION' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.completionPending]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;
  if (!action.comment.trim()) return fail('Feedback is required to request a revision');
  if (!isFinalDeliverableSubmittedStatus(contract.finalDeliverable.reviewStatus)) {
    return fail('There is no submitted final deliverable to revise');
  }

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    finalDeliverable: {
      ...contract.finalDeliverable,
      reviewStatus: FINAL_DELIVERABLE_REVIEW.revisionRequested,
      reviewComment: action.comment.trim(),
      reviewedAt: action.now,
      reviewedBy: actor.uid,
    },
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REVISION_REQUESTED',
      now: action.now,
      comment: action.comment,
      summary: 'Mentor requested a revision of the final deliverable.',
    }),
  });
}

function isFinalDeliverableSubmittedStatus(status: string): boolean {
  return (
    status === FINAL_DELIVERABLE_REVIEW.submitted ||
    status === FINAL_DELIVERABLE_REVIEW.reviewed ||
    status === FINAL_DELIVERABLE_REVIEW.revisionRequested
  );
}

function publishShowcaseAction(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'PUBLISH_SHOWCASE' | 'UNPUBLISH_SHOWCASE' }>,
  actor: ContractActor,
  published: boolean,
): ReduceResult {
  if (contract.status !== LEARNING_CONTRACT_STATUS.completed) {
    return fail('Only a completed contract has a showcase');
  }
  if (actor.role !== USER_ROLE.learner || actor.uid !== contract.learnerId) {
    return fail('Only the learner can change showcase publication');
  }
  if (contract.showcasePublished === published) {
    return ok(contract);
  }

  const showcaseId = contract.showcaseId ?? showcaseDocId(contract.id);
  return ok(
    {
      ...contract,
      showcaseId,
      showcasePublished: published,
      updatedAt: action.now,
      revisionHistory: appendRevision(contract, {
        actor,
        action: published ? 'SHOWCASE_PUBLISHED' : 'SHOWCASE_UNPUBLISHED',
        now: action.now,
        summary: published
          ? 'Learner published the showcase.'
          : 'Learner hid the showcase from public profiles.',
      }),
    },
    [{ type: 'set_showcase_published', published }],
  );
}

function rejectProposal(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REJECT_PROPOSAL' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [
      LEARNING_CONTRACT_STATUS.submittedByLearner,
      LEARNING_CONTRACT_STATUS.underMentorReview,
      LEARNING_CONTRACT_STATUS.revisionRequested,
    ]) ?? requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;
  if (!action.reason.trim()) return fail('A reason is required to reject the proposal');

  const toRejected = moveTo(contract, LEARNING_CONTRACT_STATUS.rejected);
  if (toRejected) return toRejected;

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.rejected,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    changeRequestReason: action.reason.trim(),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REJECTED',
      now: action.now,
      comment: action.reason,
      summary: 'Mentor rejected the learning contract proposal.',
    }),
  });
}

function cancelContract(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'CANCEL' }>,
  actor: ContractActor,
): ReduceResult {
  const cancellable: LearningContractStatus[] = [
    LEARNING_CONTRACT_STATUS.draft,
    LEARNING_CONTRACT_STATUS.submittedByLearner,
    LEARNING_CONTRACT_STATUS.underMentorReview,
    LEARNING_CONTRACT_STATUS.proposedByMentor,
    LEARNING_CONTRACT_STATUS.underLearnerReview,
    LEARNING_CONTRACT_STATUS.revisionRequested,
    LEARNING_CONTRACT_STATUS.inProgress,
    LEARNING_CONTRACT_STATUS.paused,
  ];
  if (!cancellable.includes(contract.status)) {
    return fail('This contract can no longer be cancelled');
  }
  if (!isPairingActor(contract, actor)) {
    return fail('You cannot act on this step');
  }

  const toCancelled = moveTo(contract, LEARNING_CONTRACT_STATUS.cancelled);
  if (toCancelled) return toCancelled;

  return ok({
    ...contract,
    status: LEARNING_CONTRACT_STATUS.cancelled,
    updatedAt: action.now,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'CANCELLED',
      now: action.now,
      comment: action.reason,
      summary:
        contract.status === LEARNING_CONTRACT_STATUS.inProgress ||
        contract.status === LEARNING_CONTRACT_STATUS.paused
          ? `${actor.role} cancelled the learning contract.`
          : `${actor.role} cancelled the Learning Goal Builder.`,
    }),
  });
}

function draftsFromSubmit(
  action: Extract<ContractAction, { type: 'SUBMIT_EVIDENCE' }>,
): EvidenceDraft[] {
  if (action.items && action.items.length > 0) return action.items;
  const drafts: EvidenceDraft[] = [];
  if (action.text?.trim()) {
    drafts.push({ type: EVIDENCE_TYPE.text, content: action.text.trim() });
  }
  if (action.link?.trim()) {
    drafts.push({ type: EVIDENCE_TYPE.link, content: action.link.trim() });
  }
  return drafts;
}

function appendEvidenceItems(
  contract: LearningContract,
  milestone: Milestone,
  actor: ContractActor,
  drafts: EvidenceDraft[],
  now: string,
): EvidenceItem[] {
  const created = drafts.map((draft) =>
    normalizeEvidenceItem({
      id: newId(),
      milestoneId: milestone.id,
      contractId: contract.id,
      submittedBy: actor.uid,
      type: draft.type,
      content: draft.content,
      storagePath: draft.storagePath ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return [...(contract.evidenceItems ?? []), ...created];
}

function withMilestoneProjection(
  milestone: Milestone,
  items: EvidenceItem[],
  status: Milestone['status'],
  lastFeedback: string | null,
): Milestone {
  const projection = latestMilestoneProjection(
    items.filter((item) => item.milestoneId === milestone.id),
  );
  return {
    ...milestone,
    status,
    lastFeedback,
    evidenceText: projection.evidenceText,
    evidenceLink: projection.evidenceLink,
  };
}

function moveMilestone(
  milestone: Milestone,
  to: Milestone['status'],
): ReduceResult | null {
  if (!canTransitionMilestone(milestone.status, to)) {
    return fail(`A ${milestone.status} milestone cannot move to ${to}`);
  }
  return null;
}

function submitEvidence(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SUBMIT_EVIDENCE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;

  const current = actionableMilestone(contract, [
    MILESTONE_STATUS.active,
    MILESTONE_STATUS.rejected,
  ]);
  if (!current) return fail('There is no active milestone to submit');

  const drafts = draftsFromSubmit(action);
  const valid = validateEvidenceDrafts(drafts, {
    contractId: contract.id,
    milestoneId: current.id,
    userId: actor.uid,
  });
  if (!valid.ok) return fail(valid.error);

  const blockedMove = moveMilestone(current, MILESTONE_STATUS.submitted);
  if (blockedMove) return blockedMove;

  const evidenceItems = appendEvidenceItems(contract, current, actor, drafts, action.now);
  const revised = current.status === MILESTONE_STATUS.rejected;

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    evidenceItems,
    milestones: contract.milestones.map((item) =>
      item.id === current.id
        ? withMilestoneProjection(item, evidenceItems, MILESTONE_STATUS.submitted, item.lastFeedback)
        : item,
    ),
    revisionHistory: appendRevision(contract, {
      actor,
      action: revised ? 'EVIDENCE_REVISED' : 'EVIDENCE_SUBMITTED',
      now: action.now,
      summary: revised
        ? `Learner resubmitted evidence for milestone “${current.title}”.`
        : `Learner submitted evidence for milestone “${current.title}”.`,
    }),
  });
}

function beginWork(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'BEGIN_WORK' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.learner);
  if (blocked) return blocked;

  const current = nextBeginWorkMilestone(contract.milestones);
  if (!current) return fail('There is no milestone ready to begin');
  const blockedMove = moveMilestone(current, MILESTONE_STATUS.active);
  if (blockedMove) return blockedMove;

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id ? { ...item, status: MILESTONE_STATUS.active } : item,
    ),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'WORK_STARTED',
      now: action.now,
      summary: `Learner began work on milestone “${current.title}”.`,
    }),
  });
}

function startReview(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'START_REVIEW' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;

  const current = actionableMilestone(contract, [MILESTONE_STATUS.submitted]);
  if (!current) return fail('There is no submitted evidence to review');
  const blockedMove = moveMilestone(current, MILESTONE_STATUS.underReview);
  if (blockedMove) return blockedMove;

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id ? { ...item, status: MILESTONE_STATUS.underReview } : item,
    ),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REVIEW_STARTED',
      now: action.now,
      summary: `Mentor started review of milestone “${current.title}”.`,
    }),
  });
}

function reviewableMilestone(contract: LearningContract): Milestone | null {
  return actionableMilestone(contract, [
    MILESTONE_STATUS.submitted,
    MILESTONE_STATUS.underReview,
  ]);
}

function approveMilestone(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'APPROVE_MILESTONE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;

  const current = reviewableMilestone(contract);
  if (!current) return fail('There is no submitted milestone to approve');
  const blockedMove = moveMilestone(current, MILESTONE_STATUS.approved);
  if (blockedMove) return blockedMove;

  const ordered = [...contract.milestones].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.id === current.id);
  const next = ordered[index + 1];
  const approvedMilestones = contract.milestones.map((item) =>
    item.id === current.id
      ? { ...item, status: MILESTONE_STATUS.approved, lastFeedback: null }
      : item,
  );

  if (!next) {
    const toPending = moveTo(contract, LEARNING_CONTRACT_STATUS.completionPending);
    if (toPending) return toPending;

    return ok({
      ...contract,
      status: LEARNING_CONTRACT_STATUS.completionPending,
      currentStepOwner: STEP_OWNER.learner,
      updatedAt: action.now,
      milestones: approvedMilestones,
      revisionHistory: appendRevision(contract, {
        actor,
        action: 'MILESTONE_APPROVED',
        now: action.now,
        summary: `Mentor approved the last milestone “${current.title}”. The learner submits the final deliverable next.`,
      }),
    });
  }

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    milestones: approvedMilestones,
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'MILESTONE_APPROVED',
      now: action.now,
      summary: `Mentor approved milestone “${current.title}”.`,
    }),
  });
}

function requestRevision(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REQUEST_REVISION' | 'REJECT_MILESTONE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;
  if (!action.feedback.trim()) return fail('Feedback is required to request a revision');

  const current = reviewableMilestone(contract);
  if (!current) return fail('There is no submitted milestone to revise');
  const blockedMove = moveMilestone(current, MILESTONE_STATUS.rejected);
  if (blockedMove) return blockedMove;

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.learner,
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id
        ? {
            ...item,
            status: MILESTONE_STATUS.rejected,
            lastFeedback: action.feedback.trim(),
          }
        : item,
    ),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'REVISION_REQUESTED',
      now: action.now,
      comment: action.feedback,
      summary: `Mentor requested a revision on milestone “${current.title}”.`,
    }),
  });
}

function declineMilestone(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'DECLINE_MILESTONE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatuses(contract, [LEARNING_CONTRACT_STATUS.inProgress]) ??
    requireActor(contract, actor, STEP_OWNER.mentor);
  if (blocked) return blocked;
  if (!action.feedback.trim()) return fail('Feedback is required to reject a milestone');

  const current = reviewableMilestone(contract);
  if (!current) return fail('There is no submitted milestone to reject');
  const blockedMove = moveMilestone(current, MILESTONE_STATUS.declined);
  if (blockedMove) return blockedMove;

  return ok({
    ...contract,
    currentStepOwner: STEP_OWNER.mentor,
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id
        ? {
            ...item,
            status: MILESTONE_STATUS.declined,
            lastFeedback: action.feedback.trim(),
          }
        : item,
    ),
    revisionHistory: appendRevision(contract, {
      actor,
      action: 'MILESTONE_REJECTED',
      now: action.now,
      comment: action.feedback,
      summary: `Mentor rejected milestone “${current.title}”.`,
    }),
  });
}

function actionableMilestone(
  contract: LearningContract,
  statuses: Milestone['status'][],
): Milestone | null {
  const matches = contract.milestones.filter((item) => statuses.includes(item.status));
  return matches[0] ?? null;
}

function upsertGoal(
  current: Goal | null,
  fields: { title: string; description: string; text: string },
): Goal {
  if (
    current &&
    current.title === fields.title &&
    current.description === fields.description &&
    current.text === fields.text
  ) {
    return current;
  }
  return normalizeGoal({
    id: newId(),
    title: fields.title,
    description: fields.description,
    text: fields.text,
    revisionOf: current?.id ?? null,
  });
}

function reviseGoal(
  contract: LearningContract,
  fields: { title: string; description: string; text: string },
): { goal: Goal; goalHistory: Goal[] } {
  const current = contract.goal;
  if (!current) {
    return { goal: upsertGoal(null, fields), goalHistory: [] };
  }
  if (
    current.title === fields.title &&
    current.description === fields.description &&
    current.text === fields.text
  ) {
    return { goal: current, goalHistory: contract.goalHistory };
  }
  return {
    goal: upsertGoal(current, fields),
    goalHistory: [...contract.goalHistory, current],
  };
}

function upsertDeliverable(
  current: Deliverable | null,
  input: {
    title: string;
    description: string;
    expectedEvidence: string;
    status: Deliverable['status'];
  },
): Deliverable {
  return normalizeDeliverable({
    id: current?.id ?? newId(),
    title: input.title,
    description: input.description,
    expectedEvidence: input.expectedEvidence,
    finalEvidenceUrl: current?.finalEvidenceUrl ?? '',
    status: input.status,
  }) as Deliverable;
}

function mergeMilestone(
  current: Milestone | undefined,
  input: {
    title: string;
    description: string;
    evidenceRequired?: string;
    successCriteria?: string;
  },
  order: number,
): Milestone {
  const criteria = (input.successCriteria ?? input.evidenceRequired ?? '').trim();
  return normalizeMilestone(
    {
      id: current?.id ?? newId(),
      order,
      title: input.title,
      description: input.description,
      evidenceRequired: (input.evidenceRequired ?? criteria).trim(),
      successCriteria: criteria,
      status: MILESTONE_STATUS.locked,
      evidenceText: current?.evidenceText ?? '',
      evidenceLink: current?.evidenceLink ?? '',
      lastFeedback: current?.lastFeedback ?? null,
    },
    order,
  );
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function assertSingleActiveMilestone(contract: LearningContract): boolean {
  if (contract.status !== LEARNING_CONTRACT_STATUS.inProgress) return true;
  return activeMilestoneCount(contract) <= 1;
}
