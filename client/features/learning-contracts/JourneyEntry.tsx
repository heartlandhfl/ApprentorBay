import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LEARNING_CONTRACT_STATUS_LABEL,
  LEARNING_JOURNEY_STEPS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  canStartLearningJourney,
  contractProgress,
  contractTitle,
  isContractCompleted,
  isContractWorkspaceView,
  journeyStepIndex,
  nextActionCopy,
  paidMentorshipServicesBlocked,
  waitingOn,
  workspaceFocus,
  workspacePartyLabel,
  type LearningContract,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import { Badge, Button, Card, Cluster, Stack, Text } from '../../components';
import {
  createMentorshipBooking,
  startLearningJourney,
  startPaymentCheckout,
} from '../../lib/api';
import { watchContractForRelationship } from './repository';

type JourneyEntryProps = {
  relationship: MentorshipRelationship;
  account: User;
  otherName: string;
};

export function JourneyEntry({ relationship, account, otherName }: JourneyEntryProps) {
  const navigate = useNavigate();
  const [contract, setContract] = useState<LearningContract | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return watchContractForRelationship(relationship.id, setContract, (err) =>
      setError(err.message),
    );
  }, [relationship.id]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await startLearningJourney(relationship.id);
      navigate(`/dashboard/journey/${relationship.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the journey');
    } finally {
      setBusy(false);
    }
  }

  async function completePayment() {
    setBusy(true);
    setError(null);
    try {
      const { booking } = await createMentorshipBooking({ relationshipId: relationship.id });
      const checkout = await startPaymentCheckout(booking.id);
      window.location.assign(checkout.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(false);
    }
  }

  const paymentBlocked = paidMentorshipServicesBlocked(relationship);
  const canStart = canStartLearningJourney(account, relationship);

  if (contract === undefined) {
    return (
      <Card>
        <Text variant="muted">Checking the learning journey…</Text>
      </Card>
    );
  }

  if (!contract) {
    return (
      <Card>
        <Stack gap={16}>
          <Text variant="h3">Learning Goal Builder</Text>
          <Text variant="small">
            A negotiated contract. It stays inactive until both of you approve the plan.
          </Text>
          {account.role === USER_ROLE.learner &&
          relationship.status === RELATIONSHIP_STATUS.active ? (
            canStart ? (
              <Button onClick={() => void start()} loading={busy}>
                Start Learning Goal Builder
              </Button>
            ) : paymentBlocked ? (
              <Stack gap={12}>
                <Text variant="small">
                  Complete payment to unlock the Learning Goal Builder for this mentorship.
                </Text>
                <Button onClick={() => void completePayment()} loading={busy}>
                  Complete payment to start
                </Button>
              </Stack>
            ) : (
              <Text variant="muted">You cannot start the Learning Goal Builder right now.</Text>
            )
          ) : (
            <Text variant="muted">
              {relationship.status === RELATIONSHIP_STATUS.active
                ? `Waiting on ${account.role === USER_ROLE.mentor ? otherName : 'the learner'} to start the Learning Goal Builder.`
                : 'Resume the mentorship to start a Learning Goal Builder.'}
            </Text>
          )}
          {error ? <Text variant="danger">{error}</Text> : null}
        </Stack>
      </Card>
    );
  }

  const step = LEARNING_JOURNEY_STEPS[journeyStepIndex(contract.status)];
  const owner = waitingOn(contract);
  const workspace = isContractWorkspaceView(contract);

  if (workspace) {
    const progress = contractProgress(contract);
    const focus = workspaceFocus(contract);
    return (
      <Card>
        <Stack gap={16}>
          <Cluster gap={12}>
            <Text variant="h3">{contractTitle(contract)}</Text>
            <Badge tone={isContractCompleted(contract) ? 'success' : 'accent'}>
              {LEARNING_CONTRACT_STATUS_LABEL[contract.status]}
            </Badge>
          </Cluster>
          <Text variant="small">
            Progress {progress.percent}% · {progress.approved}/{progress.total} milestones
            approved
          </Text>
          <Text variant="small">{focus.next}</Text>
          <Text variant="small">
            Who acts: {workspacePartyLabel(focus.who)}
            {focus.who === 'learner' || focus.who === 'mentor'
              ? ` (${owner === account.role ? 'you' : otherName})`
              : null}
          </Text>
          <Button to={`/dashboard/journey/${relationship.id}`}>Open contract workspace</Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <Stack gap={16}>
        <Cluster gap={12}>
          <Text variant="h3">Learning Goal Builder</Text>
          <Badge tone={isContractCompleted(contract) ? 'success' : 'accent'}>
            {LEARNING_CONTRACT_STATUS_LABEL[contract.status] ?? step?.label ?? contract.status}
          </Badge>
        </Cluster>
        {isContractCompleted(contract) ? (
          <Text variant="small">This deliverable is complete.</Text>
        ) : (
          <Stack gap={4}>
            <Text variant="small">
              Waiting on {owner === account.role ? 'you' : otherName}.
            </Text>
            <Text variant="small">{nextActionCopy(contract)}</Text>
          </Stack>
        )}
        <Button to={`/dashboard/journey/${relationship.id}`}>Open Learning Goal Builder</Button>
      </Stack>
    </Card>
  );
}
