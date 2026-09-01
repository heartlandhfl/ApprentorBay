import { MILESTONE_STATUS, type MilestoneStatus } from './statuses.js';
import { evidenceFromMilestone, type Evidence } from './evidence.js';

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
