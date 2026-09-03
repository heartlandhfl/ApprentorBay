import {
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  isCommercialMode,
  isMentorType,
  type CommercialMode,
  type MentorType,
} from './mentorOffering.js';
import type { PublicProfile } from './publicProfiles.js';

export type MentorDiscoveryFilters = {
  query: string;
  mentorTypes: MentorType[];
  commercialModes: CommercialMode[];
  acceptingNewLearnersOnly: boolean;
  videoSessionsOnly: boolean;
  skillsQuery: string;
};

export const EMPTY_MENTOR_DISCOVERY_FILTERS: MentorDiscoveryFilters = {
  query: '',
  mentorTypes: [],
  commercialModes: [],
  acceptingNewLearnersOnly: false,
  videoSessionsOnly: false,
  skillsQuery: '',
};

export const MENTOR_DISCOVERY_MENTOR_TYPES = [
  MENTOR_TYPE.accomplished,
  MENTOR_TYPE.competencyCoach,
  MENTOR_TYPE.learningGuide,
] as const;

export const MENTOR_DISCOVERY_COMMERCIAL_MODES = [
  COMMERCIAL_MODE.givingBack,
  COMMERCIAL_MODE.professional,
  COMMERCIAL_MODE.premium,
] as const;

function normalizedMentorType(mentor: PublicProfile): MentorType {
  return isMentorType(mentor.mentorType) ? mentor.mentorType : MENTOR_TYPE.accomplished;
}

function normalizedCommercialMode(mentor: PublicProfile): CommercialMode {
  return isCommercialMode(mentor.commercialMode)
    ? mentor.commercialMode
    : COMMERCIAL_MODE.givingBack;
}

export function mentorDiscoverySearchHaystack(mentor: PublicProfile): string {
  return [
    mentor.displayName,
    mentor.professionalIdentity,
    mentor.serviceDescription,
    mentor.servicesDescription,
    mentor.mentoringInterests,
    ...mentor.areasOfExpertise,
    ...mentor.experience.map((item) => `${item.title} ${item.organization} ${item.summary}`),
    ...mentor.education.map((item) => `${item.credential} ${item.institution}`),
  ]
    .join(' ')
    .toLowerCase();
}

export function mentorDiscoverySkillsHaystack(mentor: PublicProfile): string {
  return [
    ...mentor.areasOfExpertise,
    ...mentor.mentoredDeliverables.flatMap((item) => item.skillsDemonstrated),
    ...mentor.experience.map((item) => `${item.title} ${item.summary}`),
  ]
    .join(' ')
    .toLowerCase();
}

export function mentorMatchesDiscoveryFilters(
  mentor: PublicProfile,
  filters: MentorDiscoveryFilters,
): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query && !mentorDiscoverySearchHaystack(mentor).includes(query)) {
    return false;
  }

  const skillsQuery = filters.skillsQuery.trim().toLowerCase();
  if (skillsQuery && !mentorDiscoverySkillsHaystack(mentor).includes(skillsQuery)) {
    return false;
  }

  if (
    filters.mentorTypes.length > 0 &&
    !filters.mentorTypes.includes(normalizedMentorType(mentor))
  ) {
    return false;
  }

  if (
    filters.commercialModes.length > 0 &&
    !filters.commercialModes.includes(normalizedCommercialMode(mentor))
  ) {
    return false;
  }

  if (filters.acceptingNewLearnersOnly && mentor.acceptsNewLearners !== true) {
    return false;
  }

  if (filters.videoSessionsOnly && mentor.offersVideoSessions !== true) {
    return false;
  }

  return true;
}

export function filterListedMentors(
  mentors: PublicProfile[],
  filters: MentorDiscoveryFilters,
): PublicProfile[] {
  return mentors.filter((mentor) => mentorMatchesDiscoveryFilters(mentor, filters));
}

export function hasActiveDiscoveryFilters(filters: MentorDiscoveryFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.skillsQuery.trim().length > 0 ||
    filters.mentorTypes.length > 0 ||
    filters.commercialModes.length > 0 ||
    filters.acceptingNewLearnersOnly ||
    filters.videoSessionsOnly
  );
}

export function mentorDiscoveryExpertiseLabel(mentor: PublicProfile): string {
  const areas = mentor.areasOfExpertise.map((item) => item.trim()).filter(Boolean);
  if (areas.length > 0) return areas.slice(0, 3).join(' · ');
  const identity = mentor.professionalIdentity.trim();
  if (identity) return identity;
  return 'Mentor';
}
