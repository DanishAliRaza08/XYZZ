// Every product listing under /shop:
//   /shop/new-arrivals | bestsellers | sale | all     → collections (src/lib/catalog.ts → COLLECTIONS)
//   /shop/<section>  and  /shop/<section>/<page>       → menu sections and their dropdown pages (src/lib/navigation.ts)
//   /shop/<department>/<category>                      → any category created in Admin → Categories, inside a department
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasFilters, Listing, type SearchParams } from "@/components/Listing";
import { COLLECTIONS, DEPARTMENTS } from "@/lib/catalog";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";
import { resolveSectionPath, sectionHref, sectionPages, type NavFilter } from "@/lib/navigation";

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<SearchParams> };

type Resolved = {
  title: string;
  blurb?: string;
  crumbs: { label: string; href?: string }[];
  collection?: keyof typeof COLLECTIONS;
  filter?: NavFilter;
  subLinks?: { label: string; href: string; active?: boolean }[];
};

async function resolve(slug: string[]): Promise<Resolved | null> {
  if (slug.length === 1 && slug[0] in COLLECTIONS) {
    const key = slug[0] as keyof typeof COLLECTIONS;
    return { title: COLLECTIONS[key].label, blurb: COLLECTIONS[key].blurb, crumbs: [{ label: COLLECTIONS[key].label }], collection: key };
  }

  const menu = resolveSectionPath(slug);
  if (menu) {
    const { section, page } = menu;
    const subLinks = [
      { label: `All ${section.label}`, href: sectionHref(section), active: !page },
      ...sectionPages(section).map((p) => ({ label: p.label, href: sectionHref(section, p), active: p.slug === page?.slug })),
    ];
    return {
      title: page ? (section.filter.department ? `${section.label} · ${page.label}` : page.label) : section.label,
      blurb: page?.description ?? section.description,
      crumbs: page ? [{ label: section.label, href: sectionHref(section) }, { label: page.label }] : [{ label: section.label }],
      filter: menu.filter,
      subLinks,
    };
  }

  // Departments (e.g. /shop/baby) and admin-created categories not listed in the menu (e.g. /shop/boys/onesies).
  const dept = DEPARTMENTS.find((d) => d.slug === slug[0]);
  if (!dept || slug.length > 2) return null;
  if (slug.length === 1)
    return { title: `${dept.label}'s clothing`.replace("Baby & Toddler's", "Baby & Toddler"), blurb: dept.blurb, crumbs: [{ label: dept.label }], filter: { department: dept.value } };
  const category = await prisma.category.findUnique({ where: { slug: slug[1] } });
  if (!category) return null;
  return {
    title: `${dept.label} · ${category.name}`,
    blurb: category.description ?? undefined,
    crumbs: [{ label: dept.label, href: `/shop/${dept.slug}` }, { label: category.name }],
    filter: { department: dept.value, categories: [category.slug] },
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return {};
  return {
    title: r.title,
    description: r.blurb,
    alternates: { canonical: `/shop/${slug.join("/")}` },
    robots: hasFilters(await searchParams) ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const [sp, currency] = await Promise.all([searchParams, getCurrency()]);
  return (
    <Listing
      title={r.title}
      blurb={r.blurb}
      crumbs={r.crumbs}
      basePath={`/shop/${slug.join("/")}`}
      searchParams={sp}
      currency={currency}
      collection={r.collection}
      filter={r.filter}
      subLinks={r.subLinks}
    />
  );
}
