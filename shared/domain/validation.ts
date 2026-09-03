import { APPLICATION_MESSAGE } from './applications.js';
import {
  COMMERCIAL_MODE,
  COMMERCIAL_MODES_FOR_MENTOR_TYPE,
  MENTOR_SERVICES_DESCRIPTION,
  MENTOR_TYPE,
  SESSION_DURATION,
  SESSION_PRICE_USD,
  commercialModeAllowedForMentorType,
  isCommercialMode,
  isMentorType,
  type CommercialMode,
  type MentorOfferingFields,
  type MentorType,
} from './mentorOffering.js';
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

export const PASSWORD = {
  minLength: 6,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailValidation =
  | { ok: true; email: string }
  | { ok: false; error: string };

export type PasswordResetAction =
  | { kind: 'reset'; oobCode: string }
  | { kind: 'other'; mode: string }
  | { kind: 'none' };

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

const ok: ValidationResult = { ok: true };

export function validatePasswordResetEmail(email: string): EmailValidation {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: 'Enter the email you use to log in.' };
  if (!EMAIL_PATTERN.test(trimmed)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, email: trimmed };
}

export function validateNewPassword(password: string, confirmPassword: string): ValidationResult {
  if (password.length < PASSWORD.minLength) {
    return fail(`Password must be at least ${PASSWORD.minLength} characters.`);
  }
  if (password !== confirmPassword) {
    return fail('The two passwords do not match.');
  }
  return ok;
}

export function parsePasswordResetAction(input: {
  search?: string;
  hash?: string;
}): PasswordResetAction {
  const fromSearch = paramsFromQuery(input.search ?? '');
  const fromHash = paramsFromQuery((input.hash ?? '').replace(/^#/, ''));
  const mode = fromSearch.get('mode') ?? fromHash.get('mode');
  const oobCode = (fromSearch.get('oobCode') ?? fromHash.get('oobCode') ?? '').trim();
  if (oobCode && (!mode || mode === 'resetPassword')) {
    return { kind: 'reset', oobCode };
  }
  if (mode && mode !== 'resetPassword') {
    return { kind: 'other', mode };
  }
  return { kind: 'none' };
}

function paramsFromQuery(value: string): URLSearchParams {
  return new URLSearchParams(value.replace(/^\?/, ''));
}

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

export function validateMentorOffering(input: MentorOfferingFields): ValidationResult {
  if (input.mentorType !== undefined && !isMentorType(input.mentorType)) {
    return fail('Choose a valid mentor type');
  }
  if (input.commercialMode !== undefined && !isCommercialMode(input.commercialMode)) {
    return fail('Choose a valid commercial mode');
  }

  const mentorType: MentorType = isMentorType(input.mentorType)
    ? input.mentorType
    : MENTOR_TYPE.accomplished;
  const commercialMode: CommercialMode = isCommercialMode(input.commercialMode)
    ? input.commercialMode
    : COMMERCIAL_MODE.givingBack;

  if (
    input.mentorType !== undefined &&
    input.commercialMode !== undefined &&
    !commercialModeAllowedForMentorType(mentorType, commercialMode)
  ) {
    const allowed = COMMERCIAL_MODES_FOR_MENTOR_TYPE[mentorType]
      .map((mode) => mode.replace('_', ' '))
      .join(', ');
    return fail(`Premium is only available to Accomplished Mentors. Choose one of: ${allowed}.`);
  }

  if (input.servicesDescription !== undefined) {
    const description = input.servicesDescription.trim();
    if (description.length > MENTOR_SERVICES_DESCRIPTION.maxLength) {
      return fail(
        `Services description must be at most ${MENTOR_SERVICES_DESCRIPTION.maxLength} characters`,
      );
    }
  }

  const mode = isCommercialMode(input.commercialMode) ? input.commercialMode : commercialMode;

  if (input.sessionPriceUsd !== undefined && input.sessionPriceUsd !== null) {
    const price = input.sessionPriceUsd;
    if (!Number.isFinite(price) || price < 0) {
      return fail('Session price must be a non-negative number in USD');
    }
    if (price > SESSION_PRICE_USD.max) {
      return fail(`Session price cannot exceed $${SESSION_PRICE_USD.max}`);
    }
    if (mode === COMMERCIAL_MODE.givingBack && price > 0) {
      return fail('Giving Back mentors cannot set a session price');
    }
    if (
      (mode === COMMERCIAL_MODE.professional || mode === COMMERCIAL_MODE.premium) &&
      price <= 0 &&
      (input.commercialMode !== undefined || input.sessionPriceUsd !== null)
    ) {
      return fail('Paid mentorship requires a session price greater than zero');
    }
  }

  if (input.sessionDurationMinutes !== undefined && input.sessionDurationMinutes !== null) {
    const duration = input.sessionDurationMinutes;
    if (!Number.isInteger(duration)) {
      return fail('Session duration must be a whole number of minutes');
    }
    if (duration < SESSION_DURATION.minMinutes || duration > SESSION_DURATION.maxMinutes) {
      return fail(
        `Session duration must be between ${SESSION_DURATION.minMinutes} and ${SESSION_DURATION.maxMinutes} minutes`,
      );
    }
  }

  return ok;
}
