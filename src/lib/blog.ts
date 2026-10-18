import type { BlogPost } from "@prisma/client";
import { cached } from "./cache";
import { prisma } from "./db";

/** Published posts, newest first (cached like the catalogue; admin saves clear it). */
export function getPublishedPosts(): Promise<BlogPost[]> {
  return cached("blog", () => prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] }));
}

export async function getPublishedPost(slug: string) {
  return (await getPublishedPosts()).find((p) => p.slug === slug) ?? null;
}

export function formatPostDate(d: Date | null) {
  return (d ?? new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
