// Products ⇄ Excel: reading, checking and the export → edit → import round trip.
// The last block saves to the database in DATABASE_URL and is skipped without one.
import ExcelJS from "exceljs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { colourHex } from "@/lib/shopify-import";
import { buildProductWorkbook, cellMoney, parsePhotos, planSheetImport, readProductSheet, type ExportProduct, type Snapshot } from "@/lib/product-sheet";

const snap: Snapshot = {
  categories: [{ id: "c-dress", slug: "dresses", name: "Dresses" }, { id: "c-tops", slug: "tops", name: "Tops & T-shirts" }],
  products: [
    {
      id: "p1", slug: "red-party-dress", name: "Red Party Dress", priceGBP: 2499, salePriceGBP: null, priceUSD: 3299, salePriceUSD: null,
      variants: [{ id: "v1", sku: "RPD-34", size: "3-4 Y", colour: "Red" }, { id: "v2", sku: "RPD-56", size: "5-6 Y", colour: "Red" }],
    },
  ],
  skus: [{ sku: "RPD-34", productId: "p1" }, { sku: "RPD-56", productId: "p1" }, { sku: "OTHER-1", productId: "p9" }],
};

/** A workbook typed the way a person would, as a Buffer. */
async function sheet(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const exported: ExportProduct = {
  slug: "red-party-dress", name: "Red Party Dress", description: "A twirly party dress.", department: "GIRLS", status: "PUBLISHED",
  category: { name: "Dresses" }, collection: "Christmas Edit", ageRange: "3–8 years", composition: null, care: null, origin: null,
  priceGBP: 2499, salePriceGBP: null, priceUSD: 3299, salePriceUSD: null, featured: true, bestseller: false,
  images: [{ url: "/uploads/a.jpg#fp=40,30,1.2", colour: null }, { url: "/uploads/b.jpg", colour: "Red" }],
  variants: [
    { sku: "RPD-34", size: "3-4 Y", colour: "Red", colourHex: "#cc0000", stock: 4 },
    { sku: "RPD-56", size: "5-6 Y", colour: "Red", colourHex: "#cc0000", stock: 0 },
  ],
};

describe("cells", () => {
  it("reads prices typed as numbers or text", () => {
    expect(cellMoney(24.99)).toBe(2499);
    expect(cellMoney(24.990000000001)).toBe(2499);
    expect(cellMoney("£1,024.50")).toBe(102450);
    expect(cellMoney("")).toBeNull();
    expect(cellMoney("cheap")).toBeUndefined();
  });

  it("reads photo lists with colours and refuses odd addresses", () => {
    expect(parsePhotos("/uploads/a.jpg#fp=40,30,1.2 | https://cdn.example.com/r.jpg (Red)")).toEqual({
      photos: [{ url: "/uploads/a.jpg#fp=40,30,1.2", colour: null }, { url: "https://cdn.example.com/r.jpg", colour: "Red" }],
    });
    for (const bad of ["http://cdn.example.com/a.jpg", "//evil.example/a.jpg", "javascript:alert(1)", "photo.jpg"]) expect(parsePhotos(bad)).toHaveProperty("error");
  });
});

describe("export → import", () => {
  it("an untouched export imports as updates of the same products and sizes", async () => {
    const buf = await buildProductWorkbook([exported], snap.categories);
    const read = await readProductSheet(buf, "products.xlsx");
    expect(read.rows).toHaveLength(2);
    expect(read.ignored).toEqual([]);
    const plan = planSheetImport(read, snap, { defaultStatus: "DRAFT" });
    expect(plan.errors).toEqual([]);
    expect(plan.items).toHaveLength(1);
    const [p] = plan.items;
    expect(p).toMatchObject({ action: "update", productId: "p1", data: { name: "Red Party Dress", categoryId: "c-dress", department: "GIRLS", status: "PUBLISHED", priceGBP: 2499, priceUSD: 3299, salePriceGBP: null, featured: true, collection: "Christmas Edit" } });
    expect(p.variants).toEqual([
      { id: "v1", sku: "RPD-34", size: "3-4 Y", colour: "Red", colourHex: "#cc0000", stock: 4 },
      { id: "v2", sku: "RPD-56", size: "5-6 Y", colour: "Red", colourHex: "#cc0000", stock: 0 },
    ]);
    expect(p.photos).toEqual(exported.images);
  });

  it("the export has a Help sheet and drop-downs, and the blank template has headers only", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildProductWorkbook([], snap.categories)) as unknown as ArrayBuffer);
    expect(wb.getWorksheet("Products")!.rowCount).toBe(1);
    const help = wb.getWorksheet("Help")!;
    const text = help.getSheetValues().flat().join(" ");
    expect(text).toContain("Tops & T-shirts");
    expect(text).toContain("Web address");
  });
});

describe("checking a sheet", () => {
  it("adds a new product from a hand-made sheet with only some columns", async () => {
    const buf = await sheet([
      ["Product name", "Description", "Department", "Category", "UK price", "Size", "Colour", "Stock", "Notes"],
      ["Star Tee", "Soft cotton tee with a star.", "girls", "tops", 9.5, "3-4 Y", "White", 5, "ignore me"],
      ["Star Tee", "", "", "", "", "5-6 Y", "White", "", ""],
      ["Star Tee", "", "", "", "", "5-6 Y", "Navy", 2, ""],
    ]);
    const read = await readProductSheet(buf);
    expect(read.ignored).toEqual(["Notes"]);
    const plan = planSheetImport(read, snap, { defaultStatus: "PUBLISHED" });
    expect(plan.errors).toEqual([]);
    const [p] = plan.items;
    expect(p).toMatchObject({ action: "create", slug: "star-tee", data: { name: "Star Tee", department: "GIRLS", categoryId: "c-tops", priceGBP: 950, status: "PUBLISHED" }, photos: [] });
    expect(p.variants.map((v) => [v.sku, v.size, v.colour, v.stock, v.colourHex])).toEqual([
      ["FR-STARTEE-1", "3-4 Y", "White", 5, colourHex("White")],
      ["FR-STARTEE-2", "5-6 Y", "White", 0, colourHex("White")],
      ["FR-STARTEE-3", "5-6 Y", "Navy", 2, colourHex("Navy")],
    ]);
  });

  it("updates only the columns in the sheet (a stock and price sheet)", () => {
    const plan = planSheetImport(
      { present: new Set(["slug", "sku", "stock", "salePriceGBP"]), rows: [{ row: 2, values: { slug: "red-party-dress", sku: "rpd-56", stock: 7, salePriceGBP: 19.99 } }] },
      snap,
      { defaultStatus: "DRAFT" },
    );
    expect(plan.errors).toEqual([]);
    expect(plan.items[0].data).toEqual({ salePriceGBP: 1999 });
    expect(plan.items[0].variants).toEqual([{ id: "v2", sku: "RPD-56", size: "5-6 Y", colour: "Red", stock: 7 }]);
  });

  it("lists every problem with its row and leaves only those products out", () => {
    const rows = (values: Record<string, unknown>[]) => values.map((v, i) => ({ row: i + 2, values: v }));
    const present = new Set(["name", "description", "department", "category", "priceGBP", "salePriceGBP", "size", "sku", "stock", "photos", "featured"] as const);
    const plan = planSheetImport(
      {
        present: new Set(present),
        rows: rows([
          { name: "Good Hat", description: "A warm hat.", department: "Girls", category: "Tops & T-shirts", priceGBP: 5, size: "One size" },
          { name: "No Category", description: "x", department: "Girls", category: "Hats", priceGBP: 5, size: "S" },
          { name: "Bad Price", description: "x", department: "Girls", category: "tops", priceGBP: "five", size: "S" },
          { name: "Sale Too High", description: "x", department: "Girls", category: "tops", priceGBP: 5, salePriceGBP: 6, size: "S" },
          { name: "Taken Sku", description: "x", department: "Girls", category: "tops", priceGBP: 5, size: "S", sku: "other-1" },
          { name: "No Size", description: "x", department: "Elves", category: "tops", priceGBP: 5, stock: 3 },
          { name: "Twice", description: "x", department: "Boys", category: "tops", priceGBP: 5, size: "S", stock: "2.5", featured: "maybe", photos: "file.jpg" },
          { name: "Twice", size: "s" },
        ]),
      },
      snap,
      { defaultStatus: "DRAFT" },
    );
    expect(plan.items.map((p) => p.name)).toEqual(["Good Hat"]);
    const msg = (row: number) => plan.errors.filter((e) => e.row === row).map((e) => e.message).join(" / ");
    expect(msg(3)).toMatch(/Category "Hats" doesn't exist/);
    expect(msg(4)).toMatch(/UK price "five" isn't a price/);
    expect(msg(5)).toMatch(/sale price must be lower/);
    expect(msg(6)).toMatch(/already used by "another product"/);
    expect(msg(7)).toMatch(/Department "Elves".*Size is missing/);
    for (const m of [/Featured should be Yes or No/, /Photo "file.jpg"/, /Stock "2.5"/]) expect(msg(8)).toMatch(m);
    expect(msg(9)).toMatch(/Size s in One colour is listed twice/);
  });

  it("refuses files that aren't product sheets", async () => {
    await expect(readProductSheet(Buffer.from("not a spreadsheet"))).rejects.toThrow(/Couldn't open this file/);
    await expect(readProductSheet(await sheet([["Order", "Customer"], [1, "Ann"]]))).rejects.toThrow(/doesn't look like a product sheet/);
  });

  it("reads CSV files and keeps sizes as typed", async () => {
    const csv = Buffer.from('Product name,Description,Department,Category,UK price £ *,Size,SKU\n"Comma, Dress",Lovely,Girls,Dresses,12.00,3-4,00123\n');
    const read = await readProductSheet(csv, "list.csv");
    const plan = planSheetImport(read, snap, { defaultStatus: "DRAFT" });
    expect(plan.errors).toEqual([]);
    expect(plan.items[0]).toMatchObject({ name: "Comma, Dress", data: { priceGBP: 1200 }, variants: [{ size: "3-4", sku: "00123" }] });
  });
});

const enabled = Boolean(process.env.DATABASE_URL);
const tag = `xls${Date.now()}`;

describe.skipIf(!enabled)("Excel import (database)", () => {
  let dir: string;
  let prisma: typeof import("@/lib/db").prisma;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fr-xls-"));
    process.env.UPLOAD_DIR = dir;
    prisma = (await import("@/lib/db")).prisma;
  });
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
    await rm(dir, { recursive: true, force: true });
  });

  async function runImport(buf: Buffer) {
    const { loadSnapshot, startSheetImport, currentSheetImport } = await import("@/lib/sheet-import-job");
    const plan = planSheetImport(await readProductSheet(buf), await loadSnapshot(), { defaultStatus: "DRAFT" });
    expect(plan.errors).toEqual([]);
    expect(startSheetImport(plan, "test.xlsx", "x")).toBeNull();
    for (let i = 0; i < 200 && currentSheetImport()?.status === "running"; i++) await new Promise((r) => setTimeout(r, 25));
    return { plan, job: currentSheetImport()! };
  }

  it("adds products, then updates them from an edited export", async () => {
    const cat = await prisma.category.findFirstOrThrow();
    const { job } = await runImport(await sheet([
      ["Web address", "Product name *", "Description *", "Department *", "Category *", "UK price £ *", "Photos", "SKU", "Size *", "Colour", "Stock"],
      [`${tag}-kids-tee`, "Kids Tee", "Soft cotton tee.", "Boys", cat.name, 8, "/uploads/x.jpg | /uploads/blue.jpg (blue)", `${tag}-1`, "3-4 Y", "Blue", 3],
      [`${tag}-kids-tee`, "", "", "", "", "", "", `${tag}-2`, "5-6 Y", "Blue", 1],
    ]));
    expect(job).toMatchObject({ status: "done", created: 1, updated: 0, failed: 0 });
    const made = await prisma.product.findUniqueOrThrow({ where: { slug: `${tag}-kids-tee` }, include: { variants: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { position: "asc" } }, category: true } });
    expect(made).toMatchObject({ name: "Kids Tee", status: "DRAFT", department: "BOYS", priceGBP: 800 });
    expect(made.variants.map((v) => [v.sku, v.size, v.stock])).toEqual([[`${tag}-1`, "3-4 Y", 3], [`${tag}-2`, "5-6 Y", 1]]);
    expect(made.images.map((i) => [i.url, i.colour])).toEqual([["/uploads/x.jpg", null], ["/uploads/blue.jpg", "Blue"]]);

    // Export it, change the price, a stock level and the status, add a size, and import the file again.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildProductWorkbook([made], [cat])) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Products")!;
    const col = (h: string) => (ws.getRow(1).values as string[]).indexOf(h);
    ws.getRow(2).getCell(col("UK price £ *")).value = 9.5;
    ws.getRow(2).getCell(col("Status")).value = "Published";
    ws.getRow(3).getCell(col("Stock")).value = 10;
    ws.addRow([]).getCell(col("Web address")).value = `${tag}-kids-tee`;
    ws.getRow(4).getCell(col("Size *")).value = "7-8 Y";
    ws.getRow(4).getCell(col("Colour")).value = "Blue";
    const { job: again } = await runImport(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(again).toMatchObject({ status: "done", created: 0, updated: 1, failed: 0 });
    const after = await prisma.product.findUniqueOrThrow({ where: { slug: `${tag}-kids-tee` }, include: { variants: { orderBy: { sortOrder: "asc" } }, images: true } });
    expect(after).toMatchObject({ priceGBP: 950, status: "PUBLISHED", name: "Kids Tee" });
    expect(after.variants.map((v) => [v.sku, v.size, v.stock])).toEqual([[`${tag}-1`, "3-4 Y", 3], [`${tag}-2`, "5-6 Y", 10], [expect.stringMatching(/^FR-/), "7-8 Y", 0]]);
    expect(after.variants.map((v) => v.id).slice(0, 2)).toEqual(made.variants.map((v) => v.id));
    expect(after.images).toHaveLength(2);
  });
});
