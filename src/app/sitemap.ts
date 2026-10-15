import type { MetadataRoute } from "next";
import { DEPARTMENTS } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, cats] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { department: true, category: { select: { slug: true } } }, distinct: ["department", "categoryId"] }),
  ]);
  const staticPaths = ["", "/shop/new-arrivals", "/shop/bestsellers", "/shop/sale", "/delivery-returns", "/size-guide", "/faq", "/contact", "/about", "/privacy", "/terms", "/cookies"];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}` })),
    ...DEPARTMENTS.map((d) => ({ url: `${base}/shop/${d.slug}` })),
    ...cats.map((c) => ({ url: `${base}/shop/${DEPARTMENTS.find((d) => d.value === c.department)!.slug}/${c.category.slug}` })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
