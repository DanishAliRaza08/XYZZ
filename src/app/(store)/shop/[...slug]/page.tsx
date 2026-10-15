import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasFilters, Listing, type SearchParams } from "@/components/Listing";
import { COLLECTIONS, DEPARTMENTS } from "@/lib/catalog";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<SearchParams> };

async function resolve(slug: string[]) {
  if (slug.length === 1 && slug[0] in COLLECTIONS) {
    const key = slug[0] as keyof typeof COLLECTIONS;
    return { kind: "collection" as const, key, title: COLLECTIONS[key].label, blurb: COLLECTIONS[key].blurb };
  }
  const dept = DEPARTMENTS.find((d) => d.slug === slug[0]);
  if (!dept || slug.length > 2) return null;
  if (slug.length === 1) return { kind: "department" as const, dept, title: `${dept.label}'s clothing`.replace("Baby & Toddler's", "Baby & Toddler"), blurb: dept.blurb };
  const category = await prisma.category.findUnique({ where: { slug: slug[1] } });
  if (!category) return null;
  return { kind: "category" as const, dept, category, title: `${dept.label} · ${category.name}`, blurb: category.description ?? undefined };
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
  const basePath = `/shop/${slug.join("/")}`;

  if (r.kind === "collection")
    return <Listing title={r.title} blurb={r.blurb} crumbs={[{ label: r.title }]} basePath={basePath} searchParams={sp} currency={currency} collection={r.key} />;
  if (r.kind === "department")
    return <Listing title={r.title} blurb={r.blurb} crumbs={[{ label: r.dept.label }]} basePath={basePath} searchParams={sp} currency={currency} department={r.dept.value} />;
  return (
    <Listing
      title={r.title}
      blurb={r.blurb}
      crumbs={[{ label: r.dept.label, href: `/shop/${r.dept.slug}` }, { label: r.category.name }]}
      basePath={basePath}
      searchParams={sp}
      currency={currency}
      department={r.dept.value}
      categorySlug={r.category.slug}
    />
  );
}
