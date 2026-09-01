import type { DeliverableRef } from './deliverables.js';

/**
 * Showcase is a public projection of a completed deliverable.
 * Today it is derived from `DeliverableRef` on learner/mentor profiles.
 * There is no `showcases` collection — do not create one without a migration plan.
 */
export const SHOWCASE_SOURCE = {
  profileDeliverableRef: 'profile_deliverable_ref',
} as const;

export type ShowcaseSource = (typeof SHOWCASE_SOURCE)[keyof typeof SHOWCASE_SOURCE];

export interface ShowcaseItem {
  id: string;
  contractId: string;
  title: string;
  description: string;
  source: ShowcaseSource;
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
