# ApprentorBay — Final pre-human-testing audit

**Date:** 2026-09-01  
**Revision audited:** `2bf74ad` on `main` (Terms acceptance, #23) plus this document.  
**Method:** Production `npm run build` / `typecheck` / `npm test`; live emulator walks of the core lifecycle, admin, and security paths; rules and index review against production queries; browser check of public and gated routes.  
**Constraint:** No speculative features were added.

This audit uses the product that exists. “Verify account” in the learner script is **email verification**. That flow is not implemented. Mentor **approval** and mentor **identity verification** are implemented and are separate.

---

## 1. BUILD STATUS

**PASS**

| Check | Result |
| --- | --- |
| `npm run build` (shared + Vite client + server) | Succeeded. Vite note: main JS chunk is 963 kB (gzip 286 kB). Not a deploy blocker. |
| `npm run typecheck` | Succeeded for shared, client, and server. |
| `npm test` (shared machine, domain, legal, lifecycle) | 64 tests, 0 failed. |
| Production static output | `client/dist` written. Express serves it when `NODE_ENV=production`. |
| Env documentation | `.env.example` lists Vite Firebase keys, emulator flags, `PORT`, `CLIENT_ORIGIN`, `SEED_ADMIN_*`, and Admin SDK credentials. |
| Firebase project wiring | Client and Admin read `VITE_FIREBASE_*` / `FIREBASE_PROJECT_ID`. Local `.env` points at emulator project `apprentorbay-demo` with `VITE_USE_FIREBASE_EMULATOR=true`. |

A live production Firebase project is **not** stored in the repo. That is correct. Operators must copy `.env.example`, set real keys, and set emulator flags to `false`.

---

## 2. CORE USER FLOWS

**PASS**

Walked on Auth `:9099`, Firestore `:8080`, Storage `:9199`, API `:3001`, client `:5173`.

### Learner

| Step | Status | Notes |
| --- | --- | --- |
| Register | Pass | Role → Terms → details. Signup writes `learner` only. |
| Accept Terms | Pass | Unchecked checkbox required. Label: “I confirm that I am legally eligible to use ApprentorBay and agree to the Terms of Use.” Stored: `termsAccepted`, `termsVersion` (`2026-09-10`), `termsAcceptedAt`. Bootstrap refuses incomplete acceptance. |
| Verify account | **Not implemented** | No Firebase Auth email verification, no verify-email route. See §7. This does **not** block Discover → Showcase. |
| Complete profile | Pass | `PUT /api/profiles/me` (identity, job status, aspirations, public flag). |
| Browse mentors | Pass | Directory lists only `listed == true` and `published == true` (approved mentors). Unapproved mentors are not listed. |
| Apply | Pass | `POST /api/applications` with mentor slug + message. Apply to a pending mentor is rejected. |

### Mentor

| Step | Status | Notes |
| --- | --- | --- |
| Register | Pass | Same Terms gate. New mentor profile is `verificationStatus: pending`. |
| Submit profile | Pass | Profile + mentoring interests (there is no calendar field). |
| Await approval | Pass | Not in the public directory until an admin approves. |
| Admin approves | Pass | `POST /api/admin/mentors/:id/verification`. Approval ≠ identity verification. |
| Receive application | Pass | Mentor applications inbox. |
| Accept learner | Pass | `POST /api/applications/:id/accept` creates one active relationship. |

### Relationship → Showcase

| Stage | Status | Notes |
| --- | --- | --- |
| Relationship created | Pass | Deterministic pairing id. |
| Messaging enabled | Pass | Pairing members can create messages on an **active** relationship. Strangers cannot read or write that thread. |
| Learning Goal Builder | Pass | Learner proposes goal + deliverable; mentor revises goal, objectives, milestones, deliverable; learner can request revision; learner approves; activate. Mentor cannot skip to `ACTIVATE`. |
| Contract active | Pass | `APPROVE_PLAN` then `ACTIVATE` → `in_progress`, one active milestone. |
| Milestone + evidence | Pass | Learner submits; mentor can request revision; learner resubmits; mentor approves. Repeat for later milestones. |
| Review | Pass | Learner cannot `APPROVE_MILESTONE`. Stranger cannot. |
| Final deliverable | Pass | Learner submits; mentor reviews; confirm without review fails. |
| Completion | Pass | Mentor `CONFIRM_COMPLETION` only. Learner cannot self-complete. Status `completed`. |
| Showcase | Pass | One showcase id = contract id. Learner remains creator. Mentor contribution: “Mentored this work. The learner remains the creator.” Public copy is on `publicProfiles`, not a public `showcases` list. |

### Public profiles after completion

- Learner `publicProfiles/{slug}.portfolio` contains the deliverable.
- Mentor `publicProfiles/{slug}.mentoredDeliverables` references the same work.
- Public docs omit email and Firebase uid.

### Browser (signed-out)

Home, How It Works, signup, login, Terms, mentor directory, and auth gates for `/dashboard` and `/admin` render. How It Works names the real learner rail (Discover → Connect → Agree → Learn → Build → Prove → Showcase) and mentor rail (Be discovered → Connect → Guide → Review → Validate → Build legacy).

---

## 3. SECURITY

**PASS**

The HIGH items in `SECURITY_AUDIT.md` are **closed** (see `SECURITY_FIXES.md`). Do not treat that audit’s HIGH list as live.

| Attack | Result |
| --- | --- |
| Unauthenticated API (`/api/admin/stats`, `/api/contracts`) | 401 |
| Unauthenticated Firestore (`users`, contracts, applications, messages, showcases, audit, support) | Denied |
| Unsigned `/dashboard` | “Sign in to continue” |
| Unsigned `/admin` | “Admins only” — no tools |
| Stranger `get` / `list` of another pair’s contract | Denied |
| Stranger messages on another relationship | Denied |
| Stranger contract actions (start, approve, final deliverable, complete) | 400/403 |
| Stranger `get` of `showcases/{id}` | Denied (public surface is `publicProfiles`) |
| Stranger Storage evidence upload / download | `storage/unauthorized` |
| Learner `APPROVE_MILESTONE` / `CONFIRM_COMPLETION` | Rejected |
| Client `setDoc` of `learningContracts` | Denied |
| Mentor self-approve / self-verify (Firestore + admin API) | Denied |
| Learner/mentor self-assign `role: admin` | Denied (create allows only `learner` \| `mentor`; updates freeze `role`) |
| Learner changing `active` / `accountStatus` | Denied |
| Forged `adminAuditLogs` | Denied |
| Restricted account apply / message / start journey | Denied by rules + `canParticipate` on Express |
| Restricted account file support | Allowed (intentional) |
| Suspended account API | 401/403; client signs them out |

Contract writes stay on Express + Admin SDK + `reduceContract`. Restricted users can still **read** a workspace.

Remaining residual risk (not blockers): no rate limits; leftover world-readable `/portfolios/**` if any legacy file exists; admin dashboard loads whole collections (cost, not an access hole).

---

## 4. DATABASE

**PASS**

Live collections match the product. Canonical ids: `learner` / `mentor` / `admin`; `learnerId` / `mentorId`. Do not rename collections.

| Collection | Writer | Notes |
| --- | --- | --- |
| `users` | Signup (client create); admin SDK for status | Terms fields required on create in current rules |
| `learnerProfiles` / `mentorProfiles` | Signup create; later edits via Express | Client update/delete denied |
| `publicProfiles` | Express only | Published projection; no email/uid |
| `profileSlugs` | Express only | Client deny-all |
| `mentorshipApplications` | Learner create or Express | Decisions via Express |
| `mentorshipRelationships` | Express only | Client create/update/delete denied |
| `messages` | Pairing members | Active + participating |
| `learningContracts` | Express only | Milestones and evidence **records** live here |
| `showcases` | Express only | Pairing/admin read |
| `adminAuditLogs` | Express only | |
| `supportIssues` | Reporter create; Express resolve | |
| `mentorships` | Unused | Deny-all |

`firestore.indexes.json` covers production composite queries: applications (mentor+status, learner+mentor), relationships (pair+status, learner+status, mentor+status), messages (relationship+createdAt), mentorProfiles (verificationStatus+public), showcases (learner/mentor+published), publicProfiles (listed+published). Admin scans use the Admin SDK and do not need client indexes.

---

## 5. FIREBASE RULES

**PASS**

`firebase.json` points Firestore at `firestore.rules` and `firestore.indexes.json`. Rules are deny-by-default.

Current `users` create requires `termsAccepted == true` plus version and timestamp. Role is `learner` or `mentor`. `active` and `accountStatus` are frozen for clients. Mentor profile create must be `verificationStatus: pending`. Pairing creates and contract writes are server-only.

Deploy: `firebase deploy --only firestore:rules,firestore:indexes` against the production project (after emulator flags are off).

A long-lived local emulator process does not pick up a rules file change until restart. Restart emulators after pulling rules changes. That is a local-dev note, not a production blocker.

---

## 6. STORAGE

**PASS**

`storage.rules` is wired in `firebase.json`. The Storage emulator is on `:9199`. The client uses Storage for profile photos and private evidence.

| Prefix | Read | Write |
| --- | --- | --- |
| `/profile-photos/{slug}/{file}` | Public | Owner of `users.profileSlug`; image ≤ 5 MB jpeg/png/webp |
| `/evidence/{contractId}/{milestoneId}/{userId}/{file}` | Contract members or admin | Contract **learner** and `auth.uid == userId`; participating; ≤ 10 MB image/pdf/text |
| `/portfolios/{userId}/**` | Public | Denied (legacy) |
| `/users/{userId}/**` | Owner | Denied |
| Everything else | Denied | Denied |

Evidence is never stored under `/portfolios`. Download URLs are requested with the caller’s Auth token.

Deploy: `firebase deploy --only storage`.

---

## 7. EMAIL

**FAIL**

There is no email product in this repository.

| Flow | Status |
| --- | --- |
| Email verification after signup | Missing. No `sendEmailVerification`, no `emailVerified` gate. |
| Password reset | Missing. Login has no reset link. No `sendPasswordResetEmail`. |
| Transactional mail (apply, review, complete) | Missing. Roadmap P2-1 / P2-8. The dashboard derives “what next” in-app instead. |

Firebase Auth can send these once a real project is configured. The app does not call those APIs. Human testers on the emulator sign in with the password they chose. Production operators must plan password recovery before a public launch; it is **not** required to exercise Discover → Showcase.

---

## 8. ADMIN

**PASS**

| Check | Result |
| --- | --- |
| Seeded local admin | `admin@apprentorbay.test` / `ApprentorBayAdmin-2026` (`SEED_ADMIN_*`). Seeded only when emulators are on. |
| Approval | Pass. Sets participation `verificationStatus`. Not a background check. |
| Identity verification | Pass. Separate `verify` API and `verificationCaseStatus`. Mentor submit-for-verification cannot self-approve. |
| Restriction | Pass. Writes audit (`RESTRICT_ACCOUNT` + reason + adminId). Restricted users cannot participate. |
| Suspension | Pass. API refuses the token; client signs inactive accounts out. |
| Unauthorized admin API | Learner/mentor/anonymous → 403/401 on stats, approve, verify, status. |
| Privilege escalation | Users cannot create `role: admin` or update themselves to admin. |
| `/admin` UI | React `RequireAdmin` + Express `requireAdmin` + Firestore `isAdmin()`. |
| Production admin | **Not in the repo.** Create one Admin SDK user + `users/{uid}` with `role: admin` on the live project. Do not ship the seed password. |

`/admin/verification` redirects to `/admin`.

---

## 9. MOBILE UX

**PASS**

Verified in code and in the browser at ~390px.

| Area | Status |
| --- | --- |
| Header | `Menu` / `Close` below `md`; stacked nav. Desktop keeps inline links. |
| How It Works / home | Learner and mentor rails; display type scales down. |
| Signup | Role cards stack; Terms checkbox. |
| Tables | `min-w-[40rem]` + “Swipe sideways to see every column.” |
| File upload | `FileField` on profiles and evidence. |
| Messages | Bubbles capped to the column. |
| Dashboard | Mentor counts wrap 2 / 3 / 5 columns. Journey stepper uses a wrapping rail. |
| Auth gates | Signed-out dashboard and admin do not leak tools. |

Remaining items in `UX_AUDIT.md` (calendar availability, learner application inbox, workspace density, admin-on-phone cards, notifications) are recommendations. They do not break the lifecycle.

---

## 10. HUMAN TESTING READINESS

**READY**

### Blockers

None that meet the critical rule (critical security issue, broken core lifecycle, or deployment blocker).

### Non-blocking gaps (do not treat as “not ready”)

1. **Email verification and password reset are not implemented.** The scripted learner step “Verify account” does not exist. Testers create an account and continue.
2. **No outbound email** for applications, reviews, or completion. Testers must watch the dashboard / inbox.
3. **README is behind the product.** It omits `/dashboard`, Storage emulator `:9199`, `termsAccepted`, relationship `paused` / `terminated`, and showcases. Use this file and `.env.example`.
4. **`SECURITY_AUDIT.md` HIGH list is stale.** Fixes are in `SECURITY_FIXES.md` and in the current rules/routes.
5. **`ARCHITECTURE_AUDIT.md` is stale** (Storage unused, no profile editor, no showcase). Do not use it as the live model.
6. **Terms effective date is 10 September 2026.** Until then the UI must say they take effect and are not yet in force. Signup still records acceptance of version `2026-09-10`.
7. **No CI workflow** in the repo.
8. **No production admin user** is checked in. Provision one on the live project before production admin testing.
9. **Mentoring “availability”** is `mentoringInterests`, not a calendar.
10. **Learners have no dedicated application-history page.** The dashboard reports a pending apply.

### Suggested human-test accounts (emulator)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@apprentorbay.test` | `ApprentorBayAdmin-2026` |
| Learner | Create at `/signup` | Choose a password ≥ 6 characters |
| Mentor | Create at `/signup` | Same |

Do not reuse these seed credentials on a production Firebase project.

### Human script (what to click)

1. **Mentor:** Sign up → accept Terms → complete profile → wait. Confirm the directory does not show them.
2. **Admin:** Log in → `/admin` → approve the mentor. Optionally verify the identity claim. Confirm the mentor appears under Mentors.
3. **Learner:** Sign up → accept Terms → complete profile → Mentors → apply.
4. **Mentor:** Applications → accept. Messages should work.
5. **Learner:** Start Learning Journey from the relationship. Propose a goal and deliverable.
6. **Mentor:** Revise goal, add objectives and milestones, define the deliverable, send back.
7. **Learner:** Request a change, then approve the revised plan so the contract becomes active.
8. **Learner:** Submit evidence on the active milestone (text and/or file).
9. **Mentor:** Request a revision, then approve. Repeat until milestones are done.
10. **Learner:** Submit the final deliverable.
11. **Mentor:** Review and confirm completion.
12. Open the learner public profile: deliverable is listed. Open the mentor public profile: the same work is referenced as mentored, with the learner as creator.
13. **Admin:** Restrict and suspend a throwaway account. Confirm they cannot apply or mutate contracts. Confirm a normal user cannot open `/admin` tools or call `/api/admin/*`.

### Deploy checklist (when leaving emulators)

- [ ] Fill `.env.example` with the production Firebase web app and Admin SDK key.
- [ ] `VITE_USE_FIREBASE_EMULATOR=false` and `USE_FIREBASE_EMULATOR=false`.
- [ ] `npm run build` and host `client/dist` + the Node server.
- [ ] `firebase deploy --only firestore:rules,firestore:indexes,storage`.
- [ ] Create the production admin user out of band.
- [ ] Decide when to add Auth email verification and password reset (not required for this audit’s READY verdict).
