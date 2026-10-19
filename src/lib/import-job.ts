// Admin → Import products: copies a Shopify store's catalogue straight into the shop's database.
// The import runs in the background on the server (big stores take several minutes) and the admin page
// shows its progress. One import at a time. Photos are saved like admin uploads (UPLOAD_DIR, served at /uploads/…).
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductStatus } from "@prisma/client";
import { invalidateStoreCache } from "./cache";
import { CATEGORY_NAMES } from "./categories";
import { prisma } from "./db";
import { downloadImage, fetchShopifyProducts, mapShopifyProduct, slugify } from "./shopify-import";
import { uploadDir } from "./uploads";

export type ImportOptions = { source: string; status: ProductStatus; maxImages: number; defaultStock: number; limit: number };

export type ImportJob = {
  source: string;
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  total: number; // products in the store's feed
  processed: number;
  created: number;
  existing: number; // already in the shop (same product address)
  skipped: number; // no sizes or no price
  photos: number;
  message: string;
  log: string[]; // latest lines, newest last
};

const globalJob = globalThis as unknown as { __frImportJob?: ImportJob };

export function currentImport(): ImportJob | null {
  return globalJob.__frImportJob ?? null;
}

/** Starts an import unless one is already running. Returns an error message, or null when started. */
export function startImport(opts: ImportOptions, adminId: string): string | null {
  if (globalJob.__frImportJob?.status === "running") return "An import is already running. Wait for it to finish.";
  const job: ImportJob = {
    source: opts.source, status: "running", startedAt: new Date(), total: 0, processed: 0, created: 0, existing: 0, skipped: 0, photos: 0,
    message: "Reading the store's product list…", log: [],
  };
  globalJob.__frImportJob = job;
  void run(job, opts, adminId);
  return null;
}

function note(job: ImportJob, line: string) {
  job.log.push(line);
  if (job.log.length > 40) job.log.splice(0, job.log.length - 40);
}

async function run(job: ImportJob, opts: ImportOptions, adminId: string) {
  try {
    const items = await fetchShopifyProducts(opts.source, opts.limit, (page, count) => note(job, `Read page ${page}: ${count} products`));
    job.total = items.length;
    job.message = `Importing ${items.length} products…`;

    const [products, variants, categories] = await Promise.all([
      prisma.product.findMany({ select: { slug: true } }),
      prisma.variant.findMany({ select: { sku: true } }),
      prisma.category.findMany({ select: { id: true, slug: true } }),
    ]);
    const inShop = new Set(products.map((p) => p.slug));
    const categoryIds = new Map(categories.map((c) => [c.slug, c.id]));
    const usedSlugs = new Set<string>(inShop);
    const usedSkus = new Set<string>(variants.map((v) => v.sku.toLowerCase())); // lower-case: MySQL compares SKUs ignoring case
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });

    for (const p of items) {
      job.processed++;
      // Imported before (same product address): leave it, including any edits made in the admin.
      if (inShop.has(slugify(p.handle || p.title))) {
        job.existing++;
        continue;
      }
      const mapped = mapShopifyProduct(p, { source: opts.source, defaultStock: opts.defaultStock, usdRate: 1.3 }, usedSlugs, usedSkus);
      if (!mapped) {
        job.skipped++;
        note(job, `Skipped "${p.title}": no sizes or no price`);
        continue;
      }
      const { product, photos } = mapped;

      const images: { url: string; alt: string }[] = [];
      for (const img of photos.slice(0, opts.maxImages)) {
        try {
          const { buf, ext } = await downloadImage(img.src);
          const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
          await writeFile(path.join(dir, name), buf);
          images.push({ url: `/uploads/${name}`, alt: img.alt.slice(0, 200) });
        } catch {
          // A missing photo shouldn't stop the product.
        }
      }

      let categoryId = categoryIds.get(product.category);
      if (!categoryId) {
        const cat = await prisma.category.upsert({
          where: { slug: product.category },
          create: { slug: product.category, name: CATEGORY_NAMES[product.category] ?? product.category, sortOrder: categoryIds.size },
          update: {},
        });
        categoryIds.set(cat.slug, (categoryId = cat.id));
      }

      // One product the database refuses (e.g. a clash) is noted and skipped; it doesn't stop the whole import.
      const saved = await prisma.product.create({
        data: {
          slug: product.slug,
          name: product.name,
          description: product.description,
          department: product.department,
          categoryId,
          status: opts.status,
          priceGBP: product.priceGBP,
          salePriceGBP: product.salePriceGBP,
          priceUSD: product.priceUSD,
          salePriceUSD: product.salePriceUSD,
          ageRange: product.ageRange,
          collection: product.collection,
          variants: { create: product.variants.map((v, i) => ({ ...v, sortOrder: i })) },
          images: { create: images.map((img, i) => ({ url: img.url, alt: img.alt, position: i })) },
        },
      }).catch((e: unknown) => {
        job.skipped++;
        note(job, `Skipped "${product.name}": ${e instanceof Error ? e.message.split("\n").filter(Boolean).pop() : "could not be saved"}`);
        return null;
      });
      if (!saved) continue;
      job.created++;
      job.photos += images.length;
      note(job, `Added "${product.name}" (${images.length} photo${images.length === 1 ? "" : "s"})`);
      if (job.created % 20 === 0) invalidateStoreCache(); // let new products appear while a big import is still running
    }

    job.status = "done";
    job.message = `Finished: ${job.created} new products added, ${job.existing} already in the shop, ${job.skipped} skipped.`;
  } catch (e) {
    job.status = "failed";
    job.message = e instanceof Error ? e.message : "The import stopped unexpectedly.";
    note(job, `Stopped: ${job.message}`);
  } finally {
    job.finishedAt = new Date();
    invalidateStoreCache();
    await prisma.auditLog
      .create({ data: { adminId, action: "import", entity: "Product", details: `${job.source}: ${job.message}`.slice(0, 1000) } })
      .catch(() => undefined);
  }
}
