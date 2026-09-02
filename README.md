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
| `npm run build` | Vite client + bundled `dist/server.js` (Hostinger) |
| `npm start` | `node app.js` — loads `dist/server.js` |
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
   | Entry file | **`dist/server.js`** (or `app.js`) |
   | Output directory | **`dist`** |
   | Package manager | npm |

   A 503 with Hostinger’s “temporarily busy” page means Node started and then crashed. Open the website → **Runtime Logs** (or `nodejs/stderr.log`). After this build, `/api/health` should return JSON even on a bad boot so you can see the error.

   Do **not** leave Output directory as `client/dist` or Entry as a Vite file. That is the static-site setup and will 404 or 503.

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
   | `FIREBASE_CLIENT_EMAIL` | Admin SDK service account email (optional if using the JSON base64 var) |
   | `FIREBASE_SERVICE_ACCOUNT_BASE64` | **preferred on Hostinger** — one-line base64 of the downloaded service-account JSON (`node scripts/encode-firebase-key.mjs ./file.json`) |
   | `FIREBASE_PRIVATE_KEY` | avoid on Hostinger — the panel often turns PEM newlines into the letter `n` and OpenSSL then reports `DECODER routines::unsupported` |

   Hostinger assigns `PORT`. The app already listens on `process.env.PORT` and `0.0.0.0`.

5. Deploy. Confirm `https://apprentorbay.com/api/health` returns JSON:

   ```json
   { "ok": true, "service": "apprentorbay-api", ... }
   ```

   If you still get Hostinger’s HTML “This Page Does Not Exist”, the domain is still on the static site. Runtime logs should show `ApprentorBay API listening` and `Serving client from .../dist/public`.

   If you get **503 Service Unavailable**, the Node process is crashing. Redeploy with Entry `dist/server.js` and Output `dist`, then check Runtime Logs. Common causes: build never produced `dist/server.js`, a bad `FIREBASE_PRIVATE_KEY`, or the panel still using the Vite preset.

6. Create the first production admin (signup cannot grant `admin`):

   In hPanel environment variables, set a **unique** operator password — never `ApprentorBayAdmin-2026`:

   | Name | Value |
   | --- | --- |
   | `SEED_ADMIN_EMAIL` | your operator email |
   | `SEED_ADMIN_PASSWORD` | a unique production password |

   Redeploy or Restart. On boot, if Firebase Admin is initialized and **no** `users.role == admin` exists, Express creates that Auth user and Firestore doc. Sign in at `/login`, then open `/admin`.

   A console document at `admins/{uid}` (email + uid) is not enough by itself. Express copies it into `users/{uid}` with `role: admin` on boot and when you POST `/api/account/session`. You still need a Firebase Auth user for that email. Use **Reset password** on `/login` if you do not know the Auth password. To create the Auth user automatically, set `SEED_ADMIN_PASSWORD` and restart.

   `https://apprentorbay.com/api/health` must show `"adminInitialized": true`. If `firebase.error` mentions `DECODER routines::unsupported`, Hostinger stored a corrupted PEM. Do not paste `FIREBASE_PRIVATE_KEY` again. On your laptop:

   ```bash
   node scripts/encode-firebase-key.mjs ./your-service-account.json
   ```

   Set `FIREBASE_SERVICE_ACCOUNT_BASE64` to the printed one-line value (no quotes). It **must start with `eyJ`**. If it starts with `MII`, you pasted `private_key` from the JSON instead of encoding the file. Keep `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` if you already have them. **Redeploy** (not only Restart). Health should show `"adminInitialized": true`. `"keySource": "service-account-base64"` means the JSON file was used; `"private-key-base64"` means Express recovered a pasted key body and still needs `FIREBASE_CLIENT_EMAIL`.

   You can also run `npm run create-admin` on your machine with the same vars. After the first admin exists, later boots skip bootstrap.

Signup cannot grant `admin`. Firestore freezes `role` after create. Local emulator admin remains `admin@apprentorbay.test` / `ApprentorBayAdmin-2026`.

Your plan must include Hostinger **Node.js / Web Apps** (Business or Cloud). Shared-hosting file upload to `public_html` cannot run this API.
