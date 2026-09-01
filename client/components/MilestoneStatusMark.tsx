import { MILESTONE_STATUS, MILESTONE_STATUS_LABEL, type MilestoneStatus } from '@apprentorbay/shared';
import { Badge } from './Badge';
import { Cluster } from './Stack';
import { Text } from './Text';

const marks: Record<
  MilestoneStatus,
  { glyph: string; tone: 'neutral' | 'accent' | 'success' | 'danger'; label: string }
> = {
  [MILESTONE_STATUS.locked]: {
    glyph: '○',
    tone: 'neutral',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.locked],
  },
  [MILESTONE_STATUS.active]: {
    glyph: '●',
    tone: 'accent',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.active],
  },
  [MILESTONE_STATUS.submitted]: {
    glyph: '◐',
    tone: 'accent',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.submitted],
  },
  [MILESTONE_STATUS.underReview]: {
    glyph: '◑',
    tone: 'accent',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.underReview],
  },
  [MILESTONE_STATUS.approved]: {
    glyph: '✓',
    tone: 'success',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.approved],
  },
  [MILESTONE_STATUS.rejected]: {
    glyph: '↺',
    tone: 'danger',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.rejected],
  },
  [MILESTONE_STATUS.declined]: {
    glyph: '✕',
    tone: 'danger',
    label: MILESTONE_STATUS_LABEL[MILESTONE_STATUS.declined],
  },
};

export function MilestoneStatusMark({ status }: { status: MilestoneStatus }) {
  const mark = marks[status] ?? marks[MILESTONE_STATUS.locked];
  return (
    <Cluster gap={8}>
      <Text variant="h3" as="span">
        {mark.glyph}
      </Text>
      <Badge tone={mark.tone}>{mark.label}</Badge>
    </Cluster>
  );
}
