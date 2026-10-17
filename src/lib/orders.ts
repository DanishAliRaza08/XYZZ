import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Quote } from "./quote";
import { getStripe } from "./stripe";

export type CustomerDetails = {
  email: string;
  name: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postcode: string;
  country: string;
};

/** Order statuses in words customers understand (order tracking and the account page). */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment received — preparing your order",
  NEEDS_ATTENTION: "Payment received — our team is reviewing your order",
  PROCESSING: "Being prepared",
  SHIPPED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function generateOrderNumber(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `FR-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

/** accountId links the order to a signed-in shop customer so it shows on their account page. */
export async function createPendingOrder(quote: Quote, customer: CustomerDetails, accountId: string | null = null) {
  if (!quote.ok) throw new Error("Quote is not valid");
  return prisma.order.create({
    data: {
      number: generateOrderNumber(),
      customerId: accountId,
      currency: quote.currency,
      ...customer,
      shippingMethod: quote.shippingMethod,
      subtotal: quote.subtotal,
      discount: quote.discount,
      shipping: quote.shipping,
      total: quote.total,
      discountCode: quote.discountCode,
      items: {
        create: quote.lines.map((l) => ({
          variantId: l.variantId,
          productName: l.productName,
          sku: l.sku,
          size: l.size,
          colour: l.colour,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
      },
    },
    include: { items: true },
  });
}

/**
 * Called only after Stripe has confirmed the payment: from the signature-verified webhook, or from the
 * success page after retrieving the PaymentIntent from Stripe's API (never on the browser's word). Idempotent: an order that is no longer
 * PENDING_PAYMENT is left untouched. Stock is decremented with a guarded update so it can
 * never go negative; if any line cannot be allocated, the order is flagged NEEDS_ATTENTION.
 */
export async function markOrderPaid(opts: {
  orderId: string;
  paymentId: string | null;
  amountPaid: number | null;
  currency: string | null;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.findUnique({ where: { id: opts.orderId }, include: { items: true } });
    if (!order || order.status !== "PENDING_PAYMENT") return order;

    const notes: string[] = [];
    if (opts.amountPaid != null && opts.amountPaid !== order.total)
      notes.push(`Amount mismatch: provider reported ${opts.amountPaid}, order total ${order.total}.`);
    if (opts.currency && opts.currency.toUpperCase() !== order.currency)
      notes.push(`Currency mismatch: provider reported ${opts.currency}.`);

    for (const item of order.items) {
      const res = await tx.variant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (res.count === 0) notes.push(`Insufficient stock for ${item.sku} (qty ${item.quantity}).`);
    }
    if (order.discountCode)
      await tx.discountCode.updateMany({ where: { code: order.discountCode }, data: { timesUsed: { increment: 1 } } });

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: notes.length ? "NEEDS_ATTENTION" : "PAID",
        paidAt: new Date(),
        stripePaymentId: opts.paymentId,
        notes: notes.length ? [order.notes, ...notes].filter(Boolean).join("\n") : order.notes,
      },
    });
  });
}

export async function cancelUnpaidOrder(orderId: string) {
  await prisma.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
}

/**
 * For the thank-you page: finds the order the customer just paid for. The order number and Stripe's payment id
 * must both match, so the URL can't be used to look at other orders. If the order is still pending, Stripe is
 * asked directly whether the payment succeeded, so the page doesn't have to wait for the webhook.
 */
export async function findPaidOrder(opts: { orderNumber?: string; paymentIntentId?: string; checkoutSessionId?: string }) {
  if (!opts.orderNumber) return null;
  const include = { items: true } as const;
  if (opts.paymentIntentId) {
    const order = await prisma.order.findFirst({ where: { number: opts.orderNumber, stripePaymentId: opts.paymentIntentId }, include });
    if (order?.status !== "PENDING_PAYMENT") return order;
    const intent = await getStripe()?.paymentIntents.retrieve(opts.paymentIntentId).catch(() => null);
    if (intent?.status === "succeeded" && intent.metadata?.orderId === order.id) {
      await markOrderPaid({ orderId: order.id, paymentId: intent.id, amountPaid: intent.amount_received, currency: intent.currency });
      return prisma.order.findUnique({ where: { id: order.id }, include });
    }
    return order;
  }
  // Orders paid on Stripe's hosted checkout page (earlier versions of the shop).
  if (opts.checkoutSessionId) return prisma.order.findFirst({ where: { number: opts.orderNumber, stripeSessionId: opts.checkoutSessionId }, include });
  return null;
}
