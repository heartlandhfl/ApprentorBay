import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import {
  APPROVAL_DISCLAIMER,
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABEL,
  VERIFIED_CLAIM_LABEL,
  type PublicPortfolioItem,
  type PublicProfile,
  type VerifiedClaimType,
} from '@apprentorbay/shared';
import { Badge, Card, Cluster, EmptyState, Stack, Text } from '../../components';
import { getFirebaseStorage } from '../../lib/firebase';

export function ProfilePhoto({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const storage = getFirebaseStorage();
    if (!storage) return;
    void getDownloadURL(ref(storage, path)).then(setUrl).catch(() => setUrl(null));
  }, [path]);
  if (!url) return null;
  return <img src={url} alt={name} className="h-28 w-28 rounded-sm object-cover" />;
}

export function PortfolioSection({
  title,
  description,
  items,
  empty,
  perspective,
  featured = false,
}: {
  title: string;
  description?: string;
  items: PublicPortfolioItem[];
  empty: string;
  perspective: 'learner' | 'mentor';
  featured?: boolean;
}) {
  return (
    <Stack gap={16}>
      <Stack gap={8}>
        {featured ? <Text variant="caption">Strongest public record</Text> : null}
        <Text variant={featured ? 'h1' : 'h2'} as="h2">
          {title}
        </Text>
        {description ? <Text>{description}</Text> : null}
      </Stack>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <Stack gap={16}>
          {items.map((item) => (
            <Card key={item.id}>
              <Stack gap={12}>
                <Text variant="h2">{item.title}</Text>
                {item.description ? <Text>{item.description}</Text> : null}
                {item.skillsDemonstrated.length > 0 ? (
                  <Text variant="small">Skills demonstrated: {item.skillsDemonstrated.join(', ')}</Text>
                ) : null}
                {item.completedAt ? (
                  <Text variant="small">Completed {new Date(item.completedAt).toLocaleDateString()}</Text>
                ) : null}
                {perspective === 'learner' && item.mentorDisplayName ? (
                  <Text variant="small">Mentor: {item.mentorDisplayName}</Text>
                ) : null}
                {perspective === 'mentor' && item.learnerDisplayName ? (
                  <Text variant="small">Learner: {item.learnerDisplayName}</Text>
                ) : null}
                {perspective === 'mentor' && item.mentorContribution ? (
                  <Text variant="small">{item.mentorContribution}</Text>
                ) : null}
                {item.publicEvidence.map((evidence, index) => (
                  <Text key={`${evidence.type}-${index}`} variant="small">
                    {evidence.type.toUpperCase()}: {evidence.content}
                  </Text>
                ))}
                {item.links.map((link) => (
                  <Text key={link} variant="small">
                    {link}
                  </Text>
                ))}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function MentorBadges({
  profile,
  compact = false,
}: {
  profile: PublicProfile;
  compact?: boolean;
}) {
  const claims = profile.verifiedClaims.filter((item) => item.verified);
  return (
    <Stack gap={8}>
      <Cluster gap={8}>
        <Badge tone={profile.approvalStatus === APPROVAL_STATUS.approved ? 'success' : 'accent'}>
          {APPROVAL_STATUS_LABEL[profile.approvalStatus]}
        </Badge>
        {claims.map((item) => (
          <Badge key={item.type} tone="success">
            {VERIFIED_CLAIM_LABEL[item.type as VerifiedClaimType] ?? 'Verified claim'}
          </Badge>
        ))}
      </Cluster>
      {compact ? null : <Text variant="small">{APPROVAL_DISCLAIMER}</Text>}
    </Stack>
  );
}
