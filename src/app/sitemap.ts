// /sitemap.xml for search engines: static pages, every menu section and page, admin-created categories, products and blog posts.
import type { MetadataRoute } from "next";
import { DEPARTMENTS } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { SECTIONS, sectionHref, sectionPages } from "@/lib/navigation";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, cats, posts] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { department: true, category: { select: { slug: true } } }, distinct: ["department", "categoryId"] }),
    prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPaths = ["", "/shop/new-arrivals", "/shop/bestsellers", "/shop/sale", "/delivery-returns", "/size-guide", "/faq", "/contact", "/about", "/blog", "/privacy", "/terms", "/cookies"];
  const menuPaths = SECTIONS.flatMap((s) => [sectionHref(s), ...sectionPages(s).map((p) => sectionHref(s, p))]);
  const categoryPaths = cats.map((c) => `/shop/${DEPARTMENTS.find((d) => d.value === c.department)!.slug}/${c.category.slug}`);
  return [
    ...[...new Set([...staticPaths, ...menuPaths, ...categoryPaths])].map((p) => ({ url: `${base}${p}` })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
