import {
  LEARNING_CONTRACT_STATUS,
  STEP_OWNER,
  type LearningContractStatus,
  type StepOwner,
} from './statuses.js';
import type { Deliverable } from './deliverables.js';
import type { Milestone } from './milestones.js';
import type { UserRole } from './identities.js';
import type { IsoDateString } from './users.js';

/**
 * Learning Goal — persisted on the contract as `goal` / `goalHistory`.
 * The Learning Goal Builder is the draft/review process, not a collection.
 *
 * `title` + `description` are canonical. `text` is kept so older documents
 * and older machine actions still read.
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  text: string;
  revisionOf: string | null;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  order: number;
  text: string;
}

export interface ContractRevision {
  id: string;
  actorId: string;
  actorRole: UserRole | string;
  stage: LearningContractStatus;
  action: string;
  timestamp: IsoDateString;
  comment: string | null;
  summary: string;
}

export interface LearningContract {
  id: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  status: LearningContractStatus;
  currentStepOwner: StepOwner;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  goal: Goal | null;
  goalHistory: Goal[];
  objectives: Objective[];
  milestones: Milestone[];
  deliverable: Deliverable | null;
  changeRequestReason: string | null;
  /** Optional learner context submitted with the first proposal. */
  context: string | null;
  mentorComment: string | null;
  revisionHistory: ContractRevision[];
}

/**
 * Editable surface for the Learning Goal Builder (draft + mentor review).
 * Maps onto contract fields; never stored as its own document.
 */
export interface LearningGoalBuilder {
  goalTitle: string;
  goalDescription: string;
  goalText: string;
  context: string;
  deliverableTitle: string;
  deliverableDescription: string;
  expectedEvidence: string;
  objectives: { title: string; description: string; text: string }[];
  milestones: {
    title: string;
    description: string;
    evidenceRequired: string;
    successCriteria: string;
  }[];
  mentorComment: string;
}

export function firstLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.split(/\r?\n/, 1)[0]?.trim() ?? '';
}

export function restLines(text: string): string {
  const trimmed = text.trim();
  const index = trimmed.search(/\r?\n/);
  if (index < 0) return '';
  return trimmed.slice(index).trim();
}

export function combineGoalText(title: string, description: string): string {
  const heading = title.trim();
  const body = description.trim();
  if (heading && body) return `${heading}\n\n${body}`;
  return heading || body;
}

export function normalizeGoal(input: Partial<Goal> & { id: string }): Goal {
  const title = (input.title ?? '').trim() || firstLine(input.text ?? '');
  const description = (input.description ?? '').trim() || restLines(input.text ?? '');
  const text = (input.text ?? '').trim() || combineGoalText(title, description);
  return {
    id: input.id,
    title,
    description,
    text,
    revisionOf: input.revisionOf ?? null,
  };
}

export function normalizeObjective(
  input: Partial<Objective> & { id: string },
  order: number,
): Objective {
  const title = (input.title ?? '').trim() || firstLine(input.text ?? '');
  const description = (input.description ?? '').trim() || restLines(input.text ?? '');
  const text = (input.text ?? '').trim() || combineGoalText(title, description);
  return {
    id: input.id,
    title,
    description,
    order: input.order ?? order,
    text,
  };
}

export function normalizeMilestone(
  input: Partial<Milestone> & { id: string },
  order: number,
): Milestone {
  const criteria = (input.successCriteria ?? input.evidenceRequired ?? '').trim();
  return {
    id: input.id,
    order: input.order ?? order,
    title: (input.title ?? '').trim(),
    description: (input.description ?? '').trim(),
    evidenceRequired: (input.evidenceRequired ?? criteria).trim(),
    successCriteria: criteria || (input.evidenceRequired ?? '').trim(),
    status: input.status ?? 'locked',
    evidenceText: input.evidenceText ?? '',
    evidenceLink: input.evidenceLink ?? '',
    lastFeedback: input.lastFeedback ?? null,
  };
}

export function normalizeDeliverable(
  input: (Partial<Deliverable> & { id: string }) | null | undefined,
): Deliverable | null {
  if (!input) return null;
  return {
    id: input.id,
    title: (input.title ?? '').trim(),
    description: (input.description ?? '').trim(),
    expectedEvidence: (input.expectedEvidence ?? '').trim(),
    finalEvidenceUrl: input.finalEvidenceUrl ?? '',
    status: input.status ?? 'draft',
  };
}

export function normalizeContract(input: LearningContract): LearningContract {
  return {
    ...input,
    goal: input.goal ? normalizeGoal(input.goal) : null,
    goalHistory: (input.goalHistory ?? []).map((item) => normalizeGoal(item)),
    objectives: (input.objectives ?? []).map((item, index) => normalizeObjective(item, index)),
    milestones: (input.milestones ?? []).map((item, index) => normalizeMilestone(item, index)),
    deliverable: normalizeDeliverable(input.deliverable),
    changeRequestReason: input.changeRequestReason ?? null,
    context: input.context ?? null,
    mentorComment: input.mentorComment ?? null,
    revisionHistory: input.revisionHistory ?? [],
  };
}

export function learningGoalBuilderFromContract(
  contract: LearningContract,
): LearningGoalBuilder {
  const normalized = normalizeContract(contract);
  return {
    goalTitle: normalized.goal?.title ?? '',
    goalDescription: normalized.goal?.description ?? '',
    goalText: normalized.goal?.text ?? '',
    context: normalized.context ?? '',
    deliverableTitle: normalized.deliverable?.title ?? '',
    deliverableDescription: normalized.deliverable?.description ?? '',
    expectedEvidence: normalized.deliverable?.expectedEvidence ?? '',
    objectives:
      normalized.objectives.length > 0
        ? normalized.objectives.map((item) => ({
            title: item.title,
            description: item.description,
            text: item.text,
          }))
        : [{ title: '', description: '', text: '' }],
    milestones:
      normalized.milestones.length > 0
        ? normalized.milestones.map((item) => ({
            title: item.title,
            description: item.description,
            evidenceRequired: item.evidenceRequired,
            successCriteria: item.successCriteria,
          }))
        : [{ title: '', description: '', evidenceRequired: '', successCriteria: '' }],
    mentorComment: normalized.mentorComment ?? '',
  };
}

export function isContractCompleted(
  contract: Pick<LearningContract, 'status'>,
): boolean {
  return contract.status === LEARNING_CONTRACT_STATUS.completed;
}

export function isContractInProgress(
  contract: Pick<LearningContract, 'status'>,
): boolean {
  return contract.status === LEARNING_CONTRACT_STATUS.inProgress;
}

export function isLearnerStep(owner: StepOwner): boolean {
  return owner === STEP_OWNER.learner;
}

export function isMentorStep(owner: StepOwner): boolean {
  return owner === STEP_OWNER.mentor;
}

export function nextActionCopy(contract: LearningContract): string {
  switch (contract.status) {
    case LEARNING_CONTRACT_STATUS.draft:
      return 'Learner writes a draft goal and deliverable, then submits the proposal.';
    case LEARNING_CONTRACT_STATUS.submittedByLearner:
    case LEARNING_CONTRACT_STATUS.underMentorReview:
      return 'Mentor revises the goal, adds objectives and milestones, and proposes the contract.';
    case LEARNING_CONTRACT_STATUS.revisionRequested:
      return 'Mentor revises the plan using the learner’s comment, then proposes again.';
    case LEARNING_CONTRACT_STATUS.proposedByMentor:
    case LEARNING_CONTRACT_STATUS.underLearnerReview:
      return 'Learner approves the plan or requests a revision with a reason.';
    case LEARNING_CONTRACT_STATUS.mutuallyApproved:
    case LEARNING_CONTRACT_STATUS.agreed:
      return 'Activate the contract. Work cannot start until this step.';
    case LEARNING_CONTRACT_STATUS.inProgress:
      return 'Work the current milestone. Only one milestone is active.';
    case LEARNING_CONTRACT_STATUS.completed:
      return 'This contract is complete. The deliverable is on both profiles.';
    case LEARNING_CONTRACT_STATUS.rejected:
      return 'The mentor rejected this proposal. Start a new builder from the relationship.';
    case LEARNING_CONTRACT_STATUS.cancelled:
      return 'This builder was cancelled.';
  }
}
