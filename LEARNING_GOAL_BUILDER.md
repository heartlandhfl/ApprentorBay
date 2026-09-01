# Learning Goal Builder

**Collection:** `learningContracts` (unchanged)  
**Machine:** `shared/learningContractMachine.ts` (`reduceContract`)  
**Entry:** learner starts from an **ACTIVE** mentorship relationship (`POST /api/contracts`)

This is not a second contract system and not a standalone form. It is the negotiation workflow that writes the existing learning contract document. After the contract is ACTIVE, the same machine runs the Learning Contract Workspace (`in_progress` → `paused` / `completion_pending` → `completed`).

---

## Entry requirement

A builder can be created only when:

1. The learner is signed in.
2. The mentor is signed in (they are the other member of the pair).
3. They have an **ACTIVE** `mentorshipRelationships` document.

The server refuses create if the relationship is missing, not `active`, or not owned by the learner. Mentors cannot start a builder. Client writes to `learningContracts` remain denied.

---

## Workflow

```
DRAFT
  → SUBMITTED_BY_LEARNER
  → UNDER_MENTOR_REVIEW
  → PROPOSED_BY_MENTOR
  → (UNDER_LEARNER_REVIEW on older docs)
  → REVISION_REQUESTED  (optional loop)
  → MUTUALLY_APPROVED
  → ACTIVE (`in_progress`)
  → COMPLETION_PENDING (last milestone approved)
  → COMPLETED

Terminal exits: REJECTED (mentor) · CANCELLED (either member before mutual approval)
```

1. **Learner proposal.** Draft goal (title + description), draft deliverable (title, description, optional expected evidence), optional context. Submit.
2. **Mentor review.** Revise the goal, add ordered objectives, add ordered milestones with success criteria, revise the deliverable, comment. Propose to the learner, or reject with a reason.
3. **Learner response.** Approve, or request revision with a required comment.
4. **Mentor response.** Revise again and re-propose, or reject.
5. **Mutual approval.** Learner approval of a mentor proposal records `MUTUALLY_APPROVED`. The contract is **not** ACTIVE yet.
6. **Activate.** Either pairing member activates. Only then does status become `in_progress` (UI: **ACTIVE**) and the first milestone unlock.

Arbitrary status writes are impossible. Every transition checks current state, actor role, and pairing membership inside `reduceContract`.

---

## States (persisted snake_case, UI uppercase)

| Persisted | UI |
| --- | --- |
| `draft` | DRAFT |
| `submitted_by_learner` | SUBMITTED_BY_LEARNER |
| `under_mentor_review` | UNDER_MENTOR_REVIEW |
| `proposed_by_mentor` | PROPOSED_BY_MENTOR |
| `under_learner_review` | UNDER_LEARNER_REVIEW (legacy docs still valid) |
| `revision_requested` | REVISION_REQUESTED |
| `mutually_approved` | MUTUALLY_APPROVED |
| `in_progress` | **ACTIVE** |
| `paused` | PAUSED |
| `completion_pending` | COMPLETION_PENDING |
| `rejected` | REJECTED |
| `cancelled` | CANCELLED |
| `completed` | COMPLETED |

`agreed` remains in the type union for old documents and can only move to ACTIVE.

---

## Canonical fields

**Goal:** `title`, `description` (`text` kept for older documents)  
**Objectives:** `title`, `description`, `order`  
**Milestones:** `title`, `description`, `order`, `successCriteria` (`evidenceRequired` kept in sync)  
**Deliverable:** `title`, `description`, `expectedEvidence`  
**Optional:** `context` (learner), `mentorComment`

`normalizeContract()` fills missing fields so existing contracts still load.

---

## Revision history

`revisionHistory[]` is append-only:

| Field | Meaning |
| --- | --- |
| `actorId` / `actorRole` | Who changed it |
| `stage` | Status at the time of the change |
| `action` | `SAVE_DRAFT`, `SUBMITTED_BY_LEARNER`, `MENTOR_REVISED`, `PROPOSED_BY_MENTOR`, `REVISION_REQUESTED`, `MUTUALLY_APPROVED`, `ACTIVATED`, `REJECTED`, `CANCELLED`, … |
| `timestamp` | ISO time |
| `comment` | Reason or mentor note |
| `summary` | Human-readable what changed |

Goal text revisions still also append to `goalHistory`.

---

## UI

`/dashboard/journey/:relationshipId` is the builder until the contract is mutually approved. After that, the same URL is the **Learning Contract Workspace** (see `LEARNING_CONTRACT_WORKSPACE.md`).

Always visible:

- **Current status**
- **Next action**
- **Waiting for**
- Goal / objectives / milestones / deliverable
- **Revision history**

The relationship workspace card is the only start button (learner, active pair).

---

## Critical rule

`APPROVE_PLAN` writes `mutually_approved`. It does **not** unlock milestones.

`ACTIVATE` is the only legal path to `in_progress` (ACTIVE). Calling activate from draft, submitted, or review fails.

---

## Compatibility

- Same collection, same Express routes, same reduce function.
- Old `SAVE_DRAFT` / `SAVE_MENTOR_REVIEW` payloads that send `goalText` and `evidenceRequired` still work.
- Older `under_mentor_review` / `under_learner_review` documents remain readable and actionable.
