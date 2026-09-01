import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  VERIFICATION_STATUS,
  type MentorProfile,
  type Showcase,
  type VerificationStatus,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Page,
  Stack,
  Text,
} from '../components';
import { ApplyMentorship } from '../features/mentorship';
import { watchMentorProfile } from '../features/profiles';
import { ShowcaseCard, watchMentorShowcases } from '../features/showcases';
import { useAuth } from '../lib/auth';

function verificationBadge(status: VerificationStatus) {
  if (status === VERIFICATION_STATUS.approved) return { tone: 'success' as const, label: 'Verified' };
  if (status === VERIFICATION_STATUS.rejected) return { tone: 'danger' as const, label: 'Rejected' };
  return { tone: 'accent' as const, label: 'Pending Approval' };
}

export function MentorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const [profile, setProfile] = useState<MentorProfile | null | undefined>(undefined);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    const unsubProfile = watchMentorProfile(id, setProfile, (err) => setError(err.message));
    const unsubShowcases = watchMentorShowcases(
      id,
      setShowcases,
      (err) => setError(err.message),
      { publishedOnly: account?.uid !== id },
    );
    return () => {
      unsubProfile();
      unsubShowcases();
    };
  }, [account?.uid, id]);

  return (
    <Page>
      {error ? (
        <EmptyState title="Could not load this profile" description={error} />
      ) : profile === undefined ? (
        <Text variant="muted">Loading profile…</Text>
      ) : profile === null ? (
        <EmptyState
          title="No public mentor profile"
          description="This page is empty on purpose — the profile is missing or not public."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      ) : (
        <MentorBody
          profile={profile}
          showcases={showcases}
          isOwner={account?.uid === profile.userId}
        />
      )}
    </Page>
  );
}

function MentorBody({
  profile,
  showcases,
  isOwner,
}: {
  profile: MentorProfile;
  showcases: Showcase[];
  isOwner: boolean;
}) {
  const visible = showcases.filter((item) => item.published || isOwner);
  const badge = verificationBadge(profile.verificationStatus);

  return (
    <Stack gap={32}>
      <Stack gap={12}>
        <Cluster gap={12}>
          <Text variant="caption">Mentor</Text>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </Cluster>
        <Text variant="h1">{profile.displayName || 'Mentor'}</Text>
        <ApplyMentorship profile={profile} />
      </Stack>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Education</Text>
          {profile.education.length === 0 ? (
            <EmptyState title="No education listed yet" />
          ) : (
            <Stack gap={12}>
              {profile.education.map((item) => (
                <Stack key={item.id} gap={4}>
                  <Text variant="h3">{item.credential}</Text>
                  <Text variant="small">
                    {[item.institution, item.year].filter(Boolean).join(' · ')}
                  </Text>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Experience</Text>
          {profile.experience.length === 0 ? (
            <EmptyState title="No experience listed yet" />
          ) : (
            <Stack gap={12}>
              {profile.experience.map((item) => (
                <Stack key={item.id} gap={4}>
                  <Text variant="h3">{item.title || 'Role'}</Text>
                  <Text variant="small">
                    {[item.organization, item.year].filter(Boolean).join(' · ')}
                  </Text>
                  {item.summary ? <Text>{item.summary}</Text> : null}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Goals</Text>
          <EmptyState title="No mentoring goals listed yet" />
        </Stack>
      </Card>

      <Stack gap={16}>
        <Text variant="h2">Mentored deliverables</Text>
        <Text variant="small">
          These are works the mentor guided. The learner remains the creator.
        </Text>
        {visible.length === 0 ? (
          <EmptyState title="No mentored deliverables yet" />
        ) : (
          <Stack gap={16}>
            {visible.map((item) => (
              <ShowcaseCard key={item.id} showcase={item} perspective="mentor" />
            ))}
          </Stack>
        )}
      </Stack>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Reviews</Text>
          {profile.reviews.length === 0 ? (
            <EmptyState title="No reviews yet" />
          ) : (
            <Stack gap={12}>
              {profile.reviews.map((review) => (
                <Stack key={review.id} gap={4}>
                  <Text variant="h3">{review.authorName}</Text>
                  <Text variant="small">Rating {review.rating} / 5</Text>
                  <Text>{review.body}</Text>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
