// Reading a Shopify store's public product feed (/products.json) and turning its products into ours.
// Used by the command-line importer (scripts/import-shopify.ts) and Admin → Import products (src/lib/import-job.ts).
// Only import products and photos you have permission to sell and reuse.
import { sniffImage } from "./uploads";

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[] | string;
  options: { name: string; position: number }[];
  variants: { id: number; title: string; sku: string | null; price: string; compare_at_price: string | null; available?: boolean; option1: string | null; option2: string | null; option3: string | null }[];
  images: { src: string; alt?: string | null }[];
};

export type ImportedProduct = {
  slug: string;
  name: string;
  description: string;
  department: "WOMEN" | "MEN" | "GIRLS" | "BOYS" | "BABY";
  category: string; // category slug from src/lib/categories.ts
  collection: string | null;
  priceGBP: number; // pence
  salePriceGBP: number | null;
  priceUSD: number | null;
  salePriceUSD: number | null;
  ageRange: string | null;
  variants: { sku: string; size: string; colour: string; colourHex: string; stock: number }[];
  images: { url: string; alt: string }[];
  source: string;
};

export type MapOptions = { source: string; defaultStock: number; usdRate: number };

const UA = "Mozilla/5.0 (compatible; FashionRockstarImporter/1.0)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "gumandberries.co.uk/collections/x" → "https://gumandberries.co.uk". Throws a readable error for anything else. */
export function normaliseSource(input: string): string {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("Enter a website address, e.g. https://shop.example.co.uk");
  }
  const host = url.hostname.toLowerCase();
  // Only public websites: never this server, the local network or bare IP addresses.
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":"))
    throw new Error("Enter the address of a public online shop, e.g. https://shop.example.co.uk");
  return `https://${host}`;
}

/** Short prefix for SKUs the source store left blank (gumandberries.co.uk → "GUM"). */
export function skuPrefix(source: string) {
  return new URL(source).hostname.replace(/^www\./, "").slice(0, 3).toUpperCase();
}

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(30_000) }).catch(() => {
      throw new Error(`Couldn't reach ${new URL(url).origin}. Check the address is right and the website is online, then try again.`);
    });
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error("This website doesn't have a Shopify product feed (/products.json), so its products can't be imported automatically.");
      }
    }
    if (res.status === 429 && attempt < 5) {
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 404) throw new Error("This website doesn't have a Shopify product feed (/products.json), so its products can't be imported automatically.");
    throw new Error(`The website answered ${res.status} ${res.statusText} for ${url}`);
  }
}

/** Every product in the store's feed (up to limit), 250 per page. */
export async function fetchShopifyProducts(source: string, limit = Infinity, onPage?: (page: number, count: number) => void): Promise<ShopifyProduct[]> {
  const raw: ShopifyProduct[] = [];
  for (let page = 1; raw.length < limit; page++) {
    const data = await getJson<{ products?: ShopifyProduct[] }>(`${source}/products.json?limit=250&page=${page}`);
    if (!Array.isArray(data.products)) throw new Error("This website doesn't have a Shopify product feed (/products.json), so its products can't be imported automatically.");
    if (!data.products.length) break;
    raw.push(...data.products);
    onPage?.(page, data.products.length);
    await sleep(500);
  }
  return raw.slice(0, limit);
}

/** Downloads one product photo (resized by Shopify's CDN to `width`) and checks it really is a JPG/PNG/WebP. */
export async function downloadImage(src: string, width = 1000): Promise<{ buf: Buffer; ext: "jpg" | "png" | "webp" }> {
  const url = new URL(src.startsWith("//") ? `https:${src}` : src);
  if (url.protocol !== "https:") throw new Error("not an https image");
  if (width > 0 && /shopify/.test(url.hostname)) url.searchParams.set("width", String(width));
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) throw new Error("image larger than 10MB");
  const type = sniffImage(buf);
  if (!type) throw new Error("not a JPG/PNG/WebP image");
  return { buf, ext: type.ext };
}

// ---------- mapping helpers ----------
const pence = (s: string | null | undefined) => (s && Number(s) > 0 ? Math.round(Number(s) * 100) : null);
const toUsd = (gbp: number | null, rate: number) => (gbp && rate > 0 ? Math.max(99, Math.round((gbp * rate) / 100) * 100 - 1) : null);

export function slugify(input: string) {
  return input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function htmlToText(html: string | null) {
  if (!html) return "";
  return html
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const has = (text: string, re: RegExp) => re.test(text);

export function department(text: string): ImportedProduct["department"] {
  if (has(text, /\b(baby|babies|infant|newborn|toddler|0-3 ?m|bodysuit|romper|sleepsuit)\b/)) return "BABY";
  if (has(text, /\b(women|womens|women's|ladies)\b/)) return "WOMEN";
  if (has(text, /\b(men|mens|men's)\b/)) return "MEN";
  const girl = has(text, /\b(girls?|girl's)\b/);
  const boy = has(text, /\b(boys?|boy's)\b/);
  if (girl !== boy) return girl ? "GIRLS" : "BOYS";
  // Unisex or unclear kids' items go to Girls — move them in Admin → Products if needed.
  return "GIRLS";
}

export function category(text: string): string {
  // First match wins, so more specific rules come first. Slugs are from src/lib/categories.ts.
  const rules: [RegExp, string][] = [
    [/\b(costumes?|fancy dress|dress[- ]up|world book day)\b/, "costumes"],
    [/\b(pencil case|lunch ?bag|lunch ?box|school ?bag|backpack|rucksack|stationery|water bottle|book ?bag)\b/, "stationery"],
    [/\b(school|uniform|pinafore|blazer|pe kit)\b/, "school-uniform"],
    [/\b(shoes?|trainers?|boots?|sandals?|slippers?|sliders?|wellies|wellingtons|flip flops?|pumps)\b/, "footwear"],
    [/\b(pyjamas?|pjs?|nightwear|nightie|nightdress|onesie|dressing gown|robe|loungewear)\b/, "nightwear"],
    [/\b(bodysuits?|sleepsuits?|babygrows?|rompers?)\b/, "baby-essentials"],
    [/\b(swim\w*|bikini|beachwear)\b/, "swimwear"],
    [/\b(socks?|underwear|briefs|boxers?|knickers|vests?)\b/, "underwear-socks"],
    [/\b(eid|diwali|kurta|shalwar|lehenga|abaya|thobe|jubba|sherwani|christmas jumper)\b/, "festive-wear"],
    [/\b(suit|waistcoat|bridesmaid|flower girl|page ?boy|party ?dress|partywear|tutu)\b/, "partywear"],
    [/\b(tracksuit|set|co-ord|outfit|2 ?pc|3 ?pc|two piece|three piece)\b/, "sets"],
    [/\b(dress|dresses|gown)\b/, "dresses"],
    [/\b(hats?|beanie|gloves?|mittens|scarf|bags?|hair|bows?|headband|accessor\w*|umbrella)\b/, "accessories"],
    [/\b(coat|jacket|gilet|puffer|raincoat|parka|snowsuit)\b/, "coats"],
    [/\b(jumper|cardigan|knit\w*|sweater)\b/, "knitwear"],
    [/\b(hoodie|hoody|sweatshirt|zip[- ]through)\b/, "hoodies"],
    [/\b(leggings?|jeans|trousers|joggers?|jogging bottoms|chinos)\b/, "trousers"],
    [/\b(skirts?|skort|shorts)\b/, "skirts-shorts"],
    [/\b(t-?shirts?|tee|tops?|shirts?|polo|blouse)\b/, "tops"],
  ];
  return rules.find(([re]) => re.test(text))?.[1] ?? "more-styles";
}

export function collection(text: string) {
  if (has(text, /\b(halloween|spooky|pumpkin|skeleton|witch|vampire)\b/)) return "Halloween";
  if (has(text, /\b(christmas|xmas|festive|santa|elf|reindeer|snowman)\b/)) return "Christmas";
  if (has(text, /\b(eid|ramadan)\b/)) return "Eid";
  if (has(text, /\b(diwali)\b/)) return "Diwali";
  if (has(text, /\b(world book day|book week)\b/)) return "World Book Day";
  return null;
}

const COLOURS: Record<string, string> = {
  black: "#1c1a17", white: "#f5f5f2", ivory: "#f3ead8", cream: "#efe6d2", grey: "#9a9a9a", gray: "#9a9a9a", navy: "#26324a", blue: "#3b6fb6",
  "sky blue": "#a9c4dc", red: "#b3122e", burgundy: "#7a2e3b", pink: "#e8a3b8", "baby pink": "#f4c6d2", blush: "#e8b4bc", purple: "#6c4b8a",
  lilac: "#c7b7d8", green: "#3f7a4f", khaki: "#8a8452", sage: "#b7c4a8", yellow: "#f2cf4a", mustard: "#c99a2e", orange: "#e6792b",
  brown: "#6b4a32", beige: "#d8c8a8", camel: "#b8925f", gold: "#c9a85b", silver: "#c9c9cf", multi: "#b08fb8", multicolour: "#b08fb8",
};
export function colourHex(name: string) {
  const n = name.toLowerCase();
  return COLOURS[n] ?? Object.entries(COLOURS).find(([k]) => new RegExp(`\\b${k}\\b`).test(n))?.[1] ?? "#cccccc";
}

function ageRange(sizes: string[]) {
  const ages = sizes.flatMap((s) => [...s.matchAll(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(y|yrs|years|m|months)/gi)]);
  if (!ages.length) return null;
  const isMonths = ages.every((a) => a[3].toLowerCase().startsWith("m"));
  const nums = ages.flatMap((a) => [Number(a[1]), Number(a[2] ?? a[1])]);
  return `${Math.min(...nums)}–${Math.max(...nums)} ${isMonths ? "months" : "years"}`;
}

/**
 * One Shopify product → our product (without photos; `photos` lists the image addresses to download).
 * Returns null for products with no sizes or no price. usedSlugs/usedSkus keep slugs and SKUs unique within a run.
 * Every size/colour gets a new SKU of our own — <shop prefix>-<shop's product number>-<n>, e.g. GUM-8123456789-3 —
 * because shops often repeat or leave out SKUs. usedSkus holds lower-case SKUs: MySQL treats ABC1 and abc1 as the same.
 */
export function mapShopifyProduct(
  p: ShopifyProduct,
  opts: MapOptions,
  usedSlugs: Set<string>,
  usedSkus: Set<string>,
): { product: Omit<ImportedProduct, "images">; photos: { src: string; alt: string }[] } | null {
  let slug = slugify(p.handle || p.title) || `product-${p.id}`;
  while (usedSlugs.has(slug)) slug = `${slug}-${p.id}`;

  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",");
  const text = ` ${[p.title, p.product_type, ...tags].join(" ").toLowerCase()} `;
  const optIdx = (re: RegExp) => (p.options ?? []).findIndex((o) => re.test(o.name));
  const sizeIdx = optIdx(/size|age/i);
  const colourIdx = optIdx(/colou?r/i);
  const opt = (v: ShopifyProduct["variants"][number], i: number) => (i < 0 ? null : [v.option1, v.option2, v.option3][i]);
  const prefix = skuPrefix(opts.source);

  const variants: ImportedProduct["variants"] = [];
  const combos = new Set<string>();
  for (const [vi, v] of (p.variants ?? []).entries()) {
    const size = (opt(v, sizeIdx) ?? (v.title !== "Default Title" && colourIdx < 0 ? v.title : "One size")).slice(0, 30);
    const colour = (opt(v, colourIdx) ?? "As pictured").slice(0, 40);
    if (combos.has(`${size}|${colour}`)) continue;
    combos.add(`${size}|${colour}`);
    let sku = `${prefix}-${p.id}-${variants.length + 1}`;
    for (let n = 2; usedSkus.has(sku.toLowerCase()); n++) sku = `${prefix}-${p.id}-${variants.length + 1}-${n}`;
    usedSkus.add(sku.toLowerCase());
    variants.push({ sku, size, colour, colourHex: colourHex(colour), stock: v.available === false ? 0 : opts.defaultStock });
  }
  if (!variants.length) return null;

  // One price per product: use the highest variant price so nothing is sold below its source price.
  const priced = p.variants.map((v) => ({ price: pence(v.price), was: pence(v.compare_at_price) })).filter((v) => v.price);
  if (!priced.length) return null;
  const top = priced.reduce((a, b) => ((b.price ?? 0) > (a.price ?? 0) ? b : a));
  const onSale = top.was != null && top.was > top.price!;
  const priceGBP = onSale ? top.was! : top.price!;
  const salePriceGBP = onSale ? top.price! : null;

  usedSlugs.add(slug);
  const description = htmlToText(p.body_html);
  return {
    product: {
      slug,
      name: p.title.trim().slice(0, 120),
      description: description.length >= 10 ? description.slice(0, 5000) : `${p.title.trim()} — see photos for details.`,
      department: department(text),
      category: category(text),
      collection: collection(text),
      priceGBP,
      salePriceGBP,
      priceUSD: toUsd(priceGBP, opts.usdRate),
      salePriceUSD: salePriceGBP ? toUsd(salePriceGBP, opts.usdRate) : null,
      ageRange: ageRange(variants.map((v) => v.size)),
      variants,
      source: `${opts.source}/products/${p.handle}`,
    },
    photos: (p.images ?? []).map((img) => ({ src: img.src, alt: img.alt?.trim() || p.title })),
  };
}
