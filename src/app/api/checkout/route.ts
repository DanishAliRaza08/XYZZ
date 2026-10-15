import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { CheckoutRequest } from "@/lib/checkout-schema";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";
import { createPendingOrder } from "@/lib/orders";
import { buildQuote } from "@/lib/quote";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getStripe, siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!rateLimit(`checkout:${clientIp(req.headers)}`, 10, 60_000))
    return NextResponse.json({ error: "Too many checkout attempts. Please wait a minute." }, { status: 429 });

  const stripe = getStripe();
  if (!stripe)
    return NextResponse.json({ error: "Online payments are not yet enabled. Please contact us to place your order." }, { status: 503 });

  const parsed = CheckoutRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.at(-1)?.toString() ?? "form"] ??= issue.message;
    return NextResponse.json({ error: "Please check your details.", fieldErrors }, { status: 400 });
  }
  const { lines, shippingMethod, discountCode, customer } = parsed.data;
  const [currency, settings] = await Promise.all([getCurrency(), getSettings()]);

  if (currency === "USD" && !settings.usStoreEnabled)
    return NextResponse.json({ error: "We're not currently shipping to the US." }, { status: 400 });
  if ((currency === "GBP" && customer.country !== "GB") || (currency === "USD" && customer.country !== "US"))
    return NextResponse.json({ error: `Orders in ${currency} must be delivered to ${currency === "GBP" ? "the UK" : "the US"}. Change your shopping region in the header.` }, { status: 400 });

  // Recalculate everything server-side — the browser only sends variant IDs and quantities.
  const quote = await buildQuote({ lines, currency, shippingMethod, discountCode, rates: settings.shipping });
  if (!quote.ok) return NextResponse.json({ error: "Some items in your bag have changed. Please review your bag.", quote }, { status: 409 });
  if (discountCode && !quote.discountCode) return NextResponse.json({ error: quote.discountError ?? "Invalid discount code" }, { status: 400 });

  const order = await createPendingOrder(quote, customer);
  const cur = currency.toLowerCase();

  try {
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (quote.discount > 0) {
      const coupon = await stripe.coupons.create(
        { amount_off: quote.discount, currency: cur, duration: "once", max_redemptions: 1, name: `Discount ${quote.discountCode}` },
        { idempotencyKey: `coupon-${order.id}` },
      );
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customer.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id, orderNumber: order.number },
        payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.number } },
        line_items: quote.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: cur,
            unit_amount: l.unitPrice,
            product_data: { name: l.productName, description: `${l.colour} · ${l.size} · ${l.sku}` },
          },
        })),
        discounts,
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: shippingMethod === "express" ? "Express delivery" : "Standard delivery",
              fixed_amount: { amount: quote.shipping, currency: cur },
            },
          },
        ],
        success_url: `${siteUrl()}/checkout/success?order=${order.number}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}/bag?cancelled=1`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      { idempotencyKey: `checkout-${order.id}` },
    );

    await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
    return NextResponse.json({ url: session.url, orderNumber: order.number });
  } catch (err) {
    console.error("Stripe checkout session failed", err);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED", notes: "Payment session could not be created." } });
    return NextResponse.json({ error: "We couldn't start the payment. Please try again in a moment." }, { status: 502 });
  }
}
