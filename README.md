# ApprentorBay

A mentorship and apprenticeship app — structured pairings and living learning contracts.

## Stack

- **Client:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Server:** Express (Node/TypeScript) — one app, one health route
- **Data / auth:** Firebase (Firestore + Firebase Auth)
- **Local data:** Auth + Firestore emulators (`npm run dev` starts them)
- **Deploy:** static Vite build + Node host (Express serves `client/dist` in production)

## Folder structure

```
/client
  /components           Shared UI library only
  /features/profiles    Profile reads
  /features/admin
  /routes               Pages (signup, login, profiles, verification)
  /lib                  firebase.ts, api.ts, auth.tsx
/server
  /routes               health.ts, admin.ts
  /middleware           errorHandler.ts, requireAdmin.ts
  /lib                  firebase.ts, seedAdmin.ts
/shared                 TypeScript types — single source of truth
firestore.rules         Deny-by-default + owner/admin/public profile rules
```

## Data model (`/shared/types.ts`)

A user has exactly one role, set at signup: `mentor` | `learner` | `admin`.

| Collection | Shape |
| --- | --- |
| `/users/{uid}` | `uid`, `role`, `email`, `displayName`, `createdAt` |
| `/learnerProfiles/{uid}` | education, jobStatus, careerAspirations, competencyGoals, deliverables, public |
| `/mentorProfiles/{uid}` | education, experience, deliverables, reviews, verificationStatus, public |
| `/mentorshipApplications/{id}` | learnerId, mentorId, message, status (`pending` / `accepted` / `declined`) |
| `/mentorshipRelationships/{id}` | learnerId, mentorId, status (`active` / `ended`) |
| `/messages/{id}` | relationshipId, senderId, text, createdAt |
| `/learningContracts/{id}` | relationshipId, status, currentStepOwner, goal, objectives, milestones, deliverable |

Signup writes the user doc and the matching profile in one Firestore transaction. New mentors always start as `verificationStatus: 'pending'`.

## Routes

| Path | Who |
| --- | --- |
| `/how-it-works` | Public explanation of pairing, contract, and deliverable |
| `/signup` | Role first (Mentor or Learner), then the Terms, then the role-specific form |
| `/login` | Email / password |
| `/learners/:id` | Public learner profile (empty states when fields are blank) |
| `/mentors/:id` | Public mentor profile + Verified / Pending Approval / Rejected badge |
| `/admin/verification` | Admin-only pending table. Guarded in React **and** Express **and** Firestore rules |
| `/dashboard/applications` | Mentor inbox of pending applications (Accept / Decline) |
| `/dashboard/messages` | Active pairings |
| `/dashboard/messages/:relationshipId` | Real-time chat. The only **Start Learning Journey** entry point lives here |
| `/dashboard/journey/:relationshipId` | One stepper, one state machine. Mutations go through Express |

## Setup

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001/api/health
- Emulators: Auth `:9099`, Firestore `:8080`, UI `:4000`

A local admin is seeded when emulators are on:

- Email: `admin@apprentorbay.test`
- Password: `ApprentorBayAdmin-2026` (override with `SEED_ADMIN_*` in `.env`)

Set `VITE_USE_FIREBASE_EMULATOR=false` and fill real Firebase Admin credentials to point at a live project.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Emulators + client + server |
| `npm run emulators` | Auth + Firestore emulators only |
| `npm run build` | Typecheck + Vite production build |
| `npm start` | Serve API (and `client/dist` in prod) |
