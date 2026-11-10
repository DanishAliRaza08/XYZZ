// Admin → Products → Excel: product exports from marketplaces (Amazon reports and inventory files, TikTok Shop
// product exports, and similar spreadsheets from eBay, Etsy…) turned into the shop's own product-sheet rows, so they
// go through the same checking and importing as the shop's Excel file (src/lib/product-sheet.ts).
// Columns are recognised by their names; size/colour variations are grouped into one product by their parent
// SKU (Amazon), product ID (TikTok Shop) or, failing that, the product name.
import type { ColumnKey, SheetRow } from "./product-sheet";
import { category, department, htmlToText, slugify } from "./shopify-import";

type Field =
  | "name" | "description" | "bullet" | "sku" | "parentSku" | "parentChild" | "groupId" | "size" | "colour"
  | "price" | "salePrice" | "quantity" | "mainImage" | "image" | "department" | "type";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const FIELDS: [RegExp, Field][] = [
  [/^(itemname|title|productname|producttitle|listingtitle|name)$/, "name"],
  [/^(productdescription|description|longdescription|itemdescription)$/, "description"],
  [/^(bulletpoint\d*|keyproductfeatures\d*|keyfeatures\d*|feature\d+)$/, "bullet"],
  [/^(sellersku|itemsku|sku|merchantsku|customlabelsku|customlabel)$/, "sku"],
  [/^(parentsku)$/, "parentSku"],
  [/^(parentchild|parentage|parentagelevel)$/, "parentChild"],
  [/^(productid|itemgroupid|listingid|groupid)$/, "groupId"],
  [/^(sizename|size|sizemap|apparelsize|variationsize)$/, "size"],
  [/^(colorname|colourname|color|colour|colormap|variationcolour|variationcolor)$/, "colour"],
  [/^(standardprice|price|yourprice|retailprice|sellingprice|itemprice|startprice|priceinclvat)$/, "price"],
  [/^(saleprice|discountprice|promotionalprice)$/, "salePrice"],
  [/^(quantity|stock|availablequantity|qty|inventory|availablestock|totalquantity|quantityavailable)$/, "quantity"],
  [/^(mainimageurl|mainimage|mainproductimage|imageurl|picurl|primaryimage|productimage|image1|imageurl1)$/, "mainImage"],
  [/^(otherimageurl\d*|image\d+|imageurl\d+|additionalimage\d*|productimage\d+)$/, "image"],
  [/^(departmentname|department|gender|targetgender)$/, "department"],
  [/^(itemtype|itemtypekeyword|producttype|feedproducttype|category|productcategory|categorypath)$/, "type"],
];
// TikTok Shop style "Variation 1 name" / "Variation 1 value" pairs (also "Variation name 1", "Option 1 name"…).
const VARIATION = /^(?:variation|option|variant)(\d*)(name|type|value|option)(\d*)$/;

export type MarketplaceRead = { rows: SheetRow[]; present: Set<ColumnKey>; source: string; notes: string[] };

function fieldOf(header: string): Field | { variation: number; kind: "name" | "value" } | null {
  const h = norm(header);
  if (!h) return null;
  const v = VARIATION.exec(h);
  if (v) return { variation: Number(v[1] || v[3] || 1), kind: v[2] === "name" || v[2] === "type" ? "name" : "value" };
  return FIELDS.find(([re]) => re.test(h))?.[1] ?? null;
}

const score = (row: string[]) => row.filter((c) => fieldOf(c)).length;

/**
 * Reads a marketplace export given as rows of cell text (row 1 first). Returns null when it doesn't look like one
 * (needs at least a product name column and a SKU or price column).
 */
export function readMarketplaceGrid(grid: string[][]): MarketplaceRead | null {
  // The header row: the best of the top 6 (Amazon files start with a template row, then labels, then field names).
  let headerIndex = -1;
  let best = 0;
  for (let i = 0; i < Math.min(6, grid.length); i++) {
    const s = score(grid[i]);
    if (s > best) [best, headerIndex] = [s, i];
  }
  if (headerIndex < 0 || best < 3) return null;
  const header = grid[headerIndex];
  const cols = header.map(fieldOf);
  const has = (f: Field) => cols.includes(f);
  if (!has("name") || !(has("sku") || has("price"))) return null;

  // Which marketplace: from all the top rows (Amazon's field names are one row below its labels).
  const headerText = grid.slice(0, Math.max(headerIndex + 2, 3)).flat().map(norm).join(" ");
  const source = /itemsku|parentchild|feedproducttype|asin/.test(headerText) ? "Amazon" : /sellersku/.test(headerText) && /productid|skuid/.test(headerText) ? "TikTok Shop" : "marketplace";

  type Rec = { row: number; get: (f: Field) => string; all: (f: Field) => string[]; variations: Map<string, string> };
  const records: Rec[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells.some((c) => c.trim())) continue;
    if (score(cells) >= 3) continue; // a second heading row (e.g. Amazon's labels above the field names)
    const all = (f: Field) => cols.flatMap((c, j) => (c === f && cells[j]?.trim() ? [cells[j].trim()] : []));
    const variations = new Map<string, string>();
    const names = new Map<number, string>();
    const values = new Map<number, string>();
    cols.forEach((c, j) => {
      if (c && typeof c === "object" && cells[j]?.trim()) (c.kind === "name" ? names : values).set(c.variation, cells[j].trim());
    });
    for (const [n, value] of values) variations.set((names.get(n) ?? `option ${n}`).toLowerCase(), value);
    records.push({ row: i + 1, get: (f) => all(f)[0] ?? "", all, variations });
  }

  // Group sizes/colours into products.
  const groups = new Map<string, { parent?: Rec; children: Rec[] }>();
  for (const r of records) {
    const isParent = /^parent$/i.test(r.get("parentChild"));
    const key = isParent ? r.get("sku") : r.get("parentSku") || r.get("groupId") || r.get("name") || r.get("sku");
    if (!key) continue;
    const g = groups.get(key) ?? { children: [] };
    if (isParent) g.parent = r;
    else g.children.push(r);
    groups.set(key, g);
  }

  const notes: string[] = [];
  let noStock = 0;
  const rows: SheetRow[] = [];
  const usedSlugs = new Set<string>();
  const money = (s: string) => {
    const n = Number(s.replace(/[£$€,\s]|GBP/gi, ""));
    return n > 0 ? Math.round(n * 100) / 100 : null;
  };
  const https = (u: string) => u.replace(/^http:\/\//i, "https://");

  for (const [key, g] of groups) {
    const children = g.children.length ? g.children : g.parent ? [g.parent] : [];
    if (!children.length) continue;
    const head = g.parent ?? children[0];
    const name = (head.get("name") || children[0].get("name")).slice(0, 190);
    if (!name) continue;
    let slug = slugify(name);
    if (usedSlugs.has(slug)) slug = slugify(`${name} ${key}`);
    usedSlugs.add(slug);

    const desc = htmlToText(head.get("description") || children[0].get("description"));
    const bullets = (head.all("bullet").length ? head.all("bullet") : children[0].all("bullet")).map((b) => `• ${htmlToText(b)}`);
    const description = [desc, bullets.join("\n")].filter(Boolean).join("\n\n") || name;
    const text = ` ${[name, head.get("type"), head.get("department"), children[0].get("type")].join(" ").toLowerCase()} `;

    const prices = children.map((c) => money(c.get("price"))).filter((p): p is number => p != null);
    const price = prices.length ? Math.max(...prices) : money(head.get("price"));
    const sales = children.map((c) => money(c.get("salePrice"))).filter((p): p is number => p != null);
    const sale = sales.length && price && Math.max(...sales) < price ? Math.max(...sales) : null;

    const sizeOf = (r: Rec) => r.get("size") || [...r.variations].find(([n]) => /size|age/.test(n))?.[1] || "";
    const colourOf = (r: Rec) => r.get("colour") || [...r.variations].find(([n]) => /colou?r|shade|pattern/.test(n))?.[1] || "";
    const colourCount = new Set(children.map(colourOf).filter(Boolean)).size;

    // Photos: the parent's for every colour, each size/colour's own photos tagged with its colour.
    const photos: string[] = [];
    const seen = new Set<string>();
    const addPhoto = (u: string, colour: string) => {
      const url = https(u.trim());
      if (!/^https:\/\/\S+$/.test(url) || seen.has(url) || photos.length >= 20) return;
      seen.add(url);
      photos.push(colour && colourCount > 1 ? `${url} (${colour.replace(/[()]/g, "")})` : url);
    };
    if (g.parent) [g.parent.get("mainImage"), ...g.parent.all("image")].forEach((u) => u && addPhoto(u, ""));
    for (const c of children) if (c !== g.parent) [c.get("mainImage"), ...c.all("image")].forEach((u) => u && addPhoto(u, colourOf(c)));

    children.forEach((c, i) => {
      const qty = c.get("quantity");
      if (!qty) noStock++;
      const values: SheetRow["values"] = {
        slug,
        sku: c.get("sku") || undefined,
        size: (sizeOf(c) || "One size").slice(0, 30),
        colour: colourOf(c).slice(0, 40) || undefined,
        stock: qty ? Math.max(0, Math.floor(Number(qty)) || 0) : 0,
      };
      if (i === 0)
        Object.assign(values, {
          name,
          description: description.slice(0, 60000),
          department: department(text),
          category: category(text),
          priceGBP: price ?? undefined,
          salePriceGBP: sale ?? undefined,
          photos: photos.join(" | ") || undefined,
        });
      rows.push({ row: c.row, values });
    });
  }

  if (noStock) notes.push(`${noStock} size${noStock === 1 ? "" : "s"} had no stock number (e.g. Amazon FBA stock) and will start at 0 — set stock in the products afterwards.`);
  notes.push("Departments and categories are worked out from each product's name and type — check them before publishing.");
  const present = new Set<ColumnKey>(["slug", "name", "description", "department", "category", "priceGBP", "salePriceGBP", "photos", "sku", "size", "colour", "stock"]);
  return { rows, present, source, notes };
}
