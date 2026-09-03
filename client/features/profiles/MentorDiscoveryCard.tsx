import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import {
  COMMERCIAL_MODE,
  commercialModeDiscoveryLabel,
  formatMentorPriceDisplay,
  mentorCardServiceDescription,
  mentorDiscoveryExpertiseLabel,
  mentorPrimaryActionLabel,
  mentorTypeTitle,
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
  const serviceDescription = mentorCardServiceDescription(mentor);
  const priceLabel = formatMentorPriceDisplay({
    commercialMode,
    baseSessionPriceUsd: mentor.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: mentor.sessionDurationMinutes,
  });
  const actionLabel = mentorPrimaryActionLabel(commercialMode);

  return (
    <Card padding="lg">
      <Stack gap={16}>
        <div className="flex gap-4">
          <MentorAvatar name={mentor.displayName || 'Mentor'} photoPath={mentor.photoPath} />
          <Stack gap={8}>
            <Text variant="h2" as="h2">
              {mentor.displayName || 'Mentor'}
            </Text>
            {mentor.professionalIdentity ? (
              <Text variant="muted">{mentor.professionalIdentity}</Text>
            ) : null}
            <MentorBadges profile={mentor} compact />
          </Stack>
        </div>

        <Stack gap={8}>
          <Text variant="caption">Why they may be relevant</Text>
          <Text>{expertise}</Text>
        </Stack>

        {serviceDescription ? (
          <p className="line-clamp-3 font-sans text-small text-ink-muted">{serviceDescription}</p>
        ) : null}

        <Stack gap={12}>
          <Text variant="caption">Mentoring approach</Text>
          <Cluster gap={8}>
            <Badge tone="accent">{mentorTypeTitle(mentor.mentorType)}</Badge>
            <Badge tone={commercialMode === COMMERCIAL_MODE.givingBack ? 'success' : 'neutral'}>
              {commercialModeDiscoveryLabel(commercialMode)}
            </Badge>
            {mentor.offersVideoSessions ? <Badge>Video sessions</Badge> : null}
            {mentor.acceptsNewLearners === false ? (
              <Badge tone="neutral">Not accepting learners</Badge>
            ) : null}
          </Cluster>
        </Stack>

        <div className="border-t border-line pt-4">
          <Stack gap={12}>
            <Text variant="h3">{priceLabel}</Text>
            <Button to={`/mentors/${mentor.slug}`}>{actionLabel}</Button>
          </Stack>
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
