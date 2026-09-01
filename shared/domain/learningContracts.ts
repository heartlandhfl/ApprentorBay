import { MILESTONE_STATUS, isApprovedMilestoneStatus } from './statuses.js';
import {
  LEARNING_CONTRACT_STATUS,
  STEP_OWNER,
  isOperationalContractStatus,
  type LearningContractStatus,
  type StepOwner,
} from './statuses.js';
import type { Deliverable } from './deliverables.js';
import { nextBeginWorkMilestone, type Milestone } from './milestones.js';
import type { UserRole } from './identities.js';
import type { IsoDateString } from './users.js';
import {
  EVIDENCE_TYPE,
  evidenceItemsForMilestone,
  latestMilestoneProjection,
  normalizeEvidenceItem,
  type EvidenceItem,
} from './evidence.js';

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
  /** First-class evidence. Older docs omit this; normalize hydrates from milestone strings. */
  evidenceItems: EvidenceItem[];
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

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeGoal(input: Partial<Goal> & { id: string }): Goal {
  const title = asText(input.title).trim() || firstLine(asText(input.text));
  const description = asText(input.description).trim() || restLines(asText(input.text));
  const text = asText(input.text).trim() || combineGoalText(title, description);
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
  const title = asText(input.title).trim() || firstLine(asText(input.text));
  const description = asText(input.description).trim() || restLines(asText(input.text));
  const text = asText(input.text).trim() || combineGoalText(title, description);
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
  const criteria = (asText(input.successCriteria) || asText(input.evidenceRequired)).trim();
  return {
    id: input.id,
    order: input.order ?? order,
    title: asText(input.title).trim(),
    description: asText(input.description).trim(),
    evidenceRequired: (asText(input.evidenceRequired) || criteria).trim(),
    successCriteria: criteria || asText(input.evidenceRequired).trim(),
    status: input.status ?? 'locked',
    evidenceText: asText(input.evidenceText),
    evidenceLink: asText(input.evidenceLink),
    lastFeedback: input.lastFeedback == null ? null : asText(input.lastFeedback) || null,
  };
}

export function normalizeDeliverable(
  input: (Partial<Deliverable> & { id: string }) | null | undefined,
): Deliverable | null {
  if (!input) return null;
  return {
    id: input.id,
    title: asText(input.title).trim(),
    description: asText(input.description).trim(),
    expectedEvidence: asText(input.expectedEvidence).trim(),
    finalEvidenceUrl: asText(input.finalEvidenceUrl),
    status: input.status ?? 'draft',
  };
}

export function hydrateEvidenceItems(contract: LearningContract): EvidenceItem[] {
  const existing = (contract.evidenceItems ?? []).map((item) =>
    normalizeEvidenceItem({
      ...item,
      id: item.id,
      milestoneId: item.milestoneId,
      contractId: item.contractId || contract.id,
    }),
  );
  if (existing.length > 0) return existing;

  const migrated: EvidenceItem[] = [];
  for (const milestone of contract.milestones ?? []) {
    const text = (milestone.evidenceText ?? '').trim();
    const link = (milestone.evidenceLink ?? '').trim();
    if (text) {
      migrated.push(
        normalizeEvidenceItem({
          id: `legacy-text-${milestone.id}`,
          milestoneId: milestone.id,
          contractId: contract.id,
          submittedBy: contract.learnerId,
          type: EVIDENCE_TYPE.text,
          content: text,
          storagePath: null,
          createdAt: contract.updatedAt,
          updatedAt: contract.updatedAt,
        }),
      );
    }
    if (link) {
      migrated.push(
        normalizeEvidenceItem({
          id: `legacy-link-${milestone.id}`,
          milestoneId: milestone.id,
          contractId: contract.id,
          submittedBy: contract.learnerId,
          type: EVIDENCE_TYPE.link,
          content: link,
          storagePath: null,
          createdAt: contract.updatedAt,
          updatedAt: contract.updatedAt,
        }),
      );
    }
  }
  return migrated;
}

export function normalizeContract(input: LearningContract): LearningContract {
  const evidenceItems = hydrateEvidenceItems(input);
  const milestones = (input.milestones ?? []).map((item, index) => {
    const normalized = normalizeMilestone(item, index);
    const projection = latestMilestoneProjection(
      evidenceItemsForMilestone(evidenceItems, normalized.id),
    );
    return {
      ...normalized,
      evidenceText: normalized.evidenceText || projection.evidenceText,
      evidenceLink: normalized.evidenceLink || projection.evidenceLink,
    };
  });
  return {
    ...input,
    goal: input.goal ? normalizeGoal(input.goal) : null,
    goalHistory: (input.goalHistory ?? []).map((item) => normalizeGoal(item)),
    objectives: (input.objectives ?? []).map((item, index) => normalizeObjective(item, index)),
    milestones,
    deliverable: normalizeDeliverable(input.deliverable),
    changeRequestReason: input.changeRequestReason ?? null,
    context: input.context ?? null,
    mentorComment: input.mentorComment ?? null,
    revisionHistory: input.revisionHistory ?? [],
    evidenceItems,
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

export function isOperationalContract(
  contract: Pick<LearningContract, 'status'>,
): boolean {
  return isOperationalContractStatus(contract.status);
}

/**
 * The Learning Contract Workspace, not the Goal Builder.
 * Starts at mutual approval. Cancelled builder drafts stay in the builder;
 * a contract cancelled after activation still opens here.
 */
export function isContractWorkspaceView(
  contract: Pick<LearningContract, 'status' | 'milestones'>,
): boolean {
  if (isOperationalContract(contract)) return true;
  if (contract.status !== LEARNING_CONTRACT_STATUS.cancelled) return false;
  return contract.milestones.some((item) => item.status !== MILESTONE_STATUS.locked);
}

export type WorkspacePartyNeeded = 'learner' | 'mentor' | 'either' | 'nobody';

export type WorkspaceFocus = {
  who: WorkspacePartyNeeded;
  next: string;
  currentMilestoneTitle: string | null;
};

export function workspacePartyLabel(who: WorkspacePartyNeeded): string {
  switch (who) {
    case 'learner':
      return 'Learner';
    case 'mentor':
      return 'Mentor';
    case 'either':
      return 'Learner or mentor';
    case 'nobody':
      return 'Nobody';
  }
}

/** What has to happen next, and who must do it. Derived, not stored. */
export function workspaceFocus(contract: LearningContract): WorkspaceFocus {
  const ordered = [...contract.milestones].sort((a, b) => a.order - b.order);
  const submitted =
    ordered.find(
      (item) =>
        item.status === MILESTONE_STATUS.submitted ||
        item.status === MILESTONE_STATUS.underReview,
    ) ?? null;
  const current =
    ordered.find(
      (item) =>
        item.status === MILESTONE_STATUS.active ||
        item.status === MILESTONE_STATUS.rejected,
    ) ?? null;

  switch (contract.status) {
    case LEARNING_CONTRACT_STATUS.mutuallyApproved:
    case LEARNING_CONTRACT_STATUS.agreed:
      return {
        who: 'either',
        next: 'Activate the contract so the first milestone can start.',
        currentMilestoneTitle: null,
      };
    case LEARNING_CONTRACT_STATUS.inProgress:
      if (submitted) {
        return {
          who: 'mentor',
          next: `Review evidence for “${submitted.title}”.`,
          currentMilestoneTitle: submitted.title,
        };
      }
      if (current) {
        return {
          who: 'learner',
          next:
            current.status === MILESTONE_STATUS.rejected
              ? `Resubmit evidence for “${current.title}”.`
              : `Submit evidence for “${current.title}”.`,
          currentMilestoneTitle: current.title,
        };
      }
      const begin = nextBeginWorkMilestone(ordered);
      if (begin) {
        return {
          who: 'learner',
          next: `Begin work on “${begin.title}”.`,
          currentMilestoneTitle: begin.title,
        };
      }
      return {
        who: 'either',
        next: nextActionCopy(contract),
        currentMilestoneTitle: null,
      };
    case LEARNING_CONTRACT_STATUS.paused:
      return {
        who: 'either',
        next: 'Resume the contract to continue evidence work.',
        currentMilestoneTitle: current?.title ?? submitted?.title ?? null,
      };
    case LEARNING_CONTRACT_STATUS.completionPending:
      return {
        who: 'either',
        next: 'Confirm completion to publish the deliverable.',
        currentMilestoneTitle: null,
      };
    case LEARNING_CONTRACT_STATUS.completed:
      return {
        who: 'nobody',
        next: 'This contract is complete. The deliverable is on both profiles.',
        currentMilestoneTitle: null,
      };
    case LEARNING_CONTRACT_STATUS.cancelled:
      return {
        who: 'nobody',
        next: 'This contract was cancelled.',
        currentMilestoneTitle: null,
      };
    default:
      return {
        who: contract.currentStepOwner,
        next: nextActionCopy(contract),
        currentMilestoneTitle: null,
      };
  }
}

export function contractTitle(contract: LearningContract): string {
  const title = contract.deliverable?.title?.trim() || contract.goal?.title?.trim();
  return title || 'Learning contract';
}

/** Derived only. Never persist this as an editable field. */
export function contractProgress(contract: Pick<LearningContract, 'milestones'>): {
  approved: number;
  total: number;
  percent: number;
} {
  const total = contract.milestones.length;
  const approved = contract.milestones.filter((item) =>
    isApprovedMilestoneStatus(item.status),
  ).length;
  return {
    approved,
    total,
    percent: total === 0 ? 0 : Math.round((approved / total) * 100),
  };
}

export function milestoneEvidenceCount(
  milestone: Pick<Milestone, 'id' | 'evidenceText' | 'evidenceLink'>,
  items: readonly EvidenceItem[] = [],
): number {
  const fromItems = evidenceItemsForMilestone(items, milestone.id).length;
  if (fromItems > 0) return fromItems;
  return milestone.evidenceText.trim() || milestone.evidenceLink.trim() ? 1 : 0;
}

export type ContractEvidenceItem = {
  milestoneId: string;
  milestoneTitle: string;
  order: number;
  text: string;
  link: string;
  feedback: string | null;
};

export function contractEvidenceItems(contract: LearningContract): ContractEvidenceItem[] {
  return [...contract.milestones]
    .sort((a, b) => a.order - b.order)
    .filter((item) => milestoneEvidenceCount(item, contract.evidenceItems) > 0)
    .map((item) => ({
      milestoneId: item.id,
      milestoneTitle: item.title,
      order: item.order,
      text: item.evidenceText,
      link: item.evidenceLink,
      feedback: item.lastFeedback,
    }));
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
    case LEARNING_CONTRACT_STATUS.paused:
      return 'This contract is paused. Resume it to submit or review evidence.';
    case LEARNING_CONTRACT_STATUS.completionPending:
      return 'All milestones are approved. Confirm completion to publish the deliverable.';
    case LEARNING_CONTRACT_STATUS.completed:
      return 'This contract is complete. The deliverable is on both profiles.';
    case LEARNING_CONTRACT_STATUS.rejected:
      return 'The mentor rejected this proposal. Start a new builder from the relationship.';
    case LEARNING_CONTRACT_STATUS.cancelled:
      return 'This contract was cancelled.';
  }
}
