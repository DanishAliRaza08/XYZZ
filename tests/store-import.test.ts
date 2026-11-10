// Import products from any shop: Shopify / WooCommerce / any website (schema.org Product), with fake websites.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapShopifyProduct } from "@/lib/shopify-import";
import { fetchStoreProducts, normaliseShopUrl, pageToShopify, sitemapLocs, wooToShopify } from "@/lib/store-import";

/** A fake internet: path → response body (JSON object/array, or text). Unknown paths answer 404. */
function fakeWeb(pages: Record<string, unknown>) {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(String(input));
    asked.push(url.href);
    const key = Object.keys(pages).find((k) => url.href === k || url.href.startsWith(`${k}?`) || `${url.origin}${url.pathname}` === k);
    if (!key) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    const body = pages[key];
    if (typeof body === "string") return new Response(body, { headers: { "content-type": body.startsWith("<?xml") || body.startsWith("<urlset") || body.startsWith("<sitemapindex") ? "application/xml" : "text/html" } });
    return Response.json(body);
  });
  return asked;
}

afterEach(() => vi.unstubAllGlobals());

const productPage = (ld: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>…</body></html>`;

describe("addresses", () => {
  it("keeps the page, refuses private addresses, and sends marketplaces to their export files", () => {
    expect(normaliseShopUrl("shop.example.co.uk/collections/girls").href).toBe("https://shop.example.co.uk/collections/girls");
    for (const bad of ["localhost:3000", "http://10.0.0.1", "printer.local"]) expect(() => normaliseShopUrl(bad)).toThrow(/public online shop/);
    expect(() => normaliseShopUrl("https://www.amazon.co.uk/s?rh=Fashion+Rockstar")).toThrow(/Amazon doesn't allow.*Category Listings Report/);
    expect(() => normaliseShopUrl("https://shop.tiktok.com/view/product/123")).toThrow(/TikTok Shop doesn't allow/);
    expect(() => normaliseShopUrl("ebay.co.uk/str/x")).toThrow(/eBay/);
  });
});

describe("WooCommerce", () => {
  const woo = {
    id: 55, name: "Girls Tutu Dress", slug: "girls-tutu-dress", description: "<p>Party tutu dress.</p>",
    prices: { price: "1499", regular_price: "1999", sale_price: "1499", currency_code: "GBP", currency_minor_unit: 2 },
    images: [{ src: "https://cdn.example.com/pink.jpg", alt: "Tutu dress in pink" }, { src: "https://cdn.example.com/back.jpg", alt: "" }],
    categories: [{ name: "Girls" }, { name: "Dresses" }],
    attributes: [
      { name: "Colour", has_variations: true, terms: [{ name: "Pink", slug: "pink" }, { name: "Gold", slug: "gold" }] },
      { name: "Size", has_variations: true, terms: [{ name: "3-4 Years", slug: "3-4-years" }] },
    ],
    variations: [{ id: 1, attributes: [{ name: "Colour", value: "pink" }, { name: "Size", value: "3-4-years" }] }, { id: 2, attributes: [{ name: "Colour", value: "gold" }, { name: "Size", value: "3-4-years" }] }],
    is_in_stock: true,
  };

  it("maps prices, sale, sizes, colours and photos", () => {
    const p = wooToShopify(woo);
    expect(p).toMatchObject({ title: "Girls Tutu Dress", handle: "girls-tutu-dress", product_type: "Girls Dresses", options: [{ name: "Colour" }, { name: "Size" }] });
    expect(p.variants.map((v) => [v.option1, v.option2, v.price, v.compare_at_price])).toEqual([["Pink", "3-4 Years", "14.99", "19.99"], ["Gold", "3-4 Years", "14.99", "19.99"]]);
    const mapped = mapShopifyProduct(p, { source: "https://woo.example.com", defaultStock: 5, usdRate: 0 }, new Set(), new Set())!;
    expect(mapped.product).toMatchObject({ department: "GIRLS", category: "partywear", priceGBP: 1999, salePriceGBP: 1499 }); // a tutu counts as partywear
    expect(mapped.product.variants.map((v) => [v.size, v.colour])).toEqual([["3-4 Years", "Pink"], ["3-4 Years", "Gold"]]);
    expect(mapped.photos.map((ph) => ph.colour)).toEqual(["Pink", null]); // colour named in the photo's description
  });

  it("is found automatically and read page by page", async () => {
    fakeWeb({
      "https://woo.example.com/wp-json/wc/store/v1/products?per_page=1": [woo],
      "https://woo.example.com/wp-json/wc/store/v1/products?per_page=100&page=1": [woo],
      "https://woo.example.com/wp-json/wc/store/v1/products?per_page=100&page=2": [],
    });
    const lines: string[] = [];
    const r = await fetchStoreProducts("woo.example.com", Infinity, (l) => lines.push(l));
    expect(r.platform).toBe("WooCommerce");
    expect(r.items.map((i) => i.title)).toEqual(["Girls Tutu Dress"]);
    expect(lines[0]).toMatch(/WooCommerce/);
  });
});

describe("any website (schema.org Product)", () => {
  const group = {
    "@context": "https://schema.org", "@type": "ProductGroup", name: "Kids Christmas Jumper", description: "Warm &amp; festive knit.",
    category: "Boys > Knitwear", image: "/img/jumper.jpg", variesBy: ["https://schema.org/size", "https://schema.org/color"],
    hasVariant: [
      { "@type": "Product", sku: "XJ-R-34", size: "3-4Y", color: "Red", image: "https://cdn.shop.example/red.jpg", offers: { "@type": "Offer", price: "12.99", priceCurrency: "GBP", availability: "https://schema.org/InStock" } },
      { "@type": "Product", sku: "XJ-N-34", size: "3-4Y", color: "Navy", image: "https://cdn.shop.example/navy.jpg", offers: { "@type": "Offer", price: "12.99", priceCurrency: "GBP", availability: "https://schema.org/OutOfStock" } },
    ],
  };

  it("reads a product group with sizes, colours, stock and colour photos", () => {
    const p = pageToShopify(productPage({ "@graph": [{ "@type": "WebPage" }, group] }), "https://shop.example/products/kids-christmas-jumper")!;
    expect(p).toMatchObject({ title: "Kids Christmas Jumper", handle: "kids-christmas-jumper", body_html: "Warm & festive knit.", product_type: "Boys > Knitwear", options: [{ name: "Size" }, { name: "Colour" }] });
    expect(p.variants.map((v) => [v.option1, v.option2, v.price, v.available])).toEqual([["3-4Y", "Red", "12.99", true], ["3-4Y", "Navy", "12.99", false]]);
    const mapped = mapShopifyProduct(p, { source: "https://shop.example", defaultStock: 4, usdRate: 0 }, new Set(), new Set())!;
    expect(mapped.product).toMatchObject({ department: "BOYS", category: "festive-wear", priceGBP: 1299 }); // christmas jumper
    expect(mapped.product.variants.map((v) => v.stock)).toEqual([4, 0]);
    expect(mapped.photos.map((ph) => [ph.src, ph.colour])).toEqual([["https://shop.example/img/jumper.jpg", null], ["https://cdn.shop.example/red.jpg", "Red"], ["https://cdn.shop.example/navy.jpg", "Navy"]]);
  });

  it("reads a single product, and falls back to Open Graph product tags", () => {
    const single = pageToShopify(productPage({ "@type": "Product", name: "Plain Tee", image: ["https://cdn.shop.example/tee.jpg"], offers: [{ price: 5 }, { price: 7.5 }] }), "https://shop.example/p/plain-tee")!;
    expect(single.variants).toMatchObject([{ title: "Default Title", price: "7.5" }]);
    const og = pageToShopify('<meta property="og:title" content="Sun Hat"><meta property="product:price:amount" content="9.00"><meta property="og:image" content="/hat.jpg">', "https://shop.example/hat")!;
    expect(og).toMatchObject({ title: "Sun Hat", variants: [{ price: "9.00" }], images: [{ src: "https://shop.example/hat.jpg" }] });
    expect(pageToShopify("<html>about us</html>", "https://shop.example/about")).toBeNull();
  });

  it("finds product pages through the sitemap index, product sitemaps first, and skips other sites", async () => {
    const asked = fakeWeb({
      "https://shop.example/robots.txt": "User-agent: *\nSitemap: https://shop.example/sitemap_index.xml",
      "https://shop.example/sitemap_index.xml": "<sitemapindex><sitemap><loc>https://shop.example/page-sitemap.xml</loc></sitemap><sitemap><loc>https://shop.example/product-sitemap.xml</loc></sitemap></sitemapindex>",
      "https://shop.example/product-sitemap.xml": "<urlset><url><loc>https://shop.example/products/kids-christmas-jumper</loc></url><url><loc>https://evil.example/products/x</loc></url></urlset>",
      "https://shop.example/page-sitemap.xml": "<urlset><url><loc>https://shop.example/about</loc></url></urlset>",
      "https://shop.example/products/kids-christmas-jumper": productPage(group),
      "https://shop.example/about": "<html>About us</html>",
    });
    const lines: string[] = [];
    const r = await fetchStoreProducts("https://shop.example", Infinity, (l) => lines.push(l));
    expect(r.platform).toBe("website");
    expect(r.items.map((i) => i.title)).toEqual(["Kids Christmas Jumper"]);
    expect(asked.some((u) => u.includes("evil.example"))).toBe(false);
    expect(lines.join("\n")).toMatch(/Found 2 pages in the sitemap/);
  });

  it("imports the products linked from a category page", async () => {
    fakeWeb({
      "https://shop.example/collections/boys": '<a href="/products/kids-christmas-jumper">Jumper</a><a href="/basket">Basket</a><a href="https://other.example/x">x</a>',
      "https://shop.example/products/kids-christmas-jumper": productPage(group),
    });
    const r = await fetchStoreProducts("https://shop.example/collections/boys");
    expect(r.items.map((i) => i.title)).toEqual(["Kids Christmas Jumper"]);
  });

  it("says plainly when a website has no product details", async () => {
    fakeWeb({ "https://plain.example/sitemap.xml": "<urlset><url><loc>https://plain.example/about</loc></url></urlset>", "https://plain.example/about": "<html>Hello</html>" });
    await expect(fetchStoreProducts("plain.example")).rejects.toThrow(/No products found on this website/);
  });

  it("reads sitemap addresses, including CDATA", () => {
    expect(sitemapLocs("<urlset><url><loc><![CDATA[https://a.example/x?y=1&amp;z=2]]></loc></url><url><loc> https://a.example/b </loc></url></urlset>")).toEqual(["https://a.example/x?y=1&z=2", "https://a.example/b"]);
  });
});
