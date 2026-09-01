# Public profile system

**Collections:** `publicProfiles/{slug}`, `profileSlugs/{slug}`  
**Private records:** `learnerProfiles/{uid}`, `mentorProfiles/{uid}` (owner, pairing, or admin)  
**Account:** `users/{uid}` (never public; holds email)

A public profile exists because a **published projection** was written. Visitors do not read the private profile document. Creating an account does not, by itself, expose private fields.

Public URLs use a **slug**, not a Firebase UID: `/learners/{slug}` and `/mentors/{slug}`. Account-id-shaped paths 404. `/learners/me` and `/mentors/me` open the signed-in owner's profile after a slug exists.

Photos are stored at `profile-photos/{slug}/…`, never under the Firebase UID.

---

## Learner public profile

1. **Profile** — name, photo, professional identity, optional location (only if the learner marks location public)
2. **Portfolio** — completed deliverables and showcases (the strongest section)
3. **Competency development** — skills being developed, skills demonstrated
4. **Career status**
5. **Career aspirations**
6. **Traditional education** — education, qualifications, certifications

## Mentor public profile

1. **Profile** — name, photo, professional identity, optional location, **Approved** vs **Verified** badges
2. **Education**
3. **Professional experience**
4. **Areas of expertise**
5. **Professional goals / interests**
6. **Mentoring interests**
7. **Mentored deliverables** — learner remains the creator
8. **Reviews** — author name and rating; no `authorId`

---

## Approved vs verified

| Badge | Meaning |
| --- | --- |
| **Approved** | The platform approved participation (`verificationStatus` on the private mentor record). |
| **Verified** | A **specific claim** was checked (`verifiedClaims`: identity, education, or professional experience). |

Approval is **not** a comprehensive background check. The directory and mentor profile say so. Mentors are not shown as “Verified” merely because they may participate.

---

## Privacy

| Data | Public visitor | Owner | Pairing | Admin |
| --- | --- | --- | --- | --- |
| `publicProfiles/{slug}` if `published` | yes | yes | yes | yes |
| Unpublished public projection | no | yes (own page) | no | yes |
| `learnerProfiles` / `mentorProfiles` | **no** | yes | yes | yes |
| `users` (email, uid) | **no** | yes | no | yes |
| `profileSlugs` (slug → uid) | **no** | no | no | no (server only) |
| Location | only if `locationPublic` | yes | yes | yes |
| Showcase `learnerId` / files | not on the public projection; `showcases` is pairing/admin only | pairing/owner via `showcases` | pairing | yes |
| Photo storage path | `profile-photos/{slug}/…` | yes | yes | yes |

The public document omits `userId`, `email`, `deliverables[]`, `authorId`, and hidden location.

Edits go through `PUT /api/profiles/me`. Client writes to private profiles after signup are denied. Slug uniqueness is a transaction on `profileSlugs/{slug}`.

---

## Slugs

- Generated from display name (`ada-lovelace`), then `-2`, `-3` on collision.
- Reserved words (`admin`, `login`, `mentors`, …) are rejected.
- Strings that look like a Firebase UID are rejected.
- Changing a slug deletes the old slug and public document in the same transaction.
- Apply uses `POST /api/applications` with `mentorSlug` so the public page does not need a UID.

---

## Tests that must stay green

1. Public visitor can read a published `publicProfiles` document and cannot read `learnerProfiles` / `mentorProfiles` / `users`.
2. Owner can read and edit their private profile; location stays off the public page until they opt in.
3. Pairing members can read each other’s private profiles for the workspace, not for the public directory.
4. Admin can read both and decide **approval** separately from **verified claims**.
5. A second slug claim for the same string fails; retries by the owner keep one record.
