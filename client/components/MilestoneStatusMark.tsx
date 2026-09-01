import { MILESTONE_STATUS, type MilestoneStatus } from '@apprentorbay/shared';
import { Badge } from './Badge';
import { Cluster } from './Stack';
import { Text } from './Text';

const marks: Record<
  MilestoneStatus,
  { glyph: string; tone: 'neutral' | 'accent' | 'success' | 'danger'; label: string }
> = {
  [MILESTONE_STATUS.locked]: { glyph: '○', tone: 'neutral', label: 'Locked' },
  [MILESTONE_STATUS.active]: { glyph: '●', tone: 'accent', label: 'Active' },
  [MILESTONE_STATUS.submitted]: { glyph: '◐', tone: 'accent', label: 'Submitted' },
  [MILESTONE_STATUS.approved]: { glyph: '✓', tone: 'success', label: 'Approved' },
  [MILESTONE_STATUS.rejected]: { glyph: '✕', tone: 'danger', label: 'Rejected' },
};

export function MilestoneStatusMark({ status }: { status: MilestoneStatus }) {
  const mark = marks[status];
  return (
    <Cluster gap={8}>
      <Text variant="h3" as="span">
        {mark.glyph}
      </Text>
      <Badge tone={mark.tone}>{mark.label}</Badge>
    </Cluster>
  );
}
