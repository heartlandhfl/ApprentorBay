/**
 * Evidence lives on the learning contract (`evidenceItems[]`).
 * It is not a Firestore collection and never uses public Storage paths.
 */

export const EVIDENCE_TYPE = {
  text: 'text',
  link: 'link',
  file: 'file',
  reflection: 'reflection',
} as const;

export type EvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  [EVIDENCE_TYPE.text]: 'TEXT',
  [EVIDENCE_TYPE.link]: 'LINK',
  [EVIDENCE_TYPE.file]: 'FILE',
  [EVIDENCE_TYPE.reflection]: 'REFLECTION',
};

export const EVIDENCE = {
  textMinLength: 1,
  /**
   * Link is optional in the current machine. When present it is stored as
   * a raw string (URL-only policy until Storage is wired).
   */
  linkOptional: true,
  storagePrefix: 'evidence',
  maxFileBytes: 10 * 1024 * 1024,
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
  ],
} as const;

/** Compatibility shape: older code reads text + link off a milestone. */
export interface Evidence {
  text: string;
  link: string;
}

export interface EvidenceItem {
  id: string;
  milestoneId: string;
  contractId: string;
  submittedBy: string;
  type: EvidenceType;
  /** Written text, reflection, URL, or original file name. */
  content: string;
  /** Private Storage object path. Null for text/link/reflection. */
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceDraft {
  type: EvidenceType;
  content: string;
  storagePath?: string | null;
}

export function isEvidenceType(value: unknown): value is EvidenceType {
  return (
    value === EVIDENCE_TYPE.text ||
    value === EVIDENCE_TYPE.link ||
    value === EVIDENCE_TYPE.file ||
    value === EVIDENCE_TYPE.reflection
  );
}

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

export function evidenceStoragePath(input: {
  contractId: string;
  milestoneId: string;
  userId: string;
  fileId: string;
}): string {
  return `${EVIDENCE.storagePrefix}/${input.contractId}/${input.milestoneId}/${input.userId}/${input.fileId}`;
}

export function parseEvidenceStoragePath(path: string): {
  contractId: string;
  milestoneId: string;
  userId: string;
  fileId: string;
} | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 5 || parts[0] !== EVIDENCE.storagePrefix) return null;
  const [ , contractId, milestoneId, userId, fileId] = parts;
  if (!contractId || !milestoneId || !userId || !fileId) return null;
  return { contractId, milestoneId, userId, fileId };
}

export function isPrivateEvidencePath(path: string): boolean {
  return parseEvidenceStoragePath(path) != null;
}

export function normalizeEvidenceItem(
  input: Partial<EvidenceItem> & { id: string; milestoneId: string; contractId: string },
): EvidenceItem {
  const type = isEvidenceType(input.type) ? input.type : EVIDENCE_TYPE.text;
  return {
    id: input.id,
    milestoneId: input.milestoneId,
    contractId: input.contractId,
    submittedBy: input.submittedBy ?? '',
    type,
    content: (input.content ?? '').trim(),
    storagePath: input.storagePath?.trim() ? input.storagePath.trim() : null,
    createdAt: input.createdAt ?? '',
    updatedAt: input.updatedAt ?? input.createdAt ?? '',
  };
}

export function evidenceItemsForMilestone(
  items: readonly EvidenceItem[],
  milestoneId: string,
): EvidenceItem[] {
  return items.filter((item) => item.milestoneId === milestoneId);
}

export function latestMilestoneProjection(items: readonly EvidenceItem[]): {
  evidenceText: string;
  evidenceLink: string;
} {
  const text =
    [...items].reverse().find((item) => item.type === EVIDENCE_TYPE.text)?.content ??
    [...items].reverse().find((item) => item.type === EVIDENCE_TYPE.reflection)?.content ??
    '';
  const link =
    [...items].reverse().find((item) => item.type === EVIDENCE_TYPE.link)?.content ?? '';
  return { evidenceText: text, evidenceLink: link };
}
