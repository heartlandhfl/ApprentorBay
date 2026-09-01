import { APPLICATION_MESSAGE } from './applications.js';
import { isEvidenceComplete, type Evidence } from './evidence.js';
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

export function validateGoalDraft(input: {
  goalText: string;
  deliverableTitle: string;
  deliverableDescription: string;
}): ValidationResult {
  if (!input.goalText.trim()) return fail('Write a draft goal before sending');
  if (!input.deliverableTitle.trim() || !input.deliverableDescription.trim()) {
    return fail('Write a draft deliverable before sending');
  }
  return ok;
}

export function validateMentorPlan(input: {
  goalText: string;
  deliverableDescription: string;
  objectives: { text: string }[];
  milestones: { title: string; description: string; evidenceRequired: string }[];
}): ValidationResult {
  if (!input.goalText.trim()) return fail('The goal cannot be empty');
  if (!input.deliverableDescription.trim()) {
    return fail('The deliverable description cannot be empty');
  }
  if (input.objectives.filter((item) => item.text.trim()).length === 0) {
    return fail('Add at least one objective');
  }
  if (input.milestones.length === 0) {
    return fail('Add at least one milestone');
  }
  if (
    input.milestones.some(
      (item) =>
        !item.title.trim() || !item.description.trim() || !item.evidenceRequired.trim(),
    )
  ) {
    return fail('Every milestone needs a title, description, and required evidence');
  }
  return ok;
}

export function validateChangeRequestReason(reason: string): ValidationResult {
  if (!reason.trim()) return fail('A reason is required to request changes');
  return ok;
}

export function validateMilestoneFeedback(feedback: string): ValidationResult {
  if (!feedback.trim()) return fail('Feedback is required to reject a milestone');
  return ok;
}
