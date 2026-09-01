# Completion and showcase

**Collection:** `showcases` (document id = contract id)  
**Contract fields:** `finalDeliverable`, `showcaseId`, `showcasePublished`  
**Machine:** `shared/learningContractMachine.ts`  
**Profiles:** learner Showcase, mentor Mentored deliverables

A contract does not become **COMPLETED** because the last milestone was approved. The learner submits a final deliverable. The mentor reviews it. Only then can completion be confirmed. Confirmation creates a **Showcase** record — a public-facing representation of the work, not a second view of the contract.

The learner remains the creator. The mentor is attributed as a mentor, not an owner.

---

## Required flow

1. Every required milestone is **APPROVED**.
2. The contract moves to `completion_pending` (COMPLETION_PENDING).
3. Learner submits the final deliverable (`SUBMIT_FINAL_DELIVERABLE`).
4. Mentor reviews it (`REVIEW_FINAL_DELIVERABLE`).
5. Mentor confirms (`CONFIRM_COMPLETION`).
6. Contract becomes `completed` (COMPLETED) and is protected from ordinary editing.
7. Showcase `{contractId}` is created and published.

`REOPEN_COMPLETION` can still return to ACTIVE before confirmation.

---

## Completion safety

`CONFIRM_COMPLETION` fails unless all three are true:

1. All required milestones are approved.
2. The final deliverable has been submitted.
3. The mentor has completed the completion review.

A stranger cannot submit or confirm. The learner cannot self-complete.

---

## Final deliverable

Stored on the contract as `finalDeliverable`. Distinct from the negotiated plan (`deliverable`).

| Field | Notes |
| --- | --- |
| `title` | Required |
| `description` | Required |
| `files` | Private Storage, path `evidence/{contractId}/final/{learnerUid}/{fileId}` |
| `links` | Public URLs |
| `evidenceItemIds` | Selected milestone evidence to publish |
| `skillsDemonstrated` | Skills the learner showed |
| `reviewStatus` | `not_submitted` \| `submitted` \| `reviewed` \| `revision_requested` |

At least one of files, links, or selected evidence is required.

---

## Showcase record

Collection `showcases`. Document id is the contract id.

| Field | Notes |
| --- | --- |
| `id` / `contractId` | Same value. Makes writes idempotent |
| `title` / `description` | From the final deliverable |
| `skillsDemonstrated` | |
| `links` / `files` / `publicEvidence` | Approved public evidence |
| `completedAt` | |
| `published` / `publishedAt` | Privacy control |
| `creatorRole` | Always `learner` |
| `mentorContribution` | “Mentored this work. The learner remains the creator.” |
| `learnerDisplayName` / `mentorDisplayName` | Attribution snapshots |

Client writes to `showcases` are denied. The server upserts the same document on completion. A second completion request cannot create a second showcase: the machine rejects `CONFIRM_COMPLETION` on an already-completed contract, and a retried server write merges onto `{contractId}`.

Profile `deliverables[]` still receives a `DeliverableRef` with that same id (`arrayUnion`). That list is a pointer, not the showcase.

---

## Privacy

The learner can `PUBLISH_SHOWCASE` or `UNPUBLISH_SHOWCASE`. Unpublished records stay visible to the pairing and admins. Public profiles show published showcases only. The owner sees a Hidden badge on their own unpublished cards.

---

## Profiles

**Learner showcase**

- Deliverable title
- Description
- Skills demonstrated
- Completion date
- Mentor attribution
- Approved public evidence

**Mentor — Mentored deliverables**

- Deliverable
- Learner attribution
- Mentor contribution (not ownership)
- Completion date

---

## Activity

Append-only `revisionHistory` actions:

| Action | When |
| --- | --- |
| `FINAL_DELIVERABLE_SUBMITTED` | Learner submits or resubmits |
| `FINAL_DELIVERABLE_REVIEWED` | Mentor finishes the review |
| `CONTRACT_COMPLETED` | Mentor confirms |
| `SHOWCASE_CREATED` | Showcase document is written |
| `SHOWCASE_PUBLISHED` | Published on completion or later by the learner |

`SHOWCASE_UNPUBLISHED` is recorded if the learner hides it.

---

## Tests that must stay green

1. Active contract → all milestones approved → final deliverable submitted → mentor reviews → mentor confirms → COMPLETED.
2. Showcase id equals the contract id. A second confirm fails. A merge of two `buildShowcase` calls keeps one id.
3. Learner profile can show the showcase. Mentor profile shows mentoring contribution and does not claim ownership.
4. Completion is blocked if a milestone is open, the final deliverable is missing, or the mentor has not reviewed.
