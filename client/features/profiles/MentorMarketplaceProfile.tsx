import type { ReactNode } from 'react';
import {
  COMMERCIAL_MODE,
  commercialModeDescription,
  commercialModePublicTitle,
  formatMentorPriceDisplay,
  isPaidCommercialMode,
  mentorAvailabilityCopy,
  mentorHelpSummary,
  mentorMessagingCopy,
  mentorTypeDescription,
  mentorTypePublicTitle,
  mentorVideoSessionCopy,
  type PublicProfile,
} from '@apprentorbay/shared';
import { Card, Stack, Text } from '../../components';
import { MentorBadges, ProfilePhoto } from './PublicProfileView';

type MentorMarketplaceHeroProps = {
  profile: PublicProfile;
  name: string;
  identity: string;
  location: string | null;
  photoPath: string | null;
  children?: ReactNode;
};

export function MentorMarketplaceHero({
  profile,
  name,
  identity,
  location,
  photoPath,
  children,
}: MentorMarketplaceHeroProps) {
  const helpWith = mentorHelpSummary({
    servicesDescription: profile.servicesDescription,
    mentoringInterests: profile.mentoringInterests,
    areasOfExpertise: profile.areasOfExpertise,
    professionalIdentity: profile.professionalIdentity || identity,
  });
  const priceLabel = formatMentorPriceDisplay({
    commercialMode: profile.commercialMode ?? COMMERCIAL_MODE.givingBack,
    sessionPriceUsd: profile.sessionPriceUsd ?? null,
    sessionDurationMinutes: profile.sessionDurationMinutes,
  });

  return (
    <Stack gap={24}>
      <Card padding="lg">
        <Stack gap={24}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <ProfilePhoto path={photoPath} name={name} />
            <div className="min-w-0 flex-1">
              <Stack gap={12}>
                <Text variant="caption">Mentor</Text>
                <Text variant="h1">{name}</Text>
                {identity ? <Text variant="muted">{identity}</Text> : null}
                {location ? <Text variant="small">{location}</Text> : null}
                <MentorBadges profile={profile} compact />
              </Stack>
            </div>
          </div>

          <div className="grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
            <MarketplaceFact
              label="Experience type"
              title={mentorTypePublicTitle(profile.mentorType)}
              description={mentorTypeDescription(profile.mentorType)}
            />
            <MarketplaceFact
              label="Service model"
              title={commercialModePublicTitle(profile.commercialMode)}
              description={commercialModeDescription(profile.commercialMode)}
            />
            <MarketplaceFact label="Price" title={priceLabel} />
            <MarketplaceFact
              label="Availability"
              title={mentorAvailabilityCopy(profile.acceptsNewLearners)}
              description={[
                mentorVideoSessionCopy(profile.offersVideoSessions),
                mentorMessagingCopy(profile.messagingIncluded),
              ].join(' · ')}
            />
          </div>

          {helpWith ? (
            <div className="border-t border-line pt-6">
              <Stack gap={8}>
                <Text variant="caption">What I help with</Text>
                <Text>{helpWith}</Text>
              </Stack>
            </div>
          ) : null}

          {children ? <div className="border-t border-line pt-6">{children}</div> : null}
        </Stack>
      </Card>
    </Stack>
  );
}

function MarketplaceFact({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <Stack gap={8}>
      <Text variant="caption">{label}</Text>
      <Text variant="h3">{title}</Text>
      {description ? <Text variant="small">{description}</Text> : null}
    </Stack>
  );
}

export function mentorOfferingForApply(profile: PublicProfile) {
  const commercialMode = profile.commercialMode ?? COMMERCIAL_MODE.givingBack;
  return {
    commercialMode,
    isPaid: isPaidCommercialMode(commercialMode),
    priceLabel: formatMentorPriceDisplay({
      commercialMode,
      sessionPriceUsd: profile.sessionPriceUsd ?? null,
      sessionDurationMinutes: profile.sessionDurationMinutes,
    }),
    helpWith: mentorHelpSummary({
      servicesDescription: profile.servicesDescription,
      mentoringInterests: profile.mentoringInterests,
      areasOfExpertise: profile.areasOfExpertise,
      professionalIdentity: profile.professionalIdentity,
    }),
    offersVideoSessions: profile.offersVideoSessions === true,
    messagingIncluded: profile.messagingIncluded !== false,
    mentorTypeLabel: mentorTypePublicTitle(profile.mentorType),
    serviceModelLabel: commercialModePublicTitle(profile.commercialMode),
    serviceModelDescription: commercialModeDescription(profile.commercialMode),
  };
}
