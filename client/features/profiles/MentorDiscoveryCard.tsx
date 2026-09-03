import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import {
  COMMERCIAL_MODE,
  buildMentorshipOfferingView,
  commercialModeDiscoveryLabel,
  mentorDiscoveryExpertiseLabel,
  mentorExpertiseHeadline,
  mentorTypePublicTitle,
  type PublicProfile,
} from '@apprentorbay/shared';
import { Badge, Button, Card, Cluster, Stack, Text } from '../../components';
import { getFirebaseStorage } from '../../lib/firebase';
import { MentorBadges } from './PublicProfileView';

type MentorDiscoveryCardProps = {
  mentor: PublicProfile;
};

export function MentorDiscoveryCard({ mentor }: MentorDiscoveryCardProps) {
  const commercialMode = mentor.commercialMode ?? COMMERCIAL_MODE.givingBack;
  const expertise = mentorDiscoveryExpertiseLabel(mentor);
  const headline = mentorExpertiseHeadline(mentor.areasOfExpertise);
  const offering = buildMentorshipOfferingView({
    commercialMode,
    mentorType: mentor.mentorType,
    baseSessionPriceUsd: mentor.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: mentor.sessionDurationMinutes,
    serviceDescription: mentor.serviceDescription,
    mentoringInterests: mentor.mentoringInterests,
    areasOfExpertise: mentor.areasOfExpertise,
    offersVideoSessions: mentor.offersVideoSessions,
    includedMessaging: mentor.includedMessaging,
    mentorName: mentor.displayName || 'Mentor',
  });

  return (
    <Card padding="lg">
      <Stack gap={16}>
        <div className="flex gap-4">
          <MentorAvatar name={mentor.displayName || 'Mentor'} photoPath={mentor.photoPath} />
          <Stack gap={8}>
            <Text variant="caption">{mentorTypePublicTitle(mentor.mentorType)}</Text>
            <Text variant="h2" as="h2">
              {mentor.displayName || 'Mentor'}
            </Text>
            {mentor.professionalIdentity ? (
              <Text variant="muted">{mentor.professionalIdentity}</Text>
            ) : null}
            {headline ? <Text variant="small">{headline}</Text> : null}
            <MentorBadges profile={mentor} compact />
          </Stack>
        </div>

        <Stack gap={8}>
          <Text variant="caption">Why they may be relevant</Text>
          <Text>{expertise}</Text>
        </Stack>

        <div className="rounded-sm border border-line bg-paper-raised p-4">
          <Stack gap={12}>
            <Cluster gap={8}>
              <Text variant="h3" as="h3">
                {offering.sessionTitle}
              </Text>
              <Badge tone={offering.isPaid ? 'neutral' : 'success'}>
                {commercialModeDiscoveryLabel(commercialMode)}
              </Badge>
            </Cluster>
            <Cluster gap={12}>
              {offering.durationLabel ? <Text variant="small">{offering.durationLabel}</Text> : null}
              <Text variant="h3">{offering.priceSummary}</Text>
            </Cluster>
            <p className="line-clamp-3 text-small text-ink-muted">{offering.description}</p>
          </Stack>
        </div>

        <Stack gap={12}>
          <Cluster gap={8}>
            {mentor.offersVideoSessions ? <Badge>Video sessions</Badge> : null}
            {mentor.acceptsNewLearners === false ? (
              <Badge tone="neutral">Not accepting learners</Badge>
            ) : null}
          </Cluster>
        </Stack>

        <div className="border-t border-line pt-4">
          <Button to={`/mentors/${mentor.slug}`} className="w-full sm:w-auto">
            {offering.primaryActionLabel}
          </Button>
        </div>
      </Stack>
    </Card>
  );
}

function MentorAvatar({ name, photoPath }: { name: string; photoPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath) {
      setUrl(null);
      return;
    }
    const storage = getFirebaseStorage();
    if (!storage) return;
    void getDownloadURL(ref(storage, photoPath)).then(setUrl).catch(() => setUrl(null));
  }, [photoPath]);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-16 w-16 shrink-0 rounded-sm object-cover"
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || 'M';
  return (
    <div
      aria-hidden
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border border-line bg-accent-subtle text-h3 text-accent"
    >
      {initial}
    </div>
  );
}
