import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney, toInputValue } from "@/lib/money";
import { applyDiscount, DEFAULT_SHIPPING, resolvePrice, shippingCost, type DiscountRule } from "@/lib/pricing";

describe("money", () => {
  it("parses user-entered amounts into minor units without floats", () => {
    expect(parseMoney("19.99")).toBe(1999);
    expect(parseMoney("£1,250.5")).toBe(125050);
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("29")).toBe(2900);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("round-trips through the admin input format", () => {
    expect(toInputValue(1999)).toBe("19.99");
    expect(parseMoney(toInputValue(4500))).toBe(4500);
    expect(toInputValue(null)).toBe("");
  });
  it("formats GBP and USD", () => {
    expect(formatMoney(4500, "GBP")).toBe("£45");
    expect(formatMoney(1999, "GBP")).toBe("£19.99");
    expect(formatMoney(5900, "USD")).toBe("$59");
  });
});

describe("resolvePrice", () => {
  const p = { priceGBP: 5000, salePriceGBP: 3500, priceUSD: 6500, salePriceUSD: null };
  it("uses a valid sale price and computes percent off", () => {
    expect(resolvePrice(p, "GBP")).toEqual({ price: 3500, compareAt: 5000, percentOff: 30 });
  });
  it("uses the regular price when there is no sale", () => {
    expect(resolvePrice(p, "USD")).toEqual({ price: 6500, compareAt: null, percentOff: null });
  });
  it("ignores a sale price that is not lower than the regular price", () => {
    expect(resolvePrice({ ...p, salePriceGBP: 6000 }, "GBP")?.price).toBe(5000);
  });
  it("returns null when not sold in a market", () => {
    expect(resolvePrice({ ...p, priceUSD: null }, "USD")).toBeNull();
  });
});

describe("shipping", () => {
  it("is free above the threshold for standard delivery only", () => {
    expect(shippingCost(DEFAULT_SHIPPING, "GBP", "standard", 4999)).toBe(399);
    expect(shippingCost(DEFAULT_SHIPPING, "GBP", "standard", 5000)).toBe(0);
    expect(shippingCost(DEFAULT_SHIPPING, "GBP", "express", 9000)).toBe(699);
    expect(shippingCost(DEFAULT_SHIPPING, "USD", "standard", 10000)).toBe(0);
  });
});

describe("applyDiscount", () => {
  const base: DiscountRule = { code: "X", percentOff: 10, amountOffGBP: null, minSubtotalGBP: null, active: true, expiresAt: null, usageLimit: null, timesUsed: 0 };
  it("applies a percentage, rounding down", () => {
    expect(applyDiscount(base, "GBP", 1999)).toEqual({ ok: true, amount: 199 });
  });
  it("rejects inactive, expired and used-up codes", () => {
    expect(applyDiscount({ ...base, active: false }, "GBP", 5000).ok).toBe(false);
    expect(applyDiscount({ ...base, expiresAt: new Date("2020-01-01") }, "GBP", 5000).ok).toBe(false);
    expect(applyDiscount({ ...base, usageLimit: 3, timesUsed: 3 }, "GBP", 5000).ok).toBe(false);
  });
  it("enforces minimum spend", () => {
    expect(applyDiscount({ ...base, minSubtotalGBP: 3000 }, "GBP", 2000).ok).toBe(false);
    expect(applyDiscount({ ...base, minSubtotalGBP: 3000 }, "GBP", 3000).ok).toBe(true);
  });
  it("limits fixed-amount codes to GBP and never exceeds the subtotal", () => {
    const fixed = { ...base, percentOff: null, amountOffGBP: 1000 };
    expect(applyDiscount(fixed, "USD", 5000).ok).toBe(false);
    expect(applyDiscount(fixed, "GBP", 700)).toEqual({ ok: true, amount: 700 });
  });
});
