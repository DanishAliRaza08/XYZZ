import { NextResponse, type NextRequest } from "next/server";
import { CheckoutRequest } from "@/lib/checkout-schema";
import { getCurrency } from "@/lib/currency-server";
import { ensureStripeCustomer, getCustomer } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { createPendingOrder } from "@/lib/orders";
import { buildQuote } from "@/lib/quote";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Step 1 of checkout: validates the bag and delivery details, creates a PENDING_PAYMENT order and a Stripe
 * PaymentIntent for the server-calculated total, and returns its client secret. The browser then shows Stripe's
 * card form (Payment Element) on our checkout page; card details go straight to Stripe, never to this server.
 * The order is marked paid by the webhook (payment_intent.succeeded) or the success page, after asking Stripe.
 * For signed-in customers the payment is attached to their Stripe customer, so the card form also lists their
 * saved cards and offers "Save payment details for future purchases" (a Stripe CustomerSession).
 */
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

  const account = await getCustomer();
  const order = await createPendingOrder(quote, customer, account?.id ?? null);
  if (account) {
    // Remember the delivery address so checkout is filled in next time.
    const { email: _email, name: _name, country: _country, ...address } = customer;
    await prisma.customer.update({ where: { id: account.id }, data: address });
  }

  try {
    const stripeCustomerId = account ? await ensureStripeCustomer(account) : null;
    const intent = await stripe.paymentIntents.create(
      {
        amount: quote.total,
        currency: currency.toLowerCase(),
        // Cards plus whatever else is switched on in the Stripe Dashboard (Apple Pay, Google Pay, …).
        automatic_payment_methods: { enabled: true },
        customer: stripeCustomerId ?? undefined,
        receipt_email: customer.email,
        description: `Fashion Rockstar order ${order.number}`,
        metadata: { orderId: order.id, orderNumber: order.number },
        shipping: {
          name: customer.name,
          phone: customer.phone || undefined,
          address: {
            line1: customer.addressLine1,
            line2: customer.addressLine2 || undefined,
            city: customer.city,
            state: customer.region || undefined,
            postal_code: customer.postcode,
            country: customer.country,
          },
        },
      },
      { idempotencyKey: `pi-${order.id}` },
    );

    const customerSession = stripeCustomerId
      ? await stripe.customerSessions.create({
          customer: stripeCustomerId,
          components: {
            payment_element: {
              enabled: true,
              features: {
                payment_method_redisplay: "enabled",
                payment_method_save: "enabled",
                payment_method_save_usage: "on_session",
                payment_method_remove: "enabled",
              },
            },
          },
        })
      : null;

    await prisma.order.update({ where: { id: order.id }, data: { stripePaymentId: intent.id } });
    return NextResponse.json({
      clientSecret: intent.client_secret,
      customerSessionClientSecret: customerSession?.client_secret ?? null,
      orderNumber: order.number,
      total: quote.total,
      currency,
    });
  } catch (err) {
    console.error("Stripe payment intent failed", err);
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED", notes: "Payment could not be started." } });
    return NextResponse.json({ error: "We couldn't start the payment. Please try again in a moment." }, { status: 502 });
  }
}
