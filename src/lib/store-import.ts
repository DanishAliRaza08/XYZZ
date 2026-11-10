// Admin → Import products from any online shop. Works out what kind of website it is and reads its products:
//   1. Shopify          — the public /products.json feed
//   2. WooCommerce      — the public Store API (/wp-json/wc/store/v1/products)
//   3. any other website — product pages found through the sitemap (or the page entered), read from the
//      schema.org "Product" details most shops add for Google (JSON-LD), or from Open Graph product tags.
// Every product is turned into the Shopify shape, so mapShopifyProduct does departments, categories, SKUs and
// colour photos the same way for all of them. Marketplaces (Amazon, TikTok Shop, eBay, Etsy) block automated
// reading and their terms forbid it: their own export files are imported in Admin → Products → Excel instead.
import { fetchShopifyProducts, slugify, type ShopifyProduct } from "./shopify-import";

export type Platform = "Shopify" | "WooCommerce" | "website";

const UA = "Mozilla/5.0 (compatible; FashionRockstarImporter/1.0)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MARKETPLACES: [RegExp, string][] = [
  [/(^|\.)amazon\.[a-z.]+$/, "Amazon"],
  [/(^|\.)tiktok\.com$|(^|\.)tiktokshop\.com$/, "TikTok Shop"],
  [/(^|\.)ebay\.[a-z.]+$/, "eBay"],
  [/(^|\.)etsy\.com$/, "Etsy"],
];

/** "Amazon" etc. for marketplace addresses, which are imported from their export files instead. */
export function marketplaceOf(host: string): string | null {
  const h = host.toLowerCase();
  return MARKETPLACES.find(([re]) => re.test(h))?.[1] ?? null;
}

/** Only public websites: never this server, the local network or bare IP addresses. */
export function isPublicHost(host: string) {
  const h = host.toLowerCase();
  return h.includes(".") && h !== "localhost" && !h.endsWith(".local") && !h.endsWith(".internal") && !/^[\d.]+$/.test(h) && !h.includes(":");
}

/** The address typed in Admin → Import products → a full https address (the page is kept, e.g. a category page). */
export function normaliseShopUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("Enter a website address, e.g. https://shop.example.co.uk");
  }
  if (!isPublicHost(url.hostname)) throw new Error("Enter the address of a public online shop, e.g. https://shop.example.co.uk");
  const market = marketplaceOf(url.hostname);
  if (market)
    throw new Error(
      `${market} doesn't allow its pages to be copied automatically. Download your listings from ${market}'s seller account instead (e.g. Amazon: Inventory → Inventory Reports → Category Listings Report; TikTok Shop: Products → Manage products → Export) and upload the file in Admin → Products → Excel import / export.`,
    );
  url.protocol = "https:";
  url.hash = "";
  return url;
}

const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

async function get(url: string, accept: string): Promise<{ status: number; text: string; type: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !isPublicHost(u.hostname)) return null;
    const res = await fetch(u, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    return { status: res.status, text, type: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const r = await get(url, "application/json");
  if (!r || r.status !== 200) return null;
  try {
    return JSON.parse(r.text) as T;
  } catch {
    return null;
  }
}

/** Reads the products of any shop (up to limit). `note` gets progress lines for the admin page. */
export async function fetchStoreProducts(input: string, limit = Infinity, note: (line: string) => void = () => {}): Promise<{ platform: Platform; items: ShopifyProduct[] }> {
  const url = normaliseShopUrl(input);
  const origin = url.origin;

  const shopify = await getJson<{ products?: unknown[] }>(`${origin}/products.json?limit=1`);
  if (shopify && Array.isArray(shopify.products)) {
    note("This is a Shopify shop — reading its product feed");
    return { platform: "Shopify", items: await fetchShopifyProducts(origin, limit, (page, count) => note(`Read page ${page}: ${count} products`)) };
  }

  const woo = await getJson<unknown[]>(`${origin}/wp-json/wc/store/v1/products?per_page=1`);
  if (Array.isArray(woo)) {
    note("This is a WooCommerce shop — reading its product feed");
    return { platform: "WooCommerce", items: await fetchWooProducts(origin, limit, note) };
  }

  note("Not Shopify or WooCommerce — looking for product pages");
  const items = await fetchPageProducts(url, limit, note);
  if (!items.length)
    throw new Error(
      "No products found on this website. It may not describe its products for search engines (schema.org Product). If you can download your products as a spreadsheet, import it in Admin → Products → Excel import / export.",
    );
  return { platform: "website", items };
}

// ---------- WooCommerce ----------

type WooProduct = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  prices?: { price?: string; regular_price?: string; sale_price?: string; currency_code?: string; currency_minor_unit?: number };
  images?: { src: string; alt?: string }[];
  categories?: { name: string }[];
  tags?: { name: string }[];
  attributes?: { name: string; has_variations?: boolean; terms?: { name: string; slug: string }[] }[];
  variations?: { id: number; attributes: { name: string; value: string }[] }[];
  is_in_stock?: boolean;
};

const money = (minor: string | undefined, unit = 2) => (minor && Number(minor) > 0 ? (Number(minor) / 10 ** unit).toFixed(2) : null);

/** A WooCommerce Store API product → the Shopify shape. */
export function wooToShopify(p: WooProduct): ShopifyProduct {
  const unit = p.prices?.currency_minor_unit ?? 2;
  const price = money(p.prices?.price, unit) ?? "0";
  const regular = money(p.prices?.regular_price, unit);
  const compare = regular && Number(regular) > Number(price) ? regular : null;
  const attrs = (p.attributes ?? []).filter((a) => a.has_variations && a.terms?.length).slice(0, 3);
  const termName = (attr: string, value: string) =>
    attrs.find((a) => a.name.toLowerCase() === attr.toLowerCase())?.terms?.find((t) => t.slug === value || t.name.toLowerCase() === value.toLowerCase())?.name ?? value;
  const base = { sku: null, price, compare_at_price: compare, available: p.is_in_stock !== false, option1: null, option2: null, option3: null };
  const variants: ShopifyProduct["variants"] = p.variations?.length
    ? p.variations.map((v) => {
        const values = attrs.map((a) => {
          const found = v.attributes.find((x) => x.name.toLowerCase() === a.name.toLowerCase());
          return found?.value ? termName(a.name, found.value) : null;
        });
        return { ...base, id: v.id, title: values.filter(Boolean).join(" / "), option1: values[0] ?? null, option2: values[1] ?? null, option3: values[2] ?? null };
      })
    : [{ ...base, id: p.id, title: "Default Title" }];
  return {
    id: p.id,
    title: p.name,
    handle: p.slug,
    body_html: p.description || p.short_description || "",
    vendor: "",
    product_type: (p.categories ?? []).map((c) => c.name).join(" "),
    tags: (p.tags ?? []).map((t) => t.name),
    options: attrs.map((a, i) => ({ name: a.name, position: i + 1 })),
    variants,
    images: (p.images ?? []).map((i) => ({ src: i.src, alt: i.alt || null })),
  };
}

async function fetchWooProducts(origin: string, limit: number, note: (line: string) => void): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  const seen = new Set<number>();
  for (let page = 1; out.length < limit; page++) {
    const data = await getJson<WooProduct[]>(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!Array.isArray(data) || !data.length) break;
    // A shop that ignores ?page= would send the same products forever.
    if (data.every((p) => seen.has(p.id))) break;
    data.forEach((p) => seen.add(p.id));
    out.push(...data.map(wooToShopify));
    note(`Read page ${page}: ${data.length} products`);
    await sleep(500);
  }
  return out.slice(0, limit);
}

// ---------- any website: schema.org Product on product pages ----------

type Json = Record<string, unknown>;
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const isType = (o: Json, t: string) => asArray(o["@type"] as string | string[]).some((x) => String(x).toLowerCase() === t.toLowerCase());
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Every JSON-LD object on a page, including those inside @graph and arrays. */
export function jsonLdObjects(html: string): Json[] {
  const out: Json[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      out.push(v as Json);
      if ((v as Json)["@graph"]) walk((v as Json)["@graph"]);
    }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      // a broken block on the page: skip it
    }
  }
  return out;
}

function images(v: unknown): string[] {
  return asArray(v as unknown[]).map((i) => (typeof i === "string" ? i : str((i as Json)?.url ?? (i as Json)?.contentUrl))).filter(Boolean);
}

function offerInfo(o: Json): { price: number | null; was: number | null; currency: string; available: boolean; sku: string } {
  const offers = asArray(o.offers as Json | Json[]);
  let price: number | null = null;
  let currency = "";
  let available = offers.length === 0;
  for (const of of offers) {
    const p = Number(str(of.price) || str(of.highPrice) || str(of.lowPrice) || str((of.priceSpecification as Json)?.price));
    if (p > 0 && (price == null || p > price)) price = p;
    currency ||= str(of.priceCurrency);
    if (!/OutOfStock|SoldOut|Discontinued/i.test(str(of.availability))) available = true;
  }
  return { price, was: null, currency, available, sku: str(o.sku) };
}

/** Product details on one page (JSON-LD Product / ProductGroup, else Open Graph product tags) → the Shopify shape. */
export function pageToShopify(html: string, pageUrl: string): ShopifyProduct | null {
  const objects = jsonLdObjects(html);
  const group = objects.find((o) => isType(o, "ProductGroup"));
  const product = group ?? objects.find((o) => isType(o, "Product"));
  const path = new URL(pageUrl).pathname.replace(/\/+$/, "");
  const handle = slugify(decodeURIComponent(path.split("/").pop() || "")) || slugify(str(product?.name));
  const id = Math.abs([...pageUrl].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000_000;

  if (!product) {
    // Open Graph fallback: <meta property="product:price:amount" …>
    const meta = (prop: string) => decode(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i").exec(html)?.[1] ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html)?.[1] ?? "");
    const price = meta("product:price:amount") || meta("og:price:amount");
    const title = meta("og:title");
    if (!price || !title) return null;
    const image = meta("og:image");
    return {
      id, title, handle, body_html: meta("og:description"), vendor: "", product_type: "", tags: [], options: [],
      variants: [{ id, title: "Default Title", sku: null, price, compare_at_price: null, available: !/out ?of ?stock/i.test(meta("product:availability")), option1: null, option2: null, option3: null }],
      images: image ? [{ src: new URL(image, pageUrl).href, alt: title }] : [],
    };
  }

  const name = decode(str(product.name));
  if (!name) return null;
  const variantObjects = group ? asArray(group.hasVariant as Json | Json[]).filter((v) => v && typeof v === "object") : [];
  const items = variantObjects.length ? variantObjects : [product];
  const hasSize = items.some((v) => str(v.size) || str((v.size as Json)?.name));
  const hasColour = items.some((v) => str(v.color));
  const options = [...(hasSize ? [{ name: "Size", position: 1 }] : []), ...(hasColour ? [{ name: "Colour", position: hasSize ? 2 : 1 }] : [])];
  const groupOffer = offerInfo(product);
  const imgs: ShopifyProduct["images"] = [];
  const addImage = (src: string, variantId?: number) => {
    const abs = new URL(src, pageUrl).href;
    const found = imgs.find((i) => i.src === abs);
    if (found) {
      if (variantId) found.variant_ids = [...(found.variant_ids ?? []), variantId];
    } else imgs.push({ src: abs, alt: name, ...(variantId ? { variant_ids: [variantId] } : {}) });
  };
  images(product.image).forEach((src) => addImage(src));

  const variants: ShopifyProduct["variants"] = items.map((v, i) => {
    const vid = id * 100 + i;
    const offer = v === product ? groupOffer : offerInfo(v);
    const size = str(v.size) || str((v.size as Json)?.name);
    const colour = str(v.color);
    const values = [...(hasSize ? [size || "One size"] : []), ...(hasColour ? [colour || "As pictured"] : [])];
    if (v !== product) images(v.image).forEach((src) => addImage(src, vid));
    return {
      id: vid,
      title: values.join(" / ") || "Default Title",
      sku: offer.sku || null,
      price: String(offer.price ?? groupOffer.price ?? 0),
      compare_at_price: null,
      available: offer.available,
      option1: values[0] ?? null,
      option2: values[1] ?? null,
      option3: null,
    };
  });
  const category = str(product.category) || str((product.category as Json)?.name);
  return {
    id, title: name, handle, body_html: decode(str(product.description)), vendor: str((product.brand as Json)?.name ?? product.brand),
    product_type: category, tags: [], options, variants, images: imgs,
  };
}

/** Page addresses listed in a sitemap (or the sitemaps listed in a sitemap index). */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decode(m[1].trim()));
}

async function productPageUrls(start: URL, note: (line: string) => void): Promise<string[]> {
  const host = start.hostname;
  const sitemaps = new Set<string>();
  const robots = await get(`${start.origin}/robots.txt`, "text/plain");
  if (robots?.status === 200) for (const m of robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) sitemaps.add(m[1]);
  sitemaps.add(`${start.origin}/sitemap.xml`);
  sitemaps.add(`${start.origin}/sitemap_index.xml`);

  const pages = new Set<string>();
  const seen = new Set<string>();
  const queue = [...sitemaps];
  while (queue.length && seen.size < 40) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await get(sm, "application/xml,text/xml");
    if (!r || r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
    const locs = sitemapLocs(r.text).filter((u) => {
      try {
        return sameSite(new URL(u).hostname, host);
      } catch {
        return false;
      }
    });
    if (/<sitemapindex/i.test(r.text)) {
      // Product sitemaps first (most shops have one), then the others.
      const product = locs.filter((u) => /product/i.test(u));
      queue.unshift(...product);
      queue.push(...locs.filter((u) => !/product/i.test(u)));
    } else locs.forEach((u) => pages.add(u));
  }
  if (pages.size) note(`Found ${pages.size} pages in the sitemap`);
  // Likely product pages first.
  return [...pages].sort((a, b) => Number(/\/(products?|p|item|shop)\//i.test(b)) - Number(/\/(products?|p|item|shop)\//i.test(a)));
}

async function fetchPageProducts(start: URL, limit: number, note: (line: string) => void): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  const done = new Set<string>();
  let currencyNoted = false;
  const read = async (pageUrl: string) => {
    const key = pageUrl.replace(/[?#].*$/, "");
    if (done.has(key)) return null;
    done.add(key);
    const r = await get(pageUrl, "text/html");
    if (!r || r.status !== 200 || !/html/i.test(r.type)) return null;
    const p = pageToShopify(r.text, pageUrl);
    if (p && !currencyNoted) {
      const currency = /"priceCurrency"\s*:\s*"([A-Z]{3})"/.exec(r.text)?.[1];
      if (currency && currency !== "GBP") {
        note(`Prices on this website are in ${currency} — they're imported as £ amounts, so check them`);
        currencyNoted = true;
      }
    }
    return { product: p, html: r.text };
  };

  // The page that was entered: a product page, or a category page linking to products.
  const candidates: string[] = [];
  if (start.pathname !== "/" && start.pathname !== "") {
    const first = await read(start.href);
    if (first?.product) out.push(first.product);
    else if (first)
      for (const m of first.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
        try {
          const u = new URL(decode(m[1]), start.href);
          if (sameSite(u.hostname, start.hostname) && u.pathname.length > 1) candidates.push(u.href);
        } catch {
          // not a link
        }
      }
  }
  if (!candidates.length && out.length < limit) candidates.push(...(await productPageUrls(start, note)));

  let checked = 0;
  for (let i = 0; i < candidates.length && out.length < limit && checked < 3000; i += 4) {
    const batch = candidates.slice(i, i + 4);
    checked += batch.length;
    const results = await Promise.all(batch.map(read));
    for (const r of results) if (r?.product && out.length < limit) out.push(r.product);
    if (checked % 40 === 0) note(`Checked ${checked} pages, found ${out.length} products`);
    await sleep(250);
  }
  note(`Checked ${checked} pages, found ${out.length} products`);
  return out;
}
