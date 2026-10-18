// Imports a product catalogue from a Shopify store's public products feed (/products.json):
//   • downloads product photos into public/images/products/<product>/
//   • writes prisma/data/products.json, which `npm run db:seed` (and every `npm run build`) loads into the database
// The same import can be run from the website: Admin → Import products (src/lib/import-job.ts).
//
// Usage:  npm run import:products                       (defaults to https://gumandberries.co.uk)
//         npm run import:products -- https://shop.example --max-images 4 --limit 200
//
// Only import products and photos you have permission to sell and reuse.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_NAMES } from "../src/lib/categories";
import { downloadImage, fetchShopifyProducts, mapShopifyProduct, normaliseSource, type ImportedProduct } from "../src/lib/shopify-import";

export { CATEGORY_NAMES };
export { category, collection, colourHex, department, htmlToText, slugify, type ImportedProduct } from "../src/lib/shopify-import";

// ---------- options ----------
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SOURCE_ARG = args.find((a) => /^https?:\/\//.test(a)) ?? "https://gumandberries.co.uk";
const MAX_IMAGES = Number(flag("max-images") ?? 4);
const LIMIT = Number(flag("limit") ?? Infinity);
const IMAGE_WIDTH = Number(flag("image-width") ?? 1000);
const DEFAULT_STOCK = Number(flag("stock") ?? 10); // the feed only says in/out of stock, not quantities
const USD_RATE = Number(flag("usd-rate") ?? 1.3); // 0 = don't set US prices
const IMAGE_DIR = path.resolve("public/images/products");
const DATA_FILE = path.resolve("prisma/data/products.json");

// ---------- main ----------
async function main() {
  const source = normaliseSource(SOURCE_ARG);
  console.log(`Importing from ${source} …`);
  const selected = await fetchShopifyProducts(source, LIMIT, (page, count) => console.log(`  page ${page}: ${count} products`));

  await mkdir(IMAGE_DIR, { recursive: true });
  const usedSlugs = new Set<string>();
  const usedSkus = new Set<string>();
  const out: ImportedProduct[] = [];

  for (const [index, p] of selected.entries()) {
    const mapped = mapShopifyProduct(p, { source, defaultStock: DEFAULT_STOCK, usdRate: USD_RATE }, usedSlugs, usedSkus);
    if (!mapped) continue;
    const { product, photos } = mapped;

    const dir = path.join(IMAGE_DIR, product.slug);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const images: ImportedProduct["images"] = [];
    for (const [ii, img] of photos.slice(0, MAX_IMAGES).entries()) {
      try {
        const { buf, ext } = await downloadImage(img.src, IMAGE_WIDTH);
        const file = `${ii + 1}.${ext}`;
        await writeFile(path.join(dir, file), buf);
        images.push({ url: `/images/products/${product.slug}/${file}`, alt: img.alt });
      } catch (e) {
        console.warn(`  ! image skipped (${img.src}): ${e instanceof Error ? e.message : e}`);
      }
    }
    if (!(await readdir(dir)).length) await rm(dir, { recursive: true, force: true });

    out.push({ ...product, images });
    console.log(`  [${index + 1}/${selected.length}] ${product.name} — ${images.length} photo(s)`);
  }

  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nSaved ${out.length} products to ${path.relative(process.cwd(), DATA_FILE)} and photos to public/images/products/.`);
  console.log("Next: run `npm run db:seed` to load them into the shop.");
}

if (process.argv[1] && /import-shopify/.test(process.argv[1]))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
