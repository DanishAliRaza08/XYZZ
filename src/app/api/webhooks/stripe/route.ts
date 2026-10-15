import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { cancelUnpaidOrder, markOrderPaid } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Orders are only marked paid here — never from the browser's success redirect.
 * Signature-verified, and each event id is recorded so redelivered events are ignored.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Payments not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (await prisma.webhookEvent.findUnique({ where: { id: event.id } })) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === "paid") {
        await markOrderPaid({
          orderId,
          paymentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
          amountPaid: session.amount_total,
          currency: session.currency,
        });
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await cancelUnpaidOrder(orderId);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentId && charge.amount_refunded >= charge.amount)
        await prisma.order.updateMany({ where: { stripePaymentId: paymentId }, data: { status: "REFUNDED" } });
      break;
    }
    default:
      break;
  }

  await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } }).catch(() => undefined);
  return NextResponse.json({ received: true });
}
