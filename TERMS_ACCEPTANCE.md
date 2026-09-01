# Terms acceptance

ApprentorBay records an explicit confirmation at account creation. Opening the Terms page is not acceptance.

## Confirmation

The required, unchecked checkbox uses this exact wording:

> I confirm that I am legally eligible to use ApprentorBay and agree to the Terms of Use.

It appears on the signup Terms step and again on the create-account form. Continue and Create account stay disabled until it is checked. The client passes the live checkbox value into signup; it does not hard-code acceptance.

A link to `/legal/terms` sits next to the checkbox.

## What is stored

On `users/{uid}`:

| Field | Meaning |
| --- | --- |
| `termsAccepted` | `true` only after the confirmation |
| `termsVersion` | Current `TERMS_CONFIG.version` |
| `termsAcceptedAt` | ISO timestamp of the confirmation |

`buildTermsAcceptance(now)` is the only helper that writes this trio.

## Configuration

Edit `shared/legal/terms.ts` — `TERMS_CONFIG`:

- `version` — stored on the account; bump when the binding text changes
- `effectiveDate` — `YYYY-MM-DD` (UTC), currently `2026-09-10`

`termsEffectiveLabel()` describes the date. Before 10 September 2026 it says the Terms take effect on that day and are **not yet in force**. It never presents future Terms as already effective.

## Where the full Terms appear

- Signup (summary + link)
- Public footer on every `Page`
- `/legal/terms` for visitors and signed-in users (no redirect away)

## Enforcement

1. Shared `validateSignupTermsAcceptance` rejects anything other than `accepted: true`.
2. Shared `isValidTermsAcceptance` requires the confirmation, the current version, and a timestamp.
3. Client `signUp` refuses to create a Firebase user until validation passes, then writes the three fields.
4. Firestore `users` create requires `termsAccepted == true` plus version and timestamp. Updates cannot set `termsAccepted` to false.
5. `POST /api/account/terms` records a version bump. The body must include `accepted: true`. `TermsGate` uses this endpoint, not a client-only write.
6. Profile bootstrap refuses to continue if `needsTermsAcceptance(account)` is true.

A user document that only has `termsAcceptedAt` / `termsVersion` (older accounts) is treated as not yet confirmed. The gate asks for the same checkbox, then the server writes `termsAccepted: true`.

## Checks

- Signup without the checkbox: client validation fails; Firestore would also deny the user document.
- Signup with the checkbox: the user document stores the three fields at the current version.
- `/legal/terms` stays readable from the footer with no login.
