# ApprentorBay Architecture Audit

**Date:** 2026-09-01  
**Scope:** Existing codebase on `main` (`f1fc440` and ancestors). No product rewrite. No stack change.  
**Method:** Full-repo inspection of project structure, routes, shared types, client features, Express routes, Firestore/Storage rules, indexes, and tests. No live Firebase project was queried; collection shapes are taken from `shared/types.ts` and the write paths that populate them.

This document is an inventory and gap analysis. It does **not** implement features. Naming is described, not globally renamed.

---

## 1. Existing Architecture

### 1.1 What the application is

ApprentorBay is a **mentorship pairing product**, not a social feed. The implemented core is:

1. A learner finds a **verified public mentor**.
2. The learner **applies** with a short message.
3. The mentor **accepts** (or declines). Accept creates a **private relationship**.
4. The pair **messages** in real time.
5. The learner **starts a Learning Journey**, which creates a **learning contract**.
6. The pair negotiate a goal, objectives, milestones, and a deliverable through a **server-enforced state machine**.
7. The learner submits **text evidence** (optional URL) against **one active milestone**.
8. The mentor reviews. The last approval **completes** the contract and **copies a deliverable title/description onto both public profiles**.

That path exists as code. Several later stages (file evidence, notifications, email, profile editing, a real showcase, relationship end/pause) are missing or only sketched in types.

### 1.2 Technology stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Client | React 19, Vite 7, Tailwind 4, React Router 7 | SPA in `/client` |
| Server | Express 5, TypeScript, `tsx` in dev | `/server`; production serves `client/dist` |
| Shared | TypeScript package `@apprentorbay/shared` | Types + contract reducer + legal version |
| Auth | Firebase Auth (email/password) | Client SDK + Admin token verify |
| Database | Cloud Firestore | Client reads/writes most pairing data; Admin SDK for contracts and admin |
| Storage | Rules file only | **No client or server Storage SDK usage** |
| Local | Auth + Firestore emulators | Storage emulator is **not** configured |
| Analytics | Umami script in `client/index.html` | Third-party, not product telemetry |
| Tests | Node test runner on **shared** only | No client, server, or rules tests |
| CI | None in repo | No GitHub Actions / other pipeline files |

The stack is appropriate for the current product. Changing framework or moving off Firebase is **not** justified.

### 1.3 Repository layout

```
/client                  React SPA
  /components            Presentational UI (Page, Header, forms, table, stepper)
  /features
    /profiles            Public profile reads + mentor directory query
    /mentorship          Applications, relationships, messages
    /learning-contracts  Contract watch + "Start Learning Journey" entry
    /admin               Empty barrel (`export {}`) — leftover
  /lib                   firebase.ts, auth.tsx, api.ts
  /routes                One file per page
/server
  /routes                health, admin, contracts
  /middleware            requireAccount, requireAdmin, errorHandler
  /lib                   Admin Firebase + emulator admin seed
/shared                  types, learningContractMachine, legal
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
```

npm workspaces: `client`, `server`, `shared`. Root `npm run build` typechecks/builds all three.

### 1.4 Runtime architecture

```
Browser (React)
  ├─ Firebase Auth          email/password; emulator optional
  ├─ Cloud Firestore        users, profiles, applications, relationships, messages
  │                         learningContracts: read-only for clients
  └─ Express /api           Bearer ID token
        ├─ /api/health
        ├─ /api/admin/*     role === admin (Firestore user doc)
        └─ /api/contracts   start journey + dispatch machine actions
              └─ Admin SDK writes learningContracts (rules: create/update/delete = false)
```

**Split of authority**

| Concern | Who writes | Who reads |
| --- | --- | --- |
| Signup user + profile | Client transaction | Owner / admin / public profiles |
| Mentorship application | Client | Pairing members / admin |
| Relationship | Client (mentor on accept) | Pairing members / admin |
| Messages | Client | Active relationship members only |
| Learning contract | **Express + Admin SDK only** | Pairing members / admin (read) |
| Mentor verification | Express admin | Public if `public == true` |
| Account suspend | Express admin | Affects `users.active` + profile `public` |
| Deliverable publish | Express on last milestone approve | Profile arrays |

This split is the most important architectural decision in the repo: **the learning contract is not a client-writable document**. The shared reducer (`reduceContract`) is the single transition function. That is sound and should be preserved.

### 1.5 Routing

| Path | Guard | Page |
| --- | --- | --- |
| `/` | Public | Home + How It Works excerpt |
| `/how-it-works` | Public | Same How It Works component, featured |
| `/signup` | Public (redirect if signed in) | Role → Terms → details |
| `/login` | Public (redirect if signed in) | Email/password |
| `/legal/terms` | Public, but **signed-in users who already accepted are redirected home** | Terms body |
| `/learners/:id` | Public (rules: `public` or owner/admin) | Learner profile |
| `/mentors` | Public | Approved + public mentors |
| `/mentors/:id` | Public if profile readable | Mentor profile + apply |
| `/admin` | `RequireAdmin` + server | Stats, pending mentors, suspend/restore |
| `/admin/verification` | `RequireAdmin` | **Redirects to `/admin`** |
| `/dashboard/applications` | `RequireAuth role="mentor"` | Pending applications |
| `/dashboard/messages` | `RequireAuth` | Active relationships inbox |
| `/dashboard/messages/:relationshipId` | `RequireAuth` + membership | Chat + journey entry |
| `/dashboard/journey/:relationshipId` | `RequireAuth` + membership | Contract stepper |
| `*` | — | Navigate to `/` |

There is no learner applications inbox, no profile editor, no settings, no password-reset route, no dedicated showcase route, no notifications route.

### 1.6 Authentication and roles

**Roles** (`UserRole`): `mentor` | `learner` | `admin`.

- Signup allows only `learner` | `mentor`. Firestore create rules reject `admin`.
- Admin accounts are created by `server/lib/seedAdmin.ts` (emulator/local). Role cannot be changed later via client rules (`request.resource.data.role == resource.data.role`).
- Role lives on `/users/{uid}.role`. **Firebase custom claims are not used.** Client route guards are UX only. Real enforcement is Firestore rules + Express `requireAccount` / `requireAdmin`.
- One role per user, set at signup. No dual-role accounts.
- `active: false` is treated as suspended: Auth snapshot signs the user out; login refuses; Express returns `403 suspended`; admin hide the public profile.

**Auth flow**

1. `createUserWithEmailAndPassword` then a Firestore transaction writing `users/{uid}` and either `learnerProfiles/{uid}` or `mentorProfiles/{uid}`.
2. If the transaction fails, the Auth user is deleted (best-effort).
3. Mentors always start `verificationStatus: 'pending'`.
4. Terms version is stored on the user. `TermsGate` blocks the app (non-dismissible modal) when `termsVersion` ≠ current `TERMS_VERSION`.

**Not implemented:** email verification, password reset UI, OAuth, custom claims, session revocation beyond sign-out, MFA.

### 1.7 Learning Journey / contract machine

Canonical implementation: `shared/learningContractMachine.ts`.

UI steps (`LEARNING_JOURNEY_STEPS`): `draft` → `under_mentor_review` → `under_learner_review` → `in_progress` → `completed`.

Type-level status also includes `agreed`. **Nothing ever writes `agreed`.** `APPROVE_PLAN` jumps from `under_learner_review` to `in_progress`. `journeyStepIndex('agreed')` maps to the same stepper index as `in_progress`.

Actions: `SAVE_DRAFT`, `SEND_TO_MENTOR`, `SAVE_MENTOR_REVIEW`, `SEND_TO_LEARNER`, `APPROVE_PLAN`, `REQUEST_CHANGES`, `SUBMIT_EVIDENCE`, `APPROVE_MILESTONE`, `REJECT_MILESTONE`.

Rules encoded in the machine (and covered by shared tests):

- One step owner at a time (`currentStepOwner`).
- Admins cannot act on the machine (`isStepActor` is false for admin).
- One milestone intended to be `active` at a time (enforced on approve/start; `actionableMilestone` picks the first matching status, not necessarily by `order`).
- Last milestone approval emits `publish_deliverable_refs`.
- Goal revisions append the previous goal to `goalHistory`.

Server endpoints:

- `POST /api/contracts` — learner only; requires an **active** relationship they belong to; idempotent if a contract already exists.
- `POST /api/contracts/:id/action` — any authenticated non-admin learner/mentor; machine checks uid/role against the document.

### 1.8 Client data access

Repositories use Firestore `onSnapshot` queries:

| Function | Collection | Query |
| --- | --- | --- |
| `watchApprovedMentors` | `mentorProfiles` | `verificationStatus == approved` AND `public == true` |
| `watchPairing` | applications + relationships | learnerId + mentorId (+ relationship `status == active`) |
| `watchPendingApplications` | applications | mentorId + `status == pending` |
| `watchActiveRelationships` | relationships | learnerId **or** mentorId + `status == active` |
| `watchMessages` | messages | relationshipId + `orderBy createdAt` |
| `watchContractForRelationship` | learningContracts | relationshipId, `limit(1)` |

Indexes in `firestore.indexes.json` cover those composite queries **except** `learningContracts.relationshipId`, which is a single-field equality and uses the automatic index.

### 1.9 What is *not* in the architecture (but types hint at)

- Collection `mentorships` appears in **Firestore rules only**. No `COLLECTIONS` entry, no client/server writes. Parallel unused type: `Mentorship` + `MentorshipStatus`.
- `Review[]` on mentor profiles — no write UI or API.
- Learner `competencyGoals`, `education` — written empty (or not at all) after signup; no editor.
- Firebase Storage paths `/users/{uid}/**` and `/portfolios/{uid}/**` — unused.
- `Deliverable.finalEvidenceUrl` is filled on completion from the last milestone link/text; **not** copied onto public `DeliverableRef`.

---

## 2. Existing Features

Status key:

- **WORKING** — implemented end-to-end in UI + data + rules/server, with no known blocker in code.
- **PARTIALLY WORKING** — exists but incomplete, unusable in an important case, or only a stub.
- **BROKEN** — present but cannot complete its intended job.
- **MISSING** — required by the product lifecycle or named in types/rules, but no product path.
- **UNKNOWN** — cannot be confirmed without a live project or emulator run of that path.

| Feature | Status | Evidence |
| --- | --- | --- |
| Public home / How It Works | WORKING | `HomePage`, `HowItWorks`, `/how-it-works` |
| Signup (role + terms + profile create) | WORKING | `SignupPage` + `auth.signUp` transaction + rules |
| Login / logout | WORKING | Email/password; suspended accounts rejected |
| Terms gate + version bump | WORKING | `TermsGate`, `needsTermsAcceptance`; legal tests |
| Re-read Terms while already accepted | BROKEN | `TermsPage` redirects accepted users to `/` |
| Password reset / email verification | MISSING | No routes, no Auth calls |
| Role model (learner / mentor / admin) | WORKING | Types, signup, guards, rules, seed admin |
| Public mentor directory + search | WORKING | Client-side filter on approved+public mentors |
| Public mentor profile | WORKING | Readable when `public`; apply CTA |
| Public learner profile | PARTIALLY WORKING | Read works; most fields stay empty (no editor) |
| Profile editing after signup | MISSING | No `updateDoc` on profiles except admin `public` |
| Mentor verification (admin) | WORKING | `/api/admin/mentors/.../verification` + Admin UI |
| Apply for mentorship | WORKING | Learner-only; rules require learner role + pending + message |
| Mentor application inbox | WORKING | `/dashboard/applications` |
| Learner outbound application list | MISSING | Status only visible on that mentor’s profile |
| Duplicate-application prevention | MISSING | Rules and `createApplication` allow multiple pending rows |
| Accept → relationship + chat | WORKING | Transaction updates application + creates relationship |
| Decline application | WORKING | Status `declined`; learner can apply again in UI |
| Relationship create only via accept | BROKEN (security) | Rules allow **any signed-in user** to create a relationship as `mentorId` |
| End / pause relationship | MISSING | Status `ended` exists; no UI; `paused` only on unused `MentorshipStatus` |
| Real-time messaging | WORKING | Snapshot query + `sendMessage`; 2000-char cap |
| Messages after relationship ended | BROKEN | Rules require `status == active` for read **and** write |
| Start Learning Journey | WORKING | Learner-only button on relationship page; `POST /api/contracts` |
| Mentor starting a journey | MISSING (by design) | Server returns 403; UI waits on learner |
| Contract draft / send to mentor | WORKING | Machine + Journey UI |
| Mentor plan (objectives + milestones) | WORKING | `MentorEditor` |
| Learner approve / request changes | WORKING | `LearnerReview` |
| Explicit “agreed / signed contract” step | MISSING | `agreed` status unused; approve starts execution |
| Sequential milestone execution | WORKING | Shared tests walk submit/reject/approve/complete |
| Evidence as file upload | MISSING | Text + optional URL only; Storage unused |
| Evidence as Storage object | MISSING | `storage.rules` exist; no SDK |
| Mentor milestone review | WORKING | Approve / reject with required feedback |
| Completion + profile deliverable refs | PARTIALLY WORKING | Server `arrayUnion` title/description; **no evidence URL** on profiles |
| Dedicated showcase / portfolio gallery | MISSING | Only lists on profile cards |
| Mentor reviews | MISSING | `Review` type + empty UI; no write path |
| In-app notifications | MISSING | No collection, no UI, no triggers |
| Transactional email | MISSING | No mailer, no Auth email templates in app |
| Admin stats | PARTIALLY WORKING | Full collection scans; fine for demo, not for scale |
| Admin account suspend/restore | WORKING | Sets `active` + profile `public` via Admin SDK |
| Admin verification **page** (`/admin/verification`) | WORKING (deprecated) | Immediate redirect to `/admin` |
| Firebase Storage | MISSING (product) | Rules only |
| `mentorships` collection | MISSING (dead) | Rules without app writes |
| Header navigation for journey | PARTIALLY WORKING | Journey only reachable from a conversation |
| Empty `features/admin` module | UNKNOWN / dead | `export {}` |
| Emulator admin seed | WORKING | Default `admin@apprentorbay.test` |
| Shared contract unit tests | WORKING | `learningContractMachine.test.ts` |
| Client/server/rules tests | MISSING | — |
| Firestore emulator in `npm run dev` | WORKING (config) | Auth + Firestore; Storage omitted |

---

## 3. Blueprint Gap Analysis

Required lifecycle:

**DISCOVER → CONNECT → RELATIONSHIP → PROPOSE → NEGOTIATE → CONTRACT → EXECUTE → EVIDENCE → REVIEW → COMPLETE → SHOWCASE**

Compared to the implemented path (How It Works in the product is a **four-step** marketing summary: Find a mentor → Form a pairing → Write the contract → Ship a deliverable).

| Stage | Required meaning | What exists | Gap | Verdict |
| --- | --- | --- | --- | --- |
| **DISCOVER** | Find the right mentor (and be found) | `/mentors` directory, name/expertise search, public profiles | No skill taxonomy, no availability, no learner directory, pending mentors hidden from directory but still URL-reachable if `public` | PARTIAL |
| **CONNECT** | Request + decision | Apply modal, mentor inbox, accept/decline | No learner inbox, no duplicate guard, no notify-on-apply, can apply to any mentor **profile that exists** (rules do not require `approved`) | PARTIAL |
| **RELATIONSHIP** | Durable pairing | `mentorshipRelationships` `active`/`ended`; messages | No end/pause UI; rules allow rogue relationship **creates**; ended pairings lose message **reads**; no relationship dashboard beyond chat | PARTIAL |
| **PROPOSE** | Learner states intent | Draft goal + deliverable title/description | No structured competency mapping from `learnerProfiles.competencyGoals`; no attachments | MOSTLY PRESENT |
| **NEGOTIATE** | Back-and-forth on the plan | Mentor revises goal (history), adds objectives/milestones; learner `REQUEST_CHANGES` | Negotiation is not linked to messages; no field-level comments; no version snapshot of the full plan (only goal history) | PARTIAL |
| **CONTRACT** | Binding agreement both accept | Learner `APPROVE_PLAN` | No mentor countersignature after learner approve; no `agreed` persistence; no timestamped “signed” record; legal Terms are platform ToS, not the pair’s contract | GAP (status exists, unused) |
| **EXECUTE** | Do the work in order | `in_progress`, one active milestone | No calendar, no pause, no relationship-level status sync when contract completes (relationship stays `active`) | MOSTLY PRESENT |
| **EVIDENCE** | Prove the milestone | `evidenceText` + `evidenceLink` | No upload, no MIME/size policy in product, Storage rules only allow **images** under unused paths, link is an unvalidated string | PARTIAL / WEAK |
| **REVIEW** | Mentor judges evidence | Approve / reject + feedback | No review history beyond `lastFeedback`; no appeal; no notify-on-submit | MOSTLY PRESENT |
| **COMPLETE** | Close the journey | Last approve → `completed` + profile `arrayUnion` | Relationship not marked complete; no completion ceremony; `finalEvidenceUrl` not shown on profiles | PARTIAL |
| **SHOWCASE** | Public proof of work | Deliverable title/description on both profiles | No gallery, no evidence, no permalink to the journey, no reviews of the pairing | MISSING as a product surface |

**Architectural implication:** the app is **not** a pile of disconnected forms. The pairing → messages → journey → machine → publish path is a real spine. The blueprint gaps are mostly **missing stages and missing enforcement around the spine**, not a missing spine.

---

## 4. Database Schema Audit

Source of truth: `shared/types.ts` `COLLECTIONS` plus write sites. Fields not validated by rules are still written by the client/server as shown.

### 4.1 Collections in use

#### `users/{uid}`

| Field | Type | Written by | Notes |
| --- | --- | --- | --- |
| `uid` | string | Signup / seed | Must equal doc id on create |
| `role` | `mentor` \| `learner` \| `admin` | Signup / seed | Immutable via rules |
| `email` | string | Signup / seed | Not publicly readable |
| `displayName` | string | Signup / seed | No post-signup editor |
| `active` | boolean | Signup / admin API | Missing treated as `true` (`isAccountActive`) |
| `createdAt` | ISO string | Signup / seed | |
| `termsAcceptedAt` | ISO string \| null | Signup / TermsGate | |
| `termsVersion` | string \| null | Signup / TermsGate | Compared to `TERMS_VERSION` |

Rules: owner or admin read; owner create (learner/mentor only, `active == true`, terms required); owner or admin update but **cannot change** `uid`, `role`, or `active` via client; delete denied. Suspension therefore **must** go through Admin SDK.

#### `learnerProfiles/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | string | Should equal uid; **update does not freeze it** |
| `displayName` | string | Copied at signup |
| `education` | `EducationEntry[]` | Always `[]` at signup |
| `jobStatus` | string | Optional at signup |
| `careerAspirations` | string | Optional at signup |
| `competencyGoals` | `CompetencyGoal[]` | Always `[]` at signup |
| `deliverables` | `DeliverableRef[]` | Server `arrayUnion` on complete; owner could also write |
| `public` | boolean | Default `true`; admin sets `false` on suspend |

`EducationEntry`: `id`, `institution`, `credential`, `year`  
`CompetencyGoal`: `id`, `title`, `description`  
`DeliverableRef`: `id`, `contractId`, `title`, `description` — **no URL, no date**

Rules: read if `public` or owner/admin; owner create; owner or admin update; delete denied.

#### `mentorProfiles/{uid}`

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | string | |
| `displayName` | string | |
| `expertise` | string | Optional at signup |
| `education` | `EducationEntry[]` | Always `[]` at signup |
| `experience` | `ExperienceEntry[]` | Zero or one row from “recent role” |
| `deliverables` | `DeliverableRef[]` | Same as learner |
| `reviews` | `Review[]` | Always `[]`; no writer |
| `verificationStatus` | `pending` \| `approved` \| `rejected` | Owner cannot change |
| `public` | boolean | Default `true` |

`ExperienceEntry`: `id`, `organization`, `title`, `summary`, `year`  
`Review`: `id`, `authorId`, `authorName`, `rating`, `body`, `createdAt`

Rules: read if `public` or owner/admin; create requires `verificationStatus == pending`; owner update **cannot** change verification; admin can.

#### `mentorshipApplications/{id}`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Client-generated doc id |
| `learnerId` | string | Must equal auth uid on create |
| `mentorId` | string | Must be an existing `mentorProfiles` doc |
| `message` | string | 1–1000 chars on create |
| `status` | `pending` \| `accepted` \| `declined` | Create must be `pending`; mentor may flip to accepted/declined |
| `createdAt` | ISO string | **Not required by rules** |

No unique constraint on `(learnerId, mentorId)`.

#### `mentorshipRelationships/{id}`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `learnerId` | string | Immutable on update |
| `mentorId` | string | Immutable on update; create requires `mentorId == auth.uid` |
| `status` | `active` \| `ended` | Create must be `active`; members may set either |
| `createdAt` | ISO string | Not required by rules |

No link field back to the application that created it.

#### `messages/{id}`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `relationshipId` | string | Must be an **active** pairing the sender belongs to |
| `senderId` | string | Must equal auth uid |
| `text` | string | 1–2000 chars |
| `createdAt` | ISO string | Not required by rules |

No `readAt`, no attachments, no system messages.

#### `learningContracts/{id}`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `relationshipId` | string | One contract per relationship by server convention (`limit(1)`), **not enforced in rules** (clients cannot write) |
| `learnerId` | string | |
| `mentorId` | string | |
| `status` | see below | |
| `currentStepOwner` | `learner` \| `mentor` | |
| `createdAt` / `updatedAt` | ISO string | |
| `goal` | `Goal \| null` | `id`, `text`, `revisionOf` |
| `goalHistory` | `Goal[]` | Previous goals only |
| `objectives` | `Objective[]` | `id`, `text` |
| `milestones` | `Milestone[]` | See below |
| `deliverable` | `Deliverable \| null` | See below |
| `changeRequestReason` | string \| null | |

`LearningContractStatus`: `draft` | `under_mentor_review` | `under_learner_review` | `agreed` | `in_progress` | `completed`

`Milestone`: `id`, `order`, `title`, `description`, `evidenceRequired`, `status` (`locked`|`active`|`submitted`|`approved`|`rejected`), `evidenceText`, `evidenceLink`, `lastFeedback`

`Deliverable`: `id`, `title`, `description`, `finalEvidenceUrl`, `status` (`draft`|`in_progress`|`completed`)

Rules: **get** if pairing member or admin; **list** if **active** relationship member or admin; **create/update/delete denied** to clients.

### 4.2 Collection in rules but not in the app

#### `mentorships/{mentorshipId}` (orphan)

Rules allow:

- read: pairing member or admin
- create: any signed-in user with `learnerId == auth.uid`
- update: pairing member or admin (no field lockdown)
- delete: denied

Type `Mentorship`: `id`, `learnerId`, `mentorId`, `status` (`pending`|`active`|`paused`|`completed`|`declined`), `createdAt`, `updatedAt`.

**No code writes this collection.** It is leftover from an earlier single-collection design. It is still a write surface.

### 4.3 Collections that do not exist

No `notifications`, `emails`, `reviews` (embedded only), `showcase`, `agreements`, `apprenticeships`, `evidence`, or Storage metadata collections.

### 4.4 Indexes

Declared composites:

1. `mentorshipApplications`: `mentorId` + `status`
2. `mentorshipApplications`: `learnerId` + `mentorId`
3. `mentorshipRelationships`: `learnerId` + `mentorId` + `status`
4. `mentorshipRelationships`: `learnerId` + `status`
5. `mentorshipRelationships`: `mentorId` + `status`
6. `messages`: `relationshipId` + `createdAt`
7. `mentorProfiles`: `verificationStatus` + `public`

These match current client queries. No index for `learningContracts` composites (not needed today).

### 4.5 Storage schema (rules only)

| Path | Read | Write |
| --- | --- | --- |
| `/users/{userId}/**` | Owner | Owner, image jpeg/png/webp, ≤ 5 MB |
| `/portfolios/{userId}/**` | **Anyone** | Owner, same image limits |
| everything else | Deny | Deny |

No PDF, video, or generic octet-stream — so these rules **cannot** support typical evidence files without a change. Storage emulator is not in `firebase.json`.

---

## 5. Naming Inconsistencies

### 5.1 A. What is used today

| Term | Where | Kind |
| --- | --- | --- |
| **learner** / `learnerId` | Types, rules, queries, UI, signup | Canonical identifier and role |
| **apprentice** / `apprenticeId` | **Does not exist** in code or schema | — |
| **Learner** (UI) | Signup, profiles, journey, applications | Canonical human role name |
| **Apprentice a craft** | Signup learner card copy | Marketing verb |
| **apprenticeship** | README, package description, How It Works, Terms, home badge | Product metaphor, not a collection |
| **mentor** / `mentorId` | Everywhere | Canonical |
| **Mentorship** | Button “Apply for Mentorship”; feature folder `mentorship` | Product noun for the pairing request |
| **mentorshipApplications** | Collection + type `MentorshipApplication` | Canonical request store |
| **mentorshipRelationships** | Collection + type `MentorshipRelationship` | Canonical pairing store |
| **mentorships** + type `Mentorship` | Rules + unused type only | Legacy / abandoned |
| **Learning Journey** | UI: button, page title, cards, stepper name `LEARNING_JOURNEY_STEPS` | Canonical **UX** name for the in-progress experience |
| **learning contract** / `learningContracts` | Types, server, How It Works body, machine file name | Canonical **data** name |
| **Learning Agreement** | **Does not appear** | — |
| **pairing** | How It Works, comments, error copy | Informal synonym for relationship |
| **relationship** | Routes (`:relationshipId`), fields, server | Canonical pairing id |
| **deliverable** | Contract field + profile `DeliverableRef` | Canonical completion artifact |
| **showcase** | **Does not appear** as a route or collection | Blueprint term only |

### 5.2 B. Map of usage (high signal)

- **IDs:** every pairing document uses `learnerId` + `mentorId`. Safe to treat `learnerId` as permanent.
- **Journey vs contract:** one Firestore document, two names. UI says Journey; API says `/api/contracts`; collection is `learningContracts`.
- **Mentorship vs relationship vs pairing:** three words for one thing (the accepted pair).
- **Apprenticeship:** marketing only. Dangerous only if someone creates an `apprenticeships` collection later.

### 5.3 C. Database collections that depend on current names

Do **not** rename without a migration:

- `learnerProfiles`, `mentorProfiles`
- `mentorshipApplications` (`learnerId`, `mentorId`)
- `mentorshipRelationships` (`learnerId`, `mentorId`)
- `learningContracts` (`learnerId`, `mentorId`, `relationshipId`)
- `messages` (`relationshipId`)
- Rules helper `isPairingMember()` and all indexes listed in §4.4

The unused `mentorships` collection name should **not** be revived.

### 5.4 D. Recommended canonical vocabulary (do not rename yet)

| Concept | Canonical | UI label | Do not use for new code |
| --- | --- | --- | --- |
| Person being mentored | `learner` / `learnerId` | Learner | `apprenticeId`, `apprentice` as a role |
| Person mentoring | `mentor` / `mentorId` | Mentor | — |
| Request to pair | `mentorshipApplication` | Application | “apprenticeship application” as a type |
| Accepted pair | `mentorshipRelationship` | Relationship (or “pairing” in prose) | New `mentorships` docs; `MentorshipStatus` |
| Work plan document | `learningContract` | Learning Journey (the flow), Learning contract (the artifact) | Learning Agreement |
| In-progress UX | Learning Journey | Learning Journey | A second collection |
| Finished work | `deliverable` / `DeliverableRef` | Deliverable | Showcase as a second write model until designed |
| Product metaphor | apprenticeship | Allowed in marketing | Collection / role / id |

**“Learning Agreement”** should stay unused. Introducing it would be a fourth name for the contract.

**“Mentorship”** as a *product word* can stay (Apply for Mentorship). As a *schema*, prefer Application + Relationship, not a third `mentorships` collection.

### 5.5 E. Safe legacy compatibility

| Artifact | Action |
| --- | --- |
| `learnerId` | Keep forever. No `apprenticeId` alias needed. |
| Collection names `mentorship*` / `learningContracts` | Keep. Aliasing is more dangerous than living with the names. |
| Type `Mentorship` + `MentorshipStatus` | Treat as **legacy unused**. Do not start writing it. Remove in a later cleanup after rules drop `/mentorships`. |
| Status `agreed` | Keep in the type until an explicit contract-signing step is implemented **or** delete it in the same change that documents “approve = start work”. |
| UI “Learning Journey” vs data “contract” | Safe dual naming if documented. Do not rename the collection to `learningJourneys` without a migration. |
| Marketing “apprenticeship” | Safe as copy. Never as a field name. |
| How It Works “four steps” vs machine “five steps” | Copy inconsistency only; not a data bug. |

### 5.6 Dangerous inconsistencies

1. **`Mentorship` vs `MentorshipRelationship` vs `mentorships` rules** — a future contributor will write the wrong collection. Highest naming risk in the repo.
2. **`agreed` in the type but never persisted** — queries or admin stats that filter `status == 'agreed'` will always be empty; `contractsInProgress` only counts `in_progress`.
3. **Journey vs contract vs agreement** — product conversation will fork unless §5.4 is adopted in new PRs.
4. **Relationship stays `active` after contract `completed`** — two “done” flags that disagree.
5. **How It Works “apprenticeship” vs role “learner”** — users are never stored as apprentices; support/admin language should say learner.

---

## 6. Security Risks

Severity in this section is about **exploitability in the current rules/API**, not product completeness.

### 6.1 Unauthorized writes

| Risk | Severity | Detail |
| --- | --- | --- |
| **Forge a relationship without an application** | CRITICAL | `mentorshipRelationships` create: any signed-in user may create `{ mentorId: auth.uid, learnerId: <anyone>, status: 'active' }`. Role is **not** checked. Verification is **not** checked. A learner (or a throwaway account) can impersonate a mentor pairing and then message if they are `mentorId`. They can also unlock contract **reads** for that pairing. Combined with learner-only `POST /api/contracts`, the **victim learner** could be induced to start a journey with an unverified “mentor”. |
| **Orphan `mentorships` collection** | HIGH | Create if `learnerId == auth.uid`; update if pairing member **or admin** with **no field allowlist**. Dead code, live rules. |
| **Apply to unverified / rejected mentors** | HIGH | Application create only checks `mentorProfiles/{mentorId}` exists, not `verificationStatus == approved` or `users.active`. UI hides the button; the write still works. |
| **Fake deliverables on your own profile** | HIGH | Learner (and mentor, except verification) may `update` the whole profile, including `deliverables`. Completion is not the only writer. |
| **Learner profile `userId` rewrite** | MEDIUM | Update rules do not pin `userId` / `displayName`. |
| **Spam applications** | MEDIUM | No uniqueness, no rate limit, no server path. |
| **Unvalidated contract action body** | MEDIUM | `POST /api/contracts/:id/action` casts `req.body` to `ContractAction`. Unknown `type` falls out of the switch and returns `undefined` (likely 500). Extra fields ignored. Not privilege escalation if uid checks hold. |
| **Relationship reactivate** | MEDIUM | Members may set `status` back to `active` after `ended`. |

### 6.2 Unauthorized reads

| Risk | Severity | Detail |
| --- | --- | --- |
| **Pending/rejected mentor profiles** | MEDIUM | Default `public: true`. Directory query requires approved+public, but `/mentors/:id` is readable to anyone if `public`. Rejection does not flip `public`. |
| **Portfolio Storage path** | MEDIUM (latent) | `/portfolios/{userId}/**` is world-readable. Unused today; dangerous the moment avatars/evidence land there. |
| **Ended relationship messages/contracts** | LOW (availability, not leak) | Members **lose** reads when `status != active`. Not an unauthorized read; it is an authorized-user lockout. |
| **User emails** | OK | `users` readable only by owner/admin. Display names come from public profiles. |
| **Admin list endpoints** | OK | `requireAdmin` checks Firestore role + active. |

### 6.3 Insecure or fragile queries

| Issue | Detail |
| --- | --- |
| **Admin full scans** | `GET /api/admin/stats` and `/accounts` load entire `users`, `relationships`, `contracts`. Admin-only, but will time out / cost as data grows. N+1 user fetches on pending mentors. |
| **`getPublicDisplayName`** | Sequential get of learner profile then mentor profile. Relies on `public` (or owner). If the other party’s profile is private, name falls back to `"Member"` — OK. |
| **Contract list vs get** | Client only **lists** by `relationshipId`. List rule requires an **active** relationship. Get rule allows any pairing member. Ended pairs cannot load the contract in the current client. |
| **Application list rule** | `isPairingMember()` + queries that include `learnerId` or `mentorId == auth.uid` — consistent. |
| **No query for learner’s applications by status** | Not a security bug; a product gap. |

### 6.4 Firestore rules / query mismatches

1. **`learningContracts` list vs `isActiveRelationshipMember`** — query is `where relationshipId == X`. Rule does `get(relationship)` and requires `status == active` and membership. This is internally consistent **only while the relationship stays active**. Completing a journey does not end the relationship, so the happy path still reads. Ending the relationship **breaks** the list query (permission-denied on the whole listener).
2. **`messages` same active-only rule** — same mismatch with `RelationshipStatus.ended`.
3. **`isPairingMember()` on applications** — works for get/list when the query constrains `learnerId` or `mentorId` to the caller. A query with **neither** field would fail (good).
4. **Relationship create vs product invariant** — product assumes “accept application → create relationship”. Rules do not require an accepted application. **This is the primary rules/product mismatch.**
5. **Users `active` immutable on client** — matches the design (admin API only). Not a mismatch.
6. **Missing rules for `createdAt` / `id` on several creates** — clients can omit them; not a leak.

### 6.5 Storage vulnerabilities

- Rules are deny-by-default and reasonably tight for **images**.
- **Public portfolio prefix** is a future data leak if used for evidence.
- **No Storage in emulators** — easy to ship client uploads that only work in production.
- **Evidence links** are arbitrary strings (javascript URLs, tracking URLs, huge data URIs). XSS risk is mitigated if React text-renders them (current Journey UI uses `<Text>`, not `<a href>`). The moment someone turns `evidenceLink` into a raw link, this becomes HIGH.

### 6.6 Privilege escalation

| Path | Possible? |
| --- | --- |
| Signup as `admin` | No (rules + client) |
| Update own `role` to admin | No |
| Update own `active` | No via client |
| Change own `verificationStatus` to approved | No |
| Call `/api/admin/*` as non-admin | No (token + role) |
| Call `/api/contracts/:id/action` as the other party or a stranger | Machine rejects (uid/role). Admin role cannot act. |
| Call `/api/contracts` as mentor | 403 |
| Act on a contract you forged via rogue relationship | **Yes, if you are the `mentorId` you wrote** — you become a real machine actor. This is the escalation path that matters. |
| Client write to `learningContracts` | No |
| Custom claims spoof | N/A (unused) |

### 6.7 Other

- **CORS** is a single `CLIENT_ORIGIN`. Fine for one web origin; no CSRF cookie pattern (Bearer token).
- **No rate limiting** on apply, message, or contract action.
- **Seed admin password** in README / `.env.example` is acceptable for emulators; must never be production.
- **Terms body is still placeholder** (“replace this section with the final Terms of Use”).
- **Umami** loads for every visitor; privacy/legal review not in scope here.
- **`requireAdmin` and `requireAccount` duplicated** — drift risk, not an exploit by itself.

---

## 7. Broken User Flows

Flows that **cannot** be completed from beginning to end as a real user of the current UI + rules.

### 7.1 Happy path that *can* complete (code-level)

Signed-up learner → browse approved mentor → apply → mentor accepts → message → learner starts journey → draft → mentor plans → learner approves → evidence text → mentor approves all milestones → titles appear on both profiles.

This is the only full spine. It depends on: an **admin-approved** mentor, both parties staying `active`, the relationship staying `active`, and evidence being text/URL — not files.

### 7.2 Flows that cannot complete

| Flow | Why it breaks |
| --- | --- |
| **Learner builds a real public profile** | Signup can set job status and aspirations only. Education, competency goals, photo, and later edits have **no UI**. Profiles stay empty-state cards. |
| **Mentor completes their public profile** | Same. “Goals” on mentor profile is a **hard-coded empty state**, not bound to data. Expertise/recent role optional at signup only. |
| **Mentor self-serves verification** | Correctly blocked; they wait on admin. If no admin is using `/admin`, they stay pending forever and never appear in Discover. |
| **Learner tracks applications** | After sending, the only status surface is that mentor’s profile. No dashboard list. Declined is not shown as a status (the apply button returns). |
| **Connect without forging, if mentor never visits inbox** | No email/notification. Application sits in Firestore unseen. |
| **End a mentorship cleanly** | No UI. If someone sets `ended` (console or future bug), **chat history and contract list become unreadable**. |
| **Pause / resume** | `paused` exists only on unused `MentorshipStatus`. |
| **Sign a learning contract** | Approve starts work immediately. No dual-signature, no `agreed` row, no PDF/export. |
| **Submit file evidence** | No uploader. Storage not wired. Rules would reject PDFs anyway. |
| **Showcase the work** | Profile shows title/description only. No evidence, no journey link, no public case-study page. |
| **Leave a mentor review** | Schema only. |
| **Reset a forgotten password** | No flow. Account is unrecoverable in-app. |
| **Read Terms after accepting** | Redirected home. |
| **Learner starts journey from header** | No nav item; must open that conversation. Mentors cannot start. |
| **Use Storage in local `npm run dev`** | Storage emulator not started. |
| **Re-apply uniqueness / one active pair** | Multiple pending applications possible. Accept path tries to reuse an existing active relationship (good) but the pre-check is **outside** the transaction (race). |
| **Admin uses `/admin/verification` as a distinct tool** | Redirect only; not broken if they use `/admin`. |
| **Completed pair “closes”** | Contract `completed` but relationship remains `active` and chat stays open indefinitely — not broken, but the lifecycle never reaches a terminal pairing state. |

### 7.3 Partial / brittle flows

- **Login landing:** successful login goes to **own profile**, not messages or a dashboard. Returning users take an extra hop.
- **Suspended user:** login error is correct; if already signed in, snapshot signs them out. Mid-journey writes then fail.
- **Terms bump:** blocks the whole app (good). Accepted users still cannot open `/legal/terms`.
- **Concurrent accept:** rare double relationship if two tabs race the pre-query.
- **`approvePlan` `.sort()`** mutates the contract’s milestone array in place inside the reducer (purity / test smell; not a user-facing break).

---

## 8. Recommended Refactoring Plan

Do **not** rewrite the app. Preserve: shared machine, server-only contract writes, application → relationship → messages → journey spine, deny-by-default rules, single role at signup.

Priority is **close security holes and finish the existing spine**, then fill blueprint stages that the current model already almost supports.

### CRITICAL

1. **Lock relationship creation to the accept path**  
   Firestore: require creator role mentor (or admin), `verificationStatus == approved`, learner profile exists, and optionally an accepted/pending application for that pair. Better: **deny client creates** and create the relationship in Express (Admin SDK) inside the same accept transaction you already have on the client. Prefer moving **accept/decline** to the server so application + relationship stay atomic and authorized.

2. **Close or deny the `mentorships` collection**  
   `allow read, write: if false` until deleted. Remove unused `Mentorship` / `MentorshipStatus` in a follow-up so nobody targets them.

3. **Require approved + active mentor on application create**  
   Rules: `get(mentorProfiles).verificationStatus == 'approved'` and optionally `get(users/mentorId).active != false`.

### HIGH

4. **Align ended-relationship reads**  
   Allow message and contract **reads** for pairing members regardless of `active`. Keep **writes** (new messages, new contracts) on `active` only. Update list rules so `watchContractForRelationship` does not die on `ended`.

5. **Prevent duplicate pending applications**  
   Rules cannot cheaply enforce uniqueness; do it in a callable/Express `POST /api/applications` (or a transaction that queries first). Unique doc id scheme `learnerId_mentorId` is a simple alternative if re-apply after decline is done by **reuse + reset** rather than a new id.

6. **Pin profile updates**  
   Freeze `userId`. Do not allow clients to write `deliverables` or `reviews` — only Admin SDK on completion / future review API.

7. **Profile editor (learner + mentor)**  
   Without this, Discover and Showcase have nothing real to show. Stay on Firestore owner updates; no new framework.

8. **Evidence: decide URL-only vs Storage**  
   If Storage: add emulator, allow evidence MIME types under a **private** path scoped to the relationship, and store the object path on the milestone via the machine. Do **not** put evidence in `/portfolios` (public). If URL-only: validate http(s), render as sanitized links, and copy `finalEvidenceUrl` into `DeliverableRef`.

9. **Notifications (in-app minimum)**  
   New `notifications` collection or a Cloud Function on application create, message create, and contract `currentStepOwner` change. Email can wait, but Connect and Review die without *some* ping.

10. **Treat `agreed` explicitly**  
    Either implement dual-acknowledge (learner approve → `agreed` + mentor confirm → `in_progress`) or delete `agreed` and document that `APPROVE_PLAN` is the contract moment. Do not leave a zombie status.

### MEDIUM

11. **Learner applications inbox** and header IA (Journey / Applications for learners).

12. **End relationship UI** once read rules are fixed. Optionally set relationship `ended` when the contract completes (product decision).

13. **Password reset + email verification** via Firebase Auth (no new vendor required).

14. **Fix TermsPage** so accepted users can read terms; keep the gate.

15. **Server-side acceptApplication** (if not done in CRITICAL #1) to remove the extra-transaction race.

16. **Admin queries** — counts via aggregation or maintained counters; paginate accounts.

17. **Validate contract actions** with a type guard before `reduceContract`.

18. **Mentor directory** — do not show `public` pending profiles by URL without a “not verified” treatment; consider default `public: false` until approved.

19. **Showcase v1** — profile deliverable links to `/dashboard/journey/:relationshipId` for members and a public read-only summary for completed contracts (new read rule or published summary doc).

20. **Replace placeholder Terms** with counsel-approved text and a version bump.

21. **Remove dead `features/admin` barrel** and README line that the server is “one health route”.

### LOW

22. Mentor profile “Goals” section: bind to real data or remove.

23. Login redirect to role dashboard, not only profile.

24. How It Works copy: align four marketing steps with the five machine steps (or keep four and describe negotiation inside “Write the contract”).

25. Tests: Firestore rules emulator tests for application/relationship/message/contract; a thin API test for contract create/action; keep machine tests as the source of transition truth.

26. Rate limits on apply/message.

27. Custom claims mirroring `role` and `active` so rules can avoid `get(users)` on every check (optional performance, not required to ship).

### Suggested sequence (no calendar estimates)

```
P0  Rules/API: relationship create + mentorships deny + application eligibility
P0  Rules: ended-pairing reads
P1  Profile edit + lock deliverables/reviews to server
P1  Applications uniqueness + learner inbox
P1  Evidence policy (URL harden or private Storage)
P2  Notifications
P2  Contract `agreed` decision
P2  Showcase fields + public completion view
P3  Auth recovery, Terms UX, admin scale, cleanup types
```

**Out of scope for the next increments:** new framework, renaming `learnerId`, new `apprenticeships` collection, rebuilding the machine in the client, opening `learningContracts` to client writes.

---

## Appendix A — Firestore query inventory

| Caller | Query | Rules function | Index | Match? |
| --- | --- | --- | --- | --- |
| `watchApprovedMentors` | `verificationStatus==approved`, `public==true` | public read | Yes | Yes |
| `watchPairing` apps | `learnerId`, `mentorId` | `isPairingMember` | Yes | Yes if caller is one of the two |
| `watchPairing` rels | `learnerId`, `mentorId`, `status==active` | `isPairingMember` | Yes | Yes |
| `watchPendingApplications` | `mentorId`, `status==pending` | `isPairingMember` | Yes | Yes for that mentor |
| `watchActiveRelationships` | `learnerId` or `mentorId`, `status==active` | `isPairingMember` | Yes | Yes |
| `watchMessages` | `relationshipId`, `orderBy createdAt` | `isActiveRelationshipMember` | Yes | Yes iff relationship active |
| `watchContractForRelationship` | `relationshipId` limit 1 | list: active member | Auto | Yes iff relationship active |
| `acceptApplication` existing rel | same as pairing rels | member | Yes | Yes |
| Admin pending mentors | Admin SDK | bypass | — | — |
| Admin stats | Admin SDK full scan | bypass | — | — |

## Appendix B — Express API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | None | Liveness + Firebase admin flags |
| GET | `/api/admin/stats` | Admin | Counts |
| GET | `/api/admin/accounts` | Admin | All users |
| POST | `/api/admin/accounts/:userId/active` | Admin | Suspend/restore (not self, not other admins) |
| GET | `/api/admin/mentors/pending` | Admin | Pending + active users |
| POST | `/api/admin/mentors/:userId/verification` | Admin | approved/rejected |
| POST | `/api/contracts` | Account, learner | Create or return existing draft |
| POST | `/api/contracts/:id/action` | Account, learner/mentor | `reduceContract` + optional publish |

## Appendix C — Test surface today

| File | What it proves |
| --- | --- |
| `shared/learningContractMachine.test.ts` | Draft → review → change request → in progress → reject/resubmit → complete + effect |
| `shared/account.test.ts` | `isAccountActive` missing-flag compatibility |
| `shared/legal.test.ts` | Terms version gate |

No tests for rules, Express, or React.

## Appendix D — Technical debt list (concise)

- Unused `Mentorship` type and `/mentorships` rules
- Unused Storage + image-only rules vs evidence
- Empty `client/features/admin/index.ts`
- Duplicated auth middleware
- Admin O(n) scans
- Client-only accept transaction with pre-read race
- `agreed` zombie status
- Hard-coded mentor Goals empty state
- Placeholder legal copy
- README under-describes server routes
- No CI
- `approvePlan` in-place `sort`
- `actionableMilestone` not order-stable
- Contract action unvalidated body
- Terms page redirect for accepted users
- Relationship not updated on contract completion
- DeliverableRef omits evidence
- Login → profile instead of work queue

---

*End of audit. Implementation sequencing continues in `IMPLEMENTATION_ROADMAP.md`.*
