/**
 * Mentor classification and commercial offering.
 * `mentorType` and `commercialMode` are separate dimensions — not a single combined enum.
 */

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

export const MENTOR_SERVICES_DESCRIPTION = {
  maxLength: 500,
} as const;

export const SESSION_PRICE_USD = {
  max: 9999,
} as const;

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
  servicesDescription?: string;
  sessionPriceUsd?: number | null;
  sessionDurationMinutes?: number | null;
  offersVideoSessions?: boolean;
  messagingIncluded?: boolean;
  acceptsNewLearners?: boolean;
}

export interface ResolvedMentorOffering {
  mentorType: MentorType;
  commercialMode: CommercialMode;
  servicesDescription: string;
  sessionPriceUsd: number | null;
  sessionDurationMinutes: number | null;
  offersVideoSessions: boolean;
  messagingIncluded: boolean;
  acceptsNewLearners: boolean;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asOptionalPrice(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function asOptionalDuration(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  return value;
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

  return {
    mentorType,
    commercialMode: safeCommercialMode,
    servicesDescription: asText(input.servicesDescription).trim(),
    sessionPriceUsd:
      input.sessionPriceUsd === undefined ? null : (input.sessionPriceUsd ?? null),
    sessionDurationMinutes:
      input.sessionDurationMinutes === undefined
        ? null
        : (input.sessionDurationMinutes ?? null),
    offersVideoSessions: input.offersVideoSessions === true,
    messagingIncluded: input.messagingIncluded !== false,
    acceptsNewLearners,
  };
}

export function normalizeMentorOfferingFields(
  input: MentorOfferingFields & { public?: boolean; verificationStatus?: string },
): ResolvedMentorOffering {
  return resolveMentorOffering(input);
}
