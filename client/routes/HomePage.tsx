import {
  Badge,
  Button,
  Card,
  Cluster,
  Grid,
  Page,
  Stack,
  Stepper,
  Text,
} from '../components';
import { useAuth } from '../lib/auth';

const harborSteps = [
  {
    id: 'mentor',
    label: 'Find a mentor',
    description: 'Browse verified mentors. Each one has done the work you want to learn.',
  },
  {
    id: 'pairing',
    label: 'Form a pairing',
    description: 'The learner applies. The mentor accepts. One relationship, two people.',
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

export function HomePage() {
  const { account } = useAuth();

  return (
    <Page>
      <Stack gap={48}>
        <Stack gap={16}>
          <Badge tone="accent">A mentorship harbor</Badge>
          <Text variant="display">
            Rise on the Shoulders of Giants: Learn from experienced mentors, build real
            skills, and prove what you can do, guided by people who have walked the path
            before you.
          </Text>
          <Text variant="muted">
            ApprentorBay is not a feed. It is a pairing, a living contract, and a
            deliverable both people can point to.
          </Text>
          <Cluster gap={12}>
            {account ? (
              <>
                <Button to="/mentors">Browse mentors</Button>
                <Button variant="secondary" to={account.role === 'admin' ? '/admin' : '/dashboard/messages'}>
                  {account.role === 'admin' ? 'Open the harbor desk' : 'Go to messages'}
                </Button>
              </>
            ) : (
              <>
                <Button to="/signup">Sign up</Button>
                <Button variant="secondary" to="/login">
                  Log in
                </Button>
                <Button variant="ghost" to="/mentors">
                  Browse mentors
                </Button>
              </>
            )}
          </Cluster>
        </Stack>

        <Card padding="lg">
          <Stack gap={24}>
            <Stack gap={8}>
              <Text variant="caption">How it works</Text>
              <Text variant="h2">Mentor, learner, deliverable.</Text>
              <Text variant="muted">
                Three parts. One path. The same stepper you will see once you are inside
                a pairing.
              </Text>
            </Stack>
            <Stepper steps={harborSteps} currentStep={0} />
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

        <Card padding="lg">
          <Stack gap={16}>
            <Text variant="h2">Meet the people who have walked it</Text>
            <Text variant="muted">
              Only verified mentors appear here. Pending and suspended accounts stay
              off the public directory.
            </Text>
            <Cluster gap={12}>
              <Button to="/mentors">Open the mentors directory</Button>
              {account ? null : (
                <Button variant="secondary" to="/signup">
                  Create an account
                </Button>
              )}
            </Cluster>
          </Stack>
        </Card>
      </Stack>
    </Page>
  );
}
