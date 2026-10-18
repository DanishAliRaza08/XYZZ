import type { Department, Prisma } from "@prisma/client";
import { cached } from "./cache";
import { prisma } from "./db";
import type { CurrencyCode } from "./money";
import type { NavFilter } from "./navigation";
import { resolvePrice } from "./pricing";

export const DEPARTMENTS: { slug: string; value: Department; label: string; blurb: string }[] = [
  { slug: "women", value: "WOMEN", label: "Women", blurb: "Occasionwear, knitwear and everyday essentials." },
  { slug: "girls", value: "GIRLS", label: "Girls", blurb: "Party dresses, playwear and school-day favourites." },
  { slug: "boys", value: "BOYS", label: "Boys", blurb: "Smart sets, shirts and hard-wearing casualwear." },
  { slug: "baby", value: "BABY", label: "Baby & Toddler", blurb: "Soft first outfits and gifting, newborn to 3 years." },
  { slug: "men", value: "MEN", label: "Men", blurb: "Tailoring and weekend pieces." },
];

export const COLLECTIONS = {
  "new-arrivals": { label: "New arrivals", blurb: "The latest pieces, just landed." },
  bestsellers: { label: "Bestsellers", blurb: "The styles our customers love most." },
  sale: { label: "Sale", blurb: "Reduced prices on selected styles, while stock lasts." },
  all: { label: "Shop all", blurb: "Everything in store." },
} as const;

export type ListingQuery = {
  department?: Department;
  categorySlug?: string;
  collection?: keyof typeof COLLECTIONS;
  filter?: NavFilter; // a menu section or page (src/lib/navigation.ts)
  q?: string;
  sizes?: string[];
  colours?: string[];
  minPrice?: number; // minor units
  maxPrice?: number;
  inStock?: boolean;
  sort?: "recommended" | "newest" | "price-asc" | "price-desc" | "bestseller";
  page?: number;
  currency: CurrencyCode;
};

export const PAGE_SIZE = 24;

const listingInclude = {
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { sortOrder: "asc" } },
  category: true,
} satisfies Prisma.ProductInclude;

export type ListingProduct = Prisma.ProductGetPayload<{ include: typeof listingInclude }>;

/**
 * Every published product with its photos, sizes/colours and category, newest first. Cached in memory
 * (src/lib/cache.ts) so listings, search, the menu and product pages don't each re-read the database;
 * fine for catalogues of a few thousand products — move to a search index beyond that.
 */
export function getCatalog(): Promise<{ products: ListingProduct[]; bySlug: Map<string, ListingProduct> }> {
  return cached("catalog", async () => {
    const products = await prisma.product.findMany({ where: { status: "PUBLISHED" }, include: listingInclude, orderBy: { createdAt: "desc" } });
    return { products, bySlug: new Map(products.map((p) => [p.slug, p])) };
  });
}

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Whether a product matches the listing's department/category/collection/search rules (everything except size, colour and price). */
export function matchesListing(p: ListingProduct, q: Omit<ListingQuery, "page" | "sort">, now = Date.now()): boolean {
  // A menu filter's department takes the place of the page's department.
  const department = q.filter?.department ?? q.department;
  if (department && p.department !== department) return false;
  if (q.categorySlug && p.category.slug !== q.categorySlug) return false;
  if (q.collection === "bestsellers" && !p.bestseller) return false;
  if (q.currency === "USD" && p.priceUSD == null) return false;
  if (q.collection === "sale" && (q.currency === "GBP" ? p.salePriceGBP : p.salePriceUSD) == null) return false;
  if (q.collection === "new-arrivals" && p.createdAt.getTime() < now - 1000 * 60 * 60 * 24 * 60) return false;
  if (q.filter) {
    // A product matches if it is in ANY of the listed categories OR collections.
    const categories = q.filter.categories ?? [];
    const collections = (q.filter.collections ?? []).map(lower);
    if ((categories.length || collections.length) && !categories.includes(p.category.slug) && !collections.includes(lower(p.collection))) return false;
  }
  if (q.q) {
    const term = lower(q.q.slice(0, 80));
    const found =
      lower(p.name).includes(term) ||
      lower(p.description).includes(term) ||
      lower(p.collection).includes(term) ||
      lower(p.category.name).includes(term) ||
      p.variants.some((v) => lower(v.sku) === term || lower(v.colour).includes(term));
    if (!found) return false;
  }
  return true;
}

/** Matching published products for a listing page, with size/colour facets, filtered, sorted and paged. */
export async function listProducts(q: ListingQuery) {
  const now = Date.now();
  const all = (await getCatalog()).products.filter((p) => matchesListing(p, q, now));

  // Facets come from the products matching the base query, before size/colour/price filters.
  const facetSizes = new Set<string>();
  const facetColours = new Map<string, string>();
  for (const p of all)
    for (const v of p.variants) {
      facetSizes.add(v.size);
      facetColours.set(v.colour, v.colourHex);
    }

  let items = all.filter((p) => {
    const price = resolvePrice(p, q.currency);
    if (!price) return false;
    if (q.minPrice != null && price.price < q.minPrice) return false;
    if (q.maxPrice != null && price.price > q.maxPrice) return false;
    const variants = p.variants.filter(
      (v) =>
        (!q.sizes?.length || q.sizes.includes(v.size)) &&
        (!q.colours?.length || q.colours.includes(v.colour)) &&
        (!q.inStock || v.stock > 0),
    );
    return variants.length > 0;
  });
  if (q.collection === "sale") items = items.filter((p) => resolvePrice(p, q.currency)?.compareAt != null);

  const priceOf = (p: ListingProduct) => resolvePrice(p, q.currency)?.price ?? 0;
  switch (q.sort) {
    case "price-asc":
      items.sort((a, b) => priceOf(a) - priceOf(b));
      break;
    case "price-desc":
      items.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case "newest":
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "bestseller":
      items.sort((a, b) => Number(b.bestseller) - Number(a.bestseller));
      break;
    default:
      items.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.bestseller) - Number(a.bestseller));
  }

  const total = items.length;
  const page = Math.max(1, q.page ?? 1);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    items: pageItems,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    facets: {
      sizes: sortSizes([...facetSizes]),
      colours: [...facetColours.entries()].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

const SIZE_ORDER = ["0-3m", "3-6m", "6-12m", "12-18m", "18-24m", "2-3y", "3-4y", "4-5y", "5-6y", "6-7y", "7-8y", "8-9y", "9-10y", "10-11y", "11-12y", "12-13y", "XS", "S", "M", "L", "XL", "XXL", "6", "8", "10", "12", "14", "16", "18", "20", "One size"];

export function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, undefined, { numeric: true });
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export async function getProductBySlug(slug: string) {
  return (await getCatalog()).bySlug.get(slug) ?? null;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
