import { useEffect, useMemo, useState } from 'react';
import {
  APPROVAL_DISCLAIMER,
  EMPTY_MENTOR_DISCOVERY_FILTERS,
  filterListedMentors,
  hasActiveDiscoveryFilters,
  type MentorDiscoveryFilters,
  type PublicProfile,
} from '@apprentorbay/shared';
import { Card, EmptyState, Grid, Page, Stack, Text } from '../components';
import {
  MentorDiscoveryCard,
  MentorDiscoveryFiltersPanel,
  watchListedMentors,
} from '../features/profiles';

export function MentorsPage() {
  const [mentors, setMentors] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MentorDiscoveryFilters>(EMPTY_MENTOR_DISCOVERY_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    return watchListedMentors(setMentors, (err) => setError(err.message));
  }, []);

  const filtered = useMemo(
    () => filterListedMentors(mentors ?? [], filters),
    [mentors, filters],
  );
  const filtersActive = hasActiveDiscoveryFilters(filters);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Discover mentors</Text>
          <Text variant="h1">Find the right mentor for your goals</Text>
          <Text variant="muted">
            Browse approved mentors by experience type, commercial model, and what they help with.
            {` ${APPROVAL_DISCLAIMER}`}
          </Text>
        </Stack>

        <div className="lg:hidden">
          <button
            type="button"
            className="w-full rounded-sm border border-line bg-paper-raised px-4 py-3 text-left text-body"
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-expanded={mobileFiltersOpen}
          >
            {mobileFiltersOpen ? 'Hide filters' : 'Show filters'}
            {filtersActive ? ' · filters active' : ''}
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-start">
          <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
            <Card padding="lg">
              <MentorDiscoveryFiltersPanel
                filters={filters}
                onChange={setFilters}
                resultCount={filtered.length}
                totalCount={mentors?.length ?? 0}
              />
            </Card>
          </div>

          <Stack gap={24}>
            {error ? <Text variant="danger">{error}</Text> : null}

            {mentors === null ? (
              <Text variant="muted">Loading mentors…</Text>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={filtersActive ? 'No mentors match these filters' : 'No approved mentors yet'}
                description={
                  filtersActive
                    ? 'Try removing a filter or broadening your search.'
                    : 'Approved mentors will appear here for anyone, including visitors who are not signed in.'
                }
              />
            ) : (
              <Grid cols={2}>
                {filtered.map((mentor) => (
                  <MentorDiscoveryCard key={mentor.slug} mentor={mentor} />
                ))}
              </Grid>
            )}
          </Stack>
        </div>
      </Stack>
    </Page>
  );
}

