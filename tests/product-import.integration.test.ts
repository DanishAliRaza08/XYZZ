// Admin → Import products, end to end against the database in DATABASE_URL, with a fake Shopify store
// (no network). Skipped when no database is configured.
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mapShopifyProduct, normaliseSource, type ShopifyProduct } from "@/lib/shopify-import";

const enabled = Boolean(process.env.DATABASE_URL);
const tag = `imp${Date.now()}`;

const product = (n: number, over: Partial<ShopifyProduct> = {}): ShopifyProduct => ({
  id: 1000 + n, title: `Girls Party Dress ${tag} ${n}`, handle: `${tag}-party-dress-${n}`, body_html: "<p>A <b>lovely</b> tulle party dress.</p>",
  vendor: "Test", product_type: "Dress", tags: ["girls", "christmas"],
  options: [{ name: "Size", position: 1 }, { name: "Colour", position: 2 }],
  variants: [
    { id: 1, title: "3-4y / Red", sku: `${tag}-${n}-r34`, price: "24.00", compare_at_price: "30.00", available: true, option1: "3-4y", option2: "Red", option3: null },
    { id: 2, title: "5-6y / Red", sku: `${tag}-${n}-r56`, price: "24.00", compare_at_price: "30.00", available: false, option1: "5-6y", option2: "Red", option3: null },
  ],
  images: [{ src: "https://cdn.shopify.com/a.jpg", alt: "front" }, { src: "https://cdn.shopify.com/not-an-image.jpg" }],
  ...over,
});

describe("shop address and product mapping", () => {
  it("accepts shop addresses and refuses private ones", () => {
    expect(normaliseSource("gumandberries.co.uk/collections/new")).toBe("https://gumandberries.co.uk");
    expect(normaliseSource("http://www.shop.example.com/")).toBe("https://www.shop.example.com");
    for (const bad of ["localhost:3000", "http://127.0.0.1", "intranet", "printer.local", "not a url ::"]) expect(() => normaliseSource(bad)).toThrow();
  });
  it("maps sizes, colours, sale price, stock and category", () => {
    const m = mapShopifyProduct(product(1), { source: "https://shop.example", defaultStock: 7, usdRate: 1.3 }, new Set(), new Set())!;
    expect(m.product).toMatchObject({ department: "GIRLS", category: "partywear", collection: "Christmas", priceGBP: 3000, salePriceGBP: 2400, ageRange: "3–6 years" });
    expect(m.product.variants.map((v) => [v.size, v.colour, v.stock])).toEqual([["3-4y", "Red", 7], ["5-6y", "Red", 0]]);
    expect(m.product.description).toBe("A lovely tulle party dress.");
  });
});

describe.skipIf(!enabled)("Admin → Import products (database)", () => {
  let dir: string;
  let prisma: typeof import("@/lib/db").prisma;
  // 4: every size has the same SKU (common on Shopify) — this used to stop the import with "Variant_sku_key".
  const sameSku = (n: number) => product(n, { variants: product(n).variants.map((v) => ({ ...v, sku: "DRESS-1" })) });
  const feed = [product(1), product(2), product(3, { variants: [] }), sameSku(4), sameSku(5)];

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fr-import-"));
    process.env.UPLOAD_DIR = dir;
    const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c33" } }).jpeg().toBuffer();
    vi.stubGlobal("fetch", async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/products.json") return Response.json({ products: url.searchParams.get("page") === "1" ? feed : [] });
      if (url.pathname === "/a.jpg") return new Response(new Uint8Array(jpg));
      return new Response("<html>nope</html>");
    });
    prisma = (await import("@/lib/db")).prisma;
    // An SKU already in the shop that matches product 5's new SKU apart from upper/lower case.
    const cat = await prisma.category.findFirstOrThrow();
    await prisma.product.create({
      data: { slug: `${tag}-existing`, name: "Existing", description: "Already in the shop", department: "GIRLS", categoryId: cat.id, priceGBP: 1000, variants: { create: { sku: "sho-1005-1", size: "S", colour: "Red" } } },
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await rm(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  const runImport = async () => {
    const { currentImport, startImport } = await import("@/lib/import-job");
    const admin = await prisma.adminUser.findFirst();
    expect(startImport({ source: "https://shop.example", status: "DRAFT", maxImages: 4, defaultStock: 5, limit: Infinity }, admin?.id ?? "x")).toBeNull();
    expect(startImport({ source: "https://shop.example", status: "DRAFT", maxImages: 4, defaultStock: 5, limit: Infinity }, "x")).toMatch(/already running/);
    for (let i = 0; i < 100 && currentImport()?.status === "running"; i++) await new Promise((r) => setTimeout(r, 50));
    return currentImport()!;
  };

  it("adds new products with their photos, and skips ones without sizes", async () => {
    const job = await runImport();
    expect(job.status).toBe("done");
    expect(job).toMatchObject({ total: 5, created: 4, skipped: 1, existing: 0, photos: 4 });
    const saved = await prisma.product.findMany({ where: { slug: { startsWith: `${tag}-party` } }, include: { images: true, variants: { orderBy: { sortOrder: "asc" } } }, orderBy: { slug: "asc" } });
    expect(saved).toHaveLength(4);
    // Every size gets its own new SKU, even when the shop repeated one.
    expect(saved.map((p) => p.variants.map((v) => v.sku))).toEqual([["SHO-1001-1", "SHO-1001-2"], ["SHO-1002-1", "SHO-1002-2"], ["SHO-1004-1", "SHO-1004-2"], ["SHO-1005-1-2", "SHO-1005-2"]]);
    expect(saved[0]).toMatchObject({ status: "DRAFT", priceGBP: 3000, salePriceGBP: 2400 });
    expect(saved[0].images).toHaveLength(1); // the broken photo is left out
    expect(saved[0].images[0].url).toMatch(/^\/uploads\/[a-f0-9]{32}\.jpg$/);
    expect(saved[0].variants.map((v) => v.stock).sort()).toEqual([0, 5]);
    expect(await readdir(dir)).toHaveLength(4);
  });

  it("running it again leaves existing products alone", async () => {
    await prisma.product.updateMany({ where: { slug: `${tag}-party-dress-1` }, data: { name: "Renamed in admin" } });
    const job = await runImport();
    expect(job).toMatchObject({ status: "done", created: 0, existing: 4, skipped: 1 });
    expect((await prisma.product.findUnique({ where: { slug: `${tag}-party-dress-1` } }))?.name).toBe("Renamed in admin");
  });
});

describe("unreachable shops", () => {
  it("explain the problem in plain words", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });
    const { fetchShopifyProducts } = await import("@/lib/shopify-import");
    await expect(fetchShopifyProducts("https://shop.example")).rejects.toThrow("Couldn't reach https://shop.example. Check the address is right");
    vi.unstubAllGlobals();
  });
});
