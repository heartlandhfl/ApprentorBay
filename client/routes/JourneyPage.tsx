import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  LEARNING_JOURNEY_STEPS,
  MILESTONE_STATUS,
  USER_ROLE,
  availableActions,
  isContractCompleted,
  isStepActor,
  journeyStepIndex,
  waitingOn,
  type LearningContract,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Input,
  MilestoneStatusMark,
  Modal,
  Page,
  Stack,
  Stepper,
  Text,
  TextArea,
} from '../components';
import { watchContractForRelationship } from '../features/learning-contracts';
import { firestoreDenied, watchRelationship } from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { dispatchContractAction } from '../lib/api';
import { useAuth } from '../lib/auth';

export function JourneyPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const { account } = useAuth();
  const [relationship, setRelationship] = useState<MentorshipRelationship | null>(null);
  const [contract, setContract] = useState<LearningContract | null | undefined>(undefined);
  const [otherName, setOtherName] = useState('your pairing');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!relationshipId || !account) return;
    const unsubRel = watchRelationship(
      relationshipId,
      (next) => {
        setRelationship(next);
        if (next) {
          const otherId = next.learnerId === account.uid ? next.mentorId : next.learnerId;
          void getPublicDisplayName(otherId).then(setOtherName);
        }
      },
      (err) => {
        if (firestoreDenied(err)) setDenied(true);
        else setError(err.message);
      },
    );
    const unsubContract = watchContractForRelationship(
      relationshipId,
      setContract,
      (err) => setError(err.message),
    );
    return () => {
      unsubRel();
      unsubContract();
    };
  }, [account, relationshipId]);

  if (denied) {
    return (
      <Page>
        <EmptyState
          title="This journey is not yours"
          description="Only the learner and mentor on the relationship can open it."
          action={
            <Button variant="secondary" to="/dashboard/mentorships">
              Back to mentorships
            </Button>
          }
        />
      </Page>
    );
  }

  if (!account || contract === undefined) {
    return (
      <Page>
        <Text variant="muted">Opening the learning journey…</Text>
      </Page>
    );
  }

  if (!contract || !relationship) {
    return (
      <Page>
        <EmptyState
          title="No learning journey yet"
          description="Start it from the relationship page. That is the only entry point."
          action={
            <Button to={relationshipId ? `/dashboard/mentorships/${relationshipId}` : '/dashboard/mentorships'}>
              Back to the relationship
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <JourneyBody
      account={account}
      contract={contract}
      otherName={otherName}
      error={error}
      onError={setError}
    />
  );
}

function JourneyBody({
  account,
  contract,
  otherName,
  error,
  onError,
}: {
  account: User;
  contract: LearningContract;
  otherName: string;
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const actor =
    account.role === USER_ROLE.learner || account.role === USER_ROLE.mentor
      ? { uid: account.uid, role: account.role }
      : null;
  const actions = actor ? availableActions(contract, actor) : [];
  const ownsStep = actor ? isStepActor(contract, actor) : false;
  const owner = waitingOn(contract);
  const ownerName = owner === account.role ? 'you' : otherName;

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to={`/dashboard/mentorships/${contract.relationshipId}`}>
            Back to the relationship
          </Button>
          <Text variant="h1">Learning journey</Text>
          <Text variant="muted">
            One stepper. One owner at a time. Goal, objectives, milestones, and the
            deliverable stay visible at every stage.
          </Text>
        </Stack>

        <Card padding="lg">
          <Stepper
            steps={[...LEARNING_JOURNEY_STEPS]}
            currentStep={journeyStepIndex(contract.status)}
          />
        </Card>

        {!isContractCompleted(contract) && !ownsStep ? (
          <Card>
            <Text variant="h3">Waiting on {ownerName}</Text>
          </Card>
        ) : null}

        <Structure contract={contract} />

        {ownsStep && actions.includes('SAVE_DRAFT') ? (
          <DraftEditor contract={contract} onError={onError} />
        ) : null}
        {ownsStep && actions.includes('SAVE_MENTOR_REVIEW') ? (
          <MentorEditor contract={contract} onError={onError} />
        ) : null}
        {ownsStep && actions.includes('APPROVE_PLAN') ? (
          <LearnerReview contract={contract} onError={onError} />
        ) : null}
        {ownsStep &&
        (actions.includes('SUBMIT_EVIDENCE') || actions.includes('APPROVE_MILESTONE')) ? (
          <DcmActions contract={contract} actions={actions} onError={onError} />
        ) : null}

        {isContractCompleted(contract) ? (
          <Card>
            <Stack gap={8}>
              <Badge tone="success">Completed</Badge>
              <Text>
                This deliverable is now on both public profiles.
              </Text>
            </Stack>
          </Card>
        ) : null}

        {error ? <Text variant="danger">{error}</Text> : null}
      </Stack>
    </Page>
  );
}

function Structure({ contract }: { contract: LearningContract }) {
  return (
    <Stack gap={16}>
      <Card>
        <Stack gap={12}>
          <Text variant="h2">Goal</Text>
          {contract.goal?.text ? (
            <Text>{contract.goal.text}</Text>
          ) : (
            <EmptyState title="No goal yet" />
          )}
          {contract.goalHistory.length > 0 ? (
            <Text variant="small">
              Revised from: {contract.goalHistory.map((item) => item.text).join(' → ')}
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Card>
        <Stack gap={12}>
          <Text variant="h2">Objectives</Text>
          {contract.objectives.length === 0 ? (
            <EmptyState title="No objectives yet" />
          ) : (
            <Stack gap={8}>
              {contract.objectives.map((item) => (
                <Text key={item.id}>{item.text}</Text>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={12}>
          <Text variant="h2">Milestones</Text>
          {contract.milestones.length === 0 ? (
            <EmptyState title="No milestones yet" />
          ) : (
            <Stack gap={16}>
              {[...contract.milestones]
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <Stack key={item.id} gap={8}>
                    <Cluster gap={12}>
                      <MilestoneStatusMark status={item.status} />
                      <Text variant="h3">
                        {item.order + 1}. {item.title}
                      </Text>
                    </Cluster>
                    <Text variant="small">{item.description}</Text>
                    <Text variant="small">Evidence required: {item.evidenceRequired}</Text>
                    {item.lastFeedback ? (
                      <Text variant="danger">Feedback: {item.lastFeedback}</Text>
                    ) : null}
                    {item.evidenceText ? (
                      <Text variant="small">Submitted: {item.evidenceText}</Text>
                    ) : null}
                  </Stack>
                ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={12}>
          <Text variant="h2">Deliverable</Text>
          {contract.deliverable ? (
            <Stack gap={8}>
              <Text variant="h3">{contract.deliverable.title}</Text>
              <Text>{contract.deliverable.description}</Text>
            </Stack>
          ) : (
            <EmptyState title="No deliverable yet" />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function DraftEditor({
  contract,
  onError,
}: {
  contract: LearningContract;
  onError: (message: string | null) => void;
}) {
  const [goalText, setGoalText] = useState(contract.goal?.text ?? '');
  const [title, setTitle] = useState(contract.deliverable?.title ?? '');
  const [description, setDescription] = useState(contract.deliverable?.description ?? '');
  const [busy, setBusy] = useState(false);

  async function saveThen(send: boolean) {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, {
        type: 'SAVE_DRAFT',
        goalText,
        deliverableTitle: title,
        deliverableDescription: description,
      });
      if (send) {
        await dispatchContractAction(contract.id, { type: 'SEND_TO_MENTOR' });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update the draft');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void saveThen(true);
        }}
      >
        <Stack gap={16}>
          <Text variant="h3">Write the draft</Text>
          <TextArea
            label="Goal"
            value={goalText}
            onChange={(event) => setGoalText(event.target.value)}
            required
          />
          <Input
            label="Deliverable title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <TextArea
            label="Deliverable description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
          <Cluster gap={8}>
            <Button type="submit" loading={busy}>
              Send to Mentor
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void saveThen(false)}
            >
              Save draft
            </Button>
          </Cluster>
        </Stack>
      </form>
    </Card>
  );
}

function MentorEditor({
  contract,
  onError,
}: {
  contract: LearningContract;
  onError: (message: string | null) => void;
}) {
  const [goalText, setGoalText] = useState(contract.goal?.text ?? '');
  const [title, setTitle] = useState(contract.deliverable?.title ?? '');
  const [description, setDescription] = useState(contract.deliverable?.description ?? '');
  const [objectives, setObjectives] = useState(
    contract.objectives.length ? contract.objectives.map((item) => item.text) : [''],
  );
  const [milestones, setMilestones] = useState(
    contract.milestones.length
      ? contract.milestones.map((item) => ({
          title: item.title,
          description: item.description,
          evidenceRequired: item.evidenceRequired,
        }))
      : [{ title: '', description: '', evidenceRequired: '' }],
  );
  const [busy, setBusy] = useState(false);

  async function saveThen(send: boolean) {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, {
        type: 'SAVE_MENTOR_REVIEW',
        goalText,
        objectives: objectives.map((text) => ({ text })),
        milestones,
        deliverableTitle: title,
        deliverableDescription: description,
      });
      if (send) {
        await dispatchContractAction(contract.id, { type: 'SEND_TO_LEARNER' });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send the plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void saveThen(true);
        }}
      >
        <Stack gap={16}>
          <Text variant="h3">Revise the plan</Text>
          {contract.changeRequestReason ? (
            <Text variant="danger">Requested change: {contract.changeRequestReason}</Text>
          ) : null}
          <TextArea
            label="Goal"
            value={goalText}
            onChange={(event) => setGoalText(event.target.value)}
            required
          />
          {objectives.map((text, index) => (
            <Input
              id={`objective-${index}`}
              label={`Objective ${index + 1}`}
              value={text}
              onChange={(event) =>
                setObjectives((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
              required
            />
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setObjectives((current) => [...current, ''])}
          >
            Add objective
          </Button>
          {milestones.map((item, index) => (
            <Stack key={`milestone-${index}`} gap={8}>
              <Text variant="caption">Milestone {index + 1}</Text>
              <Input
                label={`Milestone ${index + 1} title`}
                value={item.title}
                onChange={(event) =>
                  setMilestones((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, title: event.target.value } : row,
                    ),
                  )
                }
                required
              />
              <TextArea
                label={`Milestone ${index + 1} description`}
                value={item.description}
                onChange={(event) =>
                  setMilestones((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, description: event.target.value } : row,
                    ),
                  )
                }
                required
              />
              <Input
                label={`Milestone ${index + 1} evidence required`}
                value={item.evidenceRequired}
                onChange={(event) =>
                  setMilestones((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, evidenceRequired: event.target.value }
                        : row,
                    ),
                  )
                }
                required
              />
            </Stack>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setMilestones((current) => [
                ...current,
                { title: '', description: '', evidenceRequired: '' },
              ])
            }
          >
            Add milestone
          </Button>
          <Input
            label="Deliverable title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <TextArea
            label="Deliverable description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
          <Cluster gap={8}>
            <Button type="submit" loading={busy}>
              Send to Learner
            </Button>
            <Button variant="secondary" loading={busy} onClick={() => void saveThen(false)}>
              Save plan
            </Button>
          </Cluster>
        </Stack>
      </form>
    </Card>
  );
}

function LearnerReview({
  contract,
  onError,
}: {
  contract: LearningContract;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'APPROVE_PLAN' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  async function requestChanges(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'REQUEST_CHANGES', reason });
      setOpen(false);
      setReason('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not request changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Stack gap={16}>
        <Text variant="h3">Review the mentor&apos;s plan</Text>
        <Cluster gap={8}>
          <Button loading={busy} onClick={() => void approve()}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Request Changes
          </Button>
        </Cluster>
        <Modal
          open={open}
          title="Request changes"
          onClose={() => setOpen(false)}
          footer={
            <Cluster gap={8}>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="request-changes" loading={busy}>
                Send to Mentor
              </Button>
            </Cluster>
          }
        >
          <form id="request-changes" onSubmit={(event) => void requestChanges(event)}>
            <TextArea
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              hint="Required. The mentor will see this."
            />
          </form>
        </Modal>
      </Stack>
    </Card>
  );
}

function DcmActions({
  contract,
  actions,
  onError,
}: {
  contract: LearningContract;
  actions: string[];
  onError: (message: string | null) => void;
}) {
  const current = useMemo(
    () =>
      contract.milestones.find((item) =>
        actions.includes('SUBMIT_EVIDENCE')
          ? item.status === MILESTONE_STATUS.active || item.status === MILESTONE_STATUS.rejected
          : item.status === MILESTONE_STATUS.submitted,
      ),
    [actions, contract.milestones],
  );
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'SUBMIT_EVIDENCE', text, link });
      setText('');
      setLink('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not submit evidence');
    } finally {
      setBusy(false);
    }
  }

  async function decide(type: 'APPROVE_MILESTONE' | 'REJECT_MILESTONE') {
    setBusy(true);
    onError(null);
    try {
      if (type === 'REJECT_MILESTONE') {
        await dispatchContractAction(contract.id, { type, feedback });
      } else {
        await dispatchContractAction(contract.id, { type });
      }
      setFeedback('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not review the milestone');
    } finally {
      setBusy(false);
    }
  }

  if (!current) return null;

  return (
    <Card>
      <Stack gap={16}>
        <Text variant="h3">
          Current milestone: {current.order + 1}. {current.title}
        </Text>
        <Text variant="small">Evidence required: {current.evidenceRequired}</Text>
        {actions.includes('SUBMIT_EVIDENCE') ? (
          <form onSubmit={(event) => void submit(event)}>
            <Stack gap={12}>
              <TextArea
                label="Evidence"
                value={text}
                onChange={(event) => setText(event.target.value)}
                required
              />
              <Input
                label="Link or file URL"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                hint="Optional."
              />
              <Button type="submit" loading={busy}>
                Submit evidence
              </Button>
            </Stack>
          </form>
        ) : null}
        {actions.includes('APPROVE_MILESTONE') ? (
          <Stack gap={12}>
            <Text>{current.evidenceText}</Text>
            {current.evidenceLink ? <Text variant="small">{current.evidenceLink}</Text> : null}
            <TextArea
              label="Feedback if rejecting"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
            <Cluster gap={8}>
              <Button loading={busy} onClick={() => void decide('APPROVE_MILESTONE')}>
                Approve
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => void decide('REJECT_MILESTONE')}
              >
                Reject
              </Button>
            </Cluster>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
