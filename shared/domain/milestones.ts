import {
  MILESTONE_STATUS,
  MILESTONE_STATUS_LABEL,
  isApprovedMilestoneStatus,
  isReviewableMilestoneStatus,
  type MilestoneStatus,
} from './statuses.js';
import {
  evidenceFromMilestone,
  evidenceItemsForMilestone,
  type Evidence,
  type EvidenceItem,
} from './evidence.js';

export interface Milestone {
  id: string;
  order: number;
  title: string;
  description: string;
  evidenceRequired: string;
  /** Alias of evidenceRequired for the Learning Goal Builder. */
  successCriteria: string;
  status: MilestoneStatus;
  evidenceText: string;
  evidenceLink: string;
  lastFeedback: string | null;
}

export type MilestoneParty = 'learner' | 'mentor' | 'nobody';

export function milestoneEvidence(milestone: Milestone): Evidence {
  return evidenceFromMilestone(milestone);
}

export function sortMilestones(milestones: readonly Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => a.order - b.order);
}

export function findMilestoneByStatus(
  milestones: readonly Milestone[],
  statuses: readonly MilestoneStatus[],
): Milestone | null {
  const ordered = sortMilestones(milestones);
  return ordered.find((item) => statuses.includes(item.status)) ?? null;
}

export function isActionableEvidenceMilestone(milestone: Milestone): boolean {
  return (
    milestone.status === MILESTONE_STATUS.active ||
    milestone.status === MILESTONE_STATUS.rejected
  );
}

export function isSubmittedMilestone(milestone: Milestone): boolean {
  return milestone.status === MILESTONE_STATUS.submitted;
}

export function isReviewableMilestone(milestone: Milestone): boolean {
  return isReviewableMilestoneStatus(milestone.status);
}

export function nextBeginWorkMilestone(milestones: readonly Milestone[]): Milestone | null {
  const ordered = sortMilestones(milestones);
  for (const item of ordered) {
    if (isApprovedMilestoneStatus(item.status)) continue;
    if (item.status === MILESTONE_STATUS.locked) return item;
    return null;
  }
  return null;
}

export function milestoneResponsibleParty(milestone: Milestone): MilestoneParty {
  switch (milestone.status) {
    case MILESTONE_STATUS.locked:
    case MILESTONE_STATUS.active:
    case MILESTONE_STATUS.rejected:
      return 'learner';
    case MILESTONE_STATUS.submitted:
    case MILESTONE_STATUS.underReview:
      return 'mentor';
    case MILESTONE_STATUS.approved:
    case MILESTONE_STATUS.declined:
      return 'nobody';
  }
}

export function milestoneNextAction(milestone: Milestone): string {
  switch (milestone.status) {
    case MILESTONE_STATUS.locked:
      return 'Begin work when this milestone is next.';
    case MILESTONE_STATUS.active:
      return 'Submit evidence that this milestone is done.';
    case MILESTONE_STATUS.submitted:
      return 'Mentor reviews the submitted evidence.';
    case MILESTONE_STATUS.underReview:
      return 'Mentor finishes the review: approve, request revision, or reject.';
    case MILESTONE_STATUS.rejected:
      return 'Learner resubmits evidence using the mentor feedback.';
    case MILESTONE_STATUS.approved:
      return 'This milestone is approved.';
    case MILESTONE_STATUS.declined:
      return 'This milestone was rejected.';
  }
}

export function milestoneEvidenceItems(
  milestone: Milestone,
  items: readonly EvidenceItem[],
): EvidenceItem[] {
  return evidenceItemsForMilestone(items, milestone.id);
}

export function milestoneStatusLabel(status: MilestoneStatus): string {
  return MILESTONE_STATUS_LABEL[status];
}
