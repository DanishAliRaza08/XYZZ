// Products ⇄ Excel (Admin → Products → Excel). One row per size/colour (SKU); the product's details are repeated on
// each of its rows (when importing, only one row of a product needs them). Products are matched by their web address.
// This file only builds, reads and checks spreadsheets; src/lib/sheet-import-job.ts saves the checked products.
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import type { Department, ProductStatus } from "@prisma/client";
import { parseMoney } from "./money";
import { colourHex, slugify } from "./shopify-import";

export const COLUMNS = [
  { key: "slug", header: "Web address", width: 30, help: "The product's address in the shop (fashionrockstar.co.uk/product/<web address>). Matches rows to products already in the shop — keep it as exported to update a product. Leave empty for a new product: it's made from the name." },
  { key: "name", header: "Product name *", width: 36, help: "Required for new products." },
  { key: "description", header: "Description *", width: 50, help: "Required for new products." },
  { key: "department", header: "Department *", width: 13, help: "Women, Men, Girls, Boys or Baby." },
  { key: "category", header: "Category *", width: 26, help: "A category name or web name from the list below." },
  { key: "collection", header: "Collection", width: 22, help: "Optional, e.g. Christmas Edit. Groups products on the homepage and in the menu." },
  { key: "status", header: "Status", width: 11, help: "Published (live in the shop), Draft (hidden) or Archived. Empty = the choice on the import page for new products, unchanged for existing ones." },
  { key: "priceGBP", header: "UK price £ *", width: 12, help: "e.g. 24.99. Required for new products." },
  { key: "salePriceGBP", header: "UK sale price £", width: 14, help: "Optional; must be lower than the UK price. Empty = no sale." },
  { key: "priceUSD", header: "US price $", width: 11, help: "Optional; empty = not sold in the US store." },
  { key: "salePriceUSD", header: "US sale price $", width: 14, help: "Optional; must be lower than the US price." },
  { key: "ageRange", header: "Age range", width: 12, help: "Optional, e.g. 3–8 years." },
  { key: "featured", header: "Featured", width: 10, help: "Yes or No — shown in Featured on the homepage." },
  { key: "bestseller", header: "Bestseller", width: 11, help: "Yes or No." },
  { key: "composition", header: "Fabric", width: 20, help: "Optional, e.g. 100% cotton. Only enter verified information." },
  { key: "care", header: "Care", width: 20, help: "Optional washing instructions." },
  { key: "origin", header: "Made in", width: 12, help: "Optional country of origin." },
  { key: "photos", header: "Photos", width: 60, help: "Picture addresses separated by | . Pictures already in the shop look like /uploads/…; links starting https:// are downloaded into the shop when importing. Add (Colour) after a picture for a colour's own photo, e.g. https://…/red.jpg (Red). Empty = keep a product's current photos." },
  { key: "sku", header: "SKU", width: 22, help: "Stock code, unique across the shop. Empty = one is made for new sizes. Rows are matched to sizes already on the product by SKU, or else by size + colour." },
  { key: "size", header: "Size *", width: 12, help: "e.g. 3-4 Y, S, M, One size. Each row is one size/colour of the product." },
  { key: "colour", header: "Colour", width: 14, help: "e.g. Red. Empty = One colour." },
  { key: "colourHex", header: "Colour code", width: 12, help: "Optional swatch colour like #cc0000. Empty = picked from the colour name for new sizes." },
  { key: "stock", header: "Stock", width: 9, help: "How many are in stock. Empty = 0 for new sizes, unchanged for existing ones." },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "WOMEN", label: "Women" },
  { value: "MEN", label: "Men" },
  { value: "GIRLS", label: "Girls" },
  { value: "BOYS", label: "Boys" },
  { value: "BABY", label: "Baby" },
];
const STATUS_LABELS: Record<ProductStatus, string> = { PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived" };

// ---------- export ----------

export type SheetCategory = { id: string; slug: string; name: string };
export type ExportProduct = {
  slug: string; name: string; description: string; department: Department; status: ProductStatus;
  category: { name: string };
  collection: string | null; ageRange: string | null; composition: string | null; care: string | null; origin: string | null;
  priceGBP: number; salePriceGBP: number | null; priceUSD: number | null; salePriceUSD: number | null;
  featured: boolean; bestseller: boolean;
  images: { url: string; colour: string | null }[];
  variants: { sku: string; size: string; colour: string; colourHex: string; stock: number }[];
};

const money = (minor: number | null) => (minor == null ? null : minor / 100);
export const photosCell = (images: { url: string; colour: string | null }[]) => images.map((i) => (i.colour ? `${i.url} (${i.colour})` : i.url)).join(" | ");

/** The Excel file: a Products sheet (empty when `products` is empty — the blank template) and a Help sheet. */
export async function buildProductWorkbook(products: ExportProduct[], categories: SheetCategory[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Fashion Rockstar";
  const ws = wb.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  // Text format so Excel doesn't turn sizes like "3-4" into dates or long SKUs into numbers.
  for (const k of ["slug", "sku", "size", "ageRange", "colourHex"] as const) ws.getColumn(k).numFmt = "@";
  for (const k of ["priceGBP", "salePriceGBP", "priceUSD", "salePriceUSD"] as const) ws.getColumn(k).numFmt = "0.00";
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F1A24" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  COLUMNS.forEach((c, i) => (header.getCell(i + 1).note = c.help));

  for (const p of products) {
    const base = {
      slug: p.slug, name: p.name, description: p.description,
      department: DEPARTMENTS.find((d) => d.value === p.department)?.label ?? p.department,
      category: p.category.name, collection: p.collection ?? "", status: STATUS_LABELS[p.status],
      priceGBP: money(p.priceGBP), salePriceGBP: money(p.salePriceGBP), priceUSD: money(p.priceUSD), salePriceUSD: money(p.salePriceUSD),
      ageRange: p.ageRange ?? "", featured: p.featured ? "Yes" : "No", bestseller: p.bestseller ? "Yes" : "No",
      composition: p.composition ?? "", care: p.care ?? "", origin: p.origin ?? "", photos: photosCell(p.images),
    };
    if (!p.variants.length) ws.addRow(base);
    for (const v of p.variants) ws.addRow({ ...base, sku: v.sku, size: v.size, colour: v.colour, colourHex: v.colourHex, stock: v.stock });
  }

  // Drop-down lists for the columns with fixed choices (on 5000 rows past the data, for new products typed in).
  const lists = wb.addWorksheet("Lists", { state: "hidden" });
  categories.forEach((c, i) => (lists.getCell(i + 1, 1).value = c.name));
  const last = Math.max(ws.rowCount, 1) + 5000;
  const col = (k: ColumnKey) => ws.getColumn(k).letter;
  // exceljs supports range validations at runtime, but its types only know per-cell ones.
  const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations;
  const list = (k: ColumnKey, formula: string) =>
    validations.add(`${col(k)}2:${col(k)}${last}`, { type: "list", allowBlank: true, formulae: [formula], showErrorMessage: false });
  list("department", `"${DEPARTMENTS.map((d) => d.label).join(",")}"`);
  list("status", '"Published,Draft,Archived"');
  list("featured", '"Yes,No"');
  list("bestseller", '"Yes,No"');
  if (categories.length) list("category", `Lists!$A$1:$A$${categories.length}`);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const help = wb.addWorksheet("Help");
  help.columns = [{ width: 24 }, { width: 110 }];
  const add = (a: string, b = "", bold = false) => {
    const r = help.addRow([a, b]);
    r.alignment = { wrapText: true, vertical: "top" };
    if (bold) r.font = { bold: true, size: 13 };
  };
  add("How to use this file", "", true);
  add("", "Each row is one size/colour (SKU) of a product. Rows with the same web address (or, without one, the same product name) are the same product; its details can be on just one of its rows.");
  add("", "To edit products: export, change prices, stock, names etc., then import the file in Admin → Products → Excel. Click Check file first to see what will change.");
  add("", "To add products: fill in new rows (leave the web address empty). Columns marked * are needed for new products.");
  add("", "A column you delete from the sheet is left unchanged on every product. An empty cell in a column you keep clears that detail (e.g. an empty UK sale price ends the sale) — except required details, photos and stock, which stay as they are.");
  add("", "Sizes not in the file are kept. To remove a size or delete a product, use the product's page in the admin.");
  add("");
  add("Columns", "", true);
  for (const c of COLUMNS) add(c.header, c.help);
  add("");
  add("Departments", "", true);
  add("", DEPARTMENTS.map((d) => d.label).join(", "));
  add("Statuses", "", true);
  add("", "Published, Draft, Archived");
  add("Categories", "", true);
  for (const c of categories) add(c.name, c.slug);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- reading ----------

export type SheetRow = { row: number; values: Partial<Record<ColumnKey, unknown>> };
export type ReadSheet = { rows: SheetRow[]; present: Set<ColumnKey>; ignored: string[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_KEYS = new Map<string, ColumnKey>();
for (const c of COLUMNS) {
  HEADER_KEYS.set(norm(c.header), c.key);
  HEADER_KEYS.set(norm(c.key), c.key);
}
for (const [alias, key] of Object.entries({
  slug: "slug", url: "slug", handle: "slug", productname: "name", title: "name", name: "name", price: "priceGBP", ukprice: "priceGBP",
  saleprice: "salePriceGBP", color: "colour", colorcode: "colourHex", colourhex: "colourHex", quantity: "stock", qty: "stock",
  images: "photos", photo: "photos", pictures: "photos", composition: "composition", fabric: "composition", madein: "origin",
} as Record<string, ColumnKey>))
  HEADER_KEYS.set(alias, key);

export const MAX_SHEET_ROWS = 20000;

/** Plain text of a cell value from exceljs (numbers, text, rich text, links and formula results). */
export function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; hyperlink?: string; error?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if ("result" in o) return cellText(o.result);
    if (o.text != null) return cellText(o.text);
    if (o.hyperlink) return String(o.hyperlink).trim();
  }
  return "";
}

/** Reads a product sheet (.xlsx, or .csv). Throws an Error with a message for the admin when it can't. */
export async function readProductSheet(buf: Buffer, fileName = ""): Promise<ReadSheet> {
  const wb = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(fileName)) await wb.csv.read(Readable.from(buf), { map: (v: unknown) => v } as never);
    else await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new Error("Couldn't open this file. Save it as an Excel workbook (.xlsx) and try again.");
  }
  const ws = wb.getWorksheet("Products") ?? wb.worksheets.find((w) => w.state !== "hidden" && w.rowCount > 0);
  if (!ws) throw new Error("The file is empty.");
  if (ws.rowCount > MAX_SHEET_ROWS + 10) throw new Error(`The sheet has more than ${MAX_SHEET_ROWS} rows — split it into smaller files.`);

  // The header row: the first of the top 5 rows that names at least two known columns.
  let headerRow = 0;
  let columns = new Map<number, ColumnKey>();
  let ignored: string[] = [];
  for (let r = 1; r <= Math.min(5, ws.rowCount) && !headerRow; r++) {
    const found = new Map<number, ColumnKey>();
    const unknown: string[] = [];
    ws.getRow(r).eachCell((cell, c) => {
      const text = cellText(cell.value);
      const key = HEADER_KEYS.get(norm(text));
      if (key && ![...found.values()].includes(key)) found.set(c, key);
      else if (text) unknown.push(text);
    });
    if (found.size >= 2) [headerRow, columns, ignored] = [r, found, unknown];
  }
  const present = new Set(columns.values());
  if (!headerRow || (!present.has("name") && !present.has("slug")))
    throw new Error("This doesn't look like a product sheet: it needs a \"Product name\" or \"Web address\" column. Export your products or download the template to see the layout.");

  const rows: SheetRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: SheetRow["values"] = {};
    let any = false;
    for (const [c, key] of columns) {
      const v = row.getCell(c).value;
      if (cellText(v) !== "") {
        values[key] = v;
        any = true;
      }
    }
    if (any) rows.push({ row: r, values });
  }
  return { rows, present, ignored };
}

// ---------- checking ----------

export type ProductFields = {
  name: string; description: string; department: Department; categoryId: string; status: ProductStatus;
  collection: string | null; ageRange: string | null; composition: string | null; care: string | null; origin: string | null;
  priceGBP: number; salePriceGBP: number | null; priceUSD: number | null; salePriceUSD: number | null;
  featured: boolean; bestseller: boolean;
};
export type PlannedVariant = { id?: string; sku: string; size: string; colour: string; colourHex?: string; stock?: number };
export type PlannedProduct = {
  action: "create" | "update";
  productId?: string;
  slug: string;
  name: string;
  rows: number[];
  data: Partial<ProductFields>;
  variants: PlannedVariant[];
  photos?: { url: string; colour: string | null }[]; // undefined = keep the current photos
};
export type SheetError = { row: number; product: string; message: string };
export type ImportPlan = { items: PlannedProduct[]; errors: SheetError[] };

export type Snapshot = {
  categories: SheetCategory[];
  products: { id: string; slug: string; name: string; priceGBP: number; salePriceGBP: number | null; priceUSD: number | null; salePriceUSD: number | null; variants: { id: string; sku: string; size: string; colour: string }[] }[];
  skus: { sku: string; productId: string }[];
};

const DEPARTMENT_WORDS: Record<string, Department> = { women: "WOMEN", woman: "WOMEN", womens: "WOMEN", ladies: "WOMEN", men: "MEN", man: "MEN", mens: "MEN", girls: "GIRLS", girl: "GIRLS", boys: "BOYS", boy: "BOYS", baby: "BABY", babies: "BABY" };
const STATUS_WORDS: Record<string, ProductStatus> = { published: "PUBLISHED", publish: "PUBLISHED", live: "PUBLISHED", active: "PUBLISHED", draft: "DRAFT", hidden: "DRAFT", archived: "ARCHIVED", archive: "ARCHIVED" };
const YES = new Set(["yes", "y", "true", "1", "x"]);
const NO = new Set(["no", "n", "false", "0"]);

/** Money from a cell: numbers as Excel stores them (24.99) or text like "£24.99". undefined = invalid. */
export function cellMoney(v: unknown): number | null | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : undefined;
  const t = cellText(v);
  if (!t) return null;
  return parseMoney(t) ?? undefined;
}

/** "url | url (Red)" → photos. Returns an error message for an address that can't be used. */
export function parsePhotos(cell: string): { photos: { url: string; colour: string | null }[] } | { error: string } {
  const photos: { url: string; colour: string | null }[] = [];
  for (const part of cell.split(/\s*\|\s*|\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\S+)(?:\s+\((.{1,40})\))?$/.exec(part);
    const url = m?.[1] ?? "";
    const ok = url.length <= 500 && (/^\/(?!\/)\S+$/.test(url) || /^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(url));
    if (!m || !ok) return { error: `Photo "${part.slice(0, 80)}" isn't a picture address (it should start with /uploads/, /images/ or https://)` };
    photos.push({ url, colour: m[2]?.trim() || null });
  }
  if (photos.length > 20) return { error: "A product can have up to 20 photos" };
  return { photos };
}

function skuBase(slug: string) {
  return `FR-${slug.replace(/-/g, "").slice(0, 14).toUpperCase() || "ITEM"}`;
}

/** Works out what importing the rows would do. Products with a problem are left out and listed in `errors`. */
export function planSheetImport(sheet: Pick<ReadSheet, "rows" | "present">, snap: Snapshot, opts: { defaultStatus: ProductStatus }): ImportPlan {
  const { rows, present } = sheet;
  const errors: SheetError[] = [];
  const items: PlannedProduct[] = [];
  const bySlug = new Map(snap.products.map((p) => [p.slug, p]));
  const productNames = new Map(snap.products.map((p) => [p.id, p.name]));
  const skuOwner = new Map(snap.skus.map((s) => [s.sku.toLowerCase(), s.productId]));
  const categories = new Map<string, SheetCategory>();
  for (const c of snap.categories) {
    categories.set(c.slug.toLowerCase(), c);
    categories.set(c.name.toLowerCase(), c);
  }

  // Group rows into products.
  const groups = new Map<string, SheetRow[]>();
  for (const r of rows) {
    const key = slugify(cellText(r.values.slug)) || slugify(cellText(r.values.name));
    if (!key) {
      errors.push({ row: r.row, product: "", message: "Needs a product name or web address" });
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  // SKUs typed in the sheet, so a made-up SKU never repeats one further down.
  const sheetSkus = new Map<string, string>(); // lower-case SKU → product key that claims it
  const usedSkus = new Set<string>(skuOwner.keys());
  for (const [key, group] of groups)
    for (const r of group) {
      const sku = cellText(r.values.sku).toLowerCase();
      if (!sku) continue;
      if (sheetSkus.has(sku) && sheetSkus.get(sku) !== key) continue; // reported below
      sheetSkus.set(sku, key);
      usedSkus.add(sku);
    }

  for (const [key, group] of groups) {
    const existing = bySlug.get(key);
    const errs: SheetError[] = [];
    const first = (k: ColumnKey) => group.find((r) => cellText(r.values[k]) !== "");
    const text = (k: ColumnKey) => cellText(first(k)?.values[k]);
    const rowOf = (k: ColumnKey) => first(k)?.row ?? group[0].row;
    const label = text("name") || existing?.name || key;
    const fail = (row: number, message: string) => errs.push({ row, product: label, message });
    const data: Partial<ProductFields> = {};

    // Required details: needed for a new product; for an existing one an empty cell keeps the current value.
    const required = <K extends keyof ProductFields>(k: K & ColumnKey, what: string, parse: (t: string) => ProductFields[K] | undefined) => {
      const t = text(k);
      if (!t) {
        if (!existing) fail(group[0].row, `${what} is missing`);
        return;
      }
      const v = parse(t);
      if (v === undefined) fail(rowOf(k), `${what} "${t.slice(0, 60)}" isn't valid`);
      else (data as Record<string, unknown>)[k] = v;
    };
    required("name", "Product name", (t) => (t.length >= 2 && t.length <= 190 ? t : undefined));
    required("description", "Description", (t) => (t.length <= 60000 ? t : undefined));
    required("department", "Department", (t) => DEPARTMENT_WORDS[t.toLowerCase().replace(/[^a-z]/g, "")]);
    {
      const t = text("category");
      if (!t) {
        if (!existing) fail(group[0].row, "Category is missing");
      } else {
        const c = categories.get(t.toLowerCase());
        if (c) data.categoryId = c.id;
        else fail(rowOf("category"), `Category "${t.slice(0, 60)}" doesn't exist — use one from the Help sheet or add it in Admin → Categories`);
      }
    }
    {
      const t = text("status");
      if (t) {
        const s = STATUS_WORDS[t.toLowerCase()];
        if (s) data.status = s;
        else fail(rowOf("status"), `Status "${t.slice(0, 30)}" should be Published, Draft or Archived`);
      } else if (!existing) data.status = opts.defaultStatus;
    }

    // Prices.
    const price = (k: "priceGBP" | "salePriceGBP" | "priceUSD" | "salePriceUSD", what: string) => {
      if (!present.has(k)) return;
      const f = first(k);
      const v = cellMoney(f?.values[k]);
      if (v === undefined) fail(f?.row ?? group[0].row, `${what} "${cellText(f?.values[k])}" isn't a price (e.g. 24.99)`);
      else if (k === "priceGBP") {
        if (v == null || v <= 0) {
          if (!existing) fail(group[0].row, "UK price is missing");
        } else data.priceGBP = v;
      } else data[k] = v && v > 0 ? v : null;
    };
    price("priceGBP", "UK price");
    price("salePriceGBP", "UK sale price");
    price("priceUSD", "US price");
    price("salePriceUSD", "US sale price");
    if (!existing && !present.has("priceGBP")) fail(group[0].row, "UK price is missing");
    const final = { ...{ priceGBP: 0, salePriceGBP: null, priceUSD: null, salePriceUSD: null }, ...(existing ?? {}), ...data };
    if (final.priceGBP && final.salePriceGBP != null && final.salePriceGBP >= final.priceGBP) fail(rowOf("salePriceGBP"), "UK sale price must be lower than the UK price");
    if (final.salePriceUSD != null && (final.priceUSD == null || final.salePriceUSD >= final.priceUSD)) fail(rowOf("salePriceUSD"), "US sale price must be lower than the US price");

    // Optional details: an empty cell clears them.
    for (const [k, max] of [["collection", 190], ["ageRange", 190], ["origin", 190], ["composition", 5000], ["care", 5000]] as const) {
      if (!present.has(k)) continue;
      const t = text(k);
      if (t.length > max) fail(rowOf(k), `${k === "composition" ? "Fabric" : k} is too long`);
      else data[k] = t || null;
    }
    for (const k of ["featured", "bestseller"] as const) {
      if (!present.has(k)) continue;
      const t = text(k).toLowerCase();
      if (!t || NO.has(t)) data[k] = false;
      else if (YES.has(t)) data[k] = true;
      else fail(rowOf(k), `${k === "featured" ? "Featured" : "Bestseller"} should be Yes or No`);
    }

    // Sizes / colours.
    const variants: PlannedVariant[] = [];
    const combos = new Set<string>();
    const matched = new Set<string>();
    for (const r of group) {
      const v = r.values;
      const hasVariant = ["sku", "size", "colour", "colourHex", "stock"].some((k) => cellText(v[k as ColumnKey]) !== "");
      if (!hasVariant) continue;
      let sku = cellText(v.sku);
      // A size already on the product can be found by its SKU alone (e.g. a sheet of just SKUs and stock).
      const bySku = sku ? existing?.variants.find((e) => !matched.has(e.id) && e.sku.toLowerCase() === sku.toLowerCase()) : undefined;
      if (bySku) sku = bySku.sku; // keeps the SKU's spelling (SKUs match ignoring capitals)
      const size = cellText(v.size) || bySku?.size || "";
      const colour = cellText(v.colour) || bySku?.colour || "One colour";
      if (!size) {
        fail(r.row, "Size is missing");
        continue;
      }
      if (size.length > 30 || colour.length > 40 || sku.length > 60) {
        fail(r.row, "Size (30), colour (40) or SKU (60 characters) is too long");
        continue;
      }
      const combo = `${size}|${colour}`.toLowerCase();
      if (combos.has(combo)) {
        fail(r.row, `Size ${size} in ${colour} is listed twice`);
        continue;
      }
      combos.add(combo);

      const own = bySku
        ?? existing?.variants.find((e) => !matched.has(e.id) && `${e.size}|${e.colour}`.toLowerCase() === combo);
      if (own) matched.add(own.id);
      if (sku) {
        const lower = sku.toLowerCase();
        const owner = skuOwner.get(lower);
        if (sheetSkus.get(lower) !== key) {
          fail(r.row, `SKU ${sku} is also used for another product in this file`);
          continue;
        }
        if (owner && owner !== existing?.id) {
          fail(r.row, `SKU ${sku} is already used by "${productNames.get(owner) ?? "another product"}"`);
          continue;
        }
        if (variants.some((x) => x.sku.toLowerCase() === lower)) {
          fail(r.row, `SKU ${sku} is listed twice`);
          continue;
        }
      } else if (own) sku = own.sku;
      else {
        const base = skuBase(key);
        let n = (existing?.variants.length ?? 0) + variants.length + 1;
        while (usedSkus.has(`${base}-${n}`.toLowerCase())) n++;
        sku = `${base}-${n}`;
        usedSkus.add(sku.toLowerCase());
      }

      const planned: PlannedVariant = { id: own?.id, sku, size, colour };
      const hex = cellText(v.colourHex);
      if (hex) {
        const h = hex.startsWith("#") ? hex : `#${hex}`;
        if (!/^#[0-9a-f]{6}$/i.test(h)) {
          fail(r.row, `Colour code "${hex}" should look like #cc0000`);
          continue;
        }
        planned.colourHex = h.toLowerCase();
      } else if (!own) planned.colourHex = colourHex(colour);
      const stockText = cellText(v.stock);
      if (stockText) {
        const n = Number(stockText);
        if (!Number.isInteger(n) || n < 0 || n > 100000) {
          fail(r.row, `Stock "${stockText}" should be a whole number`);
          continue;
        }
        planned.stock = n;
      } else if (!own) planned.stock = 0;
      variants.push(planned);
    }
    if (!existing && !variants.length && !errs.length) fail(group[0].row, "Add at least one row with a Size");

    // Photos: an empty cell keeps the current photos (and a new product starts with none).
    let photos: PlannedProduct["photos"];
    const photoText = text("photos");
    if (photoText) {
      const parsed = parsePhotos(photoText);
      if ("error" in parsed) fail(rowOf("photos"), parsed.error);
      else photos = parsed.photos;
    } else if (!existing) photos = [];

    if (errs.length) {
      errors.push(...errs);
      continue;
    }
    items.push({ action: existing ? "update" : "create", productId: existing?.id, slug: key, name: data.name ?? existing?.name ?? key, rows: group.map((r) => r.row), data, variants, photos });
  }
  errors.sort((a, b) => a.row - b.row);
  return { items, errors };
}
