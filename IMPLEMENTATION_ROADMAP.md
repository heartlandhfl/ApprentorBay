# ApprentorBay Implementation Roadmap

**Companion to:** `ARCHITECTURE_AUDIT.md`  
**Constraint:** Do not rewrite the application. Do not change the stack. Do not globally rename `learnerId`, collections, or the Learning Journey / learning contract dual naming.  
**Canonical names for new work:** learner / mentor / mentorshipApplication / mentorshipRelationship / learningContract (data) / Learning Journey (UI). See audit §5.4.

This roadmap is ordered by dependency and risk, not by calendar time. Each item is sized by **how many subsystems it touches** and classified **CRITICAL / HIGH / MEDIUM / LOW**.

---

## Principles

1. Keep the spine: Discover (directory) → Apply → Accept → Relationship → Messages → `POST /api/contracts` → `reduceContract` → publish `DeliverableRef`.
2. Keep **learning contract writes on Express + Admin SDK**. Do not open `learningContracts` to client writes.
3. Prefer **tightening Firestore rules** and **moving pairing mutations to Express** over adding collections.
4. Treat `mentorships` / `Mentorship` / `MentorshipStatus` as dead. Do not populate them.
5. Do not introduce `apprenticeId` or a “Learning Agreement” type.
6. Ship security and read-rule fixes before new product surfaces that depend on ended pairings or uploads.

---

## Phase 0 — Stop the bleeding

**Goal:** Unauthorized pairing and dead write surfaces cannot be used. Existing happy path still works.

| ID | Issue | Class | Subsystems | Done when |
| --- | --- | --- | --- | --- |
| P0-1 | Relationship create is open to any signed-in user as `mentorId` | CRITICAL | `firestore.rules`, likely `server/routes` + `client/features/mentorship` | Client **cannot** create `mentorshipRelationships` except via a trusted path. Accept still creates exactly one `active` row for that learner+mentor. |
| P0-2 | Orphan `/mentorships/{id}` rules allow create/update | CRITICAL | `firestore.rules`, later `shared/types.ts` | Rules deny all access (or delete match). App behavior unchanged. |
| P0-3 | Application create does not require an approved, living mentor | CRITICAL | `firestore.rules` | Create fails unless `mentorProfiles.verificationStatus == 'approved'` and the mentor user is active (if you also `get` `users/{mentorId}`). UI already hides the button. |

### Recommended design for P0-1 (do not invent a second pairing model)

**Preferred:** `allow create: if false` on `mentorshipRelationships`. Add `POST /api/applications/:id/accept` (and decline) using the same Admin transaction the client already performs. Mentor-only, application pending, no existing active pair (inside the transaction).

**Acceptable interim:** Keep client create but require `get(users/auth).role == 'mentor'`, mentor profile approved, learner profile exists, and a pending application for that pair. Weaker than server accept; still closes the “any account forges a pairing” hole.

**Do not:** Start writing `mentorships`. Do not add `apprenticeId`.

### Phase 0 verification

- Shared tests still pass (`npm test`).
- Manual: learner apply → mentor accept → chat → start journey still works.
- Negative: signed-in learner cannot `setDoc` a relationship with themselves as mentor.
- Negative: learner cannot apply to a `pending` mentor profile via the SDK.

---

## Phase 1 — Make the existing spine durable

**Goal:** The implemented journey still works after a pairing ends, profiles are trustworthy, applications are unique, evidence policy is explicit.

| ID | Issue | Class | Subsystems | Done when |
| --- | --- | --- | --- | --- |
| P1-1 | Ended relationships cannot **read** messages or list contracts | HIGH | `firestore.rules` | `isPairingMember` (not only active) for **reads**. Writes (new message, start contract) still require `active`. Journey page loads for members after `ended`. |
| P1-2 | Owner can write `deliverables` / `reviews` / `userId` | HIGH | `firestore.rules` | Profile update cannot change `userId`. `deliverables` and `reviews` unchanged unless Admin SDK. |
| P1-3 | Duplicate pending applications | HIGH | Express and/or doc-id scheme + client | At most one `pending` application per learner+mentor. Re-apply after decline is defined (reuse doc vs new doc). |
| P1-4 | Accept race (check outside transaction) | HIGH | Same as P0-1 if accept moves to server | Two concurrent accepts cannot create two relationships. |
| P1-5 | Profile editor missing | HIGH | New small feature under `client/features/profiles`, owner `updateDoc` | Learner can edit education, job status, aspirations, competency goals. Mentor can edit education, experience, expertise. Verification still admin-only. |
| P1-6 | Evidence is unvalidated text/URL; Storage unused | HIGH | Machine (fields stay), Journey UI, optionally Storage + emulator | **Decision recorded in code comments / this file:** either (A) http(s) URL + text only, `finalEvidenceUrl` copied onto `DeliverableRef`, or (B) private Storage path `/evidence/{relationshipId}/{milestoneId}/…` with rules for pairing members, emulator added to `firebase.json`. Do not use `/portfolios` for evidence. |
| P1-7 | Contract action body unvalidated | MEDIUM | `server/routes/contracts.ts` | Unknown `type` → 400 `invalid`. No 500 on `undefined` switch. |

### P1-6 decision guide

- If the next increment must support photos of shop work only, (B) with the existing image MIME allowlist is enough — but put objects under a **private** prefix, not `/portfolios`.
- If evidence is “link to a repo / photo host”, do (A) first. It is smaller and matches current `evidenceLink`.
- Do not block P1-1–P1-5 on Storage.

### Phase 1 verification

- End a relationship (admin console or a temporary admin/test control) → both members still **read** history; neither can send.
- Profile owner cannot `update` `deliverables` in the emulator rules tester.
- Second pending apply is rejected.
- Shared machine tests unchanged unless `DeliverableRef` shape grows (then update publish + types together).

---

## Phase 2 — Finish the blueprint stages the model already implies

**Goal:** CONNECT, CONTRACT, REVIEW, COMPLETE, SHOWCASE become completable without a new framework.

| ID | Issue | Class | Subsystems | Done when |
| --- | --- | --- | --- | --- |
| P2-1 | No in-app (or email) ping when someone must act | HIGH | New `notifications` collection **or** Cloud Function + thin inbox UI | Learner sees “application pending/accepted/declined”. Mentor sees new application. Both see “waiting on you” for the journey. Email is optional in this phase. |
| P2-2 | `agreed` is a zombie status | HIGH | `shared/types.ts`, machine, Journey UI, tests | **Either** learner `APPROVE_PLAN` → `agreed` and mentor `CONFIRM_START` → `in_progress`, **or** remove `agreed` from the union and stepper mapping. Pick one in the PR description. |
| P2-3 | Learner has no application inbox | MEDIUM | New route e.g. `/dashboard/applications` for learners (mentor route already exists) | Learner lists their applications and deep-links to the mentor profile or chat. |
| P2-4 | No end-relationship control | MEDIUM | UI + rules from P1-1 | Either party can set `ended`. Chat compose hides (already does). Journey remains readable. |
| P2-5 | Completion does not close the pairing | MEDIUM | `publishDeliverableRefs` or a new effect | Product choice: (1) leave chat open, or (2) set relationship `ended` on last approve, or (3) add `completed` to `RelationshipStatus`. If (3), update rules, indexes, and `watchActiveRelationships`. Prefer (1) or (2) over a third status unless chat-after-complete is required. |
| P2-6 | Showcase is title-only | MEDIUM | `DeliverableRef`, `publishDeliverableRefs`, profile pages | Public profile shows description + safe evidence URL or “completed {date}”. Members get a link to the journey. No new showcase framework. |
| P2-7 | Pending mentor URL is fully public | MEDIUM | Signup default `public: false` until approve, or profile page gating | Unapproved mentors are not world-readable unless they opt in. Directory behavior unchanged. |
| P2-8 | Password reset / email verification | MEDIUM | Firebase Auth + 1–2 routes | Forgotten password is recoverable. Optional: block sensitive actions until email verified (do not block Terms/login). |
| P2-9 | Terms page redirects accepted users | MEDIUM | `TermsPage` | `/legal/terms` is readable while logged in. `TermsGate` still blocks outdated versions. |
| P2-10 | Header / landing IA | LOW | `Header`, `LoginPage` | After login, mentors → applications or messages; learners → messages or mentors. Journey remains entered from the relationship (keep the single start button). |

### Notifications (P2-1) — keep it small

Suggested document (do not over-model):

```
notifications/{id}
  recipientId, type, title, body, link, createdAt, read
```

Types: `application_received`, `application_accepted`, `application_declined`, `message` (optional, noisy), `journey_waiting`.

Rules: recipient read/update `read`; create **only** via Admin SDK / Functions. Client must not write notifications.

If Cloud Functions are not in the project yet, write notifications from the **Express accept/contract** paths first, and from a later Function for client-written messages.

---

## Phase 3 — Hardening, cleanup, scale

**Goal:** Debt that will hurt the next feature, not the current demo.

| ID | Issue | Class | Subsystems | Done when |
| --- | --- | --- | --- | --- |
| P3-1 | Delete unused `Mentorship` / `MentorshipStatus` exports | LOW | `shared/types.ts`, `shared/index.ts` | After P0-2 has been in production rules. Grep is clean. |
| P3-2 | Empty `client/features/admin` | LOW | delete barrel | No empty module. |
| P3-3 | Duplicate `requireAccount` / `requireAdmin` token parse | LOW | `server/middleware` | One `requireAuth` + role check. |
| P3-4 | Admin full-collection scans | MEDIUM | `server/routes/admin.ts` | Paginated accounts; stats via aggregations or counters incremented on accept/complete. |
| P3-5 | Firestore rules tests | HIGH (quality) | emulator + `@firebase/rules-unit-testing` | Automated cases for P0 and P1-1/P1-2. |
| P3-6 | Express contract tests | MEDIUM | server test harness | Create + illegal action + publish effect (emulator). |
| P3-7 | README / How It Works copy | LOW | docs + `HowItWorks.tsx` | Server routes listed. Journey vs contract explained. Four marketing steps do not contradict the machine. |
| P3-8 | Placeholder Terms of Use | MEDIUM | `shared/legal/terms.ts` | Counsel text + `TERMS_VERSION` bump (gate will fire). |
| P3-9 | Mentor “Goals” stub | LOW | `MentorProfilePage` | Bound to data or removed. |
| P3-10 | Rate limits | LOW | Express and/or App Check | Apply/message/action cannot be trivial to flood. |
| P3-11 | Optional custom claims | LOW | seed + signup Cloud Function | Rules can use `request.auth.token.role` instead of `get(users)`. Only if `get(users)` cost becomes an issue. |
| P3-12 | CI | LOW | GitHub Actions | `npm test` + `npm run build` on PR. |
| P3-13 | `approvePlan` in-place `sort` / `actionableMilestone` order | LOW | machine | Reducer is pure; active milestone is the lowest `order` in the allowed statuses. |
| P3-14 | Reviews | MEDIUM | later feature | Only after P1-2 (server write). Not a Phase 0–2 blocker. |

---

## Explicitly out of scope

| Temptation | Why not |
| --- | --- |
| New framework / Next.js / tRPC rewrite | Spine already works in Vite + Express + Firestore. |
| Renaming `learnerId` → `apprenticeId` | No `apprenticeId` exists. Role is learner. Marketing may say apprenticeship. |
| Renaming `learningContracts` → `learningJourneys` or `agreements` | Collection + machine + API already say contract. UI may say Journey. |
| Client-writable contracts | Bypasses the only solid invariant in the app. |
| Reviving `mentorships` | Conflicts with applications + relationships. |
| Public Storage evidence | `/portfolios` is world-readable. |
| Building Showcase as a separate product | Extend `DeliverableRef` + profiles first. |
| Notifications as a new SaaS before an in-app list | Express/Functions writes are enough. |

---

## Dependency graph

```
P0-1 (lock relationship create)
  └─ P0-3 (approved mentor on apply)  [parallel]
  └─ P0-2 (deny mentorships)          [parallel]
        └─ P3-1 (delete unused types)

P0-1 ──► P1-3 / P1-4 (unique apply + atomic accept)

P1-1 (ended reads) ──► P2-4 (end UI) ──► P2-5 (complete vs end)

P1-2 (lock profile arrays) ──► P1-5 (editor)
                             └─ P2-6 (richer DeliverableRef)
                             └─ P3-14 (reviews)

P1-6 (evidence policy) ──► P2-6 (showcase)

P2-1 (notifications) can start after P0; richer if accept/contract are already on Express

P2-2 (agreed) independent; do it before more machine features
```

---

## Mapping to the required lifecycle

| Lifecycle stage | First roadmap IDs that make it complete |
| --- | --- |
| DISCOVER | Already works for approved mentors; P1-5 (real profiles), P2-7 (hide unverified URLs) |
| CONNECT | Exists; P0-3, P1-3, P2-1, P2-3 |
| RELATIONSHIP | Exists; P0-1, P1-1, P2-4, P2-5 |
| PROPOSE | Exists; P1-5 if goals should come from the profile |
| NEGOTIATE | Exists (request changes); P2-1 so the other party sees it |
| CONTRACT | P2-2 |
| EXECUTE | Exists |
| EVIDENCE | P1-6 |
| REVIEW | Exists; P2-1 |
| COMPLETE | Exists; P2-5 |
| SHOWCASE | P2-6 (after P1-2 / P1-6) |

---

## Suggested PR slices (keep diffs reviewable)

1. **Rules-only:** P0-2 + P0-3 + P1-1 + P1-2 (if still client-created relationships, include the interim P0-1 rule tighten).
2. **Server accept/decline:** P0-1 preferred + P1-3 + P1-4 + P1-7.
3. **Profile editor:** P1-5.
4. **Evidence policy:** P1-6 (one decision).
5. **Machine: `agreed` or delete it:** P2-2 + tests.
6. **Notifications v1:** P2-1 on Express paths.
7. **Learner inbox + Terms + auth recovery:** P2-3, P2-8, P2-9, P2-10.
8. **Showcase fields + end relationship:** P2-4, P2-5, P2-6.
9. **Cleanup and tests:** Phase 3.

Each PR should run `npm test` and `npm run build`. Add rules unit tests starting with slice 1 if the emulator harness is cheap; otherwise slice 9.

---

## Current test/build commands (do not replace)

```bash
npm test          # shared machine, account, legal
npm run typecheck
npm run build     # shared → client → server
npm run dev       # emulators + Vite + API
```

There is no client/server/rules test script yet. Add them in Phase 3; do not block Phase 0 on a new test framework beyond what the repo already uses (Node test runner + eventual Firebase rules unit testing).

---

*When implementing, update this file only if a phase decision changes (especially P1-6 evidence and P2-2 `agreed`). Do not tick boxes here instead of shipping code.*
