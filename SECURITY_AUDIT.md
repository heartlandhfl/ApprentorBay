# Security and database access audit

**Scope:** Firestore rules, production queries, indexes, Storage rules, Express auth, admin authorization, and client permission handling as of the administration system on `main`.  
**Method:** Rules and queries were read together. A rule that would deny a legitimate list listener is treated as a production failure even if the predicate looks right.

`ARCHITECTURE_AUDIT.md` §6 describes an older ruleset (client relationship create, client profile updates, apply-to-unverified mentors). Those writes are already denied. This document is the current model.

---

## Collection matrix

| Collection | Read | Create | Update | Delete | Writer |
| --- | --- | --- | --- | --- | --- |
| `users` | Owner or admin (get). List only works for admin or `uid == auth.uid`. | Own uid; role `learner` \| `mentor`; `active == true`; `accountStatus` absent or `active`; terms required; `profileSlug` null | Owner or admin; **frozen:** `uid`, `role`, `active`, `accountStatus`, `profileSlug` | Denied | Signup (client create); admin API (Admin SDK) for status |
| `learnerProfiles` | Owner, admin, or paired (`uid_other` / `other_uid` relationship exists) | Owner; `userId == auth.uid` | Denied | Denied | Signup create; later edits via Express |
| `mentorProfiles` | Same as learner | Owner; `userId == auth.uid`; `verificationStatus == pending` | Denied | Denied | Same. Approval / verification only via Admin SDK |
| `publicProfiles` | `published == true`, or admin, or owner of `users.profileSlug` | Denied | Denied | Denied | Express only |
| `profileSlugs` | Denied | Denied | Denied | Denied | Express only |
| `mentorshipApplications` | Pairing member (`learnerId` or `mentorId` == caller) or admin | Learner; own `learnerId`; `pending`; mentor ≠ self; message 1–1000; mentor approved | Denied | Denied | Client `createApplication` (unused UI) **and** Express |
| `mentorshipRelationships` | Pairing member or admin | Denied | Denied | Denied | Express on accept / status |
| `messages` | Relationship member (any status) or admin | Active relationship member; own `senderId`; text 1–2000 | Denied | Denied | Client `sendMessage` |
| `learningContracts` | **get:** pairing member or admin. **list:** relationship member or admin | Denied | Denied | Denied | Express |
| `showcases` | Pairing member or admin | Denied | Denied | Denied | Express. Public copy is on `publicProfiles` |
| `adminAuditLogs` | Admin | Denied | Denied | Denied | Express |
| `supportIssues` | Admin or reporter | Signed-in reporter; `open`; subject ≥ 3; body ≥ 8 | Denied | Denied | Express (client create also allowed by rules) |
| `mentorships` (legacy) | Denied | Denied | Denied | Denied | Unused |
| `notifications` | Denied (catch-all) | Denied | Denied | Denied | Not written |

Milestones and evidence **records** are fields on `learningContracts`. There is no `milestones` or `evidence` collection. File bytes live in Storage under `/evidence/{contractId}/{milestoneId}/{userId}/{fileId}`.

---

## Required controls (current)

| Requirement | Status |
| --- | --- |
| Read another user's private contract | Denied (get/list require pairing or admin) |
| Modify a contract you do not belong to | Denied in rules. Express `reduceContract` also requires the step owner uid |
| Approve your own milestones | Learner cannot. `APPROVE_MILESTONE` requires `actor.role == mentor` and `actor.uid == contract.mentorId` |
| Approve yourself as a mentor | `mentorProfiles` updates denied. Admin API requires admin |
| Verify yourself | Same. Submit-for-verification only sets `submitted` |
| Grant yourself Admin | Create allows only `learner` / `mentor`. Updates freeze `role` |
| Read private evidence on another contract | Storage read requires contract membership |
| Modify another user's profile | Private profile client updates denied. Public profiles server-only. Express allowlists own fields and rejects `verificationStatus` / `deliverables` |

---

## Query compatibility

Every **production** client listener was checked against the rule that would evaluate for that query.

| Query | Rule | Compatible? | Index |
| --- | --- | --- | --- |
| `users/{uid}` get / snapshot | Owner or admin | Yes | None |
| `publicProfiles` `listed == true` + `published == true` | `published == true` (or admin/owner) | Yes — query guarantees `published` | Composite `listed` + `published` |
| `publicProfiles/{slug}` get | Published, admin, or slug owner | Yes. Unpublished + stranger → `permission-denied`, mapped to `null` | None |
| `learnerProfiles` / `mentorProfiles` get | Owner, admin, paired | Yes. Stranger → denied, mapped to `null` / `"Member"` | None |
| Applications `learnerId` + `mentorId` | `isPairingMember` | Yes if caller is one of those ids | Composite |
| Applications `mentorId` + `status == pending` | Mentor is pairing member | Yes | Composite |
| Relationships `learnerId` or `mentorId == uid` | Pairing member | Yes | Single-field (composites exist for status filters) |
| Relationships `learnerId` + `mentorId` | Pairing member | Yes | Prefix of 3-field index |
| Messages `relationshipId` + `orderBy createdAt` | Relationship member (any status) | Yes — ended pairs can still **read** | Composite |
| Contracts `relationshipId` + `limit 1` | `isRelationshipMember(relationshipId)` | Yes — membership, not “active only”. Ended pairs can still **read** | Single-field |
| Showcases `learnerId` / `mentorId` (+ optional `published`) | Pairing or admin | Yes for members. **Stranger gets `permission-denied`**, client maps to `[]` | Composites exist; **no UI caller today** |

Admin-only scans (`users`, `mentorProfiles`, `relationships`, `contracts`, `supportIssues`, `adminAuditLogs`) use the **Admin SDK** and do not need client rules or client indexes.

### Permission errors vs empty results

| Surface | Denied stranger | Empty legitimate |
| --- | --- | --- |
| Journey / workspace contract or messages | `firestoreDenied` → “denied” UI | Snapshot with 0 docs → empty / no contract |
| Public profile get | Denied unpublished → `null` (looks like missing) | Missing slug → `null` |
| Mentor directory list | Would error (not swallowed) | `[]` |
| Showcase watch | Denied → `[]` (hides the error) | `[]` |
| Apply / message / contract API | HTTP 403 / 400 | HTTP 200 with empty lists |

List rules that use `get(relationship)` are safe because the query already pins `relationshipId`. The extra get is the same document for every result row.

---

## Storage

| Path | Read | Write | Notes |
| --- | --- | --- | --- |
| `/profile-photos/{slug}/{file}` | Public | Signed-in owner of `users.profileSlug`; image ≤ 5MB jpeg/png/webp | Intended public avatar |
| `/evidence/{contractId}/{milestoneId}/{userId}/{file}` | Contract members or admin | Contract **learner** and `auth.uid == userId`; ≤ 10MB image/pdf/text | Private. Mentor cannot upload as the learner |
| `/portfolios/{userId}/**` | Public | Denied | Legacy. Any file already there is world-readable |
| `/users/{userId}/**` | Owner | Owner, images | Unused by current clients |

Download URLs are requested with the caller’s Auth token. Rules are evaluated on get; evidence is not a public object.

---

## Authentication and admin

- Signup writes `role` as `learner` or `mentor` only. Rules reject `admin`.
- `requireAccount` verifies the ID token and `isAccountActive` (active **or** restricted). Suspended / terminated are signed out of the client listener and receive 403 on APIs.
- `requireAdmin` requires `canGovernAccounts` (`role == admin` and `accountStatus == active`).
- Admin mutations (approval, verification, account status) use the Admin SDK, so they bypass rules by design.
- Frontend `/admin` is a convenience. It is not the control.

---

## Findings

### CRITICAL

None in the current ruleset. The previous critical (any signed-in user forging `mentorshipRelationships`) is closed: create/update/delete are denied.

### HIGH

1. **`accountStatus` is not enforced on participating Firestore writes.** Restricted and suspended users with a live token can still:
   - `setDoc` a `mentorshipApplications` row (rules only check `isLearner()`).
   - `setDoc` a `messages` row (rules only check active pairing).
   The apply **API** already uses `canParticipate`. The unused client `createApplication` helper and the live `sendMessage` helper do not.

2. **Restricted accounts can mutate learning contracts through Express.** `POST /api/contracts` and `POST /api/contracts/:id/action` use `requireAccount` only. Restricted users can still start a journey, submit evidence, or approve milestones. Domain `canStartLearningJourney` already forbids this; the route does not call it.

3. **Restricted learners can upload private evidence.** Storage evidence writes do not check `accountStatus`.

### MEDIUM

4. **Storage `isAdmin()` ignores `active` / `accountStatus`.** A suspended admin token could still delete profile photos or evidence.

5. **Legacy `/portfolios/**` is world-readable.** Unused now; any future write (or leftover file) is public.

6. **Unused `/users/{userId}/**` storage writes.** Owner can upload images under a second prefix that the product does not use.

7. **`canSendMessage` / `canResumeRelationship` treat restricted as allowed** (`isAccountActive`). Messaging and resume are participation.

8. **Showcase list treats `permission-denied` as empty.** Correct for a visitor, but it would hide a broken pairing query. No production route calls these watchers.

9. **Admin dashboard loads entire collections.** Not an access bug; cost / timeout risk as data grows.

10. **Ended pairings can still read private profiles** (`isPairedWith` does not check relationship status). Likely desired for history; not a stranger leak.

### LOW

11. **Dead `createApplication` client writer** still exists. UI applies through `/api/applications`. Rules remain the real gate.

12. **Support tickets may be created while restricted.** Acceptable (they may need to contact admins). Suspended should not.

13. **Seed admin password** is documented for emulators.

14. **No rate limits** on apply, message, or contract action.

15. **`ARCHITECTURE_AUDIT.md` §6 is stale** and should not be used as the live threat model.

---

## What this audit does not claim

This file is a review of the codebase and emulator behavior. Production is only as secure as the deployed `firestore.rules` / `storage.rules` and the Admin SDK remaining the only writer for pairing, contracts, profiles after signup, showcases, slugs, and audit logs.
