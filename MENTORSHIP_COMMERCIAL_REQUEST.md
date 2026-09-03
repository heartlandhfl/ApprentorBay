# Mentorship commercial request state machine

This document describes how mentor `commercialMode` connects to the existing application → relationship flow. It does **not** introduce a second pairing system or payment processing.

## Canonical flow (unchanged)

```
Learner discovers mentor
  → mentorshipApplication (pending)
  → mentor accepts or declines
  → mentorshipRelationship (active | paused | ended | terminated)
  → Learning Journey / Learning Contract
```

Application **status** (`pending` | `accepted` | `declined`) and relationship **status** (`active` | `paused` | `ended` | `terminated`) are unchanged.

## New dimension: request type

Each application records a server-derived `requestType` snapshot at apply time:

| `requestType`   | When set (from mentor `commercialMode`) | Meaning |
|-----------------|----------------------------------------|---------|
| `free_request`  | `giving_back`                          | Free mentorship request |
| `paid_request`  | `professional` or `premium`            | Paid mentorship request (booking intent; payment not processed yet) |

The client **never** supplies `requestType` or commercial fields. The Express apply route reads the mentor profile and snapshots:

- `requestType`
- `commercialMode`
- `baseSessionPriceUsd` (integer cents)
- `sessionDurationMinutes`

Legacy applications without these fields are treated as `free_request` / `giving_back`.

## Application state machine

```
                    apply (server derives requestType)
                              │
                              ▼
                        ┌──────────┐
                        │ pending  │
                        └────┬─────┘
              decline        │         accept
                 │           │           │
                 ▼           │           ▼
           ┌──────────┐      │    ┌──────────┐
           │ declined │      │    │ accepted │  (terminal for application doc)
           └──────────┘      │    └──────────┘
                               │
              FREE_REQUEST: same transitions as today
              PAID_REQUEST: same transitions — Apply does NOT create a relationship;
                              Accept still creates/reactivates relationship server-side
```

**Paid apply does not skip the application step.** Clicking apply only creates a `pending` application with `requestType: paid_request`.

## Relationship commercial gate (payment placeholder)

On accept, the server copies the application commercial snapshot onto the relationship and sets:

| Field | `free_request` | `paid_request` |
|-------|----------------|----------------|
| `paymentRequired` | `false` | `true` |
| `paymentSatisfied` | `true` | `false` |

Until payment is implemented, `paymentSatisfied` stays `false` for paid requests. The domain helper `paidMentorshipServicesBlocked()` returns `true` when paid services must not be delivered yet.

**Gated today (no payment processing yet):**

- `canStartLearningJourney` — learner cannot start a Learning Journey on a paid request until `paymentSatisfied` is true.

Messaging and workspace read access are unchanged so mentors and learners can still coordinate. Payment collection will set `paymentSatisfied` in a future task.

## Server authority (unchanged)

| Action | Authority |
|--------|-----------|
| Derive `requestType` / commercial snapshot | Server only (apply route) |
| Create / update application status | Server only |
| Create / reactivate relationship | Server only (accept route) |
| Mentor identity | Resolved from slug server-side; never client-controlled |

## Backwards compatibility

| Scenario | Behaviour |
|----------|-----------|
| Legacy application without `requestType` | Normalized to `free_request` |
| Legacy relationship without commercial fields | Treated as free; services not blocked |
| Mentor changes from paid → free after an application | Existing pending `paid_request` keeps its snapshot; new applications use current mentor profile |
| Mentor profile without `commercialMode` | Defaults to `giving_back` → `free_request` |

## Invalid apply targets (rejected server-side)

- Paid commercial mode (`professional` / `premium`) without a valid positive `baseSessionPriceUsd`
- Unapproved, unpublished, or not-accepting mentor (existing rules)
- Invalid application message (existing rules)
