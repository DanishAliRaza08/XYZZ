// Runs against the database in DATABASE_URL. Skipped when no database is configured.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createPendingOrder, markOrderPaid } from "@/lib/orders";
import { DEFAULT_SHIPPING } from "@/lib/pricing";
import { buildQuote } from "@/lib/quote";

const enabled = Boolean(process.env.DATABASE_URL);
const tag = `itest-${Date.now()}`;
const customer = { email: "test@example.com", name: "Test Buyer", addressLine1: "1 High St", city: "London", postcode: "SW1A 1AA", country: "GB" };

async function makeProduct(stock: number) {
  const cat = await prisma.category.upsert({ where: { slug: `${tag}-cat` }, create: { slug: `${tag}-cat`, name: "Test" }, update: {} });
  return prisma.product.create({
    data: {
      slug: `${tag}-${Math.random().toString(36).slice(2, 8)}`,
      name: "Test Dress",
      description: "Integration test product",
      department: "GIRLS",
      categoryId: cat.id,
      status: "PUBLISHED",
      priceGBP: 3000,
      salePriceGBP: 2500,
      variants: { create: { sku: `${tag}-${Math.random().toString(36).slice(2, 8)}`, size: "5-6y", colour: "Pink", stock } },
    },
    include: { variants: true },
  });
}

describe.skipIf(!enabled)("order lifecycle (database)", () => {
  afterAll(async () => {
    await prisma.order.deleteMany({ where: { email: customer.email, items: { some: { sku: { startsWith: tag } } } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.category.deleteMany({ where: { slug: `${tag}-cat` } });
    await prisma.discountCode.deleteMany({ where: { code: { startsWith: "ITEST" } } });
    await prisma.$disconnect();
  });

  it("prices from the database, not the client, and flags stock problems", async () => {
    const p = await makeProduct(2);
    const q = await buildQuote({ lines: [{ variantId: p.variants[0].id, quantity: 3 }], currency: "GBP", shippingMethod: "standard", rates: DEFAULT_SHIPPING });
    expect(q.lines[0].unitPrice).toBe(2500);
    expect(q.lines[0].problem).toBe("Only 2 left");
    expect(q.ok).toBe(false);
  });

  it("applies discounts and free-shipping thresholds server-side", async () => {
    const p = await makeProduct(10);
    await prisma.discountCode.create({ data: { code: `ITEST${Date.now()}`, percentOff: 10 } });
    const code = (await prisma.discountCode.findFirstOrThrow({ where: { code: { startsWith: "ITEST" } } })).code;
    const q = await buildQuote({ lines: [{ variantId: p.variants[0].id, quantity: 2 }], currency: "GBP", shippingMethod: "standard", discountCode: code, rates: DEFAULT_SHIPPING });
    expect(q.subtotal).toBe(5000);
    expect(q.discount).toBe(500);
    expect(q.shipping).toBe(399); // 45.00 after discount is below the £50 threshold
    expect(q.total).toBe(4899);
  });

  it("marks paid exactly once and decrements stock once (webhook retries are safe)", async () => {
    const p = await makeProduct(5);
    const q = await buildQuote({ lines: [{ variantId: p.variants[0].id, quantity: 2 }], currency: "GBP", shippingMethod: "standard", rates: DEFAULT_SHIPPING });
    const order = await createPendingOrder(q, customer);
    const first = await markOrderPaid({ orderId: order.id, paymentId: "pi_test", amountPaid: order.total, currency: "gbp" });
    const second = await markOrderPaid({ orderId: order.id, paymentId: "pi_test", amountPaid: order.total, currency: "gbp" });
    expect(first?.status).toBe("PAID");
    expect(second?.status).toBe("PAID");
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
    expect(v.stock).toBe(3);
  });

  it("never oversells: flags the order when stock ran out before payment", async () => {
    const p = await makeProduct(1);
    const q = await buildQuote({ lines: [{ variantId: p.variants[0].id, quantity: 1 }], currency: "GBP", shippingMethod: "standard", rates: DEFAULT_SHIPPING });
    const a = await createPendingOrder(q, customer);
    const b = await createPendingOrder(q, customer);
    await markOrderPaid({ orderId: a.id, paymentId: "pi_a", amountPaid: a.total, currency: "gbp" });
    const paidB = await markOrderPaid({ orderId: b.id, paymentId: "pi_b", amountPaid: b.total, currency: "gbp" });
    expect(paidB?.status).toBe("NEEDS_ATTENTION");
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
    expect(v.stock).toBe(0);
  });

  it("flags an amount mismatch reported by the payment provider", async () => {
    const p = await makeProduct(5);
    const q = await buildQuote({ lines: [{ variantId: p.variants[0].id, quantity: 1 }], currency: "GBP", shippingMethod: "standard", rates: DEFAULT_SHIPPING });
    const order = await createPendingOrder(q, customer);
    const paid = await markOrderPaid({ orderId: order.id, paymentId: "pi_x", amountPaid: 1, currency: "gbp" });
    expect(paid?.status).toBe("NEEDS_ATTENTION");
    expect(paid?.notes).toContain("Amount mismatch");
  });
});
