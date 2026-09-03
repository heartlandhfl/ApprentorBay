# Payment Production Deployment Checklist

Use this checklist when deploying ApprentorBay payments (Stripe, USD) to production.

## 1. Environment variables

Set these in your hosting provider (e.g. Hostinger hPanel → Environment variables). **Never commit real values to git.**

| Variable | Required | Purpose |
|----------|----------|---------|
| `PAYMENT_PROVIDER` | Yes | Must be `stripe` in production |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret from the production webhook endpoint (`whsec_...`) |
| `PLATFORM_FEE_BPS` | Recommended | Marketplace commission in basis points (default `1500` = 15%) |
| `CLIENT_ORIGIN` | Yes | Public site origin, e.g. `https://apprentorbay.com` (used for checkout return/cancel URLs) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional | Publishable key (`pk_live_...`) if/when client checkout UI is added |

Existing Firebase and app variables (`FIREBASE_*`, `PORT`, etc.) remain required as today.

### Local / staging only

| Variable | Value |
|----------|-------|
| `PAYMENT_PROVIDER` | `mock` or `stripe` |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or test webhook endpoint |

## 2. Stripe Dashboard configuration

1. **Business profile** — confirm USD charges are enabled for your account country.
2. **API keys** — create restricted live keys if your security policy requires least privilege.
3. **Webhook endpoint**
   - URL: `https://<your-production-domain>/api/webhooks/payments`
   - Events to subscribe:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `payment_intent.processing`
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `charge.refunded`
4. Copy the endpoint **signing secret** into `STRIPE_WEBHOOK_SECRET`.
5. **Branding** — configure Checkout branding (logo, colors) in Stripe Dashboard.

## 3. Firestore

1. Deploy updated rules: `firebase deploy --only firestore:rules`
2. Deploy indexes: `firebase deploy --only firestore:indexes`
3. Verify new collections are server-write-only:
   - `paymentIntents`
   - `checkoutSessions`
   - `paymentRefunds`
   - `paymentEvents`
   - `paymentWebhookDedup`

## 4. Application deployment

1. `npm run build`
2. Deploy the Node/Express app (`app.js` entrypoint)
3. Confirm `/api/health` returns healthy Firebase Admin status
4. Confirm `GET /api/payments/return` and `/api/payments/cancel` are reachable (auth required)

## 5. Manual verification (production smoke test)

Use a **Stripe test mode** deployment first, then repeat in live mode with a small real charge.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Learner accepts paid mentorship → creates booking | Booking `pending_payment` |
| 2 | `POST /api/payments/checkout` with `{ bookingId }` | Returns `checkoutUrl` |
| 3 | Complete Stripe Checkout with test card `4242...` | Redirect to return URL (non-authoritative) |
| 4 | Wait for webhook delivery | `paymentIntents.status = paid`, booking `paid`, relationship `paymentSatisfied = true` |
| 5 | Learner starts Learning Journey | Allowed |
| 6 | Decline test card `4000...0002` | Booking/payment `failed` via webhook |
| 7 | Abandon checkout | `checkout.session.expired` or cancel URL — booking stays unpaid |
| 8 | Admin `POST /api/refunds` on paid intent | Refund recorded; booking `refunded` |
| 9 | Replay same webhook in Stripe Dashboard | No double-apply (`paymentWebhookDedup`) |

## 6. Security checks

- [ ] Webhook route uses raw body parsing **before** `express.json()`
- [ ] Invalid webhook signatures return `400`
- [ ] No card numbers, CVV, or credentials logged
- [ ] Client cannot submit `amountCents`, `currency`, `mentorAmountCents`, or `platformFeeCents`
- [ ] Browser return URL never marks payments paid
- [ ] `paymentWebhookDedup` collection is not client-readable/writable

## 7. Operations

| Task | How |
|------|-----|
| Reconcile stuck payments | Call `paymentService.reconcileStuckPayments()` via scheduled job (query intents in `processing` older than 15 minutes) |
| Audit trail | Read `paymentEvents` (admin) and `adminAuditLogs` for `PAYMENT_*` events |
| Refunds | `POST /api/refunds` (admin only) with `paymentIntentId` |
| Incident response | Disable checkout by removing `STRIPE_SECRET_KEY` or setting maintenance flag; existing paid bookings remain valid |

## 8. Out of scope (do not configure on ApprentorBay)

- Mercado Pago
- BRL / PIX / Brazil-specific payment methods
- Per-mentor provider selection in application code

Brazil-specific payments belong in a separate `mentorbay.com.br` deployment with its own provider adapter and environment configuration.
