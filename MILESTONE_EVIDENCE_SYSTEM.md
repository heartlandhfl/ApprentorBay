# Milestone and evidence system

**Collection:** `learningContracts` (unchanged)  
**Evidence:** `evidenceItems[]` on that document — not a second collection  
**Files:** Firebase Storage `evidence/{contractId}/{milestoneId}/{learnerUid}/{fileId}`  
**Machine:** `shared/learningContractMachine.ts` (`reduceContract`)  
**UI:** Learning Contract Workspace, milestone cards

A milestone is not complete because the learner checks a box. The learner demonstrates the work. The mentor reviews the evidence. Only **APPROVED** milestones count toward contract progress.

---

## Milestone states

Persisted snake_case. UI labels are uppercase.

| Persisted | UI | Meaning |
| --- | --- | --- |
| `locked` | **NOT_STARTED** | Not the current milestone |
| `active` | **IN_PROGRESS** | Learner is working it |
| `submitted` | **EVIDENCE_SUBMITTED** | Evidence is in; mentor has not started review |
| `under_review` | **UNDER_REVIEW** | Mentor opened the review |
| `rejected` | **REVISION_REQUESTED** | Mentor asked for another pass (resubmit allowed) |
| `approved` | **APPROVED** | Counts toward progress |
| `declined` | **REJECTED** | Terminal decline. No resubmit |

```
NOT_STARTED → IN_PROGRESS
IN_PROGRESS → EVIDENCE_SUBMITTED
EVIDENCE_SUBMITTED → UNDER_REVIEW | APPROVED | REVISION_REQUESTED | REJECTED
UNDER_REVIEW → APPROVED | REVISION_REQUESTED | REJECTED
REVISION_REQUESTED → EVIDENCE_SUBMITTED
APPROVED → (terminal)
REJECTED → (terminal)
```

Arbitrary writes are impossible. Every move goes through `canTransitionMilestone` inside `reduceContract`. Client writes to `learningContracts` stay denied.

`rejected` on older documents is **REVISION_REQUESTED**. Learners can still resubmit.

---

## Learner actions

| Action | When |
| --- | --- |
| `BEGIN_WORK` | Next `locked` milestone (previous ones approved). Activate still starts the first milestone. |
| `SUBMIT_EVIDENCE` | `IN_PROGRESS` or `REVISION_REQUESTED` |

A submission may include any mix of:

- **TEXT** — written explanation
- **REFLECTION** — what they learned
- **LINK** — a URL
- **FILE** — private Storage object

Old `{ text, link }` payloads still work and become TEXT / LINK items.

---

## Mentor actions

| Action | When |
| --- | --- |
| `START_REVIEW` | `EVIDENCE_SUBMITTED` → `UNDER_REVIEW` |
| `APPROVE_MILESTONE` | submitted or under review |
| `REQUEST_REVISION` | submitted or under review; feedback required. `REJECT_MILESTONE` is the same action for older clients |
| `DECLINE_MILESTONE` | submitted or under review; feedback required; terminal **REJECTED** |

Approving a milestone does **not** auto-start the next one. The learner begins it.

---

## Evidence item

Stored on the contract:

| Field | Notes |
| --- | --- |
| `id` | New per item |
| `milestoneId` | |
| `contractId` | |
| `submittedBy` | Learner uid |
| `type` | `text` \| `link` \| `file` \| `reflection` |
| `content` | Text, reflection, URL, or file name |
| `storagePath` | Private path, or `null` |
| `createdAt` / `updatedAt` | ISO |

`normalizeContract()` hydrates items from older `evidenceText` / `evidenceLink` so existing contracts still load. Those two strings stay on the milestone as a projection of the latest text/link.

---

## Storage security

Path:

```
evidence/{contractId}/{milestoneId}/{learnerUid}/{fileId}
```

| Who | Read | Write |
| --- | --- | --- |
| Contract learner (path uid matches) | yes | yes, ≤ 10 MB, allowed MIME types |
| Contract mentor | yes | no |
| Admin | yes | no (delete allowed) |
| Anyone else | no | no |

`/portfolios/{userId}/**` remains public and is **rejected** as an evidence path. The machine also checks that `storagePath` matches the contract, milestone, and actor.

---

## Activity

Append-only `revisionHistory` actions:

| Action | When |
| --- | --- |
| `EVIDENCE_SUBMITTED` | First submit on an IN_PROGRESS milestone |
| `EVIDENCE_REVISED` | Resubmit after REVISION_REQUESTED |
| `REVIEW_STARTED` | Mentor starts review |
| `REVISION_REQUESTED` | Mentor asks for another pass |
| `MILESTONE_APPROVED` | Mentor approves |

`MILESTONE_REJECTED` is recorded when the mentor uses terminal **REJECTED**.

---

## UI

Each milestone card shows:

- **STATUS**
- **NEXT ACTION**
- **WHO IS RESPONSIBLE**
- **EVIDENCE**
- **MENTOR FEEDBACK**

Progress stays `approved milestones / total × 100`. It is never edited by hand.

---

## Tests that must stay green

1. Learner submits evidence → mentor reviews → requests revision → learner resubmits → mentor approves → progress moves (0 → 50). The next milestone stays **NOT_STARTED** until `BEGIN_WORK`.
2. A stranger cannot submit.
3. A public `/portfolios` path and another user’s file path are rejected.
4. Terminal **REJECTED** (`declined`) does not count toward progress and cannot be resubmitted.
5. Older `in_progress` documents still normalize, including boolean `evidenceRequired` and embedded text.
