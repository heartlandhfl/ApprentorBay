# Mentorship video sessions

Periodic one-to-one video calls between a learner and mentor inside an active mentorship relationship.

## Environment variables

### MVP (public Jitsi)

| Variable | Where | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `JITSI_DOMAIN` | Server | No | `meet.jit.si` | Domain passed to the client join payload. Room names are server-generated (`ab-{sessionId}`). |
| `VITE_JITSI_DOMAIN` | Client | No | — | Not required for MVP. The client uses the domain returned by `POST /api/sessions/:id/join`. |

No client secrets are needed for MVP. Users never type or choose Jitsi room names.

### Production (JaaS or self-hosted)

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `JITSI_DOMAIN` | Server | Yes | e.g. `8x8.vc` or your self-hosted domain |
| `JITSI_APP_ID` | Server | JaaS only | From the 8x8 developer console |
| `JITSI_API_KEY_ID` | Server | JaaS only | JWT key id (`kid`) |
| `JITSI_PRIVATE_KEY` | Server | JaaS/self-hosted | PEM used to sign short-lived join JWTs — never expose to the browser |

When JWT support is enabled server-side, extend `POST /api/sessions/:id/join` to return a `jwt` field and switch the embed to `JaaSMeeting` or pass `jwt` to `JitsiMeeting`.

## Routes

- Workspace sessions list: `/dashboard/mentorships/:relationshipId`
- Pre-join + embedded meeting: `/dashboard/mentorships/:relationshipId/sessions/:sessionId`

Only pairing members (or admins) can open the meeting route. Join is authorised again on the server before the room name is returned.

## Operations

- Schedule: `POST /api/sessions`
- List: `GET /api/sessions?relationshipId=`
- View: `GET /api/sessions/:id`
- Join: `POST /api/sessions/:id/join`
- Cancel: `POST /api/sessions/:id/cancel`
- Complete: `POST /api/sessions/:id/complete`

Leaving a meeting calls **complete** so the session moves to `completed`.
