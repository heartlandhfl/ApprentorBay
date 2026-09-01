import { APPLICATION_MESSAGE } from './applications.js';
import {
  EVIDENCE_TYPE,
  isEvidenceComplete,
  isEvidenceType,
  isPrivateEvidencePath,
  parseEvidenceStoragePath,
  type Evidence,
  type EvidenceDraft,
} from './evidence.js';
import {
  FINAL_DELIVERABLE_MILESTONE_ID,
  type FinalDeliverableFile,
} from './finalDeliverable.js';
import { MESSAGE_TEXT } from './messages.js';

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

const ok: ValidationResult = { ok: true };

export function validateApplicationMessage(message: string): ValidationResult {
  const trimmed = message.trim();
  if (trimmed.length < APPLICATION_MESSAGE.minLength) {
    return fail('A short message is required');
  }
  if (trimmed.length > APPLICATION_MESSAGE.maxLength) {
    return fail(`Message must be at most ${APPLICATION_MESSAGE.maxLength} characters`);
  }
  return ok;
}

export function validateMessageText(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length < MESSAGE_TEXT.minLength) {
    return fail('Message text is required');
  }
  if (trimmed.length > MESSAGE_TEXT.maxLength) {
    return fail(`Message must be at most ${MESSAGE_TEXT.maxLength} characters`);
  }
  return ok;
}

export function validateEvidenceSubmission(evidence: Pick<Evidence, 'text' | 'link'>): ValidationResult {
  if (!isEvidenceComplete(evidence)) {
    return fail('Evidence text is required');
  }
  return ok;
}

export function validateEvidenceDrafts(
  drafts: EvidenceDraft[],
  context: { contractId: string; milestoneId: string; userId: string },
): ValidationResult {
  if (drafts.length === 0) return fail('Add at least one piece of evidence');
  for (const draft of drafts) {
    if (!isEvidenceType(draft.type)) return fail('Unknown evidence type');
    if (draft.type === EVIDENCE_TYPE.file) {
      const path = (draft.storagePath ?? '').trim();
      if (!path) return fail('A file path is required for FILE evidence');
      if (!isPrivateEvidencePath(path)) {
        return fail('File evidence must use the private evidence Storage path');
      }
      const parsed = parseEvidenceStoragePath(path);
      if (
        !parsed ||
        parsed.contractId !== context.contractId ||
        parsed.milestoneId !== context.milestoneId ||
        parsed.userId !== context.userId
      ) {
        return fail('File evidence path does not match this learner and milestone');
      }
      if (!draft.content.trim()) return fail('A file name is required');
    } else if (!draft.content.trim()) {
      return fail('Evidence content is required');
    }
  }
  return ok;
}

export function validateGoalDraft(input: {
  goalText?: string;
  goalTitle?: string;
  goalDescription?: string;
  deliverableTitle: string;
  deliverableDescription: string;
}): ValidationResult {
  const title = (input.goalTitle ?? '').trim() || (input.goalText ?? '').trim();
  const description = (input.goalDescription ?? '').trim();
  if (!title && !description) return fail('Write a draft goal before sending');
  if (!input.deliverableTitle.trim() || !input.deliverableDescription.trim()) {
    return fail('Write a draft deliverable before sending');
  }
  return ok;
}

export function validateMentorPlan(input: {
  goalText?: string;
  goalTitle?: string;
  goalDescription?: string;
  deliverableDescription: string;
  objectives: { text?: string; title?: string; description?: string }[];
  milestones: {
    title: string;
    description: string;
    evidenceRequired?: string;
    successCriteria?: string;
  }[];
}): ValidationResult {
  const goal =
    (input.goalTitle ?? '').trim() ||
    (input.goalDescription ?? '').trim() ||
    (input.goalText ?? '').trim();
  if (!goal) return fail('The goal cannot be empty');
  if (!input.deliverableDescription.trim()) {
    return fail('The deliverable description cannot be empty');
  }
  if (
    input.objectives.filter(
      (item) =>
        (item.title ?? '').trim() ||
        (item.description ?? '').trim() ||
        (item.text ?? '').trim(),
    ).length === 0
  ) {
    return fail('Add at least one objective');
  }
  if (input.milestones.length === 0) {
    return fail('Add at least one milestone');
  }
  if (
    input.milestones.some((item) => {
      const criteria = (item.successCriteria ?? item.evidenceRequired ?? '').trim();
      return !item.title.trim() || !item.description.trim() || !criteria;
    })
  ) {
    return fail('Every milestone needs a title, description, and success criteria');
  }
  return ok;
}

export function validateChangeRequestReason(reason: string): ValidationResult {
  if (!reason.trim()) return fail('A reason is required to request changes');
  return ok;
}

export function validateMilestoneFeedback(feedback: string): ValidationResult {
  if (!feedback.trim()) return fail('Feedback is required to request a revision or reject');
  return ok;
}

export function validateFinalDeliverable(input: {
  title: string;
  description: string;
  links?: string[];
  files?: FinalDeliverableFile[];
  evidenceItemIds?: string[];
  skillsDemonstrated?: string[];
  contractId: string;
  userId: string;
}): ValidationResult {
  if (!input.title.trim()) return fail('The final deliverable needs a title');
  if (!input.description.trim()) return fail('The final deliverable needs a description');
  const links = (input.links ?? []).map((item) => item.trim()).filter(Boolean);
  const files = input.files ?? [];
  const evidenceItemIds = (input.evidenceItemIds ?? []).map((item) => item.trim()).filter(Boolean);
  if (links.length === 0 && files.length === 0 && evidenceItemIds.length === 0) {
    return fail('Add a file, a link, or approved evidence to the final deliverable');
  }
  for (const file of files) {
    if (!file.fileName.trim() || !file.storagePath.trim()) {
      return fail('Each file needs a name and a private storage path');
    }
    if (!isPrivateEvidencePath(file.storagePath)) {
      return fail('Final deliverable files must use the private evidence Storage path');
    }
    const parsed = parseEvidenceStoragePath(file.storagePath);
    if (
      !parsed ||
      parsed.contractId !== input.contractId ||
      parsed.milestoneId !== FINAL_DELIVERABLE_MILESTONE_ID ||
      parsed.userId !== input.userId
    ) {
      return fail('File path does not match this learner and contract');
    }
  }
  return ok;
}
