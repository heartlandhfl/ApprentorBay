# ApprentorBay

A mentorship harbor — structured pairings and living learning contracts.

This repository is a clean rebuild. The scaffold below is the only code that exists.

## Stack

- **Client:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Server:** Express (Node/TypeScript) — one app, one health route
- **Data / auth:** Firebase (Firestore + Firebase Auth)
- **Deploy:** static Vite build + Node host (Express serves `client/dist` in production)

## Folder structure

```
/client                 React app
  /components           Shared UI library only
  /features             One folder per feature (empty until later prompts)
    /profiles
    /mentorship
    /learning-contracts
    /admin
  /routes
  /lib                  firebase.ts, api.ts
/server                 Express
  /src/routes
  /src/middleware
  /src/lib
/shared                 TypeScript types — single source of truth
firestore.rules         Deny-by-default Firestore rules
.env.example            Placeholder Firebase + server config
```

## Design system

| Token        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Type scale   | 12 / 14 / 16 / 20 / 24 / 32 / 48 (8px line-height grid)               |
| Spacing      | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64                                   |
| Accent       | Copper rust `#B4532A`                                                 |
| Typefaces    | Instrument Serif (display) + Instrument Sans (UI)                     |
| Components   | Button, Input, Card, Badge, Modal, Stepper, EmptyState, Text, Page    |

Every page composes only the shared library. Multi-step flows must reuse `Stepper` — do not add a second stepper.

## Setup

1. Copy `.env.example` to `.env` and fill in a real Firebase project (placeholders boot the SDK without throwing).
2. Install and run both apps:

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API health: http://localhost:3001/api/health (also proxied as `/api/health` from Vite)

## Scripts

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Client + server together              |
| `npm run build`  | Typecheck + Vite production build     |
| `npm start`      | Serve API (and `client/dist` in prod) |

## Firebase

Client config uses `VITE_FIREBASE_*` variables. Server Admin uses `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. The real `.env` is gitignored.

`firestore.rules` denies public read/write. Signed-in users may manage their own `users` / `profiles` documents; pairing members may read and update `mentorships` and `learningContracts`. Everything else is denied.
