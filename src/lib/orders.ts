import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Quote } from "./quote";

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

export function generateOrderNumber(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `FR-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createPendingOrder(quote: Quote, customer: CustomerDetails) {
  if (!quote.ok) throw new Error("Quote is not valid");
  return prisma.order.create({
    data: {
      number: generateOrderNumber(),
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
 * Called only from a verified payment webhook. Idempotent: an order that is no longer
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
