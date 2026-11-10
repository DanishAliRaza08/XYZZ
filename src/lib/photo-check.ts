// Admin → Photo storage: which uploaded pictures used in the shop are missing from the upload folder
// (e.g. deleted by a redeploy when UPLOAD_DIR was inside the app folder).
import { readdir } from "node:fs/promises";
import { prisma } from "./db";
import { uploadDir, uploadNamesIn } from "./uploads";

export type PhotoCheck = {
  dir: string;
  stored: number; // files in the upload folder
  used: number; // uploaded pictures the shop uses
  missing: number;
  products: { id: string; name: string; missing: number; total: number }[];
  otherPlaces: { label: string; href: string; missing: number }[];
};

export async function checkPhotos(): Promise<PhotoCheck> {
  const dir = uploadDir();
  const onDisk = new Set(await readdir(dir).catch(() => [] as string[]));
  const [images, posts, settings, events] = await Promise.all([
    prisma.productImage.findMany({ where: { url: { startsWith: "/uploads/" } }, select: { url: true, product: { select: { id: true, name: true } } } }),
    prisma.blogPost.findMany({ select: { coverImage: true, content: true } }),
    prisma.setting.findMany({ select: { value: true } }),
    prisma.seasonalEvent.findMany(),
  ]);
  const used = new Set<string>();
  const gone = (names: string[]) => names.filter((n) => (used.add(n), !onDisk.has(n))).length;

  const byProduct = new Map<string, { id: string; name: string; missing: number; total: number }>();
  for (const img of images) {
    const p = byProduct.get(img.product.id) ?? { id: img.product.id, name: img.product.name, missing: 0, total: 0 };
    p.total++;
    p.missing += gone(uploadNamesIn(img.url));
    byProduct.set(p.id, p);
  }
  const otherPlaces = [
    { label: "Blog posts", href: "/admin/blog", missing: gone(posts.flatMap((p) => uploadNamesIn(`${p.coverImage ?? ""} ${p.content}`))) },
    { label: "Site settings (homepage banner and tiles)", href: "/admin/settings", missing: gone(settings.flatMap((s) => uploadNamesIn(s.value))) },
    { label: "Seasonal events", href: "/admin/events", missing: gone(events.flatMap((e) => uploadNamesIn(JSON.stringify(e)))) },
  ].filter((p) => p.missing > 0);
  const products = [...byProduct.values()].filter((p) => p.missing > 0).sort((a, b) => b.missing - a.missing);
  return {
    dir,
    stored: onDisk.size,
    used: used.size,
    missing: products.reduce((n, p) => n + p.missing, 0) + otherPlaces.reduce((n, p) => n + p.missing, 0),
    products,
    otherPlaces,
  };
}
