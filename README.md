# ApprentorBay

A mentorship and apprenticeship app — structured pairings and living learning contracts.

## Stack

- **Client:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Server:** Express (Node/TypeScript) — one app, one health route
- **Data / auth:** Firebase (Firestore + Firebase Auth)
- **Local data:** Auth + Firestore emulators (`npm run dev` starts them)
- **Deploy:** Node.js / Express host (`app.js`). Express serves `/api/*` and `client/dist`. Do not deploy as a static Vite site.

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
SECURITY_AUDIT.md       Live collection matrix, query compatibility, findings
SECURITY_FIXES.md       Security changes from that audit
```

## Data model (`/shared/types.ts`)

A user has exactly one role, set at signup: `mentor` | `learner` | `admin`.

| Collection | Shape |
| --- | --- |
| `/users/{uid}` | `uid`, `role`, `email`, `displayName`, `active`, `accountStatus`, `createdAt` |
| `/learnerProfiles/{uid}` | Private learner record. Visitors read `publicProfiles` instead |
| `/mentorProfiles/{uid}` | Private mentor record. `verificationStatus` is participation **approval**; `verificationCaseStatus` is a separate evidence check |
| `/publicProfiles/{slug}` | Published projection only. No email, uid, or hidden location |
| `/profileSlugs/{slug}` | Server-only slug uniqueness index |
| `/mentorshipApplications/{id}` | learnerId, mentorId, message, status (`pending` / `accepted` / `declined`) |
| `/mentorshipRelationships/{id}` | learnerId, mentorId, status (`active` / `ended`) |
| `/messages/{id}` | relationshipId, senderId, text, createdAt |
| `/learningContracts/{id}` | relationshipId, status, currentStepOwner, goal, objectives, milestones, deliverable |
| `/adminAuditLogs/{id}` | Server-only admin actions: adminId, action, targetUserId, reason, timestamp |
| `/supportIssues/{id}` | Signed-in reports. Admins resolve them. Clients cannot update. |

Signup writes the user doc and the matching profile in one Firestore transaction. New mentors always start as `verificationStatus: 'pending'`.

## Routes

| Path | Who |
| --- | --- |
| `/how-it-works` | Public explanation of pairing, contract, and deliverable |
| `/signup` | Role first (Mentor or Learner), then the Terms, then the role-specific form |
| `/login` | Email / password |
| `/learners/:slug` | Public learner profile. Portfolio is the strongest section. `:slug` is not a Firebase UID |
| `/mentors/:slug` | Public mentor profile. **Approved** means participation; **Verified** is a specific claim |
| `/admin` | Admin dashboard: approvals, verification, account governance, support, audit log. Guarded in React **and** Express **and** Firestore rules |
| `/support` | Signed-in users can file a support issue |
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
| `npm run build` | Shared types + Vite client + Express |
| `npm start` | `node app.js` — API and `client/dist` |
| `npm run create-admin` | Create the live Firebase admin (production credentials only) |

## Production (Hostinger)

`https://apprentorbay.com` was serving the Vite files as static hosting. That is why `/api/health` and `/admin` 404: Hostinger never started Express.

The site must be a **Node.js web app**, not a static / Vite website.

1. In hPanel → **Websites**, remove the existing static site for `apprentorbay.com` (Hostinger will not attach a Node app to a domain that already has a site).
2. **Add Website** → **Node.js web app** → import this GitHub repo (or upload a zip **without** `node_modules` / `.git`).
3. Override auto-detect if it picks Vite:

   | Setting | Value |
   | --- | --- |
   | Framework | **Express** or **Other** — not Vite / React / static |
   | Node.js | **20** or **22** |
   | Build command | `npm run build` |
   | Entry file | `app.js` |
   | Output directory | leave empty (or `client/dist` only if the panel requires one; Express still serves it) |
   | Package manager | npm |

4. Set environment variables **before** the first build (`VITE_*` are compiled into the client):

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `VITE_USE_FIREBASE_EMULATOR` | `false` |
   | `USE_FIREBASE_EMULATOR` | `false` |
   | `CLIENT_ORIGIN` | `https://apprentorbay.com` |
   | `VITE_FIREBASE_API_KEY` | from Firebase project settings |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `apprentorbay.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `apprentorbay` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `apprentorbay.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | from Firebase |
   | `VITE_FIREBASE_APP_ID` | from Firebase |
   | `FIREBASE_PROJECT_ID` | `apprentorbay` |
   | `FIREBASE_CLIENT_EMAIL` | Admin SDK service account email |
   | `FIREBASE_PRIVATE_KEY` | full private key, with `\n` for newlines |

   Hostinger assigns `PORT`. The app already listens on `process.env.PORT` and `0.0.0.0`.

5. Deploy. Confirm `https://apprentorbay.com/api/health` returns JSON:

   ```json
   { "ok": true, "service": "apprentorbay-api", ... }
   ```

   If you still get Hostinger’s HTML “This Page Does Not Exist”, the domain is still on the static site. Runtime logs should show `ApprentorBay API listening` and `Serving client from .../client/dist`.

6. Create the production admin **once**, on your machine (not on Hostinger), with the live Admin SDK key and a unique password — never `ApprentorBayAdmin-2026`:

   ```bash
   # in .env: USE_FIREBASE_EMULATOR=false, FIREBASE_* , SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
   npm run create-admin
   ```

   Sign in at `https://apprentorbay.com/login`, then open `/admin`.

Signup cannot grant `admin`. Firestore freezes `role` after create. Local emulator admin remains `admin@apprentorbay.test` / `ApprentorBayAdmin-2026`.

Your plan must include Hostinger **Node.js / Web Apps** (Business or Cloud). Shared-hosting file upload to `public_html` cannot run this API.
