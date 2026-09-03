/**
 * Mentor classification and commercial offering.
 * `mentorType` and `commercialMode` are separate dimensions — not a single combined enum.
 */

import { isValidPriceCents, readSessionPriceCents } from './money.js';

export const MENTOR_TYPE = {
  accomplished: 'accomplished',
  competencyCoach: 'competency_coach',
  learningGuide: 'learning_guide',
} as const;

export type MentorType = (typeof MENTOR_TYPE)[keyof typeof MENTOR_TYPE];

export const COMMERCIAL_MODE = {
  givingBack: 'giving_back',
  professional: 'professional',
  premium: 'premium',
} as const;

export type CommercialMode = (typeof COMMERCIAL_MODE)[keyof typeof COMMERCIAL_MODE];

export const MENTOR_TYPE_LABEL: Record<MentorType, string> = {
  [MENTOR_TYPE.accomplished]: 'Accomplished Mentor',
  [MENTOR_TYPE.competencyCoach]: 'Competency Coach',
  [MENTOR_TYPE.learningGuide]: 'Learning Guide',
};

export const MENTOR_TYPE_DESCRIPTION: Record<MentorType, string> = {
  [MENTOR_TYPE.accomplished]:
    'Learn from someone who has built experience in the real world.',
  [MENTOR_TYPE.competencyCoach]:
    'Build practical skills and capabilities with guidance from someone who knows the work.',
  [MENTOR_TYPE.learningGuide]:
    'Stay focused, practise consistently and keep moving toward your learning goals.',
};

export const COMMERCIAL_MODE_LABEL: Record<CommercialMode, string> = {
  [COMMERCIAL_MODE.givingBack]: 'Giving Back',
  [COMMERCIAL_MODE.professional]: 'Professional',
  [COMMERCIAL_MODE.premium]: 'Premium',
};

export const COMMERCIAL_MODE_DESCRIPTION: Record<CommercialMode, string> = {
  [COMMERCIAL_MODE.givingBack]:
    'Free mentorship offered by mentors who want to support other learners.',
  [COMMERCIAL_MODE.professional]: 'Paid mentorship offered as a professional service.',
  [COMMERCIAL_MODE.premium]:
    'High-value mentorship from highly experienced professionals.',
};

/** Plain-language copy for the mentor profile editor. */
export const COMMERCIAL_MODE_EDITOR_DESCRIPTION: Record<CommercialMode, string> = {
  [COMMERCIAL_MODE.givingBack]: 'Free mentorship for learners.',
  [COMMERCIAL_MODE.professional]: 'Offer paid mentorship and set your session price.',
  [COMMERCIAL_MODE.premium]: 'Offer high-value mentorship at a premium price.',
};

/** Allowed commercial modes for each mentor type. Premium is accomplished-only. */
export const COMMERCIAL_MODES_FOR_MENTOR_TYPE: Record<MentorType, readonly CommercialMode[]> = {
  [MENTOR_TYPE.accomplished]: [
    COMMERCIAL_MODE.givingBack,
    COMMERCIAL_MODE.professional,
    COMMERCIAL_MODE.premium,
  ],
  [MENTOR_TYPE.competencyCoach]: [COMMERCIAL_MODE.givingBack, COMMERCIAL_MODE.professional],
  [MENTOR_TYPE.learningGuide]: [COMMERCIAL_MODE.givingBack, COMMERCIAL_MODE.professional],
};

export const SESSION_DURATION = {
  minMinutes: 15,
  maxMinutes: 180,
} as const;

export const MENTOR_SERVICE_DESCRIPTION = {
  maxLength: 500,
} as const;

/** @deprecated Use MENTOR_SERVICE_DESCRIPTION */
export const MENTOR_SERVICES_DESCRIPTION = MENTOR_SERVICE_DESCRIPTION;

const MENTOR_TYPE_VALUES = new Set<string>(Object.values(MENTOR_TYPE));
const COMMERCIAL_MODE_VALUES = new Set<string>(Object.values(COMMERCIAL_MODE));

export function isMentorType(value: unknown): value is MentorType {
  return typeof value === 'string' && MENTOR_TYPE_VALUES.has(value);
}

export function isCommercialMode(value: unknown): value is CommercialMode {
  return typeof value === 'string' && COMMERCIAL_MODE_VALUES.has(value);
}

export function commercialModeAllowedForMentorType(
  mentorType: MentorType,
  commercialMode: CommercialMode,
): boolean {
  return COMMERCIAL_MODES_FOR_MENTOR_TYPE[mentorType].includes(commercialMode);
}

export interface MentorOfferingFields {
  mentorType?: MentorType;
  commercialMode?: CommercialMode;
  serviceDescription?: string;
  /** Integer cents, e.g. 7500 = $75.00. Null for free mentors. */
  baseSessionPriceUsd?: number | null;
  sessionDurationMinutes?: number | null;
  offersVideoSessions?: boolean;
  includedMessaging?: boolean;
  acceptsNewLearners?: boolean;
  /** @deprecated Legacy whole-dollar field. Read-only for backwards compatibility. */
  servicesDescription?: string;
  /** @deprecated Legacy whole-dollar field. Read-only for backwards compatibility. */
  sessionPriceUsd?: number | null;
  /** @deprecated Use includedMessaging. Read-only for backwards compatibility. */
  messagingIncluded?: boolean;
}

export interface ResolvedMentorOffering {
  mentorType: MentorType;
  commercialMode: CommercialMode;
  serviceDescription: string;
  /** Integer cents. Null for free mentors. */
  baseSessionPriceUsd: number | null;
  sessionDurationMinutes: number | null;
  offersVideoSessions: boolean;
  includedMessaging: boolean;
  acceptsNewLearners: boolean;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalDuration(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  return value;
}

function readServiceDescription(input: MentorOfferingFields): string {
  const description = asText(input.serviceDescription ?? input.servicesDescription).trim();
  return description;
}

function readIncludedMessaging(input: MentorOfferingFields): boolean {
  if (input.includedMessaging !== undefined) return input.includedMessaging !== false;
  if (input.messagingIncluded !== undefined) return input.messagingIncluded !== false;
  return true;
}

function readBaseSessionPriceCents(
  input: MentorOfferingFields,
  commercialMode: CommercialMode,
): number | null {
  const raw = readSessionPriceCents(input);
  if (raw === undefined) return null;
  if (raw === null) return null;
  if (commercialMode === COMMERCIAL_MODE.givingBack) return null;
  return raw;
}

/**
 * Defaults for older mentor documents that predate mentor classification.
 * `acceptsNewLearners` follows the existing `public` flag when not set.
 */
export function resolveMentorOffering(
  input: MentorOfferingFields & { public?: boolean; verificationStatus?: string },
): ResolvedMentorOffering {
  const mentorType = isMentorType(input.mentorType)
    ? input.mentorType
    : MENTOR_TYPE.accomplished;
  const commercialMode = isCommercialMode(input.commercialMode)
    ? input.commercialMode
    : COMMERCIAL_MODE.givingBack;
  const safeCommercialMode = commercialModeAllowedForMentorType(mentorType, commercialMode)
    ? commercialMode
    : COMMERCIAL_MODE.givingBack;

  const acceptsNewLearners =
    input.acceptsNewLearners ??
    (input.public !== false && input.verificationStatus === 'approved');

  const baseSessionPriceUsd = readBaseSessionPriceCents(input, safeCommercialMode);

  return {
    mentorType,
    commercialMode: safeCommercialMode,
    serviceDescription: readServiceDescription(input),
    baseSessionPriceUsd:
      safeCommercialMode === COMMERCIAL_MODE.givingBack ? null : baseSessionPriceUsd,
    sessionDurationMinutes:
      input.sessionDurationMinutes === undefined
        ? null
        : asOptionalDuration(input.sessionDurationMinutes) ?? null,
    offersVideoSessions: input.offersVideoSessions === true,
    includedMessaging: readIncludedMessaging(input),
    acceptsNewLearners,
  };
}

export function normalizeMentorOfferingFields(
  input: MentorOfferingFields & { public?: boolean; verificationStatus?: string },
): ResolvedMentorOffering {
  return resolveMentorOffering(input);
}
