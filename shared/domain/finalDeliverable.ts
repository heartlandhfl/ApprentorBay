import { MILESTONE_STATUS } from './statuses.js';
import type { EvidenceItem } from './evidence.js';

export const FINAL_DELIVERABLE_MILESTONE_ID = 'final';

export const FINAL_DELIVERABLE_REVIEW = {
  notSubmitted: 'not_submitted',
  submitted: 'submitted',
  reviewed: 'reviewed',
  revisionRequested: 'revision_requested',
} as const;

export type FinalDeliverableReviewStatus =
  (typeof FINAL_DELIVERABLE_REVIEW)[keyof typeof FINAL_DELIVERABLE_REVIEW];

export interface FinalDeliverableFile {
  fileName: string;
  storagePath: string;
}

export interface FinalDeliverable {
  title: string;
  description: string;
  files: FinalDeliverableFile[];
  links: string[];
  evidenceItemIds: string[];
  skillsDemonstrated: string[];
  submittedAt: string | null;
  submittedBy: string | null;
  reviewStatus: FinalDeliverableReviewStatus;
  reviewComment: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export function emptyFinalDeliverable(): FinalDeliverable {
  return {
    title: '',
    description: '',
    files: [],
    links: [],
    evidenceItemIds: [],
    skillsDemonstrated: [],
    submittedAt: null,
    submittedBy: null,
    reviewStatus: FINAL_DELIVERABLE_REVIEW.notSubmitted,
    reviewComment: null,
    reviewedAt: null,
    reviewedBy: null,
  };
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item).trim()).filter(Boolean);
}

export function normalizeFinalDeliverable(
  input: Partial<FinalDeliverable> | null | undefined,
): FinalDeliverable {
  const empty = emptyFinalDeliverable();
  if (!input) return empty;
  const review = Object.values(FINAL_DELIVERABLE_REVIEW).includes(
    input.reviewStatus as FinalDeliverableReviewStatus,
  )
    ? (input.reviewStatus as FinalDeliverableReviewStatus)
    : empty.reviewStatus;
  return {
    title: asText(input.title).trim(),
    description: asText(input.description).trim(),
    files: Array.isArray(input.files)
      ? input.files
          .map((file) => ({
            fileName: asText(file?.fileName).trim(),
            storagePath: asText(file?.storagePath).trim(),
          }))
          .filter((file) => file.fileName && file.storagePath)
      : [],
    links: asStringList(input.links),
    evidenceItemIds: asStringList(input.evidenceItemIds),
    skillsDemonstrated: asStringList(input.skillsDemonstrated),
    submittedAt: input.submittedAt ?? null,
    submittedBy: input.submittedBy ?? null,
    reviewStatus: review,
    reviewComment: input.reviewComment ? asText(input.reviewComment).trim() || null : null,
    reviewedAt: input.reviewedAt ?? null,
    reviewedBy: input.reviewedBy ?? null,
  };
}

export function isFinalDeliverableSubmitted(deliverable: FinalDeliverable): boolean {
  return (
    deliverable.reviewStatus === FINAL_DELIVERABLE_REVIEW.submitted ||
    deliverable.reviewStatus === FINAL_DELIVERABLE_REVIEW.reviewed ||
    deliverable.reviewStatus === FINAL_DELIVERABLE_REVIEW.revisionRequested
  );
}

export function isFinalDeliverableReviewed(deliverable: FinalDeliverable): boolean {
  return deliverable.reviewStatus === FINAL_DELIVERABLE_REVIEW.reviewed;
}

export function allRequiredMilestonesApproved(milestones: readonly { status: string }[]): boolean {
  return (
    milestones.length > 0 && milestones.every((item) => item.status === MILESTONE_STATUS.approved)
  );
}

export function publicEvidenceFromFinal(
  deliverable: FinalDeliverable,
  items: readonly EvidenceItem[],
): EvidenceItem[] {
  const allowed = new Set(deliverable.evidenceItemIds);
  return items.filter((item) => allowed.has(item.id));
}
