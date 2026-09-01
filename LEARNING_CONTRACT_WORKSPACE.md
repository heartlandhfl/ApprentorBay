# Learning Contract Workspace

**Collection:** `learningContracts` (unchanged)  
**Discussion:** `messages` on the same `relationshipId` (unchanged)  
**Activity:** contract `revisionHistory` (unchanged)  
**Machine:** `shared/learningContractMachine.ts` (`reduceContract`)  
**Page:** `/dashboard/journey/:relationshipId` (alias `/dashboard/contracts/:relationshipId`)

This is the operational heart of ApprentorBay. It is not a second contract, progress, or chat system. After the Learning Goal Builder produces a mutually approved contract, the same document becomes this workspace.

---

## When it starts

The workspace opens when the contract is past the builder:

- `mutually_approved` / `agreed` (activate to start work)
- `in_progress` (UI: **ACTIVE**)
- `paused`
- `completion_pending`
- `completed`
- `cancelled` **after** activation (milestones are no longer all `locked`)

A cancelled **builder** draft stays on the Learning Goal Builder page.

---

## Who can open it

Only:

- the learner on the contract
- the mentor on the contract
- an authorized admin

Firestore already denies everyone else. The page also checks `canAccessContractWorkspace`. Client writes to `learningContracts` remain denied; actions go through `POST /api/contracts/:id/action`.

Both pairing members watch the same document (`learningContracts` where `relationshipId` matches). There is one contract per relationship.

---

## Header

The workspace header answers who this contract is, where it stands, and how far it has come:

| Field | Source |
| --- | --- |
| Contract title | `contractTitle()` — deliverable title, else goal title |
| Goal | `goal.title` (`text` on older docs) |
| Learner | pairing member display name |
| Mentor | pairing member display name |
| Status | persisted snake_case, UI uppercase via `LEARNING_CONTRACT_STATUS_LABEL` |
| Progress | **derived** — never stored, never editable |

---

## Sections

The page is one operational record, not a generic dashboard.

1. **Overview** — goal, objectives, deliverable.
2. **Milestones** — in order: title, description, success criteria, status, evidence count, mentor feedback. The current milestone’s submit/review actions sit on that row.
3. **Evidence** — `evidenceItems[]` on the contract (TEXT / LINK / FILE / REFLECTION). See `MILESTONE_EVIDENCE_SYSTEM.md`.
4. **Discussion** — the existing relationship `messages` thread. One pair, one contract. New posts require an **ACTIVE** relationship. Admins can read, not post.
5. **Activity** — append-only `revisionHistory`.

A focus strip above the sections answers:

- What are we trying to achieve?
- What has been completed? (approved milestones / progress)
- What needs to happen next?
- What evidence has been submitted?
- Who needs to take action?

---

## Progress

```
approved milestones / total milestones × 100
```

Implemented as `contractProgress()`. Rounded to the nearest percent. Zero milestones → `0`.

There is no progress field on the document. The UI has no control that writes progress. Approving a milestone is the only way the number moves.

---

## Contract status

Persisted values stay snake_case. Workspace labels are uppercase.

| Persisted | UI |
| --- | --- |
| `in_progress` | **ACTIVE** |
| `paused` | PAUSED |
| `completion_pending` | COMPLETION_PENDING |
| `completed` | COMPLETED |
| `cancelled` | CANCELLED |
| `mutually_approved` | MUTUALLY_APPROVED (activate to become ACTIVE) |

Transitions (central map + `reduceContract`):

```
mutually_approved / agreed → in_progress          (ACTIVATE)
in_progress → paused | completion_pending | cancelled
paused → in_progress | cancelled
completion_pending → completed | in_progress
completed → (terminal)
cancelled → (terminal)
```

`in_progress` cannot jump to `completed`. The last milestone approval writes `completion_pending` and does **not** publish profile deliverable refs. `CONFIRM_COMPLETION` publishes. `REOPEN_COMPLETION` returns to ACTIVE and sets the last milestone back to `active` so work can continue.

Pause / resume / cancel / confirm / reopen are pairing members **or admin**. Evidence submit/review stay learner/mentor on the current step.

---

## Compatibility

- Same `learningContracts` document the builder wrote.
- `normalizeContract()` still fills missing `title` / `successCriteria` / `revisionHistory` on older `in_progress` docs.
- Milestone evidence is `evidenceItems[]` on the contract. `evidenceText` / `evidenceLink` remain as a projection for older readers.
- Discussion is not a new collection.

---

## Tests that must stay green

1. Both pairing members can access the same contract; progress matches.
2. A stranger cannot access or pause it; a suspended admin cannot access it; an active admin can.
3. Progress is `0` then `50` after one of two milestones is approved, and there is still no `progress` field.
4. Pause blocks evidence; resume restores ACTIVE; last-milestone approve → `completion_pending` → confirm → `completed`.
5. Older `in_progress` documents still normalize and remain readable.
