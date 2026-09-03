# Mentorship video sessions

Periodic one-to-one video calls between a learner and mentor inside an active mentorship relationship.

## Environment variables

### Production (JaaS or self-hosted — required)

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `JITSI_DOMAIN` | Server | Yes | e.g. `8x8.vc` (JaaS) or your self-hosted domain |
| `JITSI_PRIVATE_KEY` | Server | Yes | PEM used to sign short-lived join JWTs — never expose to the browser |
| `JITSI_APP_ID` | Server | JaaS only | From the 8x8 developer console (`sub` claim) |
| `JITSI_API_KEY_ID` | Server | JaaS only | JWT key id (`kid` header) |
| `JITSI_JWT_TTL_SECONDS` | Server | No | Join token lifetime (default `600`, i.e. 10 minutes) |

Self-hosted Jitsi with token authentication uses the same signing variables; set `JITSI_APP_ID` to your Prosody application id when not on JaaS.

No client secrets are needed. Users never type or choose Jitsi room names.

### Local development

Configure the same server variables (generate an RSA key pair for `JITSI_PRIVATE_KEY`). The client always receives `domain`, `roomName`, and a signed `jwt` from `POST /api/sessions/:id/join` after `canJoinSession` passes — there is no anonymous `meet.jit.si` join path.

## Routes

- Workspace sessions list: `/dashboard/mentorships/:relationshipId`
- Pre-join + embedded meeting: `/dashboard/mentorships/:relationshipId/sessions/:sessionId`

Only pairing members (or admins) can open the meeting route. Join is authorised again on the server before the room name and JWT are returned.

`GET /api/sessions` and `GET /api/sessions/:id` never include `roomName` — only the authorised join endpoint returns the room slug with its JWT.

## Operations

- Schedule: `POST /api/sessions`
- List: `GET /api/sessions?relationshipId=`
- View: `GET /api/sessions/:id`
- Join: `POST /api/sessions/:id/join` → `{ domain, roomName, jwt, userInfo }`
- Cancel: `POST /api/sessions/:id/cancel`
- Complete: `POST /api/sessions/:id/complete`

Leaving a meeting calls **complete** so the session moves to `completed`.

## JWT claims

Short-lived RS256 tokens are minted only after `canJoinSession` succeeds:

- Header: `alg: RS256`, `kid: JITSI_API_KEY_ID` (JaaS)
- Payload: `aud: jitsi`, `iss: chat` (JaaS) or your app id (self-hosted), `sub: JITSI_APP_ID` or domain, `room` (JaaS: `{appId}/{roomName}`), `context.user`, `nbf` / `exp`

The React embed passes `jwt` to `@jitsi/react-sdk` `JitsiMeeting`; connections without a valid token are rejected by JaaS/self-hosted Jitsi.
