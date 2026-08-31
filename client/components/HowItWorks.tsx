import { Badge } from './Badge';
import { Card } from './Card';
import { Grid } from './Grid';
import { Cluster, Stack } from './Stack';
import { Stepper } from './Stepper';
import { Text } from './Text';

export const HOW_IT_WORKS_STEPS = [
  {
    id: 'mentor',
    label: 'Find a mentor',
    description: 'Browse verified mentors. Each one has done the work you want to learn.',
  },
  {
    id: 'pairing',
    label: 'Form a pairing',
    description: 'The learner applies. The mentor accepts. One apprenticeship, two people.',
  },
  {
    id: 'contract',
    label: 'Write the contract',
    description: 'A shared goal, objectives, and an ordered list of milestones with required evidence.',
  },
  {
    id: 'deliverable',
    label: 'Ship a deliverable',
    description: 'Finish the last milestone and the deliverable lands on both public profiles.',
  },
];

export function HowItWorks({ featured = false }: { featured?: boolean }) {
  return (
    <Stack gap={32}>
      <Card padding="lg">
        <Stack gap={24}>
          <Stack gap={8}>
            <Text variant="caption">Mentorship and apprenticeship</Text>
            <Text variant={featured ? 'h1' : 'h2'}>How It Works</Text>
            <Text variant="muted">
              Four steps. One path. You pair with a mentor, write a living learning
              contract, and ship work both of you can point to.
            </Text>
          </Stack>
          <Stepper steps={HOW_IT_WORKS_STEPS} currentStep={0} />
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
              <Badge tone="accent">1–2</Badge>
              <Text variant="h3">Pairing</Text>
            </Cluster>
            <Text variant="small">
              ApprentorBay is not a feed or a marketplace. A learner chooses one
              mentor, applies, and — if accepted — they form a private pairing.
              Messages stay between those two people.
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={12}>
            <Cluster gap={8}>
              <Badge tone="accent">3–4</Badge>
              <Text variant="h3">Contract and proof</Text>
            </Cluster>
            <Text variant="small">
              Together they write a learning contract: a goal, objectives, and
              milestones that require evidence. When the last milestone is approved,
              the finished deliverable is published on both profiles.
            </Text>
          </Stack>
        </Card>
      </Grid>
    </Stack>
  );
}
