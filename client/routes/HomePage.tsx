import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Cluster,
  Modal,
  Page,
  Stack,
  Stepper,
  Text,
} from '../components';

const pairingSteps = [
  {
    id: 'profile',
    label: 'Set your craft',
    description: 'Say what you practice and what you want to learn.',
  },
  {
    id: 'match',
    label: 'Form a pairing',
    description: 'Apprentices and mentors meet in one place — not a feed.',
  },
  {
    id: 'contract',
    label: 'Write a learning contract',
    description: 'Goals, cadence, and a shared record of the work.',
  },
];

export function HomePage() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <Page>
      <Stack gap={48}>
        <Stack gap={16}>
          <Badge tone="accent">A mentorship harbor</Badge>
          <Text variant="display">Find your craft. Find your people.</Text>
          <Text variant="muted">
            ApprentorBay is a place to grow beside someone who has done the work —
            structured pairings, living learning contracts, and a quieter kind of
            progress.
          </Text>
          <Cluster gap={12}>
            <Button to="/system">View system health</Button>
            <Button variant="secondary" onClick={() => setAboutOpen(true)}>
              About this scaffold
            </Button>
          </Cluster>
        </Stack>

        <Card padding="lg">
          <Stack gap={24}>
            <Stack gap={8}>
              <Text variant="caption">How a pairing works</Text>
              <Text variant="h2">One path. One stepper. Everywhere.</Text>
            </Stack>
            <Stepper steps={pairingSteps} currentStep={0} />
          </Stack>
        </Card>
      </Stack>

      <Modal
        open={aboutOpen}
        title="This is the harbor, not the fleet"
        onClose={() => setAboutOpen(false)}
      >
        <Text variant="muted">
          The shared UI library, Express health route, Firebase bootstrap, and
          typed data shapes are in place. Profiles, mentorships, learning
          contracts, and admin arrive next — they will use these same components
          and the types in /shared.
        </Text>
      </Modal>
    </Page>
  );
}
