import { MENTOR_CONTRIBUTION, type Showcase } from '@apprentorbay/shared';
import { Badge, Card, Cluster, Stack, Text } from '../../components';

type ShowcaseCardProps = {
  showcase: Showcase;
  perspective: 'learner' | 'mentor';
};

export function ShowcaseCard({ showcase, perspective }: ShowcaseCardProps) {
  const completed = showcase.completedAt
    ? new Date(showcase.completedAt).toLocaleDateString()
    : '';

  return (
    <Card>
      <Stack gap={12}>
        <Cluster gap={8}>
          <Text variant="h3">{showcase.title}</Text>
          {showcase.published ? (
            <Badge tone="success">Published</Badge>
          ) : (
            <Badge>Hidden</Badge>
          )}
        </Cluster>
        {showcase.description ? <Text>{showcase.description}</Text> : null}
        {showcase.skillsDemonstrated.length > 0 ? (
          <Text variant="small">
            Skills demonstrated: {showcase.skillsDemonstrated.join(', ')}
          </Text>
        ) : null}
        {completed ? <Text variant="small">Completed {completed}</Text> : null}
        {perspective === 'learner' ? (
          <Text variant="small">Mentor: {showcase.mentorDisplayName}</Text>
        ) : (
          <Stack gap={4}>
            <Text variant="small">Learner: {showcase.learnerDisplayName}</Text>
            <Text variant="small">{showcase.mentorContribution || MENTOR_CONTRIBUTION}</Text>
          </Stack>
        )}
        {showcase.publicEvidence.length > 0 ? (
          <Stack gap={8}>
            <Text variant="caption">Approved public evidence</Text>
            {showcase.publicEvidence.map((item, index) => (
              <Text key={`${item.type}-${index}`} variant="small">
                {item.type.toUpperCase()}: {item.content}
              </Text>
            ))}
          </Stack>
        ) : null}
        {showcase.links.length > 0 ? (
          <Stack gap={4}>
            {showcase.links.map((link) => (
              <Text key={link} variant="small">
                {link}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
