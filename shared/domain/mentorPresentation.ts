import {
  COMMERCIAL_MODE,
  COMMERCIAL_MODE_DESCRIPTION,
  COMMERCIAL_MODE_LABEL,
  MENTOR_TYPE,
  MENTOR_TYPE_DESCRIPTION,
  MENTOR_TYPE_LABEL,
  type CommercialMode,
  type MentorType,
} from './mentorOffering.js';
import { formatUsdCents } from './money.js';

/** Uppercase public-facing mentor type labels for marketplace presentation. */
export const MENTOR_TYPE_PUBLIC_LABEL: Record<MentorType, string> = {
  [MENTOR_TYPE.accomplished]: 'ACCOMPLISHED MENTOR',
  [MENTOR_TYPE.competencyCoach]: 'COMPETENCY COACH',
  [MENTOR_TYPE.learningGuide]: 'LEARNING GUIDE',
};

/** Uppercase public-facing commercial mode labels for marketplace presentation. */
export const COMMERCIAL_MODE_PUBLIC_LABEL: Record<CommercialMode, string> = {
  [COMMERCIAL_MODE.givingBack]: 'GIVING BACK',
  [COMMERCIAL_MODE.professional]: 'PROFESSIONAL',
  [COMMERCIAL_MODE.premium]: 'PREMIUM',
};

export function isPaidCommercialMode(mode: CommercialMode): boolean {
  return mode === COMMERCIAL_MODE.professional || mode === COMMERCIAL_MODE.premium;
}

export function formatMentorPriceDisplay(input: {
  commercialMode: CommercialMode;
  baseSessionPriceUsd: number | null;
  sessionDurationMinutes?: number | null;
}): string {
  if (input.commercialMode === COMMERCIAL_MODE.givingBack) {
    return 'Free mentorship';
  }
  if (input.baseSessionPriceUsd != null && input.baseSessionPriceUsd > 0) {
    const price = formatUsdCents(input.baseSessionPriceUsd);
    if (input.sessionDurationMinutes != null && input.sessionDurationMinutes > 0) {
      return `${price} / ${input.sessionDurationMinutes} min`;
    }
    return `${price} / session`;
  }
  return 'Paid mentorship';
}

export function mentorPrimaryActionLabel(commercialMode: CommercialMode): string {
  return commercialMode === COMMERCIAL_MODE.givingBack
    ? 'Request mentorship'
    : 'View mentorship options';
}

export function mentorAvailabilityCopy(acceptsNewLearners: boolean | undefined): string {
  return acceptsNewLearners === false
    ? 'Not currently accepting new learners'
    : 'Currently accepting new learners';
}

export function mentorVideoSessionCopy(offersVideoSessions: boolean | undefined): string {
  return offersVideoSessions ? 'Video sessions available' : 'Video sessions not offered';
}

export function mentorMessagingCopy(includedMessaging: boolean | undefined): string {
  return includedMessaging === false ? 'Messaging not included' : 'Messaging included';
}

export function mentorTypeTitle(mentorType: MentorType | undefined): string {
  return mentorType ? MENTOR_TYPE_LABEL[mentorType] : MENTOR_TYPE_LABEL[MENTOR_TYPE.accomplished];
}

export function mentorTypePublicTitle(mentorType: MentorType | undefined): string {
  return mentorType
    ? MENTOR_TYPE_PUBLIC_LABEL[mentorType]
    : MENTOR_TYPE_PUBLIC_LABEL[MENTOR_TYPE.accomplished];
}

export function mentorTypeDescription(mentorType: MentorType | undefined): string {
  return mentorType
    ? MENTOR_TYPE_DESCRIPTION[mentorType]
    : MENTOR_TYPE_DESCRIPTION[MENTOR_TYPE.accomplished];
}

export function commercialModeTitle(commercialMode: CommercialMode | undefined): string {
  return commercialMode
    ? COMMERCIAL_MODE_LABEL[commercialMode]
    : COMMERCIAL_MODE_LABEL[COMMERCIAL_MODE.givingBack];
}

export function commercialModePublicTitle(commercialMode: CommercialMode | undefined): string {
  return commercialMode
    ? COMMERCIAL_MODE_PUBLIC_LABEL[commercialMode]
    : COMMERCIAL_MODE_PUBLIC_LABEL[COMMERCIAL_MODE.givingBack];
}

export function commercialModeDescription(commercialMode: CommercialMode | undefined): string {
  return commercialMode
    ? COMMERCIAL_MODE_DESCRIPTION[commercialMode]
    : COMMERCIAL_MODE_DESCRIPTION[COMMERCIAL_MODE.givingBack];
}

export function mentorHelpSummary(input: {
  serviceDescription?: string;
  mentoringInterests?: string;
  areasOfExpertise?: string[];
  professionalIdentity?: string;
}): string {
  const services = input.serviceDescription?.trim();
  if (services) return services;
  const interests = input.mentoringInterests?.trim();
  if (interests) return interests;
  const areas = (input.areasOfExpertise ?? []).map((item) => item.trim()).filter(Boolean);
  if (areas.length > 0) return areas.join(', ');
  const identity = input.professionalIdentity?.trim();
  if (identity) return identity;
  return '';
}
