import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cancelUnpaidOrder } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getStripe, paymentIntentIdFromSecret } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const Body = z.object({ orderNumber: z.string().max(40), clientSecret: z.string().max(200) });

/**
 * "Edit details" on the payment step: cancels the unpaid order and its PaymentIntent so a fresh one can be
 * created with the new details. Only the browser holding the payment's client secret can do this.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`checkout-cancel:${clientIp(req.headers)}`, 20, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const stripe = getStripe();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const intentId = parsed.success ? paymentIntentIdFromSecret(parsed.data.clientSecret) : null;
  if (!stripe || !parsed.success || !intentId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const order = await prisma.order.findFirst({ where: { number: parsed.data.orderNumber, stripePaymentId: intentId, status: "PENDING_PAYMENT" } });
  if (!order) return NextResponse.json({ ok: true });

  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.client_secret !== parsed.data.clientSecret) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  // A payment that has gone through (or is still being processed) must not be cancelled.
  if (intent.status === "succeeded" || intent.status === "processing") return NextResponse.json({ error: "This payment has already been made." }, { status: 409 });

  if (intent.status !== "canceled") await stripe.paymentIntents.cancel(intentId).catch((e) => console.warn("PaymentIntent cancel failed", e));
  await cancelUnpaidOrder(order.id);
  return NextResponse.json({ ok: true });
}
