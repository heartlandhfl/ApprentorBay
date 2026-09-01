import { LEARNING_CONTRACT_STATUS, STEP_OWNER, type LearningContractStatus, type StepOwner } from './statuses.js';
import type { Deliverable } from './deliverables.js';
import type { Milestone } from './milestones.js';
import type { IsoDateString } from './users.js';

/**
 * Learning Goal — persisted on the contract as `goal` / `goalHistory`.
 * The Learning Goal Builder is the draft/review process, not a collection.
 */
export interface Goal {
  id: string;
  text: string;
  revisionOf: string | null;
}

export interface Objective {
  id: string;
  text: string;
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
}

/**
 * Editable surface for the Learning Goal Builder (draft + mentor review).
 * Maps onto contract fields; never stored as its own document.
 */
export interface LearningGoalBuilder {
  goalText: string;
  deliverableTitle: string;
  deliverableDescription: string;
  objectives: { text: string }[];
  milestones: {
    title: string;
    description: string;
    evidenceRequired: string;
  }[];
}

export function learningGoalBuilderFromContract(
  contract: LearningContract,
): LearningGoalBuilder {
  return {
    goalText: contract.goal?.text ?? '',
    deliverableTitle: contract.deliverable?.title ?? '',
    deliverableDescription: contract.deliverable?.description ?? '',
    objectives:
      contract.objectives.length > 0
        ? contract.objectives.map((item) => ({ text: item.text }))
        : [{ text: '' }],
    milestones:
      contract.milestones.length > 0
        ? contract.milestones.map((item) => ({
            title: item.title,
            description: item.description,
            evidenceRequired: item.evidenceRequired,
          }))
        : [{ title: '', description: '', evidenceRequired: '' }],
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
