// Imports a product catalogue from a Shopify store's public products feed (/products.json):
//   • downloads product photos into public/images/products/<product>/
//   • writes prisma/data/products.json, which `npm run db:seed` loads into the database
//
// Usage:  npm run import:products                       (defaults to https://gumandberries.co.uk)
//         npm run import:products -- https://shop.example --max-images 4 --limit 200
//
// Only import products and photos you have permission to sell and reuse.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_NAMES } from "../src/lib/categories";
import { sniffImage } from "../src/lib/uploads";

export { CATEGORY_NAMES };

type ShopifyProduct = {
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


// ---------- options ----------
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SOURCE = (args.find((a) => /^https?:\/\//.test(a)) ?? "https://gumandberries.co.uk").replace(/\/+$/, "");
// Prefix for SKUs the source store left blank, from its name (gumandberries.co.uk → "GUM").
const SKU_PREFIX = new URL(SOURCE).hostname.replace(/^www\./, "").slice(0, 3).toUpperCase();
const MAX_IMAGES = Number(flag("max-images") ?? 4);
const LIMIT = Number(flag("limit") ?? Infinity);
const IMAGE_WIDTH = Number(flag("image-width") ?? 1000);
const DEFAULT_STOCK = Number(flag("stock") ?? 10); // the feed only says in/out of stock, not quantities
const USD_RATE = Number(flag("usd-rate") ?? 1.3); // 0 = don't set US prices
const IMAGE_DIR = path.resolve("public/images/products");
const DATA_FILE = path.resolve("prisma/data/products.json");
const UA = "Mozilla/5.0 (compatible; FashionRockstarImporter/1.0)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 && attempt < 5) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}

// ---------- mapping helpers ----------
const pence = (s: string | null | undefined) => (s && Number(s) > 0 ? Math.round(Number(s) * 100) : null);
const toUsd = (gbp: number | null) => (gbp && USD_RATE > 0 ? Math.max(99, Math.round((gbp * USD_RATE) / 100) * 100 - 1) : null);

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

// ---------- images ----------
async function downloadImage(src: string, dir: string, n: number): Promise<string | null> {
  const url = new URL(src.startsWith("//") ? `https:${src}` : src);
  if (IMAGE_WIDTH > 0 && /shopify/.test(url.hostname)) url.searchParams.set("width", String(IMAGE_WIDTH));
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = sniffImage(buf);
    if (!type) throw new Error("not a JPG/PNG/WebP image");
    const file = `${n}.${type.ext}`;
    await writeFile(path.join(dir, file), buf);
    return file;
  } catch (e) {
    console.warn(`  ! image skipped (${src}): ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ---------- main ----------
async function main() {
  console.log(`Importing from ${SOURCE} …`);
  const raw: ShopifyProduct[] = [];
  for (let page = 1; raw.length < LIMIT; page++) {
    const { products } = await getJson<{ products: ShopifyProduct[] }>(`${SOURCE}/products.json?limit=250&page=${page}`);
    if (!products.length) break;
    raw.push(...products);
    console.log(`  page ${page}: ${products.length} products`);
    await sleep(500);
  }
  const selected = raw.slice(0, LIMIT);

  await mkdir(IMAGE_DIR, { recursive: true });
  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();
  const out: ImportedProduct[] = [];

  for (const [index, p] of selected.entries()) {
    let slug = slugify(p.handle || p.title) || `product-${p.id}`;
    while (usedSlugs.has(slug)) slug = `${slug}-${index}`;
    usedSlugs.add(slug);

    const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",");
    const text = ` ${[p.title, p.product_type, ...tags].join(" ").toLowerCase()} `;
    const optIdx = (re: RegExp) => p.options.findIndex((o) => re.test(o.name));
    const sizeIdx = optIdx(/size|age/i);
    const colourIdx = optIdx(/colou?r/i);
    const opt = (v: ShopifyProduct["variants"][number], i: number) => (i < 0 ? null : [v.option1, v.option2, v.option3][i]);

    const variants: ImportedProduct["variants"] = [];
    const combos = new Set<string>();
    for (const [vi, v] of p.variants.entries()) {
      const size = (opt(v, sizeIdx) ?? (v.title !== "Default Title" && colourIdx < 0 ? v.title : "One size")).slice(0, 30);
      const colour = (opt(v, colourIdx) ?? "As pictured").slice(0, 40);
      if (combos.has(`${size}|${colour}`)) continue;
      combos.add(`${size}|${colour}`);
      let sku = (v.sku ?? "").trim().slice(0, 60) || `${SKU_PREFIX}-${p.id}-${vi + 1}`;
      while (usedSkus.has(sku)) sku = `${sku}-${vi + 1}`;
      usedSkus.add(sku);
      variants.push({ sku, size, colour, colourHex: colourHex(colour), stock: v.available === false ? 0 : DEFAULT_STOCK });
    }
    if (!variants.length) continue;

    // One price per product: use the highest variant price so nothing is sold below its source price.
    const priced = p.variants.map((v) => ({ price: pence(v.price), was: pence(v.compare_at_price) })).filter((v) => v.price);
    if (!priced.length) continue;
    const top = priced.reduce((a, b) => ((b.price ?? 0) > (a.price ?? 0) ? b : a));
    const onSale = top.was != null && top.was > top.price!;
    const priceGBP = onSale ? top.was! : top.price!;
    const salePriceGBP = onSale ? top.price! : null;

    const dir = path.join(IMAGE_DIR, slug);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const images: ImportedProduct["images"] = [];
    for (const [ii, img] of p.images.slice(0, MAX_IMAGES).entries()) {
      const file = await downloadImage(img.src, dir, ii + 1);
      if (file) images.push({ url: `/images/products/${slug}/${file}`, alt: img.alt?.trim() || p.title });
    }
    if (!(await readdir(dir)).length) await rm(dir, { recursive: true, force: true });

    const description = htmlToText(p.body_html);
    out.push({
      slug,
      name: p.title.trim().slice(0, 120),
      description: description.length >= 10 ? description.slice(0, 5000) : `${p.title.trim()} — see photos for details.`,
      department: department(text),
      category: category(text),
      collection: collection(text),
      priceGBP,
      salePriceGBP,
      priceUSD: toUsd(priceGBP),
      salePriceUSD: salePriceGBP ? toUsd(salePriceGBP) : null,
      ageRange: ageRange(variants.map((v) => v.size)),
      variants,
      images,
      source: `${SOURCE}/products/${p.handle}`,
    });
    console.log(`  [${index + 1}/${selected.length}] ${p.title} — ${images.length} photo(s)`);
  }

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nSaved ${out.length} products to ${path.relative(process.cwd(), DATA_FILE)} and photos to public/images/products/.`);
  console.log("Next: run `npm run db:seed` to load them into the shop.");
}

if (process.argv[1] && /import-shopify/.test(process.argv[1]))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
