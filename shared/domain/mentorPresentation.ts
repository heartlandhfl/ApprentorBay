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
  return commercialMode === COMMERCIAL_MODE.givingBack ? 'Request mentorship' : 'Book a session';
}

/** Learner-facing CTA that matches the actual next step in the product flow. */
export function learnerMentorshipPrimaryActionLabel(input: {
  commercialMode: CommercialMode;
  hasActiveRelationship?: boolean;
  paymentRequired?: boolean;
  paymentSatisfied?: boolean;
}): string {
  const hasActiveRelationship = input.hasActiveRelationship === true;
  const paymentRequired = input.paymentRequired === true;
  const paymentSatisfied = input.paymentSatisfied === true;

  if (hasActiveRelationship && paymentRequired && !paymentSatisfied) {
    return 'Book and pay';
  }
  if (hasActiveRelationship && paymentSatisfied) {
    return 'Open mentorship';
  }
  return 'Request mentorship';
}

export function mentorshipSessionTitle(input: {
  commercialMode: CommercialMode;
  serviceDescription?: string;
}): string {
  const description = input.serviceDescription?.trim();
  if (description) {
    const firstLine = description.split('\n')[0]?.trim() ?? '';
    if (firstLine.length > 0 && firstLine.length <= 80) {
      return firstLine;
    }
  }
  return `${commercialModeTitle(input.commercialMode)} mentorship`;
}

export function mentorshipDurationLabel(sessionDurationMinutes?: number | null): string | null {
  if (sessionDurationMinutes == null || sessionDurationMinutes <= 0) return null;
  return `${sessionDurationMinutes} minute${sessionDurationMinutes === 1 ? '' : 's'}`;
}

export function mentorshipPriceAmountLabel(input: {
  commercialMode: CommercialMode;
  baseSessionPriceUsd: number | null;
}): string {
  if (input.commercialMode === COMMERCIAL_MODE.givingBack) {
    return 'Free';
  }
  if (input.baseSessionPriceUsd != null && input.baseSessionPriceUsd > 0) {
    return formatUsdCents(input.baseSessionPriceUsd);
  }
  return 'Price on request';
}

export const MENTORSHIP_CURRENCY_CODE = 'USD' as const;

export interface MentorshipOfferingView {
  sessionTitle: string;
  serviceModelTitle: string;
  durationLabel: string | null;
  priceAmountLabel: string;
  currencyCode: typeof MENTORSHIP_CURRENCY_CODE;
  priceSummary: string;
  description: string;
  isPaid: boolean;
  primaryActionLabel: string;
  nextSteps: readonly string[];
  includesVideo: boolean;
  includesMessaging: boolean;
}

export function mentorshipOfferingDescription(input: {
  serviceDescription?: string;
  mentoringInterests?: string;
  areasOfExpertise?: string[];
}): string {
  const service = input.serviceDescription?.trim();
  if (service) {
    const remainder = service.includes('\n') ? service.split('\n').slice(1).join(' ').trim() : '';
    if (remainder) return remainder;
    if (service.length > 80) return service;
  }
  const interests = input.mentoringInterests?.trim();
  if (interests) return interests;
  const areas = (input.areasOfExpertise ?? []).map((item) => item.trim()).filter(Boolean);
  if (areas.length > 0) {
    return `One-to-one mentorship focused on ${areas.slice(0, 3).join(', ').toLowerCase()}.`;
  }
  return 'A focused one-to-one mentorship session tailored to your goals.';
}

export function mentorshipNextSteps(input: {
  commercialMode: CommercialMode;
  mentorName: string;
  hasActiveRelationship: boolean;
  paymentRequired: boolean;
  paymentSatisfied: boolean;
}): readonly string[] {
  const mentorName = input.mentorName.trim() || 'your mentor';
  if (!isPaidCommercialMode(input.commercialMode)) {
    return [
      'Send a mentorship request with a short introduction.',
      `${mentorName} reviews your request.`,
      'If accepted, message and schedule sessions together in your mentorship workspace.',
    ];
  }
  if (input.hasActiveRelationship && input.paymentRequired && !input.paymentSatisfied) {
    return [
      'Book your mentorship session and confirm the price shown.',
      'Complete secure checkout in USD.',
      'Schedule your video session in the mentorship workspace.',
      'Join the session when it is time to meet.',
    ];
  }
  if (input.hasActiveRelationship && input.paymentSatisfied) {
    return [
      'Open your mentorship workspace.',
      'Schedule your next session when you are ready.',
      'Join the video session at the agreed time.',
    ];
  }
  return [
    'Request mentorship and introduce yourself.',
    `If ${mentorName} accepts, book and pay for your session securely in USD.`,
    'Schedule your video session together in the mentorship workspace.',
    'Join the session when it is time to meet.',
  ];
}

export function buildMentorshipOfferingView(input: {
  commercialMode: CommercialMode;
  mentorType?: MentorType;
  baseSessionPriceUsd?: number | null;
  sessionDurationMinutes?: number | null;
  serviceDescription?: string;
  mentoringInterests?: string;
  areasOfExpertise?: string[];
  offersVideoSessions?: boolean;
  includedMessaging?: boolean;
  mentorName?: string;
  hasActiveRelationship?: boolean;
  paymentRequired?: boolean;
  paymentSatisfied?: boolean;
}): MentorshipOfferingView {
  const commercialMode = input.commercialMode;
  const isPaid = isPaidCommercialMode(commercialMode);
  const hasActiveRelationship = input.hasActiveRelationship === true;
  const paymentRequired = input.paymentRequired === true;
  const paymentSatisfied = input.paymentSatisfied === true;
  return {
    sessionTitle: mentorshipSessionTitle({
      commercialMode,
      serviceDescription: input.serviceDescription,
    }),
    serviceModelTitle: commercialModeTitle(commercialMode),
    durationLabel: mentorshipDurationLabel(input.sessionDurationMinutes),
    priceAmountLabel: mentorshipPriceAmountLabel({
      commercialMode,
      baseSessionPriceUsd: input.baseSessionPriceUsd ?? null,
    }),
    currencyCode: MENTORSHIP_CURRENCY_CODE,
    priceSummary: formatMentorPriceDisplay({
      commercialMode,
      baseSessionPriceUsd: input.baseSessionPriceUsd ?? null,
      sessionDurationMinutes: input.sessionDurationMinutes,
    }),
    description: mentorshipOfferingDescription(input),
    isPaid,
    primaryActionLabel: learnerMentorshipPrimaryActionLabel({
      commercialMode,
      hasActiveRelationship,
      paymentRequired,
      paymentSatisfied,
    }),
    nextSteps: mentorshipNextSteps({
      commercialMode,
      mentorName: input.mentorName ?? 'your mentor',
      hasActiveRelationship,
      paymentRequired,
      paymentSatisfied,
    }),
    includesVideo: input.offersVideoSessions === true,
    includesMessaging: input.includedMessaging !== false,
  };
}

export function mentorExpertiseHeadline(areasOfExpertise?: string[]): string {
  const areas = (areasOfExpertise ?? []).map((item) => item.trim()).filter(Boolean);
  return areas.join(' · ');
}

export function mentorProfileQuote(input: {
  mentoringInterests?: string;
  serviceDescription?: string;
}): string {
  const interests = input.mentoringInterests?.trim();
  if (interests) return interests;
  const service = input.serviceDescription?.trim();
  if (service) return service.split('\n')[0]?.trim() ?? '';
  return '';
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

/** Discovery-facing commercial labels (Free instead of Giving Back). */
export const COMMERCIAL_MODE_DISCOVERY_LABEL: Record<CommercialMode, string> = {
  [COMMERCIAL_MODE.givingBack]: 'Free',
  [COMMERCIAL_MODE.professional]: 'Professional',
  [COMMERCIAL_MODE.premium]: 'Premium',
};

export function commercialModeDiscoveryLabel(commercialMode: CommercialMode | undefined): string {
  return commercialMode
    ? COMMERCIAL_MODE_DISCOVERY_LABEL[commercialMode]
    : COMMERCIAL_MODE_DISCOVERY_LABEL[COMMERCIAL_MODE.givingBack];
}

export function mentorCardServiceDescription(mentor: {
  serviceDescription?: string;
  servicesDescription?: string;
  mentoringInterests?: string;
}): string {
  const description =
    mentor.serviceDescription?.trim() || mentor.servicesDescription?.trim() || '';
  if (description) return description;
  return mentor.mentoringInterests?.trim() ?? '';
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
