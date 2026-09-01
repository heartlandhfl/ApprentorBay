/**
 * Evidence is embedded on a milestone (evidenceText + evidenceLink).
 * It is not a Firestore collection.
 */

export interface Evidence {
  text: string;
  link: string;
}

export const EVIDENCE = {
  textMinLength: 1,
  /**
   * Link is optional in the current machine. When present it is stored as
   * a raw string (URL-only policy until Storage is wired).
   */
  linkOptional: true,
} as const;

export function evidenceFromMilestone(milestone: {
  evidenceText: string;
  evidenceLink: string;
}): Evidence {
  return {
    text: milestone.evidenceText,
    link: milestone.evidenceLink,
  };
}

export function isEvidenceComplete(evidence: Pick<Evidence, 'text'>): boolean {
  return evidence.text.trim().length >= EVIDENCE.textMinLength;
}
