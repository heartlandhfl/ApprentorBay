import type {
  Deliverable,
  Goal,
  LearningContract,
  LearningContractStatus,
  Milestone,
  Objective,
  StepOwner,
} from './types.js';

export type ContractActor = {
  uid: string;
  role: 'learner' | 'mentor' | 'admin';
};

export type ContractAction =
  | {
      type: 'SAVE_DRAFT';
      goalText: string;
      deliverableTitle: string;
      deliverableDescription: string;
      now: IsoNow;
    }
  | { type: 'SEND_TO_MENTOR'; now: IsoNow }
  | {
      type: 'SAVE_MENTOR_REVIEW';
      goalText: string;
      objectives: { text: string }[];
      milestones: {
        title: string;
        description: string;
        evidenceRequired: string;
      }[];
      deliverableTitle: string;
      deliverableDescription: string;
      now: IsoNow;
    }
  | { type: 'SEND_TO_LEARNER'; now: IsoNow }
  | { type: 'APPROVE_PLAN'; now: IsoNow }
  | { type: 'REQUEST_CHANGES'; reason: string; now: IsoNow }
  | { type: 'SUBMIT_EVIDENCE'; text: string; link: string; now: IsoNow }
  | { type: 'APPROVE_MILESTONE'; now: IsoNow }
  | { type: 'REJECT_MILESTONE'; feedback: string; now: IsoNow };

export type ContractActionType = ContractAction['type'];

export type ClientContractAction = {
  [Type in ContractAction['type']]: Omit<Extract<ContractAction, { type: Type }>, 'now'>;
}[ContractAction['type']];

export type ContractEffect = { type: 'publish_deliverable_refs' };

export type ReduceResult =
  | { ok: true; contract: LearningContract; effects: ContractEffect[] }
  | { ok: false; error: string };

type IsoNow = string;

export const LEARNING_JOURNEY_STEPS = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Learner writes the goal and deliverable.',
  },
  {
    id: 'under_mentor_review',
    label: 'Mentor review',
    description: 'Mentor adds objectives and an ordered milestone list.',
  },
  {
    id: 'under_learner_review',
    label: 'Learner review',
    description: 'Learner approves the plan or requests changes.',
  },
  {
    id: 'in_progress',
    label: 'In progress',
    description: 'One milestone is active at a time.',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'The deliverable is published on both profiles.',
  },
] as const;

export function journeyStepIndex(status: LearningContractStatus): number {
  if (status === 'agreed') return 3;
  return LEARNING_JOURNEY_STEPS.findIndex((step) => step.id === status);
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
    status: 'draft',
    currentStepOwner: 'learner',
    createdAt: input.now,
    updatedAt: input.now,
    goal: null,
    goalHistory: [],
    objectives: [],
    milestones: [],
    deliverable: null,
    changeRequestReason: null,
  };
}

export function reduceContract(
  contract: LearningContract,
  action: ContractAction,
  actor: ContractActor,
): ReduceResult {
  switch (action.type) {
    case 'SAVE_DRAFT':
      return saveDraft(contract, action, actor);
    case 'SEND_TO_MENTOR':
      return sendToMentor(contract, action, actor);
    case 'SAVE_MENTOR_REVIEW':
      return saveMentorReview(contract, action, actor);
    case 'SEND_TO_LEARNER':
      return sendToLearner(contract, action, actor);
    case 'APPROVE_PLAN':
      return approvePlan(contract, action, actor);
    case 'REQUEST_CHANGES':
      return requestChanges(contract, action, actor);
    case 'SUBMIT_EVIDENCE':
      return submitEvidence(contract, action, actor);
    case 'APPROVE_MILESTONE':
      return approveMilestone(contract, action, actor);
    case 'REJECT_MILESTONE':
      return rejectMilestone(contract, action, actor);
  }
}

export function availableActions(
  contract: LearningContract,
  actor: ContractActor,
): ContractActionType[] {
  if (!isStepActor(contract, actor)) return [];

  switch (contract.status) {
    case 'draft':
      return ['SAVE_DRAFT', 'SEND_TO_MENTOR'];
    case 'under_mentor_review':
      return ['SAVE_MENTOR_REVIEW', 'SEND_TO_LEARNER'];
    case 'under_learner_review':
      return ['APPROVE_PLAN', 'REQUEST_CHANGES'];
    case 'in_progress':
      if (actor.role === 'learner' && actionableMilestone(contract, ['active', 'rejected'])) {
        return ['SUBMIT_EVIDENCE'];
      }
      if (actor.role === 'mentor' && actionableMilestone(contract, ['submitted'])) {
        return ['APPROVE_MILESTONE', 'REJECT_MILESTONE'];
      }
      return [];
    case 'agreed':
    case 'completed':
      return [];
  }
}

export function isStepActor(contract: LearningContract, actor: ContractActor): boolean {
  if (actor.role === 'admin') return false;
  if (actor.role === 'learner') {
    return actor.uid === contract.learnerId && contract.currentStepOwner === 'learner';
  }
  if (actor.role === 'mentor') {
    return actor.uid === contract.mentorId && contract.currentStepOwner === 'mentor';
  }
  return false;
}

export function waitingOn(contract: LearningContract): StepOwner {
  return contract.currentStepOwner;
}

export function activeMilestoneCount(contract: LearningContract): number {
  return contract.milestones.filter((item) => item.status === 'active').length;
}

function fail(error: string): ReduceResult {
  return { ok: false, error };
}

function ok(contract: LearningContract, effects: ContractEffect[] = []): ReduceResult {
  return { ok: true, contract, effects };
}

function requireStatus(
  contract: LearningContract,
  status: LearningContractStatus,
): ReduceResult | null {
  if (contract.status !== status) {
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
  const expectedUid = owner === 'learner' ? contract.learnerId : contract.mentorId;
  if (actor.role !== owner || actor.uid !== expectedUid) {
    return fail('You cannot act on this step');
  }
  return null;
}

function saveDraft(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SAVE_DRAFT' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'draft') ?? requireActor(contract, actor, 'learner');
  if (blocked) return blocked;

  return ok({
    ...contract,
    updatedAt: action.now,
    goal: upsertGoal(contract.goal, action.goalText, contract.goalHistory),
    deliverable: upsertDeliverable(contract.deliverable, {
      title: action.deliverableTitle,
      description: action.deliverableDescription,
      status: 'draft',
    }),
  });
}

function sendToMentor(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SEND_TO_MENTOR' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'draft') ?? requireActor(contract, actor, 'learner');
  if (blocked) return blocked;
  if (!contract.goal?.text.trim()) return fail('Write a draft goal before sending');
  if (!contract.deliverable?.title.trim() || !contract.deliverable.description.trim()) {
    return fail('Write a draft deliverable before sending');
  }

  return ok({
    ...contract,
    status: 'under_mentor_review',
    currentStepOwner: 'mentor',
    updatedAt: action.now,
    changeRequestReason: null,
  });
}

function saveMentorReview(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SAVE_MENTOR_REVIEW' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'under_mentor_review') ??
    requireActor(contract, actor, 'mentor');
  if (blocked) return blocked;

  const nextGoal = reviseGoal(contract, action.goalText);
  return ok({
    ...contract,
    updatedAt: action.now,
    goal: nextGoal.goal,
    goalHistory: nextGoal.goalHistory,
    objectives: action.objectives.map((item, index) => ({
      id: contract.objectives[index]?.id ?? newId(),
      text: item.text.trim(),
    })),
    milestones: action.milestones.map((item, index) =>
      mergeMilestone(contract.milestones[index], item, index),
    ),
    deliverable: upsertDeliverable(contract.deliverable, {
      title: action.deliverableTitle,
      description: action.deliverableDescription,
      status: 'draft',
    }),
  });
}

function sendToLearner(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SEND_TO_LEARNER' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'under_mentor_review') ??
    requireActor(contract, actor, 'mentor');
  if (blocked) return blocked;
  if (!contract.goal?.text.trim()) return fail('The goal cannot be empty');
  if (!contract.deliverable?.description.trim()) {
    return fail('The deliverable description cannot be empty');
  }
  if (contract.objectives.filter((item) => item.text.trim()).length === 0) {
    return fail('Add at least one objective');
  }
  if (contract.milestones.length === 0) {
    return fail('Add at least one milestone');
  }
  if (
    contract.milestones.some(
      (item) =>
        !item.title.trim() || !item.description.trim() || !item.evidenceRequired.trim(),
    )
  ) {
    return fail('Every milestone needs a title, description, and required evidence');
  }

  const ordered = [...contract.milestones]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index,
      status: 'locked' as const,
    }));

  return ok({
    ...contract,
    status: 'under_learner_review',
    currentStepOwner: 'learner',
    updatedAt: action.now,
    milestones: ordered,
  });
}

function approvePlan(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'APPROVE_PLAN' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'under_learner_review') ??
    requireActor(contract, actor, 'learner');
  if (blocked) return blocked;
  if (contract.milestones.length === 0) return fail('This plan has no milestones');

  const started = contract.milestones
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index,
      status: index === 0 ? ('active' as const) : ('locked' as const),
    }));

  return ok({
    ...contract,
    status: 'in_progress',
    currentStepOwner: 'learner',
    updatedAt: action.now,
    changeRequestReason: null,
    milestones: started,
    deliverable: contract.deliverable
      ? { ...contract.deliverable, status: 'in_progress' }
      : contract.deliverable,
  });
}

function requestChanges(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REQUEST_CHANGES' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'under_learner_review') ??
    requireActor(contract, actor, 'learner');
  if (blocked) return blocked;
  if (!action.reason.trim()) return fail('A reason is required to request changes');

  return ok({
    ...contract,
    status: 'under_mentor_review',
    currentStepOwner: 'mentor',
    updatedAt: action.now,
    changeRequestReason: action.reason.trim(),
  });
}

function submitEvidence(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'SUBMIT_EVIDENCE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'in_progress') ?? requireActor(contract, actor, 'learner');
  if (blocked) return blocked;
  if (!action.text.trim()) return fail('Evidence text is required');

  const current = actionableMilestone(contract, ['active', 'rejected']);
  if (!current) return fail('There is no active milestone to submit');

  return ok({
    ...contract,
    currentStepOwner: 'mentor',
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id
        ? {
            ...item,
            status: 'submitted',
            evidenceText: action.text.trim(),
            evidenceLink: action.link.trim(),
          }
        : item,
    ),
  });
}

function approveMilestone(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'APPROVE_MILESTONE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'in_progress') ?? requireActor(contract, actor, 'mentor');
  if (blocked) return blocked;

  const current = actionableMilestone(contract, ['submitted']);
  if (!current) return fail('There is no submitted milestone to approve');

  const ordered = [...contract.milestones].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.id === current.id);
  const next = ordered[index + 1];

  if (!next) {
    const completedMilestones = contract.milestones.map((item) =>
      item.id === current.id ? { ...item, status: 'approved' as const, lastFeedback: null } : item,
    );
    const deliverable: Deliverable | null = contract.deliverable
      ? {
          ...contract.deliverable,
          status: 'completed',
          finalEvidenceUrl: current.evidenceLink || current.evidenceText,
        }
      : contract.deliverable;

    return ok(
      {
        ...contract,
        status: 'completed',
        currentStepOwner: 'mentor',
        updatedAt: action.now,
        milestones: completedMilestones,
        deliverable,
      },
      [{ type: 'publish_deliverable_refs' }],
    );
  }

  return ok({
    ...contract,
    currentStepOwner: 'learner',
    updatedAt: action.now,
    milestones: contract.milestones.map((item) => {
      if (item.id === current.id) {
        return { ...item, status: 'approved', lastFeedback: null };
      }
      if (item.id === next.id) {
        return { ...item, status: 'active' };
      }
      return item;
    }),
  });
}

function rejectMilestone(
  contract: LearningContract,
  action: Extract<ContractAction, { type: 'REJECT_MILESTONE' }>,
  actor: ContractActor,
): ReduceResult {
  const blocked =
    requireStatus(contract, 'in_progress') ?? requireActor(contract, actor, 'mentor');
  if (blocked) return blocked;
  if (!action.feedback.trim()) return fail('Feedback is required to reject a milestone');

  const current = actionableMilestone(contract, ['submitted']);
  if (!current) return fail('There is no submitted milestone to reject');

  return ok({
    ...contract,
    currentStepOwner: 'learner',
    updatedAt: action.now,
    milestones: contract.milestones.map((item) =>
      item.id === current.id
        ? {
            ...item,
            status: 'rejected',
            lastFeedback: action.feedback.trim(),
          }
        : item,
    ),
  });
}

function actionableMilestone(
  contract: LearningContract,
  statuses: Milestone['status'][],
): Milestone | null {
  const matches = contract.milestones.filter((item) => statuses.includes(item.status));
  return matches[0] ?? null;
}

function upsertGoal(current: Goal | null, text: string, _history: Goal[]): Goal {
  const trimmed = text.trim();
  if (current && current.text === trimmed) return current;
  if (current) {
    return { id: newId(), text: trimmed, revisionOf: current.id };
  }
  return { id: newId(), text: trimmed, revisionOf: null };
}

function reviseGoal(
  contract: LearningContract,
  text: string,
): { goal: Goal; goalHistory: Goal[] } {
  const trimmed = text.trim();
  const current = contract.goal;
  if (!current) {
    return { goal: { id: newId(), text: trimmed, revisionOf: null }, goalHistory: [] };
  }
  if (current.text === trimmed) {
    return { goal: current, goalHistory: contract.goalHistory };
  }
  return {
    goal: { id: newId(), text: trimmed, revisionOf: current.id },
    goalHistory: [...contract.goalHistory, current],
  };
}

function upsertDeliverable(
  current: Deliverable | null,
  input: { title: string; description: string; status: Deliverable['status'] },
): Deliverable {
  return {
    id: current?.id ?? newId(),
    title: input.title.trim(),
    description: input.description.trim(),
    finalEvidenceUrl: current?.finalEvidenceUrl ?? '',
    status: input.status,
  };
}

function mergeMilestone(
  current: Milestone | undefined,
  input: { title: string; description: string; evidenceRequired: string },
  order: number,
): Milestone {
  return {
    id: current?.id ?? newId(),
    order,
    title: input.title.trim(),
    description: input.description.trim(),
    evidenceRequired: input.evidenceRequired.trim(),
    status: 'locked',
    evidenceText: current?.evidenceText ?? '',
    evidenceLink: current?.evidenceLink ?? '',
    lastFeedback: current?.lastFeedback ?? null,
  };
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function assertSingleActiveMilestone(contract: LearningContract): boolean {
  if (contract.status !== 'in_progress') return true;
  return activeMilestoneCount(contract) <= 1;
}
