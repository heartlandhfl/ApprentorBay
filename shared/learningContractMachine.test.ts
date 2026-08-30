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
import type { LearningContract } from './types.js';

const now = '2026-08-30T17:00:00.000Z';
const learner: ContractActor = { uid: 'learner-1', role: 'learner' };
const mentor: ContractActor = { uid: 'mentor-1', role: 'mentor' };
const stranger: ContractActor = { uid: 'other', role: 'learner' };

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
  return result.contract;
}

describe('learning contract machine', () => {
  it('creates a draft owned by the learner', () => {
    const contract = draft();
    assert.equal(contract.status, 'draft');
    assert.equal(contract.currentStepOwner, 'learner');
    assert.deepEqual(availableActions(contract, learner), ['SAVE_DRAFT', 'SEND_TO_MENTOR']);
    assert.deepEqual(availableActions(contract, mentor), []);
    assert.equal(journeyStepIndex(contract.status), 0);
    assert.equal(LEARNING_JOURNEY_STEPS.length, 5);
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
    assert.equal(result.contract.status, 'under_mentor_review');
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
    assert.equal(changed.contract.status, 'under_mentor_review');
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
    assert.deepEqual(availableActions(contract, learner), ['SUBMIT_EVIDENCE']);
    assert.deepEqual(availableActions(contract, mentor), []);
    assert.equal(journeyStepIndex('agreed'), 3);
    assert.equal(journeyStepIndex(contract.status), 3);
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
      'APPROVE_MILESTONE',
      'REJECT_MILESTONE',
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
    assert.equal(contract.milestones[1]?.status, 'active');
    assert.equal(activeMilestoneCount(contract), 1);
    assert.equal(result.effects.length, 0);

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
    assert.equal(contract.status, 'completed');
    assert.equal(contract.milestones[1]?.status, 'approved');
    assert.equal(contract.deliverable?.status, 'completed');
    assert.deepEqual(result.effects, [{ type: 'publish_deliverable_refs' }]);
    assert.deepEqual(availableActions(contract, learner), []);
    assert.deepEqual(availableActions(contract, mentor), []);
    assert.equal(journeyStepIndex(contract.status), 4);
  });
});
