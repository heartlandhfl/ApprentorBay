import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  LEARNING_CONTRACT_STATUS,
  LEARNING_CONTRACT_STATUS_LABEL,
  LEARNING_JOURNEY_STEPS,
  MILESTONE_STATUS,
  USER_ROLE,
  availableActions,
  canAccessContractWorkspace,
  isContractCompleted,
  isContractWorkspaceView,
  isStepActor,
  journeyStepIndex,
  nextActionCopy,
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
import { ContractWorkspace, watchContractForRelationship } from '../features/learning-contracts';
import { firestoreDenied, watchRelationship } from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { dispatchContractAction } from '../lib/api';
import { useAuth } from '../lib/auth';

export function JourneyPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const { account } = useAuth();
  const [relationship, setRelationship] = useState<MentorshipRelationship | null>(null);
  const [contract, setContract] = useState<LearningContract | null | undefined>(undefined);
  const [learnerName, setLearnerName] = useState('Learner');
  const [mentorName, setMentorName] = useState('Mentor');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!relationshipId || !account) return;
    const unsubRel = watchRelationship(
      relationshipId,
      (next) => {
        setRelationship(next);
        if (next) {
          void getPublicDisplayName(next.learnerId).then(setLearnerName);
          void getPublicDisplayName(next.mentorId).then(setMentorName);
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
      (err) => {
        if (firestoreDenied(err)) setDenied(true);
        else setError(err.message);
      },
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
          title="This contract is not yours"
          description="Only the learner, the mentor, and authorized admins can open this workspace."
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
        <Text variant="muted">Opening the learning contract…</Text>
      </Page>
    );
  }

  if (!contract || !relationship) {
    return (
      <Page>
        <EmptyState
          title="No Learning Goal Builder yet"
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

  if (contract && !canAccessContractWorkspace(account, contract)) {
    return (
      <Page>
        <EmptyState
          title="This contract is not yours"
          description="Only the learner, the mentor, and authorized admins can open this workspace."
          action={
            <Button variant="secondary" to="/dashboard/mentorships">
              Back to mentorships
            </Button>
          }
        />
      </Page>
    );
  }

  const otherName = account.uid === relationship.learnerId ? mentorName : learnerName;

  if (isContractWorkspaceView(contract)) {
    return (
      <Page>
        <ContractWorkspace
          account={account}
          contract={contract}
          relationship={relationship}
          learnerName={learnerName}
          mentorName={mentorName}
          error={error}
          onError={setError}
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
    account.role === USER_ROLE.learner ||
    account.role === USER_ROLE.mentor ||
    account.role === USER_ROLE.admin
      ? { uid: account.uid, role: account.role }
      : null;
  const actions = actor ? availableActions(contract, actor) : [];
  const ownsStep = actor ? isStepActor(contract, actor) : false;
  const owner = waitingOn(contract);
  const ownerName = owner === account.role ? 'you' : otherName;
  const statusLabel = LEARNING_CONTRACT_STATUS_LABEL[contract.status];

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to={`/dashboard/mentorships/${contract.relationshipId}`}>
            Back to the relationship
          </Button>
          <Cluster gap={12}>
            <Text variant="h1">Learning Goal Builder</Text>
            <Badge
              tone={
                contract.status === LEARNING_CONTRACT_STATUS.inProgress ||
                contract.status === LEARNING_CONTRACT_STATUS.mutuallyApproved
                  ? 'success'
                  : contract.status === LEARNING_CONTRACT_STATUS.rejected ||
                      contract.status === LEARNING_CONTRACT_STATUS.cancelled
                    ? 'danger'
                    : 'accent'
              }
            >
              {statusLabel}
            </Badge>
          </Cluster>
          <Text variant="muted">
            A negotiated learning contract. It does not become ACTIVE until both
            sides have approved the plan.
          </Text>
        </Stack>

        <div className="grid gap-16 md:grid-cols-3">
          <Card>
            <Stack gap={8}>
              <Text variant="caption">Current status</Text>
              <Text variant="h3">{statusLabel}</Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap={8}>
              <Text variant="caption">Next action</Text>
              <Text>{nextActionCopy(contract)}</Text>
            </Stack>
          </Card>
          <Card>
            <Stack gap={8}>
              <Text variant="caption">Waiting for</Text>
              <Text variant="h3">
                {isContractCompleted(contract) ||
                contract.status === LEARNING_CONTRACT_STATUS.rejected ||
                contract.status === LEARNING_CONTRACT_STATUS.cancelled
                  ? 'Nobody'
                  : ownerName}
              </Text>
            </Stack>
          </Card>
        </div>

        <Card padding="lg">
          <Stepper
            steps={[...LEARNING_JOURNEY_STEPS]}
            currentStep={journeyStepIndex(contract.status)}
          />
        </Card>

        {!isContractCompleted(contract) &&
        contract.status !== LEARNING_CONTRACT_STATUS.rejected &&
        contract.status !== LEARNING_CONTRACT_STATUS.cancelled &&
        !ownsStep &&
        !actions.includes('ACTIVATE') ? (
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
        {actions.includes('ACTIVATE') ? (
          <ActivateCard contract={contract} onError={onError} />
        ) : null}
        {ownsStep &&
        (actions.includes('SUBMIT_EVIDENCE') || actions.includes('APPROVE_MILESTONE')) ? (
          <DcmActions contract={contract} actions={actions} onError={onError} />
        ) : null}

        {actions.includes('CANCEL') ? (
          <CancelRow contract={contract} onError={onError} />
        ) : null}

        <RevisionHistory contract={contract} />

        {isContractCompleted(contract) ? (
          <Card>
            <Stack gap={8}>
              <Badge tone="success">COMPLETED</Badge>
              <Text>This deliverable is now on both public profiles.</Text>
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
          {contract.goal?.title || contract.goal?.text ? (
            <Stack gap={8}>
              <Text variant="h3">{contract.goal.title || contract.goal.text}</Text>
              {contract.goal.description ? <Text>{contract.goal.description}</Text> : null}
            </Stack>
          ) : (
            <EmptyState title="No goal yet" />
          )}
          {contract.context ? (
            <Text variant="small">Learner context: {contract.context}</Text>
          ) : null}
        </Stack>
      </Card>

      <Card>
        <Stack gap={12}>
          <Text variant="h2">Objectives</Text>
          {contract.objectives.length === 0 ? (
            <EmptyState title="No objectives yet" />
          ) : (
            <Stack gap={12}>
              {contract.objectives.map((item) => (
                <Stack key={item.id} gap={4}>
                  <Text variant="h3">
                    {item.order + 1}. {item.title || item.text}
                  </Text>
                  {item.description ? <Text variant="small">{item.description}</Text> : null}
                </Stack>
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
                    <Text variant="small">
                      Success criteria: {item.successCriteria || item.evidenceRequired}
                    </Text>
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
              {contract.deliverable.expectedEvidence ? (
                <Text variant="small">
                  Expected evidence: {contract.deliverable.expectedEvidence}
                </Text>
              ) : null}
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
  const [goalTitle, setGoalTitle] = useState(contract.goal?.title ?? '');
  const [goalDescription, setGoalDescription] = useState(contract.goal?.description ?? '');
  const [context, setContext] = useState(contract.context ?? '');
  const [title, setTitle] = useState(contract.deliverable?.title ?? '');
  const [description, setDescription] = useState(contract.deliverable?.description ?? '');
  const [expectedEvidence, setExpectedEvidence] = useState(
    contract.deliverable?.expectedEvidence ?? '',
  );
  const [busy, setBusy] = useState(false);

  async function saveThen(send: boolean) {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, {
        type: 'SAVE_DRAFT',
        goalText: `${goalTitle}\n\n${goalDescription}`.trim(),
        goalTitle,
        goalDescription,
        context,
        deliverableTitle: title,
        deliverableDescription: description,
        expectedEvidence,
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
          <Text variant="h3">Your proposal</Text>
          <Input
            label="Goal title"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            required
          />
          <TextArea
            label="Goal description"
            value={goalDescription}
            onChange={(event) => setGoalDescription(event.target.value)}
            required
          />
          <TextArea
            label="Optional context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            hint="Background the mentor should know. Optional."
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
          <Input
            label="Expected evidence"
            value={expectedEvidence}
            onChange={(event) => setExpectedEvidence(event.target.value)}
            hint="What will prove this deliverable exists."
          />
          <Cluster gap={8}>
            <Button type="submit" loading={busy}>
              Submit proposal
            </Button>
            <Button variant="secondary" loading={busy} onClick={() => void saveThen(false)}>
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
  const [goalTitle, setGoalTitle] = useState(contract.goal?.title ?? '');
  const [goalDescription, setGoalDescription] = useState(contract.goal?.description ?? '');
  const [title, setTitle] = useState(contract.deliverable?.title ?? '');
  const [description, setDescription] = useState(contract.deliverable?.description ?? '');
  const [expectedEvidence, setExpectedEvidence] = useState(
    contract.deliverable?.expectedEvidence ?? '',
  );
  const [comment, setComment] = useState(contract.mentorComment ?? '');
  const [objectives, setObjectives] = useState(
    contract.objectives.length
      ? contract.objectives.map((item) => ({
          title: item.title || item.text,
          description: item.description,
        }))
      : [{ title: '', description: '' }],
  );
  const [milestones, setMilestones] = useState(
    contract.milestones.length
      ? contract.milestones.map((item) => ({
          title: item.title,
          description: item.description,
          successCriteria: item.successCriteria || item.evidenceRequired,
        }))
      : [{ title: '', description: '', successCriteria: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  async function saveThen(send: boolean) {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, {
        type: 'SAVE_MENTOR_REVIEW',
        goalText: `${goalTitle}\n\n${goalDescription}`.trim(),
        goalTitle,
        goalDescription,
        objectives: objectives.map((item) => ({
          title: item.title,
          description: item.description,
          text: item.title,
        })),
        milestones: milestones.map((item) => ({
          title: item.title,
          description: item.description,
          evidenceRequired: item.successCriteria,
          successCriteria: item.successCriteria,
        })),
        deliverableTitle: title,
        deliverableDescription: description,
        expectedEvidence,
        comment,
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

  async function reject(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, {
        type: 'REJECT_PROPOSAL',
        reason: rejectReason,
      });
      setRejectOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not reject the proposal');
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
          <Text variant="h3">Revise and propose</Text>
          {contract.changeRequestReason ? (
            <Text variant="danger">Requested change: {contract.changeRequestReason}</Text>
          ) : null}
          <Input
            label="Goal title"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            required
          />
          <TextArea
            label="Goal description"
            value={goalDescription}
            onChange={(event) => setGoalDescription(event.target.value)}
            required
          />
          {objectives.map((item, index) => (
            <Stack key={`objective-${index}`} gap={8}>
              <Input
                id={`objective-title-${index}`}
                label={`Objective ${index + 1} title`}
                value={item.title}
                onChange={(event) =>
                  setObjectives((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, title: event.target.value } : row,
                    ),
                  )
                }
                required
              />
              <TextArea
                id={`objective-desc-${index}`}
                label={`Objective ${index + 1} description`}
                value={item.description}
                onChange={(event) =>
                  setObjectives((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, description: event.target.value } : row,
                    ),
                  )
                }
              />
            </Stack>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setObjectives((current) => [...current, { title: '', description: '' }])}
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
                label={`Milestone ${index + 1} success criteria`}
                value={item.successCriteria}
                onChange={(event) =>
                  setMilestones((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, successCriteria: event.target.value }
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
                { title: '', description: '', successCriteria: '' },
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
          <Input
            label="Expected evidence"
            value={expectedEvidence}
            onChange={(event) => setExpectedEvidence(event.target.value)}
          />
          <TextArea
            label="Comments for the learner"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Cluster gap={8}>
            <Button type="submit" loading={busy}>
              Propose to learner
            </Button>
            <Button variant="secondary" loading={busy} onClick={() => void saveThen(false)}>
              Save plan
            </Button>
            <Button variant="danger" onClick={() => setRejectOpen(true)}>
              Reject proposal
            </Button>
          </Cluster>
        </Stack>
      </form>
      <Modal
        open={rejectOpen}
        title="Reject this proposal"
        onClose={() => setRejectOpen(false)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Keep reviewing
            </Button>
            <Button type="submit" form="reject-proposal" variant="danger" loading={busy}>
              Reject
            </Button>
          </Cluster>
        }
      >
        <form id="reject-proposal" onSubmit={(event) => void reject(event)}>
          <TextArea
            label="Reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            required
          />
        </form>
      </Modal>
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
        <Text variant="h3">Review the mentor&apos;s proposal</Text>
        {contract.mentorComment ? (
          <Text variant="small">Mentor comment: {contract.mentorComment}</Text>
        ) : null}
        <Cluster gap={8}>
          <Button loading={busy} onClick={() => void approve()}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Request revision
          </Button>
        </Cluster>
        <Modal
          open={open}
          title="Request revision"
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

function ActivateCard({
  contract,
  onError,
}: {
  contract: LearningContract;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'ACTIVATE' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not activate the contract');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Stack gap={16}>
        <Text variant="h3">Mutual approval recorded</Text>
        <Text>
          Both sides agreed. Activate the contract to start milestone work. It is
          not ACTIVE until you do this.
        </Text>
        <Button loading={busy} onClick={() => void activate()}>
          Activate contract
        </Button>
      </Stack>
    </Card>
  );
}

function CancelRow({
  contract,
  onError,
}: {
  contract: LearningContract;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'CANCEL', reason: 'Cancelled from the builder' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={() => void cancel()}>
      Cancel builder
    </Button>
  );
}

function RevisionHistory({ contract }: { contract: LearningContract }) {
  const rows = [...contract.revisionHistory].reverse();
  return (
    <Stack gap={12}>
      <Text variant="h2">Revision history</Text>
      {rows.length === 0 ? (
        <EmptyState title="No revisions yet" />
      ) : (
        <Card>
          <Stack gap={16}>
            {rows.map((item) => (
              <Stack key={item.id} gap={4}>
                <Cluster gap={8}>
                  <Badge>{item.action}</Badge>
                  <Text variant="caption">{LEARNING_CONTRACT_STATUS_LABEL[item.stage] ?? item.stage}</Text>
                </Cluster>
                <Text variant="small">
                  {item.actorRole} · {new Date(item.timestamp).toLocaleString()}
                </Text>
                <Text>{item.summary}</Text>
                {item.comment ? <Text variant="small">Comment: {item.comment}</Text> : null}
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
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
        <Text variant="small">
          Success criteria: {current.successCriteria || current.evidenceRequired}
        </Text>
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
