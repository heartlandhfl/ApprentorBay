import { LEARNER_JOURNEY, MENTOR_JOURNEY } from '@apprentorbay/shared';
import { Badge } from './Badge';
import { Card } from './Card';
import { Grid } from './Grid';
import { Cluster, Stack } from './Stack';
import { Stepper } from './Stepper';
import { Text } from './Text';

export const HOW_IT_WORKS_STEPS = LEARNER_JOURNEY.map((step) => ({
  id: step.id,
  label: step.label,
  description: step.description,
}));

export function HowItWorks({ featured = false }: { featured?: boolean }) {
  return (
    <Stack gap={32}>
      <Card padding="lg">
        <Stack gap={24}>
          <Stack gap={8}>
            <Text variant="caption">Mentorship and apprenticeship</Text>
            <Text variant={featured ? 'h1' : 'h2'}>How It Works</Text>
            <Text variant="muted">
              One pairing. One living contract. Proof that both people can point to.
              Learners move from discover to showcase. Mentors move from being found
              to building a public legacy.
            </Text>
          </Stack>
          <Stack gap={16}>
            <Text variant="caption">Learner</Text>
            <Stepper steps={[...LEARNER_JOURNEY]} currentStep={0} layout="rail" />
          </Stack>
          <Stack gap={16}>
            <Text variant="caption">Mentor</Text>
            <Stepper steps={[...MENTOR_JOURNEY]} currentStep={0} layout="rail" />
          </Stack>
        </Stack>
      </Card>

      <Stack gap={16}>
        <Text variant="caption">The three parts</Text>
        <Grid cols={3}>
          <Card>
            <Stack gap={12}>
              <Badge>Mentor</Badge>
              <Text variant="h3">Guides the work</Text>
              <Text variant="small">
                A verified mentor revises the goal, writes objectives, and sets the
                ordered milestones. They approve evidence. They do not vanish into a
                comment thread.
              </Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap={12}>
              <Badge>Learner</Badge>
              <Text variant="h3">Does the work</Text>
              <Text variant="small">
                The learner drafts the goal, submits evidence against one active
                milestone at a time, and owns the deliverable that will appear on
                their public profile.
              </Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap={12}>
              <Badge tone="accent">Deliverable</Badge>
              <Text variant="h3">Proves the work</Text>
              <Text variant="small">
                When the last milestone is approved, the deliverable is written onto
                both public profiles. The proof is the work — not a certificate.
              </Text>
            </Stack>
          </Card>
        </Grid>
      </Stack>

      <Grid cols={2}>
        <Card>
          <Stack gap={12}>
            <Cluster gap={8}>
              <Badge tone="accent">Discover–Agree</Badge>
              <Text variant="h3">Pairing</Text>
            </Cluster>
            <Text variant="small">
              A learner finds a mentor, applies, and — if accepted — they form a
              private pairing. Messages stay between those two people while they
              write the contract.
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={12}>
            <Cluster gap={8}>
              <Badge tone="accent">Learn–Showcase</Badge>
              <Text variant="h3">Work and proof</Text>
            </Cluster>
            <Text variant="small">
              They work one milestone at a time. The mentor validates evidence.
              When the contract completes, the finished work can be published on
              both profiles.
            </Text>
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}
