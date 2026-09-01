# Administration system

The admin governs the platform. The React `/admin` route is a convenience. **Every decision is enforced on the server and in Firestore rules.**

---

## Dashboard

| Count | Meaning |
| --- | --- |
| Total users | Every `users` document |
| Learners | `role == learner` |
| Mentors | `role == mentor` |
| Pending mentor approvals | Mentor `verificationStatus == pending` |
| Pending verification | Verification case is submitted, under review, or partially verified |
| Active mentorship relationships | Relationship `active` |
| Active learning contracts | Contract `in_progress` |
| Completed deliverables | Contract `completed` |
| Support issues | Open or in-progress `supportIssues` |

---

## Approval vs verification

**Approval** (`mentorProfiles.verificationStatus`) is participation:

| Status | Meaning |
| --- | --- |
| `pending` | Waiting on the platform |
| `approved` | May participate |
| `rejected` | May not participate |
| `suspended` | Participation withdrawn |

Approval is **not** a background check.

**Verification** (`verificationCaseStatus` + `verifiedClaims[]`) is a separate evidence process:

| Status | Meaning |
| --- | --- |
| `not_submitted` | No case |
| `submitted` | Mentor asked for a check |
| `under_review` | Admin is reviewing |
| `partially_verified` | Some claims checked |
| `verified` | Identity, education, and professional experience checked |

---

## Account governance

Applies to learners and mentors. Admins cannot change their own account or another admin.

| Status | Sign in | Participate | Public profile |
| --- | --- | --- | --- |
| `active` | yes | yes | if published |
| `restricted` | yes | no | hidden |
| `suspended` | no | no | hidden |
| `terminated` | no | no | hidden; not restored from the dashboard |

`users.active` stays in sync (`true` only for active and restricted) so older login checks keep working.

---

## Admin actions

| Action | API |
| --- | --- |
| Approve / reject / suspend mentor | `POST /api/admin/mentors/:userId/verification` |
| Verify mentor / remove verification | `POST /api/admin/mentors/:userId/verify` |
| Restrict / suspend / terminate / restore account | `POST /api/admin/accounts/:userId/status` |
| Resolve support issue | `POST /api/admin/support/:issueId/resolve` |

Reject, suspend, restrict, terminate, and remove-verification require a reason.

---

## Audit log

Each major admin action writes `adminAuditLogs/{id}`:

- `adminId`
- `action` (`APPROVE_MENTOR`, `SUSPEND_ACCOUNT`, …)
- `targetUserId`
- `reason` (when supplied)
- `timestamp`

Clients cannot write this collection. Admins may read it.

---

## Security

| Attempt | Result |
| --- | --- |
| Grant yourself `admin` | Firestore create allows only `learner` / `mentor`. Updates freeze `role`. |
| Approve or verify yourself | Mentor profile updates after signup are denied. Admin APIs require `users.role == admin`. |
| Change another user's status from the client | `active` and `accountStatus` are frozen on client updates. |
| Call `/api/admin/*` as a learner or mentor | `403 Admin role required` |

See `firestore.rules` and `server/middleware/requireAdmin.ts`.
