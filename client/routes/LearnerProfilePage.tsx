import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LearnerProfile, Showcase } from '@apprentorbay/shared';
import {
  Button,
  Card,
  EmptyState,
  Page,
  Stack,
  Text,
} from '../components';
import { watchLearnerProfile } from '../features/profiles';
import { ShowcaseCard, watchLearnerShowcases } from '../features/showcases';
import { useAuth } from '../lib/auth';

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const [profile, setProfile] = useState<LearnerProfile | null | undefined>(undefined);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    const unsubProfile = watchLearnerProfile(id, setProfile, (err) => setError(err.message));
    const unsubShowcases = watchLearnerShowcases(
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
          title="No public learner profile"
          description="This page is empty on purpose — the profile is missing or not public."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      ) : (
        <LearnerBody
          profile={profile}
          showcases={showcases}
          isOwner={account?.uid === profile.userId}
        />
      )}
    </Page>
  );
}

function LearnerBody({
  profile,
  showcases,
  isOwner,
}: {
  profile: LearnerProfile;
  showcases: Showcase[];
  isOwner: boolean;
}) {
  const visible = showcases.filter((item) => item.published || isOwner);
  return (
    <Stack gap={32}>
      <Stack gap={12}>
        <Text variant="caption">Learner</Text>
        <Text variant="h1">{profile.displayName || 'Learner'}</Text>
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
          <Text variant="h2">Job status</Text>
          {profile.jobStatus.trim() ? (
            <Text>{profile.jobStatus}</Text>
          ) : (
            <EmptyState title="No job status yet" />
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Career aspirations</Text>
          {profile.careerAspirations.trim() ? (
            <Text>{profile.careerAspirations}</Text>
          ) : (
            <EmptyState title="No career aspirations yet" />
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Competency goals</Text>
          {profile.competencyGoals.length === 0 ? (
            <EmptyState title="No competency goals yet" />
          ) : (
            <Stack gap={12}>
              {profile.competencyGoals.map((goal) => (
                <Stack key={goal.id} gap={4}>
                  <Text variant="h3">{goal.title}</Text>
                  {goal.description ? <Text variant="small">{goal.description}</Text> : null}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Stack gap={16}>
        <Text variant="h2">Showcase</Text>
        {visible.length === 0 ? (
          <EmptyState
            title="No published showcase yet"
            description="Completed work appears here after the mentor confirms completion."
          />
        ) : (
          <Stack gap={16}>
            {visible.map((item) => (
              <ShowcaseCard key={item.id} showcase={item} perspective="learner" />
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
