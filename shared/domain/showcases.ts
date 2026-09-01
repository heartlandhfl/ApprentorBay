import type { DeliverableRef } from './deliverables.js';
import type { EvidenceItem } from './evidence.js';
import { EVIDENCE_TYPE } from './evidence.js';
import {
  isFinalDeliverableReviewed,
  isFinalDeliverableSubmitted,
  publicEvidenceFromFinal,
  type FinalDeliverable,
} from './finalDeliverable.js';
import { allRequiredMilestonesApproved } from './finalDeliverable.js';
import { USER_ROLE } from './identities.js';
import type { User } from './users.js';

export type ShowcaseContract = {
  id: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  deliverable: { title: string; description: string } | null;
  finalDeliverable: FinalDeliverable;
  evidenceItems: EvidenceItem[];
  showcasePublished: boolean;
};

/**
 * Showcase is a public-facing record of completed work.
 * One document per contract (`showcases/{contractId}`). That id makes
 * completion retries idempotent — they overwrite the same record.
 */
export const SHOWCASE_SOURCE = {
  profileDeliverableRef: 'profile_deliverable_ref',
  completion: 'completion',
} as const;

export type ShowcaseSource = (typeof SHOWCASE_SOURCE)[keyof typeof SHOWCASE_SOURCE];

export const MENTOR_CONTRIBUTION =
  'Mentored this work. The learner remains the creator.';

export interface ShowcaseEvidence {
  type: string;
  content: string;
}

export interface Showcase {
  id: string;
  contractId: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  title: string;
  description: string;
  skillsDemonstrated: string[];
  links: string[];
  files: { fileName: string; storagePath: string }[];
  publicEvidence: ShowcaseEvidence[];
  completedAt: string;
  published: boolean;
  publishedAt: string | null;
  creatorRole: typeof USER_ROLE.learner;
  mentorContribution: string;
  learnerDisplayName: string;
  mentorDisplayName: string;
  source: ShowcaseSource;
  createdAt: string;
  updatedAt: string;
}

/** Compatibility projection of older profile `deliverables[]` rows. */
export interface ShowcaseItem {
  id: string;
  contractId: string;
  title: string;
  description: string;
  source: ShowcaseSource;
}

export function showcaseDocId(contractId: string): string {
  return contractId;
}

export function showcaseFromDeliverableRef(ref: DeliverableRef): ShowcaseItem {
  return {
    id: ref.id,
    contractId: ref.contractId,
    title: ref.title,
    description: ref.description,
    source: SHOWCASE_SOURCE.profileDeliverableRef,
  };
}

export function showcasesFromProfile(profile: { deliverables: DeliverableRef[] }): ShowcaseItem[] {
  return profile.deliverables.map(showcaseFromDeliverableRef);
}

export function deliverableRefFromShowcase(showcase: Pick<Showcase, 'id' | 'contractId' | 'title' | 'description'>): DeliverableRef {
  return {
    id: showcase.id,
    contractId: showcase.contractId,
    title: showcase.title,
    description: showcase.description,
  };
}

export function publicEvidenceForShowcase(
  deliverable: FinalDeliverable,
  items: readonly EvidenceItem[],
): ShowcaseEvidence[] {
  return publicEvidenceFromFinal(deliverable, items)
    .filter((item) => item.type !== EVIDENCE_TYPE.file)
    .map((item) => ({ type: item.type, content: item.content }));
}

export function buildShowcase(input: {
  contract: ShowcaseContract;
  learnerDisplayName: string;
  mentorDisplayName: string;
  now: string;
  published?: boolean;
}): Showcase {
  const final = input.contract.finalDeliverable;
  const planned = input.contract.deliverable;
  const id = showcaseDocId(input.contract.id);
  const published = input.published ?? input.contract.showcasePublished;
  return {
    id,
    contractId: input.contract.id,
    relationshipId: input.contract.relationshipId,
    learnerId: input.contract.learnerId,
    mentorId: input.contract.mentorId,
    title: final.title || planned?.title || 'Completed deliverable',
    description: final.description || planned?.description || '',
    skillsDemonstrated: final.skillsDemonstrated,
    links: final.links,
    files: final.files,
    publicEvidence: publicEvidenceForShowcase(final, input.contract.evidenceItems),
    completedAt: input.now,
    published,
    publishedAt: published ? input.now : null,
    creatorRole: USER_ROLE.learner,
    mentorContribution: MENTOR_CONTRIBUTION,
    learnerDisplayName: input.learnerDisplayName,
    mentorDisplayName: input.mentorDisplayName,
    source: SHOWCASE_SOURCE.completion,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Same id + payload. A second completion write replaces, it does not fork. */
export function mergeShowcaseRecord(existing: Showcase | null, next: Showcase): Showcase {
  if (!existing) return next;
  return {
    ...next,
    id: existing.id,
    createdAt: existing.createdAt,
  };
}

export type CompletionRequirement = {
  milestonesApproved: boolean;
  finalDeliverableSubmitted: boolean;
  mentorReviewCompleted: boolean;
};

export function completionRequirements(contract: {
  milestones: { status: string }[];
  finalDeliverable: FinalDeliverable;
}): CompletionRequirement {
  return {
    milestonesApproved: allRequiredMilestonesApproved(contract.milestones),
    finalDeliverableSubmitted: isFinalDeliverableSubmitted(contract.finalDeliverable),
    mentorReviewCompleted: isFinalDeliverableReviewed(contract.finalDeliverable),
  };
}

export function canConfirmCompletion(contract: {
  milestones: { status: string }[];
  finalDeliverable: FinalDeliverable;
}): boolean {
  const gates = completionRequirements(contract);
  return gates.milestonesApproved && gates.finalDeliverableSubmitted && gates.mentorReviewCompleted;
}

export function completionBlockers(contract: {
  milestones: { status: string }[];
  finalDeliverable: FinalDeliverable;
}): string[] {
  const gates = completionRequirements(contract);
  const missing: string[] = [];
  if (!gates.milestonesApproved) missing.push('All required milestones must be approved');
  if (!gates.finalDeliverableSubmitted) missing.push('The learner must submit the final deliverable');
  if (!gates.mentorReviewCompleted) missing.push('The mentor must complete the completion review');
  return missing;
}

export function canReadShowcase(
  actor: Pick<User, 'uid' | 'role' | 'active'> | null | undefined,
  showcase: Pick<Showcase, 'published' | 'learnerId' | 'mentorId'>,
): boolean {
  if (showcase.published) return true;
  if (!actor) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return actor.uid === showcase.learnerId || actor.uid === showcase.mentorId;
}

export function canPublishShowcase(
  actor: Pick<User, 'uid' | 'role'> | null | undefined,
  showcase: Pick<Showcase, 'learnerId'>,
): boolean {
  return Boolean(actor && actor.role === USER_ROLE.learner && actor.uid === showcase.learnerId);
}
