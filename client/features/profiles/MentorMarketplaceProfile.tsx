import type { ReactNode } from 'react';
import {
  COMMERCIAL_MODE,
  buildMentorshipOfferingView,
  mentorExpertiseHeadline,
  mentorProfileQuote,
  mentorTypePublicTitle,
  type PublicProfile,
} from '@apprentorbay/shared';
import { Card, Stack, Text } from '../../components';
import { MentorBadges, ProfilePhoto } from './PublicProfileView';
import { MentorshipOfferingCard } from './MentorshipOfferingCard';

type MentorMarketplaceHeroProps = {
  profile: PublicProfile;
  name: string;
  identity: string;
  location: string | null;
  photoPath: string | null;
  offeringAction?: ReactNode;
};

export function MentorMarketplaceHero({
  profile,
  name,
  identity,
  location,
  photoPath,
  offeringAction,
}: MentorMarketplaceHeroProps) {
  const expertise = mentorExpertiseHeadline(profile.areasOfExpertise);
  const quote = mentorProfileQuote({
    mentoringInterests: profile.mentoringInterests,
    serviceDescription: profile.serviceDescription,
  });
  const offering = buildMentorshipOfferingView({
    commercialMode: profile.commercialMode ?? COMMERCIAL_MODE.givingBack,
    mentorType: profile.mentorType,
    baseSessionPriceUsd: profile.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    serviceDescription: profile.serviceDescription,
    mentoringInterests: profile.mentoringInterests,
    areasOfExpertise: profile.areasOfExpertise,
    offersVideoSessions: profile.offersVideoSessions,
    includedMessaging: profile.includedMessaging,
    mentorName: name,
  });

  return (
    <Stack gap={24}>
      <Card padding="lg">
        <Stack gap={24}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <ProfilePhoto path={photoPath} name={name} />
            <div className="min-w-0 flex-1">
              <Stack gap={12}>
                <Text variant="caption">{mentorTypePublicTitle(profile.mentorType)}</Text>
                <Text variant="h1">{name}</Text>
                {identity ? <Text variant="muted">{identity}</Text> : null}
                {expertise ? <Text variant="small">{expertise}</Text> : null}
                {location ? <Text variant="small">{location}</Text> : null}
                <MentorBadges profile={profile} compact />
                {quote ? (
                  <blockquote className="border-l-2 border-accent pl-4 text-body text-ink-muted">
                    “{quote}”
                  </blockquote>
                ) : null}
              </Stack>
            </div>
          </div>
        </Stack>
      </Card>

      <Stack gap={12}>
        <Text variant="h2" as="h2">
          Mentorship options
        </Text>
        <MentorshipOfferingCard offering={offering} action={offeringAction} />
      </Stack>
    </Stack>
  );
}

export function mentorOfferingForApply(profile: PublicProfile) {
  const commercialMode = profile.commercialMode ?? COMMERCIAL_MODE.givingBack;
  return buildMentorshipOfferingView({
    commercialMode,
    mentorType: profile.mentorType,
    baseSessionPriceUsd: profile.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    serviceDescription: profile.serviceDescription,
    mentoringInterests: profile.mentoringInterests,
    areasOfExpertise: profile.areasOfExpertise,
    offersVideoSessions: profile.offersVideoSessions,
    includedMessaging: profile.includedMessaging,
  });
}
