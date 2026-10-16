// On-page card payments: checkout → PaymentIntent → success page / webhook → order paid.
// Runs the real route handlers against the database in DATABASE_URL, with a fake Stripe client
// (no network). Skipped when no database is configured.
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type FakeIntent = { id: string; client_secret: string; status: string; amount: number; amount_received: number; currency: string; metadata: Record<string, string> };

const fake = vi.hoisted(() => {
  const intents = new Map<string, FakeIntent>();
  let n = 0;
  return {
    intents,
    stripe: {
      paymentIntents: {
        create: async (params: { amount: number; currency: string; metadata: Record<string, string> }) => {
          const id = `pi_test${Date.now()}${n++}`;
          const pi = { id, client_secret: `${id}_secret_abc123`, status: "requires_payment_method", amount: params.amount, amount_received: 0, currency: params.currency, metadata: params.metadata };
          intents.set(id, pi);
          return pi;
        },
        retrieve: async (id: string) => intents.get(id),
        cancel: async (id: string) => Object.assign(intents.get(id)!, { status: "canceled" }),
      },
      webhooks: {
        constructEvent: (body: string, signature: string) => {
          if (signature !== "valid-signature") throw new Error("bad signature");
          return JSON.parse(body);
        },
      },
    },
  };
});

vi.mock("@/lib/stripe", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/stripe")>()), getStripe: () => fake.stripe }));
vi.mock("@/lib/currency-server", () => ({ getCurrency: async () => "GBP" }));

const { prisma } = await import("@/lib/db");
const checkout = await import("@/app/api/checkout/route");
const cancel = await import("@/app/api/checkout/cancel/route");
const webhook = await import("@/app/api/webhooks/stripe/route");
const { findPaidOrder } = await import("@/lib/orders");
// What the thank-you page does with ?order=…&payment_intent=…
const visitSuccessPage = (p: { order: string; payment_intent: string }) => findPaidOrder({ orderNumber: p.order, paymentIntentId: p.payment_intent });

const enabled = Boolean(process.env.DATABASE_URL);
const tag = `ptest-${Date.now()}`;
const customer = { email: "card-test@example.com", name: "Card Tester", phone: "", addressLine1: "1 High St", addressLine2: "", city: "London", region: "", postcode: "SW1A 1AA", country: "GB" };

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

async function startCheckout(variantId: string) {
  const res = await checkout.POST(post("/api/checkout", { lines: [{ variantId, quantity: 2 }], shippingMethod: "standard", discountCode: null, customer, acceptTerms: true }));
  const data = await res.json();
  expect(res.status, JSON.stringify(data)).toBe(200);
  const order = await prisma.order.findUniqueOrThrow({ where: { number: data.orderNumber } });
  return { data, order, intent: fake.intents.get(order.stripePaymentId!)! };
}
const stockOf = async (variantId: string) => (await prisma.variant.findUniqueOrThrow({ where: { id: variantId } })).stock;
const sendWebhook = (event: unknown, signature = "valid-signature") => webhook.POST(post("/api/webhooks/stripe", JSON.stringify(event), { "stripe-signature": signature }));

describe.skipIf(!enabled)("on-page card payments (database)", () => {
  let variantId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const cat = await prisma.category.create({ data: { slug: `${tag}-cat`, name: "Test" } });
    const product = await prisma.product.create({
      data: {
        slug: `${tag}-dress`, name: "Card Test Dress", description: "Integration test product", department: "GIRLS", categoryId: cat.id, status: "PUBLISHED", priceGBP: 2000,
        variants: { create: { sku: `${tag}-sku`, size: "5-6y", colour: "Pink", stock: 10 } },
      },
      include: { variants: true },
    });
    variantId = product.variants[0].id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { email: customer.email } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.category.deleteMany({ where: { slug: `${tag}-cat` } });
    await prisma.$disconnect();
  });

  it("creates a pending order and a PaymentIntent for the server-calculated total", async () => {
    const { data, order, intent } = await startCheckout(variantId);
    expect(data.clientSecret).toBe(intent.client_secret);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(intent.amount).toBe(order.total);
    expect(order.total).toBe(4000 + 399); // 2 × £20 + standard delivery (under the £50 free-delivery threshold)
    expect(intent.currency).toBe("gbp");
    expect(intent.metadata).toEqual({ orderId: order.id, orderNumber: order.number });
    expect(await stockOf(variantId)).toBe(10); // stock only moves once paid
  });

  it("success page only marks the order paid once Stripe says the payment succeeded", async () => {
    const before = await stockOf(variantId);
    const { order, intent } = await startCheckout(variantId);
    const params = { order: order.number, payment_intent: intent.id };

    await visitSuccessPage(params);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");

    Object.assign(intent, { status: "succeeded", amount_received: intent.amount });
    await visitSuccessPage(params);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect(await stockOf(variantId)).toBe(before - 2);

    // The webhook arriving afterwards must not take stock twice.
    const res = await sendWebhook({ id: `evt_${tag}_1`, type: "payment_intent.succeeded", data: { object: intent } });
    expect(res.status).toBe(200);
    expect(await stockOf(variantId)).toBe(before - 2);
  });

  it("success page ignores a payment id that belongs to a different order", async () => {
    const a = await startCheckout(variantId);
    const b = await startCheckout(variantId);
    Object.assign(b.intent, { status: "succeeded", amount_received: b.intent.amount });
    expect(await visitSuccessPage({ order: a.order.number, payment_intent: b.intent.id })).toBeNull();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("webhook payment_intent.succeeded marks paid; bad signatures are rejected", async () => {
    const { order, intent } = await startCheckout(variantId);
    Object.assign(intent, { status: "succeeded", amount_received: intent.amount });
    expect((await sendWebhook({ id: `evt_${tag}_2`, type: "payment_intent.succeeded", data: { object: intent } }, "forged")).status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    await sendWebhook({ id: `evt_${tag}_3`, type: "payment_intent.succeeded", data: { object: intent } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("flags an order when the amount Stripe received doesn't match", async () => {
    const { order, intent } = await startCheckout(variantId);
    Object.assign(intent, { status: "succeeded", amount_received: 100 });
    await sendWebhook({ id: `evt_${tag}_4`, type: "payment_intent.succeeded", data: { object: intent } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("NEEDS_ATTENTION");
  });

  it("Edit details cancels the unpaid order, but only with the right client secret", async () => {
    const { order, intent } = await startCheckout(variantId);
    expect((await cancel.POST(post("/api/checkout/cancel", { orderNumber: order.number, clientSecret: `${intent.id}_secret_wrong1` }))).status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");

    expect((await cancel.POST(post("/api/checkout/cancel", { orderNumber: order.number, clientSecret: intent.client_secret }))).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    expect(intent.status).toBe("canceled");
  });

  it("refuses to cancel a payment that has already gone through", async () => {
    const { order, intent } = await startCheckout(variantId);
    intent.status = "succeeded";
    expect((await cancel.POST(post("/api/checkout/cancel", { orderNumber: order.number, clientSecret: intent.client_secret }))).status).toBe(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("webhook payment_intent.canceled cancels the unpaid order", async () => {
    const { order, intent } = await startCheckout(variantId);
    await sendWebhook({ id: `evt_${tag}_5`, type: "payment_intent.canceled", data: { object: { ...intent, status: "canceled" } } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });
});
