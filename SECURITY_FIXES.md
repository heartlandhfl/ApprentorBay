# Security fixes

Changes from `SECURITY_AUDIT.md`. List and get rules were left alone so existing production queries keep working.

---

## 1. Participating writes require an active account (HIGH)

**Files:** `firestore.rules`

Added caller-only helpers (`accountCanSignIn`, `accountParticipates`, `userParticipates`). These `get()` the **caller** (or the mentor uid on apply). They do not vary by result row, so they are safe if ever reused on a list rule. They are used on **create only**.

| Write | Before | After |
| --- | --- | --- |
| `mentorshipApplications` create | `isLearner()` + mentor approved | Also `accountParticipates()` and `userParticipates(mentorId)` |
| `messages` create | Active pairing member | Also `accountParticipates()` |
| `supportIssues` create | Any signed-in user | `accountCanSignIn()` (restricted may file; suspended/terminated may not) |

Reads, list listeners, and pairing membership checks are unchanged.

---

## 2. Restricted accounts cannot mutate contracts (HIGH)

**Files:** `server/routes/contracts.ts`

- `POST /api/contracts` — learner must `canParticipate`.
- `POST /api/contracts/:id/action` — learner/mentor must `canParticipate`. Admins may still act.

Restricted users can still **read** the workspace over Firestore (list/get rules unchanged).

---

## 3. Restricted mentors cannot submit verification (HIGH)

**Files:** `server/routes/profiles.ts`

`POST /api/profiles/me/verification/submit` now requires `canParticipate`.

---

## 4. Evidence uploads require participation (HIGH)

**Files:** `storage.rules`

Evidence `create` / `update` now requires `accountParticipates()` in addition to being the contract learner writing under their own uid segment.

Profile photo writes use `accountCanSignIn()` so a restricted user can still replace their avatar. Public photo reads are unchanged.

---

## 5. Storage admin matches Firestore admin (MEDIUM)

**Files:** `storage.rules`

`isAdmin()` now requires `active != false` and `accountStatus` absent or `active`, same as `firestore.rules`.

---

## 6. Close unused `/users/{userId}/**` writes (MEDIUM)

**Files:** `storage.rules`

That prefix is not used by the current client (photos go to `/profile-photos/{slug}`). Writes are denied. Owner read remains so any leftover file is not stranded.

---

## 7. Domain: messaging and resume are participation (MEDIUM)

**Files:** `shared/domain/permissions.ts`, `shared/domain.test.ts`

- `canSendMessage` requires `canParticipate`.
- `canResumeRelationship` requires `canParticipate`.
- `canPauseRelationship` / `canEndRelationship` still use `isAccountActive` so a restricted member can leave or pause.

---

## Intentionally not changed

| Item | Reason |
| --- | --- |
| Contract / message / application **list** rules | Compatible with current queries. Ended pairs can still read. |
| Public profile list `listed` + `published` | Already matches `published == true`. |
| Showcase pairing-only reads | Public portfolio is on `publicProfiles`. |
| Client `createApplication` helper | Unused. Rules now block restricted / unapproved / inactive mentors. Removing it is cleanup, not a security control. |
| `/portfolios/**` public read | Legacy; writes already denied. Deleting files is a data decision. |
| Admin full-collection scans | Operational, not an access bug. |
| Rate limits | Out of scope for this rules/query pass. |

---

## Validation

Performed on the Firebase emulators after reloading `firestore.rules`:

| Check | Result |
| --- | --- |
| `npm run build` (shared + client + server) | Pass |
| `npm run typecheck` | Pass |
| `npm test` (50 tests) | Pass |
| Anonymous list of published `publicProfiles` | Allowed |
| Anonymous read of `users`, contracts, applications, messages, audit, support | Denied |
| Anonymous `/api/admin/stats` | 401 |
| Learner read own user; list own pairing contracts | Allowed |
| Learner grant admin / change `accountStatus` / write contracts / admin API | Denied |
| Mentor self-approve, self-verify, grant admin | Denied |
| Mentor submit verification + admin approve | Allowed |
| Stranger list another pairing’s contracts or messages | Denied (`permission-denied`, not an empty success) |
| Restricted learner send message / create application / start journey | Denied |
| Restricted learner file support | Allowed (201) |
