// Seeds the super-admin account, categories, the imported product catalogue and the
// Halloween / Christmas events. Safe to run again: existing products and events are left alone.
//
// Products come from prisma/data/products.json, created by `npm run import:products`
// (photos are saved in public/images/products/). Set SEED_PRODUCT_STATUS=DRAFT to import them hidden.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, type ProductStatus } from "@prisma/client";
import type { ImportedProduct } from "../src/lib/shopify-import";
import { CATEGORIES, CATEGORY_NAMES } from "../src/lib/categories";

const prisma = new PrismaClient();

// The placeholder products earlier versions of the seed created. They are removed (or archived
// when they have orders) so only the real catalogue is shown.
const OLD_SAMPLE_SLUGS = [
  "rosa-tulle-party-dress", "clara-sequin-bodice-dress", "daisy-embroidered-cardigan", "oliver-linen-look-shirt",
  "harry-three-piece-suit-set", "jack-chino-trousers", "evelyn-wrap-midi-dress", "isla-satin-slip-skirt",
  "margot-wool-blend-coat", "ava-cable-knit-jumper", "luna-star-pyjama-set", "bunny-knitted-romper",
  "freddie-quilted-jacket", "poppy-ballet-flats",
];

const DATA_FILE = path.resolve("prisma/data/products.json");

async function removeSamples() {
  const samples = await prisma.product.findMany({
    where: { slug: { in: OLD_SAMPLE_SLUGS } },
    select: { id: true, _count: { select: { variants: { where: { orderItems: { some: {} } } } } } },
  });
  for (const s of samples) {
    if (s._count.variants > 0) await prisma.product.update({ where: { id: s.id }, data: { status: "ARCHIVED" } });
    else await prisma.product.delete({ where: { id: s.id } });
  }
  if (samples.length) console.log(`Removed ${samples.length} placeholder sample products.`);
}

async function importCatalogue() {
  if (!existsSync(DATA_FILE)) {
    console.log("No prisma/data/products.json yet — run `npm run import:products` to fetch the catalogue.");
    return;
  }
  const items = JSON.parse(readFileSync(DATA_FILE, "utf8")) as ImportedProduct[];
  const status = (process.env.SEED_PRODUCT_STATUS === "DRAFT" ? "DRAFT" : "PUBLISHED") satisfies ProductStatus;
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  let created = 0;
  for (const p of items) {
    if (await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } })) continue;
    let categoryId = categories.get(p.category);
    if (!categoryId) {
      const cat = await prisma.category.create({ data: { slug: p.category, name: CATEGORY_NAMES[p.category] ?? p.category, sortOrder: categories.size } });
      categories.set(cat.slug, (categoryId = cat.id));
    }
    const skuTaken = await prisma.variant.findFirst({ where: { sku: { in: p.variants.map((v) => v.sku) } }, select: { sku: true } });
    if (skuTaken) {
      console.warn(`  skipped ${p.name}: SKU ${skuTaken.sku} already used by another product`);
      continue;
    }
    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        department: p.department,
        categoryId,
        status,
        priceGBP: p.priceGBP,
        salePriceGBP: p.salePriceGBP,
        priceUSD: p.priceUSD,
        salePriceUSD: p.salePriceUSD,
        ageRange: p.ageRange,
        collection: p.collection,
        featured: created < 8,
        variants: { create: p.variants.map((v, i) => ({ ...v, sortOrder: i })) },
        images: { create: p.images.map((img, i) => ({ url: img.url, alt: img.alt, position: i })) },
      },
    });
    created++;
  }
  console.log(`Imported ${created} new products as ${status} (${items.length - created} already existed or were skipped).`);
}

async function seedEvents() {
  if ((await prisma.seasonalEvent.count()) > 0) return;
  const year = new Date().getUTCFullYear();
  await prisma.seasonalEvent.createMany({
    data: [
      {
        name: `Halloween ${year}`,
        theme: "HALLOWEEN",
        active: true,
        startsAt: new Date(`${year}-10-01T00:00:00Z`),
        endsAt: new Date(`${year}-10-31T23:59:59Z`),
        barText: "🎃 Halloween is here — spooky costumes & party outfits, with next-day UK delivery",
        barLinkLabel: "Shop Halloween",
        barLinkHref: "/search?q=Halloween",
        heroEyebrow: "Spooky season",
        heroTitle: "Trick or treat in style",
        heroSubtitle: "Costumes, pumpkin-patch pyjamas and party outfits for little monsters — order by the 29th for Halloween.",
        heroCtaLabel: "Shop the Halloween edit",
        heroCtaHref: "/search?q=Halloween",
        collection: "Halloween",
        sectionTitle: "The Halloween shop",
      },
      {
        name: `Christmas ${year}`,
        theme: "CHRISTMAS",
        active: true,
        startsAt: new Date(`${year}-11-15T00:00:00Z`),
        endsAt: new Date(`${year}-12-26T23:59:59Z`),
        barText: "🎄 Christmas gifting is open — festive jumpers, pyjamas & party wear",
        barLinkLabel: "Shop Christmas",
        barLinkHref: "/search?q=Christmas",
        heroEyebrow: "Merry & bright",
        heroTitle: "Dressed for the festive season",
        heroSubtitle: "Matching Christmas pyjamas, cosy jumpers and party outfits — wrapped up and delivered in time for the big day.",
        heroCtaLabel: "Shop Christmas",
        heroCtaHref: "/search?q=Christmas",
        collection: "Christmas",
        sectionTitle: "The Christmas shop",
      },
    ],
  });
  console.log("Created Halloween and Christmas events (edit them in Admin → Seasonal events).");
}

// `--on-deploy` (used by `npm run build`, e.g. on Hostinger): runs on every deploy, so it only creates the admin
// account when it doesn't exist yet (a password changed in the admin is kept) and never stops the build.
const ON_DEPLOY = process.argv.includes("--on-deploy");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    if (ON_DEPLOY) return console.log("Admin account skipped: set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) to create it.");
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) in .env before seeding");
  }
  if (ON_DEPLOY && (await prisma.adminUser.findUnique({ where: { email } }))) return console.log(`Admin account already exists: ${email}`);
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name: "Owner", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    update: { passwordHash: await bcrypt.hash(password, 12), active: true, role: "SUPER_ADMIN" },
  });
  console.log(`Admin account ready: ${email}`);
}

async function main() {
  await seedAdmin();

  // Every category the menu links to (src/lib/categories.ts). Existing categories keep any edits made in the admin.
  for (const [i, c] of CATEGORIES.entries())
    await prisma.category.upsert({ where: { slug: c.slug }, create: { slug: c.slug, name: c.name, description: c.description, sortOrder: i }, update: {} });

  await removeSamples();
  await importCatalogue();
  await seedEvents();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
