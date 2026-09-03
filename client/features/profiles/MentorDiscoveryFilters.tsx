import {
  COMMERCIAL_MODE,
  COMMERCIAL_MODE_LABEL,
  EMPTY_MENTOR_DISCOVERY_FILTERS,
  hasActiveDiscoveryFilters,
  MENTOR_DISCOVERY_COMMERCIAL_MODES,
  MENTOR_DISCOVERY_MENTOR_TYPES,
  MENTOR_TYPE_LABEL,
  type CommercialMode,
  type MentorDiscoveryFilters,
  type MentorType,
} from '@apprentorbay/shared';
import { Button, Checkbox, Cluster, Input, Stack, Text } from '../../components';

type MentorDiscoveryFiltersProps = {
  filters: MentorDiscoveryFilters;
  onChange: (filters: MentorDiscoveryFilters) => void;
  resultCount: number;
  totalCount: number;
};

export function MentorDiscoveryFiltersPanel({
  filters,
  onChange,
  resultCount,
  totalCount,
}: MentorDiscoveryFiltersProps) {
  const active = hasActiveDiscoveryFilters(filters);

  function toggleMentorType(type: MentorType) {
    const next = filters.mentorTypes.includes(type)
      ? filters.mentorTypes.filter((item) => item !== type)
      : [...filters.mentorTypes, type];
    onChange({ ...filters, mentorTypes: next });
  }

  function toggleCommercialMode(mode: CommercialMode) {
    const next = filters.commercialModes.includes(mode)
      ? filters.commercialModes.filter((item) => item !== mode)
      : [...filters.commercialModes, mode];
    onChange({ ...filters, commercialModes: next });
  }

  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <Text variant="h3">Find a mentor</Text>
        <Text variant="small">
          Showing {resultCount} of {totalCount} approved mentors. Refine by mentoring style,
          commercial model, or what you want to learn.
        </Text>
      </Stack>

      <Input
        label="Search by name or background"
        value={filters.query}
        onChange={(event) => onChange({ ...filters, query: event.target.value })}
        placeholder="Display name, professional identity, experience…"
      />

      <Input
        label="Skills or area of expertise"
        value={filters.skillsQuery}
        onChange={(event) => onChange({ ...filters, skillsQuery: event.target.value })}
        placeholder="e.g. writing, carpentry, project management"
      />

      <Stack gap={12}>
        <Text variant="small">Mentor type</Text>
        <Cluster gap={8}>
          {MENTOR_DISCOVERY_MENTOR_TYPES.map((type) => (
            <FilterChip
              key={type}
              active={filters.mentorTypes.includes(type)}
              onClick={() => toggleMentorType(type)}
            >
              {MENTOR_TYPE_LABEL[type]}
            </FilterChip>
          ))}
        </Cluster>
      </Stack>

      <Stack gap={12}>
        <Text variant="small">Commercial model</Text>
        <Cluster gap={8}>
          {MENTOR_DISCOVERY_COMMERCIAL_MODES.map((mode) => (
            <FilterChip
              key={mode}
              active={filters.commercialModes.includes(mode)}
              onClick={() => toggleCommercialMode(mode)}
            >
              {mode === COMMERCIAL_MODE.givingBack ? 'Free' : COMMERCIAL_MODE_LABEL[mode]}
            </FilterChip>
          ))}
        </Cluster>
      </Stack>

      <Stack gap={12}>
        <Text variant="small">Availability & format</Text>
        <Checkbox
          checked={filters.acceptingNewLearnersOnly}
          onChange={(event) =>
            onChange({ ...filters, acceptingNewLearnersOnly: event.target.checked })
          }
          label="Accepting new learners"
        />
        <Checkbox
          checked={filters.videoSessionsOnly}
          onChange={(event) => onChange({ ...filters, videoSessionsOnly: event.target.checked })}
          label="Video sessions available"
        />
      </Stack>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...EMPTY_MENTOR_DISCOVERY_FILTERS })}
        >
          Clear all filters
        </Button>
      ) : null}
    </Stack>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm border px-3 py-2 text-small transition-colors ${
        active
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-line bg-paper-raised text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
