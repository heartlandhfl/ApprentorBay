import {
  CHECKOUT_SESSION_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  type CheckoutSession,
  type CheckoutSessionStatus,
  type PaymentIntent,
  type PaymentRefund,
  type PaymentStatus,
  type RefundStatus,
} from './payments.js';
import type { IsoDateString } from './users.js';

export type PaymentIntentAction =
  | { type: 'CHECKOUT_CREATED'; checkoutSessionId: string; providerPaymentIntentId: string }
  | { type: 'PROVIDER_PROCESSING' }
  | { type: 'WEBHOOK_PAYMENT_SUCCEEDED'; paidAt: IsoDateString; providerChargeId?: string }
  | {
      type: 'WEBHOOK_PAYMENT_FAILED';
      failureCode?: string;
      failureMessage?: string;
    }
  | { type: 'WEBHOOK_PAYMENT_CANCELLED' }
  | { type: 'CANCEL'; cancelledAt: IsoDateString }
  | { type: 'REFUND_SUCCEEDED' }
  | { type: 'RECONCILIATION_SUCCEEDED'; paidAt: IsoDateString };

export type CheckoutSessionAction =
  | { type: 'CHECKOUT_OPENED'; checkoutUrl: string; expiresAt: IsoDateString; providerCheckoutSessionId: string }
  | { type: 'CHECKOUT_COMPLETED' }
  | { type: 'CHECKOUT_EXPIRED' };

export type RefundAction =
  | { type: 'REFUND_SUBMITTED'; providerRefundId: string }
  | { type: 'REFUND_SUCCEEDED'; succeededAt: IsoDateString }
  | { type: 'REFUND_FAILED' }
  | { type: 'REFUND_CANCELLED' };

export function canApplyPaymentIntentAction(
  status: PaymentStatus,
  action: PaymentIntentAction['type'],
): boolean {
  switch (action) {
    case 'CHECKOUT_CREATED':
      return status === PAYMENT_STATUS.draft || status === PAYMENT_STATUS.requiresPaymentMethod;
    case 'PROVIDER_PROCESSING':
      return (
        status === PAYMENT_STATUS.requiresPaymentMethod || status === PAYMENT_STATUS.processing
      );
    case 'WEBHOOK_PAYMENT_SUCCEEDED':
    case 'RECONCILIATION_SUCCEEDED':
      return status === PAYMENT_STATUS.processing || status === PAYMENT_STATUS.requiresPaymentMethod;
    case 'WEBHOOK_PAYMENT_FAILED':
      return (
        status === PAYMENT_STATUS.processing ||
        status === PAYMENT_STATUS.requiresPaymentMethod ||
        status === PAYMENT_STATUS.draft
      );
    case 'WEBHOOK_PAYMENT_CANCELLED':
    case 'CANCEL':
      return (
        status === PAYMENT_STATUS.draft ||
        status === PAYMENT_STATUS.requiresPaymentMethod ||
        status === PAYMENT_STATUS.processing
      );
    case 'REFUND_SUCCEEDED':
      return status === PAYMENT_STATUS.paid || status === PAYMENT_STATUS.partiallyRefunded;
    default:
      return false;
  }
}

export function reducePaymentIntent(
  intent: PaymentIntent,
  action: PaymentIntentAction,
  now: IsoDateString,
): PaymentIntent {
  if (!canApplyPaymentIntentAction(intent.status, action.type)) {
    throw new Error(`Cannot apply ${action.type} to payment intent in status ${intent.status}`);
  }

  switch (action.type) {
    case 'CHECKOUT_CREATED':
      return {
        ...intent,
        status: PAYMENT_STATUS.requiresPaymentMethod,
        providerPaymentIntentId: action.providerPaymentIntentId,
        latestCheckoutSessionId: action.checkoutSessionId,
        updatedAt: now,
      };
    case 'PROVIDER_PROCESSING':
      return {
        ...intent,
        status: PAYMENT_STATUS.processing,
        updatedAt: now,
      };
    case 'WEBHOOK_PAYMENT_SUCCEEDED':
    case 'RECONCILIATION_SUCCEEDED':
      return {
        ...intent,
        status: PAYMENT_STATUS.paid,
        paidAt: action.paidAt,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      };
    case 'WEBHOOK_PAYMENT_FAILED':
      return {
        ...intent,
        status: PAYMENT_STATUS.failed,
        failureCode: action.failureCode ?? null,
        failureMessage: action.failureMessage ?? null,
        updatedAt: now,
      };
    case 'WEBHOOK_PAYMENT_CANCELLED':
    case 'CANCEL':
      return {
        ...intent,
        status: PAYMENT_STATUS.cancelled,
        cancelledAt: action.type === 'CANCEL' ? action.cancelledAt : now,
        updatedAt: now,
      };
    case 'REFUND_SUCCEEDED':
      return {
        ...intent,
        status: PAYMENT_STATUS.refunded,
        updatedAt: now,
      };
    default:
      return intent;
  }
}

export function reduceCheckoutSession(
  session: CheckoutSession,
  action: CheckoutSessionAction,
  now: IsoDateString,
): CheckoutSession {
  switch (action.type) {
    case 'CHECKOUT_OPENED':
      if (session.status !== CHECKOUT_SESSION_STATUS.open) {
        throw new Error(`Cannot open checkout session in status ${session.status}`);
      }
      return {
        ...session,
        checkoutUrl: action.checkoutUrl,
        expiresAt: action.expiresAt,
        providerCheckoutSessionId: action.providerCheckoutSessionId,
        updatedAt: now,
      };
    case 'CHECKOUT_COMPLETED':
      if (session.status !== CHECKOUT_SESSION_STATUS.open) {
        return session;
      }
      return {
        ...session,
        status: CHECKOUT_SESSION_STATUS.complete,
        updatedAt: now,
      };
    case 'CHECKOUT_EXPIRED':
      if (session.status !== CHECKOUT_SESSION_STATUS.open) {
        return session;
      }
      return {
        ...session,
        status: CHECKOUT_SESSION_STATUS.expired,
        updatedAt: now,
      };
    default:
      return session;
  }
}

export function reducePaymentRefund(
  refund: PaymentRefund,
  action: RefundAction,
  now: IsoDateString,
): PaymentRefund {
  switch (action.type) {
    case 'REFUND_SUBMITTED':
      if (refund.status !== REFUND_STATUS.pending) {
        throw new Error(`Cannot submit refund in status ${refund.status}`);
      }
      return {
        ...refund,
        providerRefundId: action.providerRefundId,
        updatedAt: now,
      };
    case 'REFUND_SUCCEEDED':
      if (refund.status !== REFUND_STATUS.pending) {
        throw new Error(`Cannot succeed refund in status ${refund.status}`);
      }
      return {
        ...refund,
        status: REFUND_STATUS.succeeded,
        succeededAt: action.succeededAt,
        updatedAt: now,
      };
    case 'REFUND_FAILED':
      if (refund.status !== REFUND_STATUS.pending) {
        throw new Error(`Cannot fail refund in status ${refund.status}`);
      }
      return {
        ...refund,
        status: REFUND_STATUS.failed,
        updatedAt: now,
      };
    case 'REFUND_CANCELLED':
      if (refund.status !== REFUND_STATUS.pending) {
        throw new Error(`Cannot cancel refund in status ${refund.status}`);
      }
      return {
        ...refund,
        status: REFUND_STATUS.cancelled,
        updatedAt: now,
      };
    default:
      return refund;
  }
}

export function isTerminalCheckoutStatus(status: CheckoutSessionStatus): boolean {
  return status === CHECKOUT_SESSION_STATUS.complete || status === CHECKOUT_SESSION_STATUS.expired;
}
