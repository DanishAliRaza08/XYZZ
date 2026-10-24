// Admin → Products → Excel: saves the products checked by planSheetImport (src/lib/product-sheet.ts).
// Runs in the background like the Shopify import (src/lib/import-job.ts), because photo links in the sheet are
// downloaded into the shop and a big sheet takes a while. One Excel import at a time.
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalidateStoreCache } from "./cache";
import { prisma } from "./db";
import type { ImportPlan, PlannedProduct, ProductFields, Snapshot } from "./product-sheet";
import { downloadImage } from "./shopify-import";
import { uploadDir } from "./uploads";

export type SheetJob = {
  fileName: string;
  status: "running" | "done" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  photos: number; // photos downloaded from links
  message: string;
  log: string[];
};

const globalJob = globalThis as unknown as { __frSheetJob?: SheetJob };

export function currentSheetImport(): SheetJob | null {
  return globalJob.__frSheetJob ?? null;
}

/** What's in the shop now, for checking a sheet against it. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [categories, products, skus] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      select: { id: true, slug: true, name: true, priceGBP: true, salePriceGBP: true, priceUSD: true, salePriceUSD: true, variants: { select: { id: true, sku: true, size: true, colour: true } } },
    }),
    prisma.variant.findMany({ select: { sku: true, productId: true } }),
  ]);
  return { categories, products, skus };
}

/** Starts saving the plan unless an Excel import is already running. Returns an error message, or null when started. */
export function startSheetImport(plan: ImportPlan, fileName: string, adminId: string): string | null {
  if (globalJob.__frSheetJob?.status === "running") return "An Excel import is already running. Wait for it to finish.";
  const job: SheetJob = {
    fileName, status: "running", startedAt: new Date(), total: plan.items.length, processed: 0, created: 0, updated: 0, failed: 0, photos: 0,
    message: `Saving ${plan.items.length} products…`, log: [],
  };
  globalJob.__frSheetJob = job;
  void run(job, plan.items, adminId);
  return null;
}

function note(job: SheetJob, line: string) {
  job.log.push(line);
  if (job.log.length > 60) job.log.splice(0, job.log.length - 60);
}

async function run(job: SheetJob, items: PlannedProduct[], adminId: string) {
  const downloaded = new Map<string, string>(); // link → /uploads/… (a picture used twice is downloaded once)
  try {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    for (const item of items) {
      job.processed++;
      try {
        const photos = item.photos && (await localPhotos(job, item, dir, downloaded));
        await save(item, photos);
        if (item.action === "create") job.created++;
        else job.updated++;
        if (item.action === "create") note(job, `Added "${item.name}"`);
      } catch (e) {
        job.failed++;
        note(job, `Not saved: "${item.name}" (row ${item.rows[0]}): ${e instanceof Error ? e.message.split("\n").filter(Boolean).pop() : "could not be saved"}`);
      }
      if (job.processed % 25 === 0) invalidateStoreCache();
    }
    job.status = "done";
    job.message = `Finished: ${job.created} added, ${job.updated} updated${job.failed ? `, ${job.failed} not saved (see below)` : ""}.`;
  } catch (e) {
    job.status = "failed";
    job.message = e instanceof Error ? e.message : "The import stopped unexpectedly.";
    note(job, `Stopped: ${job.message}`);
  } finally {
    job.finishedAt = new Date();
    invalidateStoreCache();
    await prisma.auditLog
      .create({ data: { adminId, action: "import-excel", entity: "Product", details: `${job.fileName}: ${job.message}`.slice(0, 1000) } })
      .catch(() => undefined);
  }
}

/** Photo links (https://…) are downloaded into the shop; addresses already in the shop are kept. Keeps the framing (#fp=…). */
async function localPhotos(job: SheetJob, item: PlannedProduct, dir: string, downloaded: Map<string, string>) {
  const out: { url: string; colour: string | null }[] = [];
  for (const p of item.photos ?? []) {
    if (p.url.startsWith("/")) {
      out.push(p);
      continue;
    }
    const [src, frag] = p.url.split("#", 2);
    let local = downloaded.get(src);
    if (!local) {
      try {
        const { buf, ext } = await downloadImage(src, 0);
        const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
        await writeFile(path.join(dir, name), buf);
        local = `/uploads/${name}`;
        downloaded.set(src, local);
        job.photos++;
      } catch (e) {
        note(job, `Photo skipped for "${item.name}": ${src.slice(0, 120)} (${e instanceof Error ? e.message : "couldn't download"})`);
        continue;
      }
    }
    out.push({ url: frag ? `${local}#${frag}` : local, colour: p.colour });
  }
  return out;
}

async function save(item: PlannedProduct, photos: { url: string; colour: string | null }[] | undefined) {
  await prisma.$transaction(async (tx) => {
    let productId = item.productId;
    if (item.action === "create") {
      const created = await tx.product.create({ data: { slug: item.slug, ...(item.data as ProductFields) } });
      productId = created.id;
    } else if (Object.keys(item.data).length) {
      await tx.product.update({ where: { id: productId }, data: item.data });
    }
    const id = productId!;
    // Sizes in the sheet are added or updated; sizes not in the sheet are left as they are.
    let sortOrder = await tx.variant.count({ where: { productId: id } });
    for (const v of item.variants) {
      const data = { sku: v.sku, size: v.size, colour: v.colour, ...(v.colourHex ? { colourHex: v.colourHex } : {}), ...(v.stock != null ? { stock: v.stock } : {}) };
      if (v.id) await tx.variant.update({ where: { id: v.id }, data });
      else await tx.variant.create({ data: { ...data, productId: id, sortOrder: sortOrder++ } });
    }
    if (photos) {
      // Photo colours are spelt as on the product's sizes, so the product page matches them exactly.
      const colours = new Map((await tx.variant.findMany({ where: { productId: id }, select: { colour: true } })).map((v) => [v.colour.toLowerCase(), v.colour]));
      const name = item.data.name ?? item.name;
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (photos.length)
        await tx.productImage.createMany({
          data: photos.map((p, i) => ({
            productId: id,
            url: p.url,
            alt: name.slice(0, 200),
            // A colour that isn't one of the product's colours falls back to "all colours" (like the product form).
            colour: (p.colour && colours.get(p.colour.toLowerCase())) || null,
            position: i,
          })),
        });
    }
  }, { timeout: 30_000 });
}

