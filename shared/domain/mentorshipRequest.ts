import type { MentorshipApplication } from './applications.js';
import {
  COMMERCIAL_MODE,
  isCommercialMode,
  normalizeMentorOfferingFields,
  type CommercialMode,
  type MentorOfferingFields,
} from './mentorOffering.js';
import { isPaidCommercialMode } from './mentorPresentation.js';
import { isValidPriceCents } from './money.js';
import type { MentorshipRelationship } from './relationships.js';
import type { MentorProfile } from './users.js';
import type { ValidationResult } from './validation.js';

export const REQUEST_TYPE = {
  freeRequest: 'free_request',
  paidRequest: 'paid_request',
} as const;

export type RequestType = (typeof REQUEST_TYPE)[keyof typeof REQUEST_TYPE];

export const REQUEST_TYPE_PUBLIC_LABEL: Record<RequestType, string> = {
  [REQUEST_TYPE.freeRequest]: 'FREE REQUEST',
  [REQUEST_TYPE.paidRequest]: 'PAID REQUEST',
};

const REQUEST_TYPE_VALUES = new Set<string>(Object.values(REQUEST_TYPE));

export function isRequestType(value: unknown): value is RequestType {
  return typeof value === 'string' && REQUEST_TYPE_VALUES.has(value);
}

export interface MentorshipCommercialSnapshot {
  requestType: RequestType;
  commercialMode: CommercialMode;
  baseSessionPriceUsd: number | null;
  sessionDurationMinutes: number | null;
  paymentRequired: boolean;
  paymentSatisfied: boolean;
}

export function requestTypeFromCommercialMode(commercialMode: CommercialMode): RequestType {
  return isPaidCommercialMode(commercialMode)
    ? REQUEST_TYPE.paidRequest
    : REQUEST_TYPE.freeRequest;
}

export function requestTypePublicLabel(requestType: RequestType | undefined): string {
  return requestType
    ? REQUEST_TYPE_PUBLIC_LABEL[requestType]
    : REQUEST_TYPE_PUBLIC_LABEL[REQUEST_TYPE.freeRequest];
}

function freeCommercialSnapshot(): MentorshipCommercialSnapshot {
  return {
    requestType: REQUEST_TYPE.freeRequest,
    commercialMode: COMMERCIAL_MODE.givingBack,
    baseSessionPriceUsd: null,
    sessionDurationMinutes: null,
    paymentRequired: false,
    paymentSatisfied: true,
  };
}

export function buildMentorshipCommercialSnapshot(
  mentor: MentorOfferingFields & {
    commercialMode?: CommercialMode;
    baseSessionPriceUsd?: number | null;
    sessionPriceUsd?: number | null;
    sessionDurationMinutes?: number | null;
  },
): MentorshipCommercialSnapshot {
  const offering = normalizeMentorOfferingFields(mentor);
  const requestType = requestTypeFromCommercialMode(offering.commercialMode);
  const paymentRequired = requestType === REQUEST_TYPE.paidRequest;
  return {
    requestType,
    commercialMode: offering.commercialMode,
    baseSessionPriceUsd: offering.baseSessionPriceUsd,
    sessionDurationMinutes: offering.sessionDurationMinutes,
    paymentRequired,
    paymentSatisfied: !paymentRequired,
  };
}

export function validateMentorApplicationTarget(
  mentor: MentorOfferingFields & {
    commercialMode?: CommercialMode;
    baseSessionPriceUsd?: number | null;
    sessionPriceUsd?: number | null;
    sessionDurationMinutes?: number | null;
  },
): ValidationResult {
  const snapshot = buildMentorshipCommercialSnapshot(mentor);
  if (snapshot.requestType === REQUEST_TYPE.paidRequest) {
    if (
      snapshot.baseSessionPriceUsd == null ||
      !isValidPriceCents(snapshot.baseSessionPriceUsd) ||
      snapshot.baseSessionPriceUsd <= 0
    ) {
      return {
        ok: false,
        error: 'This mentor has not published a valid paid session price yet',
      };
    }
    if (!isCommercialMode(snapshot.commercialMode) || !isPaidCommercialMode(snapshot.commercialMode)) {
      return { ok: false, error: 'This mentor is not configured for paid mentorship' };
    }
  }
  return { ok: true };
}

export function normalizeApplicationCommercialFields(
  application: Partial<MentorshipApplication>,
): MentorshipCommercialSnapshot {
  if (!application.requestType && !application.commercialMode) {
    return freeCommercialSnapshot();
  }
  const commercialMode = isCommercialMode(application.commercialMode)
    ? application.commercialMode
    : COMMERCIAL_MODE.givingBack;
  const requestType = application.requestType
    ? application.requestType
    : requestTypeFromCommercialMode(commercialMode);
  const paymentRequired = requestType === REQUEST_TYPE.paidRequest;
  return {
    requestType,
    commercialMode,
    baseSessionPriceUsd: application.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: application.sessionDurationMinutes ?? null,
    paymentRequired,
    paymentSatisfied: !paymentRequired,
  };
}

export function applicationCommercialFieldsFromSnapshot(
  snapshot: MentorshipCommercialSnapshot,
): Pick<
  MentorshipApplication,
  'requestType' | 'commercialMode' | 'baseSessionPriceUsd' | 'sessionDurationMinutes'
> {
  return {
    requestType: snapshot.requestType,
    commercialMode: snapshot.commercialMode,
    baseSessionPriceUsd: snapshot.baseSessionPriceUsd,
    sessionDurationMinutes: snapshot.sessionDurationMinutes,
  };
}

export function relationshipCommercialFromApplication(
  application: Partial<MentorshipApplication>,
): Pick<
  MentorshipRelationship,
  | 'requestType'
  | 'commercialMode'
  | 'baseSessionPriceUsd'
  | 'sessionDurationMinutes'
  | 'paymentRequired'
  | 'paymentSatisfied'
> {
  const snapshot = normalizeApplicationCommercialFields(application);
  return {
    requestType: snapshot.requestType,
    commercialMode: snapshot.commercialMode,
    baseSessionPriceUsd: snapshot.baseSessionPriceUsd,
    sessionDurationMinutes: snapshot.sessionDurationMinutes,
    paymentRequired: snapshot.paymentRequired,
    paymentSatisfied: snapshot.paymentSatisfied,
  };
}

/** True when paid mentorship services must not be delivered yet (payment not satisfied). */
export function paidMentorshipServicesBlocked(
  relationship: Pick<
    MentorshipRelationship,
    'requestType' | 'paymentRequired' | 'paymentSatisfied'
  >,
): boolean {
  if (relationship.paymentRequired === true && relationship.paymentSatisfied !== true) {
    return true;
  }
  if (relationship.requestType === REQUEST_TYPE.paidRequest && relationship.paymentSatisfied === false) {
    return true;
  }
  return false;
}

export function canAccessPaidMentorshipServices(
  relationship: Pick<
    MentorshipRelationship,
    'requestType' | 'paymentRequired' | 'paymentSatisfied'
  >,
): boolean {
  return !paidMentorshipServicesBlocked(relationship);
}

export function buildMentorshipCommercialSnapshotFromProfile(
  profile: Pick<
    MentorProfile,
    | 'commercialMode'
    | 'baseSessionPriceUsd'
    | 'sessionPriceUsd'
    | 'sessionDurationMinutes'
    | 'mentorType'
    | 'serviceDescription'
    | 'servicesDescription'
    | 'includedMessaging'
    | 'messagingIncluded'
    | 'offersVideoSessions'
    | 'acceptsNewLearners'
    | 'public'
    | 'verificationStatus'
  >,
): MentorshipCommercialSnapshot {
  return buildMentorshipCommercialSnapshot(profile);
}
