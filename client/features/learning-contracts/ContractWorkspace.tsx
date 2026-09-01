import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  LEARNING_CONTRACT_STATUS,
  LEARNING_CONTRACT_STATUS_LABEL,
  MILESTONE_STATUS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  availableActions,
  canSendMessage,
  contractEvidenceItems,
  contractProgress,
  contractTitle,
  isContractCompleted,
  milestoneEvidenceCount,
  sortMilestones,
  workspaceFocus,
  workspacePartyLabel,
  type ContractActionType,
  type ContractActor,
  type LearningContract,
  type MentorshipRelationship,
  type Message,
  type Milestone,
  type User,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Input,
  MessageBubble,
  MilestoneStatusMark,
  Modal,
  Stack,
  Text,
  TextArea,
} from '../../components';
import { sendMessage, watchMessages } from '../mentorship';
import { dispatchContractAction } from '../../lib/api';

type ContractWorkspaceProps = {
  account: User;
  contract: LearningContract;
  relationship: MentorshipRelationship;
  learnerName: string;
  mentorName: string;
  error: string | null;
  onError: (message: string | null) => void;
};

function asActor(account: User): ContractActor | null {
  if (
    account.role !== USER_ROLE.learner &&
    account.role !== USER_ROLE.mentor &&
    account.role !== USER_ROLE.admin
  ) {
    return null;
  }
  return { uid: account.uid, role: account.role };
}

function statusTone(
  status: LearningContract['status'],
): 'success' | 'accent' | 'danger' | 'neutral' {
  if (
    status === LEARNING_CONTRACT_STATUS.inProgress ||
    status === LEARNING_CONTRACT_STATUS.completed
  ) {
    return 'success';
  }
  if (
    status === LEARNING_CONTRACT_STATUS.cancelled ||
    status === LEARNING_CONTRACT_STATUS.rejected
  ) {
    return 'danger';
  }
  if (status === LEARNING_CONTRACT_STATUS.paused) return 'neutral';
  return 'accent';
}

export function ContractWorkspace({
  account,
  contract,
  relationship,
  learnerName,
  mentorName,
  error,
  onError,
}: ContractWorkspaceProps) {
  const actor = asActor(account);
  const actions = actor ? availableActions(contract, actor) : [];
  const progress = contractProgress(contract);
  const focus = workspaceFocus(contract);
  const title = contractTitle(contract);
  const goalTitle = contract.goal?.title || contract.goal?.text || 'No goal yet';
  const whoName =
    focus.who === 'learner'
      ? account.uid === contract.learnerId
        ? 'you'
        : learnerName
      : focus.who === 'mentor'
        ? account.uid === contract.mentorId
          ? 'you'
          : mentorName
        : focus.who === 'either'
          ? 'learner or mentor'
          : 'nobody';

  return (
    <Stack gap={32}>
      <Stack gap={12}>
        <Button variant="ghost" size="sm" to={`/dashboard/mentorships/${contract.relationshipId}`}>
          Back to the relationship
        </Button>
        <Cluster gap={12}>
          <Text variant="h1">{title}</Text>
          <Badge tone={statusTone(contract.status)}>
            {LEARNING_CONTRACT_STATUS_LABEL[contract.status]}
          </Badge>
        </Cluster>
        <Text variant="muted">{goalTitle}</Text>
      </Stack>

      <Card padding="lg">
        <Stack gap={16}>
          <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Goal" value={goalTitle} />
            <Meta label="Learner" value={learnerName} />
            <Meta label="Mentor" value={mentorName} />
            <Meta
              label="Status"
              value={LEARNING_CONTRACT_STATUS_LABEL[contract.status]}
            />
          </div>
          <ProgressMeter
            percent={progress.percent}
            approved={progress.approved}
            total={progress.total}
          />
        </Stack>
      </Card>

      <Card>
        <Stack gap={12}>
          <Text variant="caption">What needs to happen next</Text>
          <Text variant="h3">{focus.next}</Text>
          <Text variant="small">
            Who needs to take action:{' '}
            {focus.who === 'learner' || focus.who === 'mentor'
              ? `${workspacePartyLabel(focus.who)} (${whoName})`
              : workspacePartyLabel(focus.who)}
          </Text>
        </Stack>
      </Card>

      <Overview contract={contract} />
      <MilestonesSection
        contract={contract}
        actions={actions}
        onError={onError}
      />
      <EvidenceSection contract={contract} />
      <DiscussionSection
        account={account}
        relationship={relationship}
        learnerName={learnerName}
        mentorName={mentorName}
        onError={onError}
      />
      <ActivitySection contract={contract} />

      <WorkspaceControls contract={contract} actions={actions} onError={onError} />

      {isContractCompleted(contract) ? (
        <Card>
          <Stack gap={8}>
            <Badge tone="success">COMPLETED</Badge>
            <Text>The deliverable is now on both public profiles.</Text>
          </Stack>
        </Card>
      ) : null}

      {error ? <Text variant="danger">{error}</Text> : null}
    </Stack>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={4}>
      <Text variant="caption">{label}</Text>
      <Text variant="h3">{value}</Text>
    </Stack>
  );
}

function ProgressMeter({
  percent,
  approved,
  total,
}: {
  percent: number;
  approved: number;
  total: number;
}) {
  return (
    <Stack gap={8}>
      <Cluster gap={12}>
        <Text variant="caption">Progress</Text>
        <Text variant="h3">{percent}%</Text>
        <Text variant="small">
          {approved} of {total} milestones approved
        </Text>
      </Cluster>
      <div
        className="h-2 w-full overflow-hidden rounded-sm bg-line"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Contract progress from approved milestones"
      >
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>
      <Text variant="small">
        Progress is calculated from approved milestones. It cannot be edited.
      </Text>
    </Stack>
  );
}

function Overview({ contract }: { contract: LearningContract }) {
  return (
    <Stack gap={16}>
      <Text variant="h2">1. Overview</Text>
      <Card>
        <Stack gap={12}>
          <Text variant="caption">Goal</Text>
          {contract.goal?.title || contract.goal?.text ? (
            <Stack gap={8}>
              <Text variant="h3">{contract.goal.title || contract.goal.text}</Text>
              {contract.goal.description ? <Text>{contract.goal.description}</Text> : null}
            </Stack>
          ) : (
            <EmptyState title="No goal on this contract" />
          )}
        </Stack>
      </Card>
      <Card>
        <Stack gap={12}>
          <Text variant="caption">Objectives</Text>
          {contract.objectives.length === 0 ? (
            <EmptyState title="No objectives" />
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
          <Text variant="caption">Deliverable</Text>
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
            <EmptyState title="No deliverable" />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function MilestonesSection({
  contract,
  actions,
  onError,
}: {
  contract: LearningContract;
  actions: ContractActionType[];
  onError: (message: string | null) => void;
}) {
  const rows = sortMilestones(contract.milestones);
  return (
    <Stack gap={16}>
      <Text variant="h2">2. Milestones</Text>
      {rows.length === 0 ? (
        <EmptyState title="No milestones" />
      ) : (
        <Stack gap={16}>
          {rows.map((item) => (
            <Card key={item.id}>
              <Stack gap={12}>
                <Cluster gap={12}>
                  <MilestoneStatusMark status={item.status} />
                  <Text variant="h3">
                    {item.order + 1}. {item.title}
                  </Text>
                </Cluster>
                <Text>{item.description}</Text>
                <Text variant="small">
                  Success criteria: {item.successCriteria || item.evidenceRequired || 'None listed'}
                </Text>
                <Text variant="small">
                  Evidence: {milestoneEvidenceCount(item)} submitted
                </Text>
                {item.lastFeedback ? (
                  <Text variant="danger">Mentor feedback: {item.lastFeedback}</Text>
                ) : (
                  <Text variant="small">Mentor feedback: none yet</Text>
                )}
                <MilestoneWork
                  contract={contract}
                  milestone={item}
                  actions={actions}
                  onError={onError}
                />
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function MilestoneWork({
  contract,
  milestone,
  actions,
  onError,
}: {
  contract: LearningContract;
  milestone: Milestone;
  actions: ContractActionType[];
  onError: (message: string | null) => void;
}) {
  const canSubmit =
    actions.includes('SUBMIT_EVIDENCE') &&
    (milestone.status === MILESTONE_STATUS.active ||
      milestone.status === MILESTONE_STATUS.rejected);
  const canReview =
    actions.includes('APPROVE_MILESTONE') &&
    milestone.status === MILESTONE_STATUS.submitted;
  if (!canSubmit && !canReview) return null;
  return (
    <MilestoneActions
      contract={contract}
      milestone={milestone}
      canSubmit={canSubmit}
      canReview={canReview}
      onError={onError}
    />
  );
}

function MilestoneActions({
  contract,
  milestone,
  canSubmit,
  canReview,
  onError,
}: {
  contract: LearningContract;
  milestone: Milestone;
  canSubmit: boolean;
  canReview: boolean;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState(canSubmit ? '' : milestone.evidenceText);
  const [link, setLink] = useState(canSubmit ? '' : milestone.evidenceLink);
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

  return (
    <Stack gap={12}>
      {canSubmit ? (
        <form onSubmit={(event) => void submit(event)}>
          <Stack gap={12}>
            <Text variant="h3">Submit evidence for this milestone</Text>
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
      {canReview ? (
        <Stack gap={12}>
          <Text variant="h3">Review this evidence</Text>
          <Text>{milestone.evidenceText}</Text>
          {milestone.evidenceLink ? <Text variant="small">{milestone.evidenceLink}</Text> : null}
          <TextArea
            label="Feedback if rejecting"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <Cluster gap={8}>
            <Button loading={busy} onClick={() => void decide('APPROVE_MILESTONE')}>
              Approve milestone
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
  );
}

function EvidenceSection({ contract }: { contract: LearningContract }) {
  const items = contractEvidenceItems(contract);
  return (
    <Stack gap={16}>
      <Text variant="h2">3. Evidence</Text>
      {items.length === 0 ? (
        <EmptyState
          title="No evidence yet"
          description="Submitted work against milestones will appear here."
        />
      ) : (
        <Stack gap={16}>
          {items.map((item) => (
            <Card key={item.milestoneId}>
              <Stack gap={8}>
                <Text variant="caption">
                  Milestone {item.order + 1}
                </Text>
                <Text variant="h3">{item.milestoneTitle}</Text>
                <Text>{item.text}</Text>
                {item.link ? <Text variant="small">{item.link}</Text> : null}
                {item.feedback ? (
                  <Text variant="danger">Mentor feedback: {item.feedback}</Text>
                ) : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function DiscussionSection({
  account,
  relationship,
  learnerName,
  mentorName,
  onError,
}: {
  account: User;
  relationship: MentorshipRelationship;
  learnerName: string;
  mentorName: string;
  onError: (message: string | null) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const canPost = canSendMessage(account, relationship, draft || 'ok');
  const composerOk = canSendMessage(account, relationship, draft);

  useEffect(() => {
    return watchMessages(relationship.id, setMessages, (err) => onError(err.message));
  }, [onError, relationship.id]);

  const authorName = useMemo(
    () => (senderId: string) => {
      if (senderId === account.uid) return 'You';
      if (senderId === relationship.learnerId) return learnerName;
      if (senderId === relationship.mentorId) return mentorName;
      return 'Member';
    },
    [account.uid, learnerName, mentorName, relationship.learnerId, relationship.mentorId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!composerOk) return;
    setBusy(true);
    onError(null);
    try {
      await sendMessage({
        relationshipId: relationship.id,
        senderId: account.uid,
        text: draft,
      });
      setDraft('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap={16}>
      <Text variant="h2">4. Discussion</Text>
      <Text variant="small">
        Contract-specific communication for this pairing. This is the same thread as the
        relationship — one pair, one contract.
      </Text>
      <Card padding="lg">
        <Stack gap={16}>
          {messages.length === 0 ? (
            <EmptyState title="No discussion yet" description="Ask about the next milestone or the evidence." />
          ) : (
            <Stack gap={12}>
              {messages.map((item) => (
                <MessageBubble
                  key={item.id}
                  mine={item.senderId === account.uid}
                  author={authorName(item.senderId)}
                  text={item.text}
                  time={new Date(item.createdAt).toLocaleString()}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
      {canPost ? (
        <form onSubmit={(event) => void onSubmit(event)}>
          <Stack gap={12}>
            <TextArea
              label="Message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              required
              maxLength={2000}
            />
            <Button type="submit" loading={busy} disabled={!composerOk}>
              Send
            </Button>
          </Stack>
        </form>
      ) : (
        <EmptyState
          title={
            account.role === USER_ROLE.admin
              ? 'Admins can read this discussion'
              : relationship.status === RELATIONSHIP_STATUS.paused
                ? 'Discussion is paused with the mentorship'
                : 'Discussion is read-only'
          }
          description="Messages stay on the relationship. New posts require an ACTIVE pairing."
        />
      )}
    </Stack>
  );
}

function ActivitySection({ contract }: { contract: LearningContract }) {
  const rows = [...contract.revisionHistory].reverse();
  return (
    <Stack gap={16}>
      <Text variant="h2">5. Activity</Text>
      {rows.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <Stack gap={16}>
            {rows.map((item) => (
              <Stack key={item.id} gap={4}>
                <Cluster gap={8}>
                  <Badge>{item.action}</Badge>
                  <Text variant="caption">
                    {LEARNING_CONTRACT_STATUS_LABEL[item.stage] ?? item.stage}
                  </Text>
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

function WorkspaceControls({
  contract,
  actions,
  onError,
}: {
  contract: LearningContract;
  actions: ContractActionType[];
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  async function run(action: Parameters<typeof dispatchContractAction>[1]) {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, action);
      setCancelOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update the contract');
    } finally {
      setBusy(false);
    }
  }

  const hasControls =
    actions.includes('ACTIVATE') ||
    actions.includes('PAUSE_CONTRACT') ||
    actions.includes('RESUME_CONTRACT') ||
    actions.includes('CONFIRM_COMPLETION') ||
    actions.includes('REOPEN_COMPLETION') ||
    actions.includes('CANCEL');

  if (!hasControls) return null;

  return (
    <Card>
      <Stack gap={16}>
        <Text variant="h3">Contract controls</Text>
        <Text variant="small">
          Status changes go through the learning contract machine. Progress is never set here.
        </Text>
        <Cluster gap={8}>
          {actions.includes('ACTIVATE') ? (
            <Button loading={busy} onClick={() => void run({ type: 'ACTIVATE' })}>
              Activate contract
            </Button>
          ) : null}
          {actions.includes('PAUSE_CONTRACT') ? (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void run({ type: 'PAUSE_CONTRACT' })}
            >
              Pause
            </Button>
          ) : null}
          {actions.includes('RESUME_CONTRACT') ? (
            <Button loading={busy} onClick={() => void run({ type: 'RESUME_CONTRACT' })}>
              Resume
            </Button>
          ) : null}
          {actions.includes('CONFIRM_COMPLETION') ? (
            <Button loading={busy} onClick={() => void run({ type: 'CONFIRM_COMPLETION' })}>
              Confirm completion
            </Button>
          ) : null}
          {actions.includes('REOPEN_COMPLETION') ? (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void run({ type: 'REOPEN_COMPLETION' })}
            >
              Reopen work
            </Button>
          ) : null}
          {actions.includes('CANCEL') ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel contract
            </Button>
          ) : null}
        </Cluster>
        <Modal
          open={cancelOpen}
          title="Cancel this contract"
          onClose={() => setCancelOpen(false)}
          footer={
            <Cluster gap={8}>
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>
                Keep working
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => void run({ type: 'CANCEL', reason: 'Cancelled from the workspace' })}
              >
                Cancel contract
              </Button>
            </Cluster>
          }
        >
          <Text>The contract will become CANCELLED. Milestone work stops.</Text>
        </Modal>
      </Stack>
    </Card>
  );
}
