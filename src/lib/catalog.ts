import type { Department, Prisma } from "@prisma/client";
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
 * Loads matching published products. Price filtering and price sorting depend on the active
 * currency and sale prices, so the final filter/sort happens in memory after the DB query —
 * fine for catalogues of a few thousand products; move to a search index beyond that.
 */
export async function listProducts(q: ListingQuery) {
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  if (q.department) where.department = q.department;
  if (q.categorySlug) where.category = { slug: q.categorySlug };
  if (q.collection === "bestsellers") where.bestseller = true;
  if (q.currency === "USD") where.priceUSD = { not: null };
  if (q.collection === "sale")
    where.OR = q.currency === "GBP" ? [{ salePriceGBP: { not: null } }] : [{ salePriceUSD: { not: null } }];
  if (q.collection === "new-arrivals") where.createdAt = { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) };
  const and: Prisma.ProductWhereInput[] = [];
  if (q.filter) {
    if (q.filter.department) where.department = q.filter.department;
    // A product matches if it is in ANY of the listed categories OR collections.
    const anyOf: Prisma.ProductWhereInput[] = [];
    if (q.filter.categories?.length) anyOf.push({ category: { slug: { in: q.filter.categories } } });
    for (const name of q.filter.collections ?? []) anyOf.push({ collection: { equals: name, mode: "insensitive" } });
    if (anyOf.length) and.push({ OR: anyOf });
  }
  if (q.q) {
    const term = q.q.slice(0, 80);
    and.push(
      {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { collection: { contains: term, mode: "insensitive" } },
          { category: { name: { contains: term, mode: "insensitive" } } },
          { variants: { some: { sku: { equals: term, mode: "insensitive" } } } },
          { variants: { some: { colour: { contains: term, mode: "insensitive" } } } },
        ],
      },
    );
  }
  if (and.length) where.AND = and;

  const all = await prisma.product.findMany({ where, include: listingInclude, orderBy: { createdAt: "desc" } });

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
  return prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: listingInclude,
  });
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
