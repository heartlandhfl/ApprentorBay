import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { LearnerProfile } from '@apprentorbay/shared';
import {
  Button,
  Card,
  EmptyState,
  Page,
  Stack,
  Text,
} from '../components';
import { watchLearnerProfile } from '../features/profiles';

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<LearnerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    return watchLearnerProfile(id, setProfile, (err) => setError(err.message));
  }, [id]);

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
              Back to harbor
            </Button>
          }
        />
      ) : (
        <LearnerBody profile={profile} />
      )}
    </Page>
  );
}

function LearnerBody({ profile }: { profile: LearnerProfile }) {
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

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Completed deliverables</Text>
          {profile.deliverables.length === 0 ? (
            <EmptyState title="No completed deliverables yet" />
          ) : (
            <Stack gap={8}>
              {profile.deliverables.map((item) => (
                <Text key={item.id}>{item.id}</Text>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
