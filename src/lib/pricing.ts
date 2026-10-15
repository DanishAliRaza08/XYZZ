import type { CurrencyCode } from "./money";

export type PriceFields = {
  priceGBP: number;
  salePriceGBP: number | null;
  priceUSD: number | null;
  salePriceUSD: number | null;
};

export type ResolvedPrice = { price: number; compareAt: number | null; percentOff: number | null };

/** Returns the selling price for a currency, or null when the product is not sold in that market. */
export function resolvePrice(p: PriceFields, currency: CurrencyCode): ResolvedPrice | null {
  const regular = currency === "GBP" ? p.priceGBP : p.priceUSD;
  const sale = currency === "GBP" ? p.salePriceGBP : p.salePriceUSD;
  if (regular == null || regular <= 0) return null;
  if (sale != null && sale > 0 && sale < regular) {
    return { price: sale, compareAt: regular, percentOff: Math.round(((regular - sale) / regular) * 100) };
  }
  return { price: regular, compareAt: null, percentOff: null };
}

export type ShippingRates = {
  GBP: { standard: number; express: number; freeOver: number };
  USD: { standard: number; express: number; freeOver: number };
};

export const DEFAULT_SHIPPING: ShippingRates = {
  GBP: { standard: 399, express: 699, freeOver: 5000 },
  USD: { standard: 999, express: 1999, freeOver: 10000 },
};

export type ShippingMethod = "standard" | "express";

export function shippingCost(
  rates: ShippingRates,
  currency: CurrencyCode,
  method: ShippingMethod,
  discountedSubtotal: number,
): number {
  const r = rates[currency];
  if (method === "express") return r.express;
  return discountedSubtotal >= r.freeOver ? 0 : r.standard;
}

export type DiscountRule = {
  code: string;
  percentOff: number | null;
  amountOffGBP: number | null;
  minSubtotalGBP: number | null;
  active: boolean;
  expiresAt: Date | null;
  usageLimit: number | null;
  timesUsed: number;
};

export type DiscountResult = { ok: true; amount: number } | { ok: false; reason: string };

export function applyDiscount(
  rule: DiscountRule,
  currency: CurrencyCode,
  subtotal: number,
  now = new Date(),
): DiscountResult {
  if (!rule.active) return { ok: false, reason: "This code is not active." };
  if (rule.expiresAt && rule.expiresAt < now) return { ok: false, reason: "This code has expired." };
  if (rule.usageLimit != null && rule.timesUsed >= rule.usageLimit)
    return { ok: false, reason: "This code has reached its usage limit." };
  if (rule.percentOff != null && rule.percentOff > 0) {
    if (currency === "GBP" && rule.minSubtotalGBP && subtotal < rule.minSubtotalGBP)
      return { ok: false, reason: "Your bag does not meet the minimum spend for this code." };
    return { ok: true, amount: Math.min(subtotal, Math.floor((subtotal * rule.percentOff) / 100)) };
  }
  if (rule.amountOffGBP != null && rule.amountOffGBP > 0) {
    if (currency !== "GBP") return { ok: false, reason: "This code is valid on UK (GBP) orders only." };
    if (rule.minSubtotalGBP && subtotal < rule.minSubtotalGBP)
      return { ok: false, reason: "Your bag does not meet the minimum spend for this code." };
    return { ok: true, amount: Math.min(subtotal, rule.amountOffGBP) };
  }
  return { ok: false, reason: "This code is not valid." };
}
