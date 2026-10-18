import { describe, expect, it } from "vitest";
import { cached, invalidateStoreCache } from "@/lib/cache";
import { matchesListing, type ListingProduct } from "@/lib/catalog";

const product = (over: Partial<ListingProduct> = {}) =>
  ({
    slug: "rosa-dress", name: "Rosa Tulle Dress", description: "Party dress", department: "GIRLS", collection: "Christmas",
    priceUSD: 2000, salePriceGBP: null, salePriceUSD: null, bestseller: false, createdAt: new Date(),
    category: { slug: "dresses", name: "Dresses" },
    variants: [{ sku: "FR-RED-56", colour: "Red", size: "5-6y", stock: 3 }],
    ...over,
  }) as unknown as ListingProduct;

describe("catalogue filtering (in memory)", () => {
  it("searches name, description, collection, category, colour and exact SKU, ignoring case", () => {
    const p = product();
    for (const q of ["rosa", "PARTY", "christmas", "dresses", "red", "fr-red-56"]) expect(matchesListing(p, { currency: "GBP", q })).toBe(true);
    expect(matchesListing(p, { currency: "GBP", q: "fr-red" })).toBe(false); // SKU must match exactly
    expect(matchesListing(p, { currency: "GBP", q: "jumper" })).toBe(false);
  });
  it("menu pages match ANY listed category OR collection, and their department wins", () => {
    const p = product();
    expect(matchesListing(p, { currency: "GBP", filter: { categories: ["coats"], collections: ["christmas"] } })).toBe(true);
    expect(matchesListing(p, { currency: "GBP", filter: { categories: ["dresses"], collections: [] } })).toBe(true);
    expect(matchesListing(p, { currency: "GBP", filter: { categories: ["coats"], collections: ["Eid"] } })).toBe(false);
    expect(matchesListing(p, { currency: "GBP", department: "BOYS", filter: { department: "GIRLS" } })).toBe(true);
  });
  it("applies department, category, sale, bestseller, US and new-arrival rules", () => {
    const p = product();
    expect(matchesListing(p, { currency: "GBP", department: "BOYS" })).toBe(false);
    expect(matchesListing(p, { currency: "GBP", categorySlug: "coats" })).toBe(false);
    expect(matchesListing(p, { currency: "GBP", collection: "sale" })).toBe(false);
    expect(matchesListing(product({ salePriceGBP: 1500 }), { currency: "GBP", collection: "sale" })).toBe(true);
    expect(matchesListing(p, { currency: "GBP", collection: "bestsellers" })).toBe(false);
    expect(matchesListing(product({ priceUSD: null }), { currency: "USD" })).toBe(false);
    expect(matchesListing(product({ createdAt: new Date(Date.now() - 90 * 864e5) }), { currency: "GBP", collection: "new-arrivals" })).toBe(false);
  });
});

describe("store cache", () => {
  it("loads once for many callers, and again after invalidation", async () => {
    let loads = 0;
    const load = async () => ++loads;
    const [a, b] = await Promise.all([cached("t1", load), cached("t1", load)]);
    expect([a, b, loads]).toEqual([1, 1, 1]);
    invalidateStoreCache();
    expect(await cached("t1", load)).toBe(2);
  });
  it("expires after its lifetime and never keeps a failed load", async () => {
    let n = 0;
    expect(await cached("t2", async () => ++n, 0)).toBe(1);
    expect(await cached("t2", async () => ++n, 0)).toBe(2);
    await expect(cached("t3", async () => { throw new Error("db down"); })).rejects.toThrow("db down");
    expect(await cached("t3", async () => "ok")).toBe("ok");
  });
});
