import { useEffect, useMemo, useState } from 'react';
import {
  APPROVAL_DISCLAIMER,
  VERIFIED_CLAIM_LABEL,
  type PublicProfile,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Grid,
  Input,
  Page,
  Stack,
  Text,
} from '../components';
import { watchListedMentors } from '../features/profiles';

export function MentorsPage() {
  const [mentors, setMentors] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    return watchListedMentors(setMentors, (err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mentors ?? [];
    return (mentors ?? []).filter((mentor) => mentorMatches(mentor, needle));
  }, [mentors, query]);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Directory</Text>
          <Text variant="h1">Approved mentors</Text>
          <Text variant="muted">
            Public profiles only. A mentor appears here after the platform approves
            participation. {APPROVAL_DISCLAIMER}
          </Text>
          <Input
            label="Search by name or expertise"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Timber framing, joinery, display name…"
          />
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        {mentors === null ? (
          <Text variant="muted">Loading mentors…</Text>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query.trim() ? 'No mentors match that search' : 'No approved mentors yet'}
            description={
              query.trim()
                ? 'Try a different name or area of expertise.'
                : 'Approved mentors will appear here for anyone, including visitors who are not signed in.'
            }
          />
        ) : (
          <Grid cols={3}>
            {filtered.map((mentor) => (
              <MentorCard key={mentor.slug} mentor={mentor} />
            ))}
          </Grid>
        )}
      </Stack>
    </Page>
  );
}

function MentorCard({ mentor }: { mentor: PublicProfile }) {
  const craft = mentor.areasOfExpertise[0] || mentor.professionalIdentity || 'Mentor';

  return (
    <Card>
      <Stack gap={16}>
        <Stack gap={8}>
          <Badge tone="success">Approved</Badge>
          {mentor.verifiedClaims
            .filter((item) => item.verified)
            .map((item) => (
              <Badge key={item.type}>
                {VERIFIED_CLAIM_LABEL[item.type as keyof typeof VERIFIED_CLAIM_LABEL] ?? 'Verified claim'}
              </Badge>
            ))}
          <Text variant="h3">{mentor.displayName || 'Mentor'}</Text>
          <Text variant="small">{craft}</Text>
        </Stack>
        {mentor.mentoredDeliverables.length > 0 ? (
          <Text variant="small">
            {mentor.mentoredDeliverables.length} mentored deliverable
            {mentor.mentoredDeliverables.length === 1 ? '' : 's'}
          </Text>
        ) : (
          <Text variant="small">No public deliverables yet</Text>
        )}
        <Button variant="secondary" to={`/mentors/${mentor.slug}`}>
          View profile
        </Button>
      </Stack>
    </Card>
  );
}

function mentorMatches(mentor: PublicProfile, needle: string): boolean {
  const haystack = [
    mentor.displayName,
    mentor.professionalIdentity,
    ...mentor.areasOfExpertise,
    ...mentor.experience.map((item) => `${item.title} ${item.organization} ${item.summary}`),
    ...mentor.education.map((item) => `${item.credential} ${item.institution}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
