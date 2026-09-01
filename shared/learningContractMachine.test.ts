import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEARNING_JOURNEY_STEPS,
  activeMilestoneCount,
  availableActions,
  createDraftContract,
  journeyStepIndex,
  reduceContract,
  waitingOn,
  type ContractActor,
} from './learningContractMachine.js';
import {
  MENTOR_CONTRIBUTION,
  buildShowcase,
  canAccessContractWorkspace,
  contractProgress,
  evidenceStoragePath,
  isContractWorkspaceView,
  mergeShowcaseRecord,
  normalizeContract,
  showcaseDocId,
  workspaceFocus,
} from './domain/index.js';
import type { LearningContract } from './types.js';

const now = '2026-08-30T17:00:00.000Z';
const learner: ContractActor = { uid: 'learner-1', role: 'learner' };
const mentor: ContractActor = { uid: 'mentor-1', role: 'mentor' };
const stranger: ContractActor = { uid: 'other', role: 'learner' };
const admin: ContractActor = { uid: 'admin-1', role: 'admin' };

function draft(): LearningContract {
  return createDraftContract({
    id: 'contract-1',
    relationshipId: 'rel-1',
    learnerId: learner.uid,
    mentorId: mentor.uid,
    now,
  });
}

function filledDraft(): LearningContract {
  const created = draft();
  const saved = reduceContract(
    created,
    {
      type: 'SAVE_DRAFT',
      goalText: 'Learn timber framing',
      deliverableTitle: 'A sawhorse',
      deliverableDescription: 'Build a square, load-bearing sawhorse',
      now,
    },
    learner,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) throw new Error(saved.error);
  return saved.contract;
}

function withMentorPlan(contract: LearningContract): LearningContract {
  const saved = reduceContract(
    contract,
    {
      type: 'SAVE_MENTOR_REVIEW',
      goalText: 'Learn timber framing with safe joinery',
      objectives: [{ text: 'Cut square' }, { text: 'Assemble without racking' }],
      milestones: [
        {
          title: 'Stock prep',
          description: 'Select and mill the stock',
          evidenceRequired: 'Photo of milled pieces',
        },
        {
          title: 'Assembly',
          description: 'Join and square the frame',
          evidenceRequired: 'Photo plus a short note',
        },
      ],
      deliverableTitle: 'A sawhorse',
      deliverableDescription: 'A square sawhorse that holds 80kg',
      now,
    },
    mentor,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) throw new Error(saved.error);
  return saved.contract;
}

function inProgress(): LearningContract {
  let contract = filledDraft();
  let result = reduceContract(contract, { type: 'SEND_TO_MENTOR', now }, learner);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  contract = withMentorPlan(result.contract);
  result = reduceContract(contract, { type: 'SEND_TO_LEARNER', now }, mentor);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(result.contract, { type: 'APPROVE_PLAN', now }, learner);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(result.contract, { type: 'ACTIVATE', now }, learner);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.contract;
}

function completionPending(): LearningContract {
  let contract = inProgress();
  let result = reduceContract(
    contract,
    { type: 'SUBMIT_EVIDENCE', text: 'Stock is milled', link: '', now },
    learner,
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(result.contract, { type: 'BEGIN_WORK', now }, learner);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(
    result.contract,
    { type: 'SUBMIT_EVIDENCE', text: 'Assembled', link: '', now },
    learner,
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error);
  return result.contract;
}

describe('learning contract machine', () => {
  it('creates a draft owned by the learner', () => {
    const contract = draft();
    assert.equal(contract.status, 'draft');
    assert.equal(contract.currentStepOwner, 'learner');
    assert.deepEqual(availableActions(contract, learner), [
      'SAVE_DRAFT',
      'SEND_TO_MENTOR',
      'CANCEL',
    ]);
    assert.deepEqual(availableActions(contract, mentor), []);
    assert.equal(journeyStepIndex(contract.status), 0);
    assert.equal(LEARNING_JOURNEY_STEPS.length, 6);
  });

  it('blocks send until the learner writes a goal and deliverable', () => {
    const result = reduceContract(draft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(result.ok, false);
  });

  it('rejects actions from the party who does not own the step', () => {
    const contract = filledDraft();
    const asMentor = reduceContract(contract, { type: 'SEND_TO_MENTOR', now }, mentor);
    const asStranger = reduceContract(contract, { type: 'SEND_TO_MENTOR', now }, stranger);
    assert.equal(asMentor.ok, false);
    assert.equal(asStranger.ok, false);
  });

  it('moves draft to mentor review', () => {
    const result = reduceContract(filledDraft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.contract.status, 'submitted_by_learner');
    assert.equal(waitingOn(result.contract), 'mentor');
    assert.equal(journeyStepIndex(result.contract.status), 1);
  });

  it('records goal history when the mentor revises the goal', () => {
    const sent = reduceContract(filledDraft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(sent.ok, true);
    if (!sent.ok) throw new Error(sent.error);
    const originalGoalId = sent.contract.goal?.id;
    assert.ok(originalGoalId);
    const reviewed = withMentorPlan(sent.contract);
    assert.equal(reviewed.goal?.revisionOf, originalGoalId);
    assert.equal(reviewed.goalHistory.length, 1);
    assert.equal(reviewed.goalHistory[0]?.id, originalGoalId);
    assert.equal(reviewed.objectives.length, 2);
    assert.equal(reviewed.milestones.length, 2);
    assert.equal(reviewed.milestones[0]?.order, 0);
    assert.equal(reviewed.milestones[1]?.order, 1);
  });

  it('blocks sending to the learner without objectives and milestones', () => {
    const sent = reduceContract(filledDraft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(sent.ok, true);
    if (!sent.ok) throw new Error(sent.error);
    const result = reduceContract(sent.contract, { type: 'SEND_TO_LEARNER', now }, mentor);
    assert.equal(result.ok, false);
  });

  it('returns to mentor review when the learner requests changes', () => {
    const sent = reduceContract(filledDraft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(sent.ok, true);
    if (!sent.ok) throw new Error(sent.error);
    const planned = reduceContract(
      withMentorPlan(sent.contract),
      { type: 'SEND_TO_LEARNER', now },
      mentor,
    );
    assert.equal(planned.ok, true);
    if (!planned.ok) throw new Error(planned.error);
    const empty = reduceContract(
      planned.contract,
      { type: 'REQUEST_CHANGES', reason: '', now },
      learner,
    );
    assert.equal(empty.ok, false);
    const changed = reduceContract(
      planned.contract,
      { type: 'REQUEST_CHANGES', reason: 'Need a third milestone', now },
      learner,
    );
    assert.equal(changed.ok, true);
    if (!changed.ok) throw new Error(changed.error);
    assert.equal(changed.contract.status, 'revision_requested');
    assert.equal(changed.contract.currentStepOwner, 'mentor');
    assert.equal(changed.contract.changeRequestReason, 'Need a third milestone');
  });

  it('approving the plan starts in_progress with exactly one active milestone', () => {
    const contract = inProgress();
    assert.equal(contract.status, 'in_progress');
    assert.equal(contract.currentStepOwner, 'learner');
    assert.equal(activeMilestoneCount(contract), 1);
    assert.equal(contract.milestones[0]?.status, 'active');
    assert.equal(contract.milestones[1]?.status, 'locked');
    assert.deepEqual(availableActions(contract, learner), [
      'PAUSE_CONTRACT',
      'CANCEL',
      'SUBMIT_EVIDENCE',
    ]);
    assert.deepEqual(availableActions(contract, mentor), ['PAUSE_CONTRACT', 'CANCEL']);
    assert.equal(journeyStepIndex('agreed'), 3);
    assert.equal(journeyStepIndex(contract.status), 4);
  });

  it('walks two milestones through submit, reject, resubmit, approve, and complete', () => {
    let contract = inProgress();

    let result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Stock is milled', link: 'https://example.com/a.jpg', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'submitted');
    assert.equal(contract.currentStepOwner, 'mentor');
    assert.deepEqual(availableActions(contract, mentor), [
      'PAUSE_CONTRACT',
      'CANCEL',
      'START_REVIEW',
      'APPROVE_MILESTONE',
      'REQUEST_REVISION',
      'REJECT_MILESTONE',
      'DECLINE_MILESTONE',
    ]);

    result = reduceContract(
      contract,
      { type: 'REJECT_MILESTONE', feedback: '', now },
      mentor,
    );
    assert.equal(result.ok, false);

    result = reduceContract(
      contract,
      { type: 'REJECT_MILESTONE', feedback: 'Show the grain direction', now },
      mentor,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'rejected');
    assert.equal(contract.milestones[0]?.lastFeedback, 'Show the grain direction');
    assert.equal(contract.currentStepOwner, 'learner');

    result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Milled, grain marked', link: 'https://example.com/b.jpg', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;

    result = reduceContract(contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'in_progress');
    assert.equal(contract.milestones[0]?.status, 'approved');
    assert.equal(contract.milestones[1]?.status, 'locked');
    assert.equal(activeMilestoneCount(contract), 0);
    assert.equal(result.effects.length, 0);

    result = reduceContract(contract, { type: 'BEGIN_WORK', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[1]?.status, 'active');
    assert.equal(activeMilestoneCount(contract), 1);

    result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Assembled and square', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);

    result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'completion_pending');
    assert.equal(contract.milestones[1]?.status, 'approved');
    assert.deepEqual(availableActions(contract, mentor), ['REOPEN_COMPLETION']);
    assert.ok(availableActions(contract, learner).includes('SUBMIT_FINAL_DELIVERABLE'));

    const blocked = reduceContract(contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(blocked.ok, false);

    result = reduceContract(
      contract,
      {
        type: 'SUBMIT_FINAL_DELIVERABLE',
        title: 'A sawhorse',
        description: 'Square and load-bearing',
        links: ['https://example.com/sawhorse'],
        skillsDemonstrated: ['Joinery'],
        now,
      },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'REVIEW_FINAL_DELIVERABLE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'completed');
    assert.equal(contract.deliverable?.status, 'completed');
    assert.equal(contract.showcaseId, 'contract-1');
    assert.deepEqual(result.effects, [{ type: 'publish_showcase' }]);
    assert.deepEqual(availableActions(contract, learner), ['UNPUBLISH_SHOWCASE']);
    assert.deepEqual(availableActions(contract, mentor), []);
    assert.equal(journeyStepIndex(contract.status), 5);
  });
});

describe('learning goal builder', () => {
  it('walks proposal, mentor revision, learner revision, mutual approval, then active', () => {
    let contract = filledDraft();
    let result = reduceContract(contract, { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'submitted_by_learner');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'SUBMITTED_BY_LEARNER'));

    contract = withMentorPlan(contract);
    assert.equal(contract.status, 'under_mentor_review');
    assert.equal(contract.goal?.title, 'Learn timber framing with safe joinery');
    assert.equal(contract.objectives[0]?.title, 'Cut square');
    assert.equal(contract.milestones[0]?.successCriteria, 'Photo of milled pieces');

    result = reduceContract(contract, { type: 'SEND_TO_LEARNER', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'proposed_by_mentor');
    assert.equal(waitingOn(contract), 'learner');

    result = reduceContract(
      contract,
      { type: 'REQUEST_CHANGES', reason: 'Need a third milestone', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'revision_requested');

    const revised = reduceContract(
      contract,
      {
        type: 'SAVE_MENTOR_REVIEW',
        goalText: 'Learn timber framing with safe joinery',
        objectives: [
          { title: 'Cut square', description: 'Square stock' },
          { title: 'Assemble without racking', description: 'Brace the frame' },
          { title: 'Finish', description: 'Sand and oil' },
        ],
        milestones: [
          {
            title: 'Stock prep',
            description: 'Select and mill the stock',
            successCriteria: 'Photo of milled pieces',
          },
          {
            title: 'Assembly',
            description: 'Join and square the frame',
            successCriteria: 'Photo plus a short note',
          },
          {
            title: 'Finish',
            description: 'Sand and oil',
            successCriteria: 'Photo of the finished horse',
          },
        ],
        deliverableTitle: 'A sawhorse',
        deliverableDescription: 'A square sawhorse that holds 80kg',
        expectedEvidence: 'Photos of the finished horse under load',
        comment: 'Added a finish milestone',
        now,
      },
      mentor,
    );
    assert.equal(revised.ok, true);
    if (!revised.ok) throw new Error(revised.error);
    contract = revised.contract;
    assert.equal(contract.objectives.length, 3);
    assert.equal(contract.mentorComment, 'Added a finish milestone');

    result = reduceContract(contract, { type: 'SEND_TO_LEARNER', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;

    result = reduceContract(contract, { type: 'APPROVE_PLAN', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'mutually_approved');
    assert.equal(contract.milestones.every((item) => item.status === 'locked'), true);

    const tooSoon = reduceContract(
      filledDraft(),
      { type: 'ACTIVATE', now },
      learner,
    );
    assert.equal(tooSoon.ok, false);

    result = reduceContract(contract, { type: 'ACTIVATE', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'in_progress');
    assert.equal(contract.milestones[0]?.status, 'active');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'MUTUALLY_APPROVED'));
    assert.ok(contract.revisionHistory.some((item) => item.action === 'ACTIVATED'));
    assert.ok(contract.revisionHistory.every((item) => item.actorId && item.timestamp));
  });

  it('rejects unauthorized actors and illegal transitions', () => {
    const submitted = reduceContract(filledDraft(), { type: 'SEND_TO_MENTOR', now }, learner);
    assert.equal(submitted.ok, true);
    if (!submitted.ok) throw new Error(submitted.error);

    const strangerAct = reduceContract(
      submitted.contract,
      { type: 'SAVE_MENTOR_REVIEW', goalText: 'x', objectives: [], milestones: [], deliverableTitle: 't', deliverableDescription: 'd', now },
      stranger,
    );
    assert.equal(strangerAct.ok, false);

    const learnerAsMentor = reduceContract(
      submitted.contract,
      { type: 'REJECT_PROPOSAL', reason: 'No', now },
      learner,
    );
    assert.equal(learnerAsMentor.ok, false);

    const skipToActive = reduceContract(submitted.contract, { type: 'ACTIVATE', now }, mentor);
    assert.equal(skipToActive.ok, false);

    const approveEarly = reduceContract(submitted.contract, { type: 'APPROVE_PLAN', now }, learner);
    assert.equal(approveEarly.ok, false);

    const rejected = reduceContract(
      submitted.contract,
      { type: 'REJECT_PROPOSAL', reason: 'Not a fit for this pairing', now },
      mentor,
    );
    assert.equal(rejected.ok, true);
    if (!rejected.ok) throw new Error(rejected.error);
    assert.equal(rejected.contract.status, 'rejected');
    const afterReject = reduceContract(rejected.contract, { type: 'SEND_TO_LEARNER', now }, mentor);
    assert.equal(afterReject.ok, false);
  });
});

describe('learning contract workspace', () => {
  it('shows both pairing members the same contract and derived progress', () => {
    const contract = inProgress();
    assert.equal(contract.id, 'contract-1');
    assert.equal(contract.relationshipId, 'rel-1');
    assert.equal(canAccessContractWorkspace(learner, contract), true);
    assert.equal(canAccessContractWorkspace(mentor, contract), true);
    assert.equal(contractProgress(contract).percent, 0);
    assert.equal(contractProgress({ milestones: contract.milestones }).percent, 0);
    assert.equal('progress' in contract, false);
    assert.equal(isContractWorkspaceView(contract), true);
    assert.equal(workspaceFocus(contract).who, 'learner');
  });

  it('keeps unauthorized users out of the workspace', () => {
    const contract = inProgress();
    assert.equal(
      canAccessContractWorkspace({ uid: 'other', role: 'learner', active: true }, contract),
      false,
    );
    assert.equal(
      canAccessContractWorkspace({ uid: 'mentor-2', role: 'mentor', active: true }, contract),
      false,
    );
    assert.equal(
      canAccessContractWorkspace({ uid: 'admin-1', role: 'admin', active: true }, contract),
      true,
    );
    assert.equal(
      canAccessContractWorkspace({ uid: 'admin-1', role: 'admin', active: false }, contract),
      false,
    );
    assert.equal(reduceContract(contract, { type: 'PAUSE_CONTRACT', now }, stranger).ok, false);
  });

  it('derives progress from approved milestones and forbids skipping states', () => {
    const contract = inProgress();
    assert.equal(contractProgress(contract).approved, 0);
    assert.equal(contractProgress(contract).total, 2);
    assert.equal(contractProgress(contract).percent, 0);

    let result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Stock is milled', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    assert.equal(contractProgress(result.contract).percent, 50);
    assert.equal(result.contract.status, 'in_progress');
    assert.equal('progress' in result.contract, false);

    const paused = reduceContract(result.contract, { type: 'PAUSE_CONTRACT', now }, mentor);
    assert.equal(paused.ok, true);
    if (!paused.ok) throw new Error(paused.error);
    assert.equal(paused.contract.status, 'paused');
    assert.equal(
      reduceContract(
        paused.contract,
        { type: 'SUBMIT_EVIDENCE', text: 'Nope', link: '', now },
        learner,
      ).ok,
      false,
    );

    const resumed = reduceContract(paused.contract, { type: 'RESUME_CONTRACT', now }, learner);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) throw new Error(resumed.error);
    assert.equal(resumed.contract.status, 'in_progress');

    const adminPause = reduceContract(resumed.contract, { type: 'PAUSE_CONTRACT', now }, admin);
    assert.equal(adminPause.ok, true);
    if (!adminPause.ok) throw new Error(adminPause.error);
    assert.equal(adminPause.contract.status, 'paused');
  });

  it('moves last-milestone approval to completion pending, then completed on confirm', () => {
    let contract = inProgress();
    let result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Stock is milled', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'BEGIN_WORK', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(
      result.contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Assembled', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'completion_pending');
    assert.equal(contractProgress(contract).percent, 100);
    assert.equal(result.effects.length, 0);
    assert.equal(workspaceFocus(contract).who, 'learner');

    const reopen = reduceContract(contract, { type: 'REOPEN_COMPLETION', now }, learner);
    assert.equal(reopen.ok, true);
    if (!reopen.ok) throw new Error(reopen.error);
    assert.equal(reopen.contract.status, 'in_progress');
    assert.equal(reopen.contract.milestones[1]?.status, 'active');
    assert.equal(contractProgress(reopen.contract).percent, 50);

    result = reduceContract(
      reopen.contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Assembled again', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);

    const earlyConfirm = reduceContract(contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(earlyConfirm.ok, false);

    result = reduceContract(
      contract,
      {
        type: 'SUBMIT_FINAL_DELIVERABLE',
        title: 'A sawhorse',
        description: 'Square and load-bearing',
        links: ['https://example.com/sawhorse'],
        skillsDemonstrated: ['Joinery'],
        now,
      },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'REVIEW_FINAL_DELIVERABLE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.contract.status, 'completed');
    assert.deepEqual(result.effects, [{ type: 'publish_showcase' }]);
    assert.equal(isContractWorkspaceView(result.contract), true);
  });

  it('keeps a cancelled builder in the builder, and a cancelled active contract in the workspace', () => {
    const builderCancel = reduceContract(filledDraft(), { type: 'CANCEL', now }, learner);
    assert.equal(builderCancel.ok, true);
    if (!builderCancel.ok) throw new Error(builderCancel.error);
    assert.equal(isContractWorkspaceView(builderCancel.contract), false);

    const activeCancel = reduceContract(inProgress(), { type: 'CANCEL', now }, mentor);
    assert.equal(activeCancel.ok, true);
    if (!activeCancel.ok) throw new Error(activeCancel.error);
    assert.equal(activeCancel.contract.status, 'cancelled');
    assert.equal(isContractWorkspaceView(activeCancel.contract), true);
  });

  it('keeps older in_progress documents readable after normalize', () => {
    const legacy = normalizeContract({
      id: 'old-1',
      relationshipId: 'rel-1',
      learnerId: learner.uid,
      mentorId: mentor.uid,
      status: 'in_progress',
      currentStepOwner: 'learner',
      createdAt: now,
      updatedAt: now,
      goal: { id: 'g1', text: 'Learn joinery', revisionOf: null },
      goalHistory: [],
      objectives: [{ id: 'o1', text: 'Cut square' }],
      milestones: [
        {
          id: 'm1',
          order: 0,
          title: 'Prep',
          description: 'Mill',
          evidenceRequired: 'Photo',
          status: 'approved',
          evidenceText: 'Done',
          evidenceLink: '',
          lastFeedback: null,
        },
        {
          id: 'm2',
          order: 1,
          title: 'Assemble',
          description: 'Join',
          evidenceRequired: 'Photo',
          status: 'active',
          evidenceText: '',
          evidenceLink: '',
          lastFeedback: null,
        },
      ],
      deliverable: {
        id: 'd1',
        title: 'A sawhorse',
        description: 'Square',
        finalEvidenceUrl: '',
        status: 'in_progress',
      },
      changeRequestReason: null,
    } as never);
    assert.equal(legacy.goal?.title, 'Learn joinery');
    assert.equal(legacy.objectives[0]?.title, 'Cut square');
    assert.equal(legacy.milestones[0]?.successCriteria, 'Photo');
    assert.equal(legacy.deliverable?.expectedEvidence, '');
    assert.equal(contractProgress(legacy).percent, 50);
    const booleanEvidence = normalizeContract({
      ...legacy,
      milestones: [
        {
          id: 'm1',
          order: 0,
          title: 'Prep',
          description: 'Mill',
          evidenceRequired: true as never,
          status: 'approved',
          evidenceText: 'Done',
          evidenceLink: '',
          lastFeedback: null,
        },
      ],
    } as never);
    assert.equal(booleanEvidence.milestones[0]?.successCriteria, '');
    assert.equal(booleanEvidence.milestones[0]?.evidenceRequired, '');
    assert.equal(canAccessContractWorkspace(learner, legacy), true);
    assert.equal(
      canAccessContractWorkspace({ uid: 'other', role: 'learner', active: true }, legacy),
      false,
    );
    assert.equal(
      canAccessContractWorkspace({ uid: 'admin-1', role: 'admin', active: true }, legacy),
      true,
    );
    assert.equal(legacy.evidenceItems.length, 1);
    assert.equal(legacy.evidenceItems[0]?.type, 'text');
  });
});

describe('milestone and evidence system', () => {
  it('walks submit, review, revision, resubmit, approve, and progress', () => {
    let contract = inProgress();
    assert.equal(contractProgress(contract).percent, 0);

    let result = reduceContract(
      contract,
      {
        type: 'SUBMIT_EVIDENCE',
        items: [
          { type: 'text', content: 'Stock is milled' },
          { type: 'link', content: 'https://example.com/stock.jpg' },
          { type: 'reflection', content: 'The grain ran cleaner than I expected.' },
        ],
        now,
      },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'submitted');
    assert.equal(contract.evidenceItems.length, 3);
    assert.ok(contract.revisionHistory.some((item) => item.action === 'EVIDENCE_SUBMITTED'));

    const strangerSubmit = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Nope', link: '', now },
      stranger,
    );
    assert.equal(strangerSubmit.ok, false);

    result = reduceContract(contract, { type: 'START_REVIEW', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'under_review');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'REVIEW_STARTED'));

    result = reduceContract(
      contract,
      { type: 'REQUEST_REVISION', feedback: 'Show the grain direction', now },
      mentor,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'rejected');
    assert.equal(contract.milestones[0]?.lastFeedback, 'Show the grain direction');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'REVISION_REQUESTED'));
    assert.equal(contractProgress(contract).percent, 0);

    result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Milled, grain marked', link: 'https://example.com/b.jpg', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'submitted');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'EVIDENCE_REVISED'));

    result = reduceContract(contract, { type: 'APPROVE_MILESTONE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'approved');
    assert.equal(contractProgress(contract).percent, 50);
    assert.ok(contract.revisionHistory.some((item) => item.action === 'MILESTONE_APPROVED'));
    assert.equal(contract.milestones[1]?.status, 'locked');
    assert.equal(workspaceFocus(contract).who, 'learner');
    assert.match(workspaceFocus(contract).next, /Begin work/);
  });

  it('records terminal REJECTED and does not count it toward progress', () => {
    let contract = inProgress();
    let result = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Stock is milled', link: '', now },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(
      result.contract,
      { type: 'DECLINE_MILESTONE', feedback: 'This is not the work we agreed.', now },
      mentor,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.milestones[0]?.status, 'declined');
    assert.equal(contractProgress(contract).percent, 0);
    assert.ok(contract.revisionHistory.some((item) => item.action === 'MILESTONE_REJECTED'));
    const resubmit = reduceContract(
      contract,
      { type: 'SUBMIT_EVIDENCE', text: 'Trying again', link: '', now },
      learner,
    );
    assert.equal(resubmit.ok, false);
  });

  it('rejects a public storage path and a stranger file path', () => {
    const contract = inProgress();
    const publicPath = reduceContract(
      contract,
      {
        type: 'SUBMIT_EVIDENCE',
        items: [
          {
            type: 'file',
            content: 'photo.jpg',
            storagePath: `portfolios/${learner.uid}/photo.jpg`,
          },
        ],
        now,
      },
      learner,
    );
    assert.equal(publicPath.ok, false);

    const owned = evidenceStoragePath({
      contractId: contract.id,
      milestoneId: contract.milestones[0]!.id,
      userId: learner.uid,
      fileId: 'shot.jpg',
    });
    const okFile = reduceContract(
      contract,
      {
        type: 'SUBMIT_EVIDENCE',
        items: [{ type: 'file', content: 'shot.jpg', storagePath: owned }],
        now,
      },
      learner,
    );
    assert.equal(okFile.ok, true);

    const otherPath = evidenceStoragePath({
      contractId: contract.id,
      milestoneId: contract.milestones[0]!.id,
      userId: stranger.uid,
      fileId: 'shot.jpg',
    });
    const stolen = reduceContract(
      contract,
      {
        type: 'SUBMIT_EVIDENCE',
        items: [{ type: 'file', content: 'shot.jpg', storagePath: otherPath }],
        now,
      },
      learner,
    );
    assert.equal(stolen.ok, false);
  });
});

describe('completion and showcase', () => {
  it('walks final deliverable, mentor review, completion, and a single showcase', () => {
    let contract = completionPending();
    assert.equal(contract.status, 'completion_pending');
    assert.equal(contractProgress(contract).percent, 100);
    assert.equal(reduceContract(contract, { type: 'CONFIRM_COMPLETION', now }, mentor).ok, false);
    assert.equal(
      reduceContract(
        contract,
        {
          type: 'SUBMIT_FINAL_DELIVERABLE',
          title: 'Stolen',
          description: 'Nope',
          links: ['https://example.com'],
          now,
        },
        stranger,
      ).ok,
      false,
    );

    let result = reduceContract(
      contract,
      {
        type: 'SUBMIT_FINAL_DELIVERABLE',
        title: 'A sawhorse',
        description: 'Square, load-bearing, and photographed',
        links: ['https://example.com/sawhorse'],
        evidenceItemIds: contract.evidenceItems.map((item) => item.id),
        skillsDemonstrated: ['Joinery', 'Layout'],
        now,
      },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.finalDeliverable.reviewStatus, 'submitted');
    assert.ok(contract.revisionHistory.some((item) => item.action === 'FINAL_DELIVERABLE_SUBMITTED'));

    result = reduceContract(contract, { type: 'REVIEW_FINAL_DELIVERABLE', comment: 'Ready', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.ok(contract.revisionHistory.some((item) => item.action === 'FINAL_DELIVERABLE_REVIEWED'));

    result = reduceContract(contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;
    assert.equal(contract.status, 'completed');
    assert.equal(contract.showcaseId, showcaseDocId(contract.id));
    assert.equal(contract.showcasePublished, true);
    assert.deepEqual(result.effects, [{ type: 'publish_showcase' }]);
    assert.ok(contract.revisionHistory.some((item) => item.action === 'CONTRACT_COMPLETED'));
    assert.ok(contract.revisionHistory.some((item) => item.action === 'SHOWCASE_CREATED'));
    assert.ok(contract.revisionHistory.some((item) => item.action === 'SHOWCASE_PUBLISHED'));

    const again = reduceContract(contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(again.ok, false);

    const first = buildShowcase({
      contract,
      learnerDisplayName: 'Ada',
      mentorDisplayName: 'Ben',
      now,
    });
    const second = buildShowcase({
      contract,
      learnerDisplayName: 'Ada',
      mentorDisplayName: 'Ben',
      now: '2026-09-01T00:00:00.000Z',
    });
    const merged = mergeShowcaseRecord(first, second);
    assert.equal(first.id, second.id);
    assert.equal(merged.id, first.id);
    assert.equal(merged.createdAt, first.createdAt);
    assert.equal(merged.mentorContribution, MENTOR_CONTRIBUTION);
    assert.equal(merged.creatorRole, 'learner');
    assert.match(merged.mentorContribution, /learner remains the creator/i);
  });

  it('lets the learner hide and republish the showcase without creating another one', () => {
    let contract = completionPending();
    let result = reduceContract(
      contract,
      {
        type: 'SUBMIT_FINAL_DELIVERABLE',
        title: 'A sawhorse',
        description: 'Done',
        links: ['https://example.com/done'],
        skillsDemonstrated: ['Joinery'],
        now,
      },
      learner,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'REVIEW_FINAL_DELIVERABLE', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    result = reduceContract(result.contract, { type: 'CONFIRM_COMPLETION', now }, mentor);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    contract = result.contract;

    result = reduceContract(contract, { type: 'UNPUBLISH_SHOWCASE', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.contract.showcasePublished, false);
    assert.equal(result.contract.showcaseId, contract.showcaseId);
    assert.deepEqual(result.effects, [{ type: 'set_showcase_published', published: false }]);

    const mentorPublish = reduceContract(result.contract, { type: 'UNPUBLISH_SHOWCASE', now }, mentor);
    assert.equal(mentorPublish.ok, false);

    result = reduceContract(result.contract, { type: 'PUBLISH_SHOWCASE', now }, learner);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.error);
    assert.equal(result.contract.showcasePublished, true);
    assert.equal(result.contract.showcaseId, contract.showcaseId);
  });
});
