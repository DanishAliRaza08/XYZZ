// The shop's menu: every top-level item in the header (Boys, Girls, … Sale), its dropdown,
// the pages under it and the "Shop by department" tiles on the homepage — all from this one file.
//
// How it fits together
//   Section  = a top-level menu item. It has its own page at /shop/<section-slug>.
//   Page     = a link inside the section's dropdown. It has a page at /shop/<section-slug>/<page-slug>.
//   Filter   = which products a section or page lists. A page's filter is laid over its section's
//              filter, so a page in "Boys" only has to say { categories: ["tops"] }.
//
// To add a page to a dropdown, add an entry to one of the section's `columns[].pages` lists.
// To add a new menu item, add a new Section to SECTIONS. See README → "Menu, categories and pages".
import type { Department } from "@prisma/client";
import { CATEGORIES } from "./categories";

export type NavFilter = {
  department?: Department;
  // Products in ANY of these categories (slugs from src/lib/categories.ts) …
  categories?: string[];
  // … or whose "Collection / edit" field is ANY of these (e.g. "Halloween"). Case does not matter.
  collections?: string[];
};

export type NavPage = { slug: string; label: string; description?: string; filter?: NavFilter };
export type NavLink = { label: string; href: string };
export type NavColumn = { title: string; pages?: NavPage[]; links?: NavLink[] };
export type NavPromo = { title: string; text: string; href: string; cta: string };
export type HomeTile = { title?: string; text?: string; href?: string; image: string; button: string };

export type Section = {
  slug: string;
  label: string;
  description: string; // shown in the dropdown and at the top of the section's page
  filter: NavFilter;
  columns: NavColumn[];
  promo?: NavPromo;
  tile?: HomeTile; // shows the section in "Shop by department" on the homepage
  // For department sections: list categories that have products but aren't in `columns` under "More in …".
  autoCategories?: boolean;
};

/** A dropdown page listing one category. Its URL is /shop/<section>/<category-slug>; the description defaults to the category's. */
const cat = (slug: string, label: string, description?: string): NavPage => ({
  slug,
  label,
  description: description ?? CATEGORIES.find((c) => c.slug === slug)?.description,
  filter: { categories: [slug] },
});

export const SECTIONS: Section[] = [
  {
    slug: "boys",
    label: "Boys",
    description: "Everyday clothing, tracksuits, partywear and school basics for boys aged 0–16.",
    filter: { department: "BOYS" },
    autoCategories: true,
    columns: [
      {
        title: "Clothing",
        pages: [
          cat("tops", "T-shirts & tops"),
          cat("hoodies", "Hoodies & sweatshirts"),
          cat("sets", "Tracksuits & sets"),
          cat("trousers", "Jeans, joggers & trousers"),
          cat("skirts-shorts", "Shorts"),
          cat("coats", "Coats & jackets"),
          cat("knitwear", "Jumpers & cardigans"),
        ],
      },
      {
        title: "Occasions & essentials",
        pages: [
          cat("partywear", "Suits & partywear"),
          cat("festive-wear", "Eid & festive outfits"),
          cat("nightwear", "Pyjamas & nightwear"),
          cat("underwear-socks", "Underwear & socks"),
          cat("swimwear", "Swimwear"),
          cat("school-uniform", "School uniform"),
          cat("footwear", "Shoes & trainers"),
          cat("accessories", "Hats & accessories"),
        ],
      },
    ],
    promo: { title: "Back to school", text: "Polo shirts, trousers, jumpers and school shoes.", href: "/shop/school-stationery/boys-uniform", cta: "Shop boys' uniform" },
    tile: { image: "/images/departments/boys.svg", button: "Shop boys" },
  },
  {
    slug: "girls",
    label: "Girls",
    description: "Dresses, leggings, party outfits, pyjamas and school favourites for girls aged 0–16.",
    filter: { department: "GIRLS" },
    autoCategories: true,
    columns: [
      {
        title: "Clothing",
        pages: [
          cat("dresses", "Dresses"),
          cat("tops", "T-shirts & tops"),
          cat("hoodies", "Hoodies & sweatshirts"),
          cat("sets", "Tracksuits & sets"),
          cat("trousers", "Leggings & jeans"),
          cat("skirts-shorts", "Skirts & shorts"),
          cat("coats", "Coats & jackets"),
          cat("knitwear", "Jumpers & cardigans"),
        ],
      },
      {
        title: "Occasions & essentials",
        pages: [
          cat("partywear", "Party & occasionwear"),
          cat("festive-wear", "Eid & festive outfits"),
          cat("nightwear", "Pyjamas & nightwear"),
          cat("underwear-socks", "Underwear & socks"),
          cat("swimwear", "Swimwear"),
          cat("school-uniform", "School uniform"),
          cat("footwear", "Shoes & trainers"),
          cat("accessories", "Hair accessories & bags"),
        ],
      },
    ],
    promo: { title: "Party season", text: "Sparkly dresses and outfits for birthdays, weddings and celebrations.", href: "/shop/girls/partywear", cta: "Shop partywear" },
    tile: { image: "/images/departments/girls.svg", button: "Shop girls" },
  },
  {
    slug: "men",
    label: "Men",
    description: "Casual essentials, tracksuits, loungewear and footwear for men.",
    filter: { department: "MEN" },
    autoCategories: true,
    columns: [
      {
        title: "Clothing",
        pages: [
          cat("tops", "T-shirts, polos & shirts"),
          cat("hoodies", "Hoodies & sweatshirts"),
          cat("sets", "Tracksuits"),
          cat("trousers", "Jeans, joggers & trousers"),
          cat("skirts-shorts", "Shorts"),
          cat("coats", "Coats & jackets"),
          cat("knitwear", "Knitwear"),
        ],
      },
      {
        title: "Essentials",
        pages: [
          cat("nightwear", "Pyjamas & loungewear"),
          cat("underwear-socks", "Underwear & socks"),
          cat("swimwear", "Swim shorts"),
          cat("footwear", "Shoes, trainers & slippers"),
          cat("accessories", "Hats, gloves & accessories"),
        ],
      },
    ],
    tile: { image: "/images/departments/men.svg", button: "Shop men" },
  },
  {
    slug: "women",
    label: "Women",
    description: "Dresses, knitwear, loungewear, nightwear and occasion outfits for women.",
    filter: { department: "WOMEN" },
    autoCategories: true,
    columns: [
      {
        title: "Clothing",
        pages: [
          cat("dresses", "Dresses"),
          cat("tops", "Tops & blouses"),
          cat("knitwear", "Knitwear & cardigans"),
          cat("hoodies", "Hoodies & sweatshirts"),
          cat("trousers", "Jeans, trousers & leggings"),
          cat("skirts-shorts", "Skirts & shorts"),
          cat("coats", "Coats & jackets"),
        ],
      },
      {
        title: "Occasions & essentials",
        pages: [
          cat("partywear", "Occasionwear"),
          cat("festive-wear", "Festive & traditional wear"),
          cat("sets", "Co-ords & loungewear"),
          cat("nightwear", "Nightwear & pyjamas"),
          cat("swimwear", "Swimwear"),
          cat("footwear", "Shoes & slippers"),
          cat("accessories", "Bags & accessories"),
        ],
      },
    ],
    tile: { image: "/images/departments/women.svg", button: "Shop women" },
  },
  {
    slug: "school-stationery",
    label: "School & Stationery",
    description: "Everything for the school run: uniform, PE kit, school bags, lunch bags and stationery.",
    filter: { categories: ["school-uniform", "stationery"] },
    columns: [
      {
        title: "School uniform",
        pages: [
          { slug: "uniform", label: "All school uniform", filter: { categories: ["school-uniform"] } },
          { slug: "girls-uniform", label: "Girls' uniform", filter: { department: "GIRLS", categories: ["school-uniform"] } },
          { slug: "boys-uniform", label: "Boys' uniform", filter: { department: "BOYS", categories: ["school-uniform"] } },
        ],
      },
      {
        title: "Bags & stationery",
        pages: [{ slug: "bags-stationery", label: "School bags & stationery", filter: { categories: ["stationery"] } }],
        links: [{ label: "School shoes & trainers", href: "/shop/footwear" }],
      },
    ],
    promo: { title: "Ready for the new term", text: "Name-label friendly basics that survive the playground.", href: "/shop/school-stationery/uniform", cta: "Shop uniform" },
    tile: { image: "/images/departments/school.svg", button: "Shop school" },
  },
  {
    slug: "festival-special",
    label: "Festival Special",
    description: "Costumes and outfits for Halloween, Christmas, Eid, Diwali, World Book Day and every celebration.",
    filter: { categories: ["costumes", "festive-wear"], collections: ["Halloween", "Christmas", "Eid", "Diwali", "World Book Day"] },
    columns: [
      {
        title: "Celebrations",
        pages: [
          { slug: "halloween", label: "Halloween", filter: { categories: [], collections: ["Halloween"] } },
          { slug: "christmas", label: "Christmas", filter: { categories: [], collections: ["Christmas"] } },
          { slug: "eid", label: "Eid", filter: { categories: [], collections: ["Eid"] } },
          { slug: "diwali", label: "Diwali", filter: { categories: [], collections: ["Diwali"] } },
          { slug: "world-book-day", label: "World Book Day", filter: { categories: [], collections: ["World Book Day"] } },
        ],
      },
      {
        title: "Shop by type",
        pages: [
          { slug: "costumes", label: "Fancy dress & costumes", filter: { categories: ["costumes"], collections: [] } },
          { slug: "festive-wear", label: "Festive & traditional wear", filter: { categories: ["festive-wear"], collections: [] } },
        ],
      },
    ],
    promo: { title: "Dress-up days sorted", text: "Order by 2pm for next-day UK delivery on in-stock costumes.", href: "/shop/festival-special/costumes", cta: "Shop costumes" },
    tile: { image: "/images/departments/festival.svg", button: "Shop festivals" },
  },
  {
    slug: "footwear",
    label: "Footwear",
    description: "Trainers, school shoes, boots, sandals and slippers for the whole family.",
    filter: { categories: ["footwear"] },
    columns: [
      {
        title: "Shop by department",
        pages: [
          { slug: "girls", label: "Girls' shoes", filter: { department: "GIRLS" } },
          { slug: "boys", label: "Boys' shoes", filter: { department: "BOYS" } },
          { slug: "baby", label: "Baby & toddler shoes", filter: { department: "BABY" } },
          { slug: "women", label: "Women's shoes", filter: { department: "WOMEN" } },
          { slug: "men", label: "Men's shoes", filter: { department: "MEN" } },
        ],
      },
    ],
    promo: { title: "Character slippers", text: "Cosy slippers and light-up trainers kids love.", href: "/shop/footwear", cta: "Shop footwear" },
    tile: { image: "/images/departments/footwear.svg", button: "Shop footwear" },
  },
  {
    slug: "more",
    label: "More",
    description: "Baby & toddler, nightwear for the family, accessories, new arrivals and bestsellers.",
    filter: {},
    columns: [
      {
        title: "Baby & toddler",
        pages: [
          { slug: "baby", label: "All baby & toddler", filter: { department: "BABY" } },
          { slug: "baby-essentials", label: "Bodysuits & sleepsuits", filter: { department: "BABY", categories: ["baby-essentials"] } },
          { slug: "baby-sets", label: "Outfits & sets", filter: { department: "BABY", categories: ["sets"] } },
          { slug: "baby-coats", label: "Snowsuits & coats", filter: { department: "BABY", categories: ["coats"] } },
        ],
      },
      {
        title: "For everyone",
        pages: [
          { slug: "nightwear", label: "Pyjamas & nightwear", filter: { categories: ["nightwear"] } },
          { slug: "accessories", label: "Hats, bags & accessories", filter: { categories: ["accessories"] } },
          { slug: "swimwear", label: "Swimwear", filter: { categories: ["swimwear"] } },
        ],
        links: [
          { label: "New in", href: "/shop/new-arrivals" },
          { label: "Bestsellers", href: "/shop/bestsellers" },
        ],
      },
    ],
    tile: {
      title: "Baby & Toddler",
      text: "Soft bodysuits, sleepsuits and outfits from newborn to 3 years.",
      href: "/shop/more/baby",
      image: "/images/departments/baby.svg",
      button: "Shop baby",
    },
  },
];

/** The last item in the menu, shown in the accent colour. */
export const SALE_LINK: NavLink = { label: "Sale", href: "/shop/sale" };

export function sectionHref(section: Section, page?: NavPage) {
  return `/shop/${section.slug}${page ? `/${page.slug}` : ""}`;
}

export function sectionPages(section: Section) {
  return section.columns.flatMap((c) => c.pages ?? []);
}

/** A page's filter laid over its section's filter. Anything the page sets replaces the section's value. */
export function mergeFilter(base: NavFilter, page?: NavFilter): NavFilter {
  return { ...base, ...page };
}

export type ResolvedSectionPath = { section: Section; page?: NavPage; filter: NavFilter };

/** Matches /shop/<section>[/<page>] against the menu. Returns null when the path isn't in the menu. */
export function resolveSectionPath(slug: string[]): ResolvedSectionPath | null {
  const section = SECTIONS.find((s) => s.slug === slug[0]);
  if (!section || slug.length > 2) return null;
  if (slug.length === 1) return { section, filter: section.filter };
  const page = sectionPages(section).find((p) => p.slug === slug[1]);
  if (!page) return null;
  return { section, page, filter: mergeFilter(section.filter, page.filter) };
}

/** What the header renders for one menu item (built by buildNav in navigation-server.ts). */
export type NavItem = {
  label: string;
  href: string;
  description?: string;
  sale?: boolean;
  columns?: { title: string; links: NavLink[] }[];
  promo?: NavPromo;
};

export type ResolvedTile = { slug: string; title: string; text: string; href: string; image: string; button: string; links: NavLink[] };

/** The homepage "Shop by department" tiles: navigation.ts defaults with any Admin → Site settings overrides applied. */
export function homeTiles(overrides: Record<string, Partial<{ image: string; text: string; button: string }>> = {}): ResolvedTile[] {
  return SECTIONS.filter((s) => s.tile).map((section) => {
    const tile = section.tile!;
    const o = overrides[section.slug] ?? {};
    const href = tile.href ?? sectionHref(section);
    const links = (section.columns[0]?.pages ?? [])
      .map((p) => ({ label: p.label, href: sectionHref(section, p) }))
      .filter((l) => l.href !== href)
      .slice(0, 4);
    return {
      slug: section.slug,
      title: tile.title ?? section.label,
      text: o.text || tile.text || section.description,
      href,
      image: o.image || tile.image,
      button: o.button || tile.button,
      links,
    };
  });
}

// ---------- Placing products in the menu (Admin → Products) ----------

export type Placement = { department?: Department; categorySlug?: string; collection?: string | null };

function filterMatches(f: NavFilter, p: Placement): boolean {
  if (f.department && p.department !== f.department) return false;
  const cats = f.categories ?? [];
  const cols = (f.collections ?? []).map((c) => c.toLowerCase());
  if (!cats.length && !cols.length) return true;
  return (p.categorySlug != null && cats.includes(p.categorySlug)) || (p.collection != null && cols.includes(p.collection.toLowerCase()));
}

/** Every menu section and page a product with this department/category/collection is listed on, e.g. "Girls → Dresses". */
export function menuPlacesFor(p: Placement): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const section of SECTIONS) {
    // Section pages with an empty filter (e.g. "More") list everything, so they don't count as a placement.
    const sectionHasRule = Boolean(section.filter.department || section.filter.categories?.length || section.filter.collections?.length);
    if (sectionHasRule && filterMatches(section.filter, p)) out.push({ label: `${section.label} (all)`, href: sectionHref(section) });
    for (const page of sectionPages(section))
      if (filterMatches(mergeFilter(section.filter, page.filter), p)) out.push({ label: `${section.label} → ${page.label}`, href: sectionHref(section, page) });
  }
  return out;
}

/**
 * What a product needs to appear on a menu page: its department, one category and/or a collection.
 * Used by the "Put it in the menu" picker; only fields the page decides are returned.
 */
export function placementForPage(sectionSlug: string, pageSlug: string): Placement | null {
  const section = SECTIONS.find((s) => s.slug === sectionSlug);
  const page = section && sectionPages(section).find((p) => p.slug === pageSlug);
  if (!section || !page) return null;
  const f = mergeFilter(section.filter, page.filter);
  const out: Placement = {};
  if (f.department) out.department = f.department;
  if (f.categories?.length) out.categorySlug = f.categories[0];
  // A page that lists by collection only (e.g. Festival Special → Halloween) needs the product's collection set.
  if (!f.categories?.length && f.collections?.length) out.collection = f.collections[0];
  return out;
}
