import { prisma } from "./db";
import type { CurrencyCode } from "./money";
import { applyDiscount, resolvePrice, shippingCost, type ShippingMethod, type ShippingRates } from "./pricing";

export type CartLine = { variantId: string; quantity: number };

export type QuoteLine = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  image: string | null;
  sku: string;
  size: string;
  colour: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  problem: string | null;
};

export type Quote = {
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  discountCode: string | null;
  discountError: string | null;
  shipping: number;
  shippingMethod: ShippingMethod;
  total: number;
  freeShippingRemaining: number;
  ok: boolean;
};

export const MAX_QTY_PER_LINE = 10;

/** Server-side source of truth for prices, stock, discounts and shipping. The browser's cart is only a list of IDs. */
export async function buildQuote(opts: {
  lines: CartLine[];
  currency: CurrencyCode;
  shippingMethod: ShippingMethod;
  discountCode?: string | null;
  rates: ShippingRates;
}): Promise<Quote> {
  const merged = new Map<string, number>();
  for (const l of opts.lines.slice(0, 50)) {
    const qty = Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.floor(Number(l.quantity) || 0)));
    if (qty > 0 && typeof l.variantId === "string") merged.set(l.variantId, Math.min(MAX_QTY_PER_LINE, (merged.get(l.variantId) ?? 0) + qty));
  }
  const variants = await prisma.variant.findMany({
    where: { id: { in: [...merged.keys()] } },
    include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: QuoteLine[] = [];
  for (const [variantId, quantity] of merged) {
    const v = byId.get(variantId);
    if (!v) continue; // silently drop deleted variants
    const price = resolvePrice(v.product, opts.currency);
    let problem: string | null = null;
    if (v.product.status !== "PUBLISHED") problem = "No longer available";
    else if (!price) problem = `Not available in ${opts.currency}`;
    else if (v.stock <= 0) problem = "Out of stock";
    else if (v.stock < quantity) problem = `Only ${v.stock} left`;
    const unitPrice = price?.price ?? 0;
    lines.push({
      variantId,
      productId: v.productId,
      productName: v.product.name,
      productSlug: v.product.slug,
      image: v.product.images[0]?.url ?? null,
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      available: Math.max(0, v.stock),
      problem,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let discount = 0;
  let discountError: string | null = null;
  let discountCode: string | null = null;
  const code = opts.discountCode?.trim().toUpperCase();
  if (code) {
    const rule = await prisma.discountCode.findUnique({ where: { code } });
    if (!rule) discountError = "We don't recognise that code.";
    else {
      const r = applyDiscount(rule, opts.currency, subtotal);
      if (r.ok) {
        discount = r.amount;
        discountCode = code;
      } else discountError = r.reason;
    }
  }
  const afterDiscount = subtotal - discount;
  const shipping = lines.length ? shippingCost(opts.rates, opts.currency, opts.shippingMethod, afterDiscount) : 0;
  const freeOver = opts.rates[opts.currency].freeOver;
  return {
    currency: opts.currency,
    lines,
    subtotal,
    discount,
    discountCode,
    discountError,
    shipping,
    shippingMethod: opts.shippingMethod,
    total: afterDiscount + shipping,
    freeShippingRemaining: Math.max(0, freeOver - afterDiscount),
    ok: lines.length > 0 && lines.every((l) => !l.problem),
  };
}
