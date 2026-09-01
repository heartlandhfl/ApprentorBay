import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  EVIDENCE_TYPE_LABEL,
  LEARNING_CONTRACT_STATUS,
  LEARNING_CONTRACT_STATUS_LABEL,
  MILESTONE_STATUS,
  RELATIONSHIP_STATUS,
  USER_ROLE,
  availableActions,
  canSendMessage,
  contractProgress,
  contractTitle,
  evidenceItemsForMilestone,
  isContractCompleted,
  milestoneEvidenceCount,
  milestoneNextAction,
  milestoneResponsibleParty,
  nextBeginWorkMilestone,
  sortMilestones,
  workspaceFocus,
  workspacePartyLabel,
  type ContractActionType,
  type ContractActor,
  type EvidenceDraft,
  type EvidenceItem,
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
import { evidenceDownloadUrl, uploadEvidenceFile } from './evidenceStorage';

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
        account={account}
        learnerName={learnerName}
        mentorName={mentorName}
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

function partyName(
  party: ReturnType<typeof milestoneResponsibleParty>,
  account: User,
  contract: LearningContract,
  learnerName: string,
  mentorName: string,
): string {
  if (party === 'nobody') return 'Nobody';
  if (party === 'learner') {
    return account.uid === contract.learnerId ? 'Learner (you)' : `Learner (${learnerName})`;
  }
  return account.uid === contract.mentorId ? 'Mentor (you)' : `Mentor (${mentorName})`;
}

function MilestonesSection({
  contract,
  actions,
  account,
  learnerName,
  mentorName,
  onError,
}: {
  contract: LearningContract;
  actions: ContractActionType[];
  account: User;
  learnerName: string;
  mentorName: string;
  onError: (message: string | null) => void;
}) {
  const rows = sortMilestones(contract.milestones);
  const beginTarget = nextBeginWorkMilestone(contract.milestones);
  return (
    <Stack gap={16}>
      <Text variant="h2">2. Milestones</Text>
      {rows.length === 0 ? (
        <EmptyState title="No milestones" />
      ) : (
        <Stack gap={16}>
          {rows.map((item) => {
            const who = milestoneResponsibleParty(item);
            return (
              <Card key={item.id}>
                <Stack gap={12}>
                  <Text variant="h3">
                    {item.order + 1}. {item.title}
                  </Text>
                  <Text>{item.description}</Text>
                  <Text variant="small">
                    Success criteria: {item.successCriteria || item.evidenceRequired || 'None listed'}
                  </Text>
                  <Stack gap={4}>
                    <Text variant="caption">Status</Text>
                    <MilestoneStatusMark status={item.status} />
                  </Stack>
                  <Stack gap={4}>
                    <Text variant="caption">Next action</Text>
                    <Text>{milestoneNextAction(item)}</Text>
                  </Stack>
                  <Stack gap={4}>
                    <Text variant="caption">Who is responsible</Text>
                    <Text>{partyName(who, account, contract, learnerName, mentorName)}</Text>
                  </Stack>
                  <Stack gap={4}>
                    <Text variant="caption">Evidence</Text>
                    <EvidenceList
                      items={evidenceItemsForMilestone(contract.evidenceItems, item.id)}
                      emptyLabel={`${milestoneEvidenceCount(item, contract.evidenceItems)} submitted`}
                    />
                  </Stack>
                  <Stack gap={4}>
                    <Text variant="caption">Mentor feedback</Text>
                    {item.lastFeedback ? (
                      <Text variant="danger">{item.lastFeedback}</Text>
                    ) : (
                      <Text variant="small">None yet</Text>
                    )}
                  </Stack>
                  <MilestoneWork
                    contract={contract}
                    milestone={item}
                    actions={actions}
                    account={account}
                    canBegin={
                      actions.includes('BEGIN_WORK') && beginTarget?.id === item.id
                    }
                    onError={onError}
                  />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function MilestoneWork({
  contract,
  milestone,
  actions,
  account,
  canBegin,
  onError,
}: {
  contract: LearningContract;
  milestone: Milestone;
  actions: ContractActionType[];
  account: User;
  canBegin: boolean;
  onError: (message: string | null) => void;
}) {
  const canSubmit =
    actions.includes('SUBMIT_EVIDENCE') &&
    (milestone.status === MILESTONE_STATUS.active ||
      milestone.status === MILESTONE_STATUS.rejected);
  const canStartReview =
    actions.includes('START_REVIEW') && milestone.status === MILESTONE_STATUS.submitted;
  const canDecide =
    (actions.includes('APPROVE_MILESTONE') || actions.includes('REQUEST_REVISION')) &&
    (milestone.status === MILESTONE_STATUS.submitted ||
      milestone.status === MILESTONE_STATUS.underReview);
  if (!canSubmit && !canStartReview && !canDecide && !canBegin) return null;
  return (
    <MilestoneActions
      contract={contract}
      milestone={milestone}
      account={account}
      canBegin={canBegin}
      canSubmit={canSubmit}
      canStartReview={canStartReview}
      canDecide={canDecide}
      onError={onError}
    />
  );
}

function MilestoneActions({
  contract,
  milestone,
  account,
  canBegin,
  canSubmit,
  canStartReview,
  canDecide,
  onError,
}: {
  contract: LearningContract;
  milestone: Milestone;
  account: User;
  canBegin: boolean;
  canSubmit: boolean;
  canStartReview: boolean;
  canDecide: boolean;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [reflection, setReflection] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'BEGIN_WORK' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not begin this milestone');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const items: EvidenceDraft[] = [];
      if (text.trim()) items.push({ type: 'text', content: text.trim() });
      if (reflection.trim()) items.push({ type: 'reflection', content: reflection.trim() });
      if (link.trim()) items.push({ type: 'link', content: link.trim() });
      if (file) {
        const uploaded = await uploadEvidenceFile({
          contractId: contract.id,
          milestoneId: milestone.id,
          userId: account.uid,
          file,
        });
        items.push({
          type: 'file',
          content: uploaded.fileName,
          storagePath: uploaded.storagePath,
        });
      }
      await dispatchContractAction(contract.id, { type: 'SUBMIT_EVIDENCE', items });
      setText('');
      setReflection('');
      setLink('');
      setFile(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not submit evidence');
    } finally {
      setBusy(false);
    }
  }

  async function startReview() {
    setBusy(true);
    onError(null);
    try {
      await dispatchContractAction(contract.id, { type: 'START_REVIEW' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start the review');
    } finally {
      setBusy(false);
    }
  }

  async function decide(type: 'APPROVE_MILESTONE' | 'REQUEST_REVISION' | 'DECLINE_MILESTONE') {
    setBusy(true);
    onError(null);
    try {
      if (type === 'APPROVE_MILESTONE') {
        await dispatchContractAction(contract.id, { type });
      } else {
        await dispatchContractAction(contract.id, { type, feedback });
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
      {canBegin ? (
        <Button loading={busy} onClick={() => void begin()}>
          Begin work
        </Button>
      ) : null}
      {canSubmit ? (
        <form onSubmit={(event) => void submit(event)}>
          <Stack gap={12}>
            <Text variant="h3">
              {milestone.status === MILESTONE_STATUS.rejected
                ? 'Resubmit evidence'
                : 'Submit evidence'}
            </Text>
            <Text variant="small">
              A checkbox is not enough. Add writing, a link, a reflection, or a private file.
            </Text>
            <TextArea
              label="Written explanation"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <TextArea
              label="Reflection"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              hint="Optional. What did you learn while doing this?"
            />
            <Input
              label="Link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              hint="Optional public URL. Files go through private Storage, not here."
            />
            <label>
              <Text variant="small" as="span">
                File
              </Text>
              <input
                type="file"
                className="mt-2 block w-full text-small"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button
              type="submit"
              loading={busy}
              disabled={!text.trim() && !reflection.trim() && !link.trim() && !file}
            >
              Submit evidence
            </Button>
          </Stack>
        </form>
      ) : null}
      {canStartReview || canDecide ? (
        <Stack gap={12}>
          <Text variant="h3">Review this evidence</Text>
          {canStartReview ? (
            <Button variant="secondary" loading={busy} onClick={() => void startReview()}>
              Start review
            </Button>
          ) : null}
          {canDecide ? (
            <Stack gap={12}>
              <TextArea
                label="Feedback for a revision or rejection"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
              <Cluster gap={8}>
                <Button loading={busy} onClick={() => void decide('APPROVE_MILESTONE')}>
                  Approve milestone
                </Button>
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => void decide('REQUEST_REVISION')}
                >
                  Request revision
                </Button>
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => void decide('DECLINE_MILESTONE')}
                >
                  Reject
                </Button>
              </Cluster>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

function EvidenceList({
  items,
  emptyLabel,
}: {
  items: EvidenceItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <Text variant="small">{emptyLabel ?? 'None yet'}</Text>;
  }
  return (
    <Stack gap={8}>
      {items.map((item) => (
        <Stack key={item.id} gap={4}>
          <Cluster gap={8}>
            <Badge>{EVIDENCE_TYPE_LABEL[item.type]}</Badge>
            <Text variant="small">{new Date(item.createdAt).toLocaleString()}</Text>
          </Cluster>
          {item.type === 'file' && item.storagePath ? (
            <EvidenceFileLink path={item.storagePath} label={item.content} />
          ) : item.type === 'link' ? (
            <Text variant="small">{item.content}</Text>
          ) : (
            <Text>{item.content}</Text>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function EvidenceFileLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void evidenceDownloadUrl(path)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) {
    return <Text variant="small">{label} (private file)</Text>;
  }
  return (
    <a href={url} className="text-small text-accent underline" target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function EvidenceSection({ contract }: { contract: LearningContract }) {
  const rows = sortMilestones(contract.milestones).flatMap((milestone) =>
    evidenceItemsForMilestone(contract.evidenceItems, milestone.id).map((item) => ({
      milestone,
      item,
    })),
  );
  return (
    <Stack gap={16}>
      <Text variant="h2">3. Evidence</Text>
      {rows.length === 0 ? (
        <EmptyState
          title="No evidence yet"
          description="A milestone is not done until the learner demonstrates it and the mentor approves."
        />
      ) : (
        <Stack gap={16}>
          {rows.map(({ milestone, item }) => (
            <Card key={item.id}>
              <Stack gap={8}>
                <Text variant="caption">
                  Milestone {milestone.order + 1} · {EVIDENCE_TYPE_LABEL[item.type]}
                </Text>
                <Text variant="h3">{milestone.title}</Text>
                {item.type === 'file' && item.storagePath ? (
                  <EvidenceFileLink path={item.storagePath} label={item.content} />
                ) : (
                  <Text>{item.content}</Text>
                )}
                {milestone.lastFeedback ? (
                  <Text variant="danger">Mentor feedback: {milestone.lastFeedback}</Text>
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
