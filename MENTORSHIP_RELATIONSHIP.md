# Mentorship Relationship Engine

**Collection:** `mentorshipRelationships` (unchanged)  
**Accept/decline/status:** Express + Admin SDK (`/api/applications/:id/accept|decline`, `/api/relationships/:id/status`)  
**Apply:** existing client write to `mentorshipApplications` (reuse)

This is not a second pairing system. It repairs the existing application → relationship spine so a dedicated relationship document is always created (or reactivated) on accept, idempotently.

---

## Business rule

1. A learner discovers a verified mentor (`/mentors`).
2. The learner applies (`mentorshipApplications`, status `pending`).
3. The mentor accepts or declines.
4. **Accept creates or activates one `mentorshipRelationships` document.** The pairing is never inferred from `application.status === accepted` alone.

---

## Canonical document

Persisted on `mentorshipRelationships/{id}`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Deterministic `{learnerId}_{mentorId}` for new pairs; legacy random ids are reused |
| `mentorId` | string | |
| `learnerId` | string | Canonical learner field (not `apprenticeId`) |
| `applicationId` | string \| null | Application that created or last activated the pair. Older docs may omit this |
| `status` | `active` \| `paused` \| `ended` \| `terminated` | Stored lowercase; UI shows ACTIVE / PAUSED / ENDED / TERMINATED |
| `createdAt` | ISO string | First create |
| `startedAt` | ISO string | Last time the pair became active |
| `updatedAt` | ISO string | Last status change |
| `endedAt` | ISO string \| null | Set when ended or terminated |

`normalizeRelationship()` fills missing fields so existing `active`/`ended` documents still load.

---

## Statuses and transitions

```
active  → paused | ended | terminated
paused  → active | ended | terminated
ended   → (reactivate only by a new accept, not a generic status write)
terminated → (terminal; admin only)
```

| Status | Messages | New learning contract | Workspace read |
| --- | --- | --- | --- |
| ACTIVE | yes | yes (learner) | members + admin |
| PAUSED | no | no | members + admin |
| ENDED | no | no | members + admin |
| TERMINATED | no | no | members + admin |

Ended/terminated history remains readable (Firestore: pairing members may **read** messages and contracts; **writes** require `active`).

---

## Permissions

| Action | Who |
| --- | --- |
| Apply | Learner, approved mentor, no open pair, no pending apply |
| Accept / decline | Mentor on that application (or admin) |
| View workspace, messages, contracts | Learner + mentor on the document, or admin |
| Send message / start journey | Members, relationship `active` |
| Pause / resume / end | Either member (or admin) |
| Terminate | Admin only |
| Create/update relationship docs | **Server only** (client rules deny write) |
| Decide application status | **Server only** |

---

## Idempotent accept

`POST /api/applications/:id/accept` runs an Admin SDK transaction:

1. Re-read the application.
2. Resolve the relationship id: existing open pair for this learner+mentor, else any legacy doc, else `{learnerId}_{mentorId}`.
3. If an **open** relationship already exists → mark the application accepted (if needed) and return that document. No second create.
4. If an **ended** relationship exists → reactivate it (`active`, new `startedAt`, clear `endedAt`).
5. If none exists → `set` exactly one new document.
6. Repeat / double-click / retry hits the same document id.

Decline is idempotent: already-declined returns 200.

---

## Audit trail

Written to `adminAuditLogs` (client writes denied):

| Event | When |
| --- | --- |
| `APPLICATION_ACCEPTED` | Application flips to accepted |
| `APPLICATION_DECLINED` | Application flips to declined |
| `RELATIONSHIP_CREATED` | First document for the pair |
| `RELATIONSHIP_PAUSED` | Status → paused |
| `RELATIONSHIP_RESUMED` | Status → active from paused |
| `RELATIONSHIP_ENDED` | Status → ended |
| `RELATIONSHIP_TERMINATED` | Admin terminate |

---

## UI (existing routes kept)

| Path | Who | What |
| --- | --- | --- |
| `/dashboard/mentorships` | Learner: **My Mentors**. Mentor: **My Learners** | Active (and ended) relationships |
| `/dashboard/mentorships/:id` | Members | Workspace: people, status, pause/end, messages, learning contracts |
| `/dashboard/messages` | — | Redirects to `/dashboard/mentorships` |
| `/dashboard/messages/:id` | Members | Same workspace component (compat) |
| `/dashboard/applications` | Mentor | Pending accept/decline → workspace |

---

## What was reused vs changed

**Reused:** apply modal, pending applications list, Firestore message listeners, Journey entry, `learnerId`/`mentorId`, collection names.

**Repaired:** accept/decline moved off the client (closes the “anyone can create a relationship as mentorId” hole and the extra-transaction race). Relationship shape extended. Rules deny client relationship writes and require an approved mentor on apply.

---

## Compatibility

- Collection name not renamed.
- Existing `status: 'active' | 'ended'` documents still valid.
- New fields optional on read (`normalizeRelationship`).
- Persisted status strings stay lowercase.
- Old `/dashboard/messages` URLs still work.
