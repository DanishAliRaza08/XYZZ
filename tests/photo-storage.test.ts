// Admin → Photo storage: is the upload folder safe from redeploys, and which pictures are missing.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uploadNamesIn, uploadsInsideApp } from "@/lib/uploads";

const a = "a".repeat(32);
const b = "b".repeat(32);

describe("upload folder", () => {
  it("is at risk inside the app folder and safe outside it", () => {
    expect(uploadsInsideApp("/home/u1/domains/shop/nodejs/storage/uploads", "/home/u1/domains/shop/nodejs")).toBe(true);
    expect(uploadsInsideApp("/home/u1/domains/shop/nodejs", "/home/u1/domains/shop/nodejs")).toBe(true);
    expect(uploadsInsideApp("/home/u1/uploads", "/home/u1/domains/shop/nodejs")).toBe(false);
    expect(uploadsInsideApp("/home/u1/domains/shop/nodejs-uploads", "/home/u1/domains/shop/nodejs")).toBe(false);
  });

  it("finds uploaded pictures in addresses and text", () => {
    expect(uploadNamesIn(`/uploads/${a}.jpg#fp=10,20,1.5 and ![x](/uploads/${b}.webp) and /images/x.jpg`)).toEqual([`${a}.jpg`, `${b}.webp`]);
  });
});

const enabled = Boolean(process.env.DATABASE_URL);
const tag = `photo${Date.now()}`;

describe.skipIf(!enabled)("missing pictures (database)", () => {
  let dir: string;
  let prisma: typeof import("@/lib/db").prisma;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fr-photos-"));
    process.env.UPLOAD_DIR = dir;
    prisma = (await import("@/lib/db")).prisma;
  });
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await rm(dir, { recursive: true, force: true });
  });

  it("lists products whose uploaded photos aren't in the folder", async () => {
    await writeFile(path.join(dir, `${a}.jpg`), "x");
    const cat = await prisma.category.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        slug: `${tag}-p`, name: "Photo Check Dress", description: "x", department: "GIRLS", categoryId: cat.id, priceGBP: 1000,
        images: { create: [{ url: `/uploads/${a}.jpg#fp=40,40,1`, alt: "here", position: 0 }, { url: `/uploads/${b}.png`, alt: "gone", position: 1 }, { url: "/images/x.jpg", alt: "public", position: 2 }] },
      },
    });
    const { checkPhotos } = await import("@/lib/photo-check");
    const check = await checkPhotos();
    expect(check.dir).toBe(dir);
    expect(check.products.find((p) => p.id === product.id)).toEqual({ id: product.id, name: "Photo Check Dress", missing: 1, total: 2 });
  });
});
