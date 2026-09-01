# ApprentorBay Domain Model

**Canonical package:** `shared/domain/` (imported as `@apprentorbay/shared`)  
**Compatibility barrel:** `shared/types.ts` re-exports the same shapes the app already used.  
**This document describes the model as implemented.** It does not rename Firestore collections or change routes.

---

## Canonical language

| Concept | Internal identifier | Public copy may say | Persisted field / collection |
| --- | --- | --- | --- |
| Person being mentored | `USER_ROLE.learner` (`'learner'`) | **Apprentice/Learner** (`PUBLIC_LEARNER_LABEL`) | `learnerId` — never `apprenticeId` |
| Person mentoring | `USER_ROLE.mentor` | Mentor | `mentorId` |
| Administrator | `USER_ROLE.admin` | Admin | `users.role` |
| Mentor Application | `MentorshipApplication` (alias `MentorApplication`) | Application | `mentorshipApplications` |
| Mentorship Relationship | `MentorshipRelationship` | Relationship / pairing | `mentorshipRelationships` |
| Learning Contract | `LearningContract` | Learning Journey (UI) | `learningContracts` |
| Learning Goal Builder | `LearningGoalBuilder` | Draft / mentor review forms | **Not a collection** — view of contract fields |
| Objective | `Objective` | Objective | Embedded on the contract |
| Milestone | `Milestone` | Milestone | Embedded on the contract |
| Evidence | `Evidence` | Evidence | Embedded on the milestone (`evidenceText`, `evidenceLink`) |
| Deliverable | `Deliverable` / `DeliverableRef` | Deliverable | Contract field + profile array |
| Showcase | `Showcase` | Showcase / completed work | `showcases/{contractId}` |
| Notification | `Notification` | Notification | Reserved: `notifications` (not written) |
| Admin Audit Log | `AdminAuditLog` | — | `adminAuditLogs` (server writes only) |
| Support Issue | `SupportIssue` | Support | `supportIssues` |

---

## 1. Canonical entities

### User

Account document. One role at signup. Admin is seeded, never self-assigned. `accountStatus` is `active` | `restricted` | `suspended` | `terminated`. See `ADMINISTRATION_SYSTEM.md`.

### LearnerProfile / MentorProfile

**Private** records keyed by `uid`. Visitors do not read these. Public pages read `publicProfiles/{slug}`. Mentor `verificationStatus` is participation **approval**, not a background check. Verification cases (`verificationCaseStatus` + `verifiedClaims[]`) are separate. See `PUBLIC_PROFILE_SYSTEM.md` and `ADMINISTRATION_SYSTEM.md`.

### Mentor Application (`MentorshipApplication`)

Learner request to pair with a mentor.

### Mentorship Relationship

Accepted pair. Owns messages and at most one learning contract (server convention).

### Message

Chat line scoped to a relationship.

### Learning Contract

Server-written living plan: goal, objectives, milestones, deliverable, step owner.

### Learning Goal Builder

Not stored. `learningGoalBuilderFromContract()` maps a contract onto the editable draft/review surface (goal text, deliverable, objectives, milestone specs).

### Goal / Objective / Milestone / Evidence / Deliverable

Nested on the contract. Evidence is two strings on the milestone. Deliverable completion copies a `DeliverableRef` onto both profiles.

### ShowcaseItem

Read model: `{ id, contractId, title, description, source: 'profile_deliverable_ref' }`.

### AdminAuditLog

Server-written `adminAuditLogs/{id}` on every major admin action: `adminId`, `action`, `targetUserId`, `reason`, `timestamp`. Clients cannot write this collection.

### SupportIssue

Signed-in users file `supportIssues/{id}`. Admins resolve them from the dashboard. Clients cannot update or delete.

### Notification

Typed for future writes. No current repository writes this collection.

### Legacy `Mentorship`

Abandoned unified pairing type. Do not write. Rules still mention `/mentorships`.

---

## 2. Required fields

Shapes match existing production documents. New optional fields were **not** added to live collections.

### `users/{uid}`

`uid`, `role`, `email`, `displayName`, `active`, `accountStatus?`, `createdAt`, `termsAcceptedAt`, `termsVersion`, `profileSlug`

Missing `active` is treated as `true` (`isAccountActive`). Missing `accountStatus` follows `active` (`active` / `suspended`).

### `learnerProfiles/{uid}`

Private. `userId`, `slug`, `displayName`, `photoPath`, `professionalIdentity`, `location`, `locationPublic`, `education[]`, `qualifications[]`, `certifications[]`, `jobStatus`, `careerAspirations`, `competencyGoals[]`, `skillsDeveloping[]`, `skillsDemonstrated[]`, `deliverables[]`, `public`

### `mentorProfiles/{uid}`

Private. Learner fields plus `expertise`, `areasOfExpertise[]`, `experience[]`, `professionalGoals`, `mentoringInterests`, `reviews[]`, `verificationStatus` (approval: pending / approved / rejected / suspended), `previousVerificationStatus`, `verificationCaseStatus`, `verifiedClaims[]`

### `publicProfiles/{slug}`

Public projection. No `userId`, email, or hidden location. Photo paths use the slug. Portfolio / mentored deliverables are embedded. Visitors do not read `showcases`.

### `profileSlugs/{slug}`

Server-only uniqueness index: `userId`, `role`.

### `mentorshipApplications/{id}`

`id`, `learnerId`, `mentorId`, `message`, `status`, `createdAt`

### `mentorshipRelationships/{id}`

`id`, `learnerId`, `mentorId`, `status`, `createdAt`

### `messages/{id}`

`id`, `relationshipId`, `senderId`, `text`, `createdAt`

### `showcases/{id}`

`id` (= `contractId`), `learnerId`, `mentorId`, `title`, `description`, `skillsDemonstrated`, `completedAt`, `published`, `creatorRole` (`learner`), `mentorContribution`

### `learningContracts/{id}`

`id`, `relationshipId`, `learnerId`, `mentorId`, `status`, `currentStepOwner`, `createdAt`, `updatedAt`, `goal`, `goalHistory`, `objectives`, `milestones`, `deliverable`, `changeRequestReason`

### `adminAuditLogs/{id}`

`id`, `adminId`, `actorId`, `action`, `targetUserId`, `reason`, `timestamp`, `metadata`, `createdAt`

### `supportIssues/{id}`

`id`, `reporterId`, `reporterRole`, `reporterName`, `subject`, `body`, `status`, `createdAt`, `resolvedAt`, `resolvedBy`

### Nested

| Entity | Fields |
| --- | --- |
| Goal | `id`, `text`, `revisionOf` |
| Objective | `id`, `text` |
| Milestone | `id`, `order`, `title`, `description`, `evidenceRequired`, `status`, `evidenceText`, `evidenceLink`, `lastFeedback` |
| Evidence (view) | `text`, `link` |
| Deliverable | `id`, `title`, `description`, `finalEvidenceUrl`, `status` |
| DeliverableRef | `id`, `contractId`, `title`, `description` |

### Reserved (not persisted yet)

| Entity | Fields |
| --- | --- |
| Notification | `id`, `recipientId`, `type`, `title`, `body`, `link`, `createdAt`, `status` (`unread` / `read`) |
| AdminAuditLog | `id`, `actorId`, `action`, `targetUserId`, `metadata`, `createdAt` |

---

## 3. Relationships between entities

```
User 1──1 LearnerProfile | MentorProfile
Learner ──* Mentor Application *── Mentor
Application (accepted) ── creates ── Mentorship Relationship
Relationship 1──* Message
Relationship 1──0..1 Learning Contract
Contract 1──0..1 Goal (+ goalHistory)
Contract 1──* Objective
Contract 1──* Milestone
Milestone 1──0..1 Evidence (embedded)
Contract 1──0..1 Deliverable
Deliverable (completed) ── copies ── DeliverableRef on both profiles
Completed contract ── upserts ── Showcase (`showcases/{contractId}`)
DeliverableRef ── points at ── Showcase
```

Foreign keys already on documents:

- Application / relationship / contract: `learnerId`, `mentorId`
- Contract / message: `relationshipId`
- DeliverableRef: `contractId`

---

## 4. Legacy compatibility decisions

These are binding. See also the report at the bottom of this file.

1. **Collections are not renamed.** `mentorshipApplications`, `mentorshipRelationships`, `learningContracts`, `learnerProfiles`, `mentorProfiles`, `users`, `messages` stay as-is.
2. **`learnerId` stays.** No `apprenticeId` field, alias column, or dual-write.
3. **Type names `MentorshipApplication` and `MentorshipRelationship` stay** so existing imports compile. `MentorApplication` is an alias only.
4. **`shared/types.ts` remains a compatibility barrel.** Old `from './types.js'` / `@apprentorbay/shared` imports still work.
5. **`COLLECTIONS` keys and values are unchanged.** Planned names live in `RESERVED_COLLECTIONS` so live code cannot target them by accident.
6. **`Mentorship` / `MentorshipStatus` / `mentorships` are legacy.** Types remain, marked deprecated. No writes.
7. **`LearningContractStatus.agreed` remains in the union** because existing TypeScript and `journeyStepIndex` already treat it. The machine still does not write it. `LEARNING_CONTRACT_TRANSITIONS` documents `agreed → in_progress` for a future signing step.
8. **Showcase is not a new collection.** It is derived from profile `deliverables`.
9. **Notification types do not create documents.** Admin audit logs and support issues are written by the server. Existing users are unaffected.
10. **Evidence stays on the milestone.** No `evidence` collection.
11. **Learning Goal Builder is a view**, not a document.
12. **Firestore rules and routes are unchanged** by this work.
13. **Persisted status strings are unchanged** (`pending`, `active`, `in_progress`, `under_mentor_review`, …). Only TypeScript access moved to const objects (`APPLICATION_STATUS.pending`, etc.).
14. **Relationship domain transition is one-way** (`active → ended`). Rules still allow `ended → active`; the domain map does not, so new product code should not reactivate.

---

## 5. Status definitions

All values live in `shared/domain/statuses.ts`. Use the const objects; do not repeat raw strings in new code.

| Vocabulary | Const | Values |
| --- | --- | --- |
| Account role | `USER_ROLE` | `learner`, `mentor`, `admin` |
| Account governance | `ACCOUNT_STATUS` | `active`, `restricted`, `suspended`, `terminated` |
| Mentor approval | `VERIFICATION_STATUS` | `pending`, `approved`, `rejected`, `suspended` |
| Mentor verification case | `VERIFICATION_CASE_STATUS` | `not_submitted`, `submitted`, `under_review`, `verified`, `partially_verified` |
| Support issue | `SUPPORT_ISSUE_STATUS` | `open`, `in_progress`, `resolved` |
| Application | `APPLICATION_STATUS` | `pending`, `accepted`, `declined` |
| Relationship | `RELATIONSHIP_STATUS` | `active`, `ended` |
| Contract | `LEARNING_CONTRACT_STATUS` | `draft`, `under_mentor_review`, `under_learner_review`, `agreed` (unused write), `in_progress`, `completed` |
| Step owner | `STEP_OWNER` | `learner`, `mentor` |
| Milestone | `MILESTONE_STATUS` | `locked`, `active`, `submitted`, `approved`, `rejected` |
| Deliverable | `DELIVERABLE_STATUS` | `draft`, `in_progress`, `completed` |
| Notification | `NOTIFICATION_STATUS` | `unread`, `read` |
| Legacy pairing | `LEGACY_MENTORSHIP_STATUS` | `pending`, `active`, `paused`, `completed`, `declined` |

Type guards: `isUserRole`, `isApplicationStatus`, `isRelationshipStatus`, `isLearningContractStatus`, `isMilestoneStatus`, `isDeliverableStatus`, `isVerificationStatus`, `isStepOwner`.

---

## 6. Allowed state transitions

Implemented in `shared/domain/transitions.ts`. Contract *behavior* remains `reduceContract` in `learningContractMachine.ts` — the tables below are the domain map of what that machine (or the pairing flow) allows.

### Mentor approval (`verificationStatus`)

```
pending → approved | rejected | suspended
approved → rejected | suspended
rejected → approved | pending
suspended → approved | rejected
```

Verification cases (`verificationCaseStatus`) are a separate evidence process and are not this map. See `ADMINISTRATION_SYSTEM.md`.

### Mentor application

```
pending → accepted
pending → declined
accepted → (terminal)
declined → (terminal)
```

Re-apply after decline is a **new document** today (not a transition).

### Mentorship relationship

```
active → ended
ended → (domain terminal)
```

### Learning contract (what the machine writes)

```
draft → under_mentor_review          SEND_TO_MENTOR
under_mentor_review → under_learner_review   SEND_TO_LEARNER
under_learner_review → under_mentor_review   REQUEST_CHANGES
under_learner_review → in_progress   APPROVE_PLAN  (skips agreed)
in_progress → completed              last APPROVE_MILESTONE
agreed → in_progress                 reserved; not dispatched
```

UI stepper (`LEARNING_JOURNEY_STEPS`) still has five visible steps; `agreed` maps to the same index as `in_progress`.

### Milestone

```
locked → active          plan approved / previous approved
active → submitted       SUBMIT_EVIDENCE
submitted → approved     APPROVE_MILESTONE
submitted → rejected     REJECT_MILESTONE
rejected → submitted     SUBMIT_EVIDENCE
approved → (terminal)
```

### Deliverable

```
draft → in_progress      APPROVE_PLAN
in_progress → completed  last milestone approved
```

---

## Helpers (where to look)

| Concern | Module |
| --- | --- |
| Roles, `learnerId` field | `domain/identities.ts` |
| Status const objects + guards | `domain/statuses.ts` |
| Live vs reserved collections | `domain/collections.ts` |
| Pairing membership, other party | `domain/relationships.ts` |
| Apply / accept / start journey / admin | `domain/permissions.ts` |
| Message, evidence, plan validation | `domain/validation.ts` |
| Transition tables | `domain/transitions.ts` |
| Goal builder view | `domain/learningContracts.ts` |
| Showcase projection | `domain/showcases.ts` |
| Contract reducer (unchanged behavior) | `learningContractMachine.ts` |

---

## Compatibility decision log

Recorded for reviewers. Every item was chosen to keep production data and the working signup → apply → accept → chat → journey path intact.

1. Domain lives in **`shared/domain/`**, not a new `src/domain/` tree and not a new package — this repo already uses `@apprentorbay/shared` as the single source of truth.
2. **No collection renames, no data migration, no dual-write.** Compatibility is TypeScript-level (barrel + aliases), not Firestore-level.
3. Public “Apprentice/Learner” is a **label constant**, not a second role.
4. **`MentorApplication` alias** satisfies the required entity name without changing the persisted type or collection.
5. **Showcase / Notification / Admin Audit Log** are modeled now so later features do not invent a second vocabulary; they do not write.
6. Call sites that **compared or wrote** statuses (`repository`, journey UI, admin API, auth, header) now use the const objects. Values written to Firestore are the same strings as before.
7. Permission helpers encode **product intent** (approved mentor, learner-only apply, learner-only start journey). They are available for new code; this change does not replace Firestore rules.
8. Existing tests (`learningContractMachine`, `isAccountActive`, terms) stay; `domain.test.ts` covers identities, transitions, permissions, and showcase projection.
