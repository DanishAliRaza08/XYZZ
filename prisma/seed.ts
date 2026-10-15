// Seeds the super-admin account, starter categories and a few SAMPLE products so the shop
// isn't empty on first run. Sample products are created as drafts unless SEED_PUBLISH_SAMPLES=1.
// Replace them with your real catalogue in Admin → Products.
import bcrypt from "bcryptjs";
import { PrismaClient, type Department } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  ["dresses", "Dresses & occasionwear", "Party dresses, bridesmaid and celebration styles."],
  ["tops", "Tops, T-shirts & shirts", null],
  ["trousers", "Trousers, leggings & jeans", null],
  ["skirts-shorts", "Skirts & shorts", null],
  ["coats", "Coats & jackets", null],
  ["knitwear", "Knitwear & cardigans", null],
  ["nightwear", "Nightwear & loungewear", null],
  ["sets", "Sets & co-ords", null],
  ["accessories", "Shoes & accessories", null],
] as const;

type Sample = {
  name: string; dept: Department; cat: string; gbp: number; sale?: number; usd?: number; collection?: string;
  featured?: boolean; bestseller?: boolean; age?: string; colours: [string, string][]; sizes: string[]; description: string;
};

const KID = ["3-4y", "5-6y", "7-8y", "9-10y", "11-12y"];
const WOMEN = ["8", "10", "12", "14", "16"];
const BABY = ["0-3m", "3-6m", "6-12m", "12-18m", "18-24m"];

const SAMPLES: Sample[] = [
  { name: "Rosa Tulle Party Dress", dept: "GIRLS", cat: "dresses", gbp: 4500, usd: 5900, collection: "Celebration Edit", featured: true, bestseller: true, age: "3–12 years", colours: [["Blush", "#e8b4bc"], ["Ivory", "#f3ead8"]], sizes: KID, description: "A layered tulle party dress with a fitted bodice and full skirt, finished with a satin sash that ties at the back." },
  { name: "Clara Sequin Bodice Dress", dept: "GIRLS", cat: "dresses", gbp: 5500, sale: 3900, usd: 7200, collection: "Celebration Edit", featured: true, age: "3–12 years", colours: [["Silver", "#c9c9cf"]], sizes: KID, description: "Sparkling sequin bodice with a soft net skirt — made for parties, weddings and every special occasion." },
  { name: "Daisy Embroidered Cardigan", dept: "GIRLS", cat: "knitwear", gbp: 2800, usd: 3600, featured: true, age: "3–12 years", colours: [["Cream", "#efe6d2"], ["Sage", "#b7c4a8"]], sizes: KID, description: "A soft knitted cardigan with daisy embroidery and pearl-effect buttons." },
  { name: "Oliver Linen-Look Shirt", dept: "BOYS", cat: "tops", gbp: 2200, usd: 2900, featured: true, age: "3–12 years", colours: [["Sky", "#a9c4dc"], ["White", "#f5f5f2"]], sizes: KID, description: "A smart short-sleeve shirt with a button-down collar, ideal for weddings and summer events." },
  { name: "Harry Three-Piece Suit Set", dept: "BOYS", cat: "sets", gbp: 6500, usd: 8500, collection: "Celebration Edit", bestseller: true, age: "3–12 years", colours: [["Navy", "#26324a"]], sizes: KID, description: "Jacket, waistcoat and trousers in a tailored fit for page boys and formal occasions." },
  { name: "Jack Chino Trousers", dept: "BOYS", cat: "trousers", gbp: 2000, sale: 1500, usd: 2600, age: "3–12 years", colours: [["Stone", "#cdbf9f"], ["Navy", "#26324a"]], sizes: KID, description: "Classic chinos with an adjustable waist and a smart pressed crease." },
  { name: "Evelyn Wrap Midi Dress", dept: "WOMEN", cat: "dresses", gbp: 8900, usd: 11500, collection: "Autumn Occasion Edit", featured: true, bestseller: true, colours: [["Burgundy", "#7a2e3b"], ["Forest", "#2f4a3a"]], sizes: WOMEN, description: "A flattering wrap midi dress with a tie waist and fluted sleeves. Dress it up for weddings or down with boots." },
  { name: "Isla Satin Slip Skirt", dept: "WOMEN", cat: "skirts-shorts", gbp: 4900, usd: 6400, colours: [["Champagne", "#d9c3a0"], ["Black", "#1c1a17"]], sizes: WOMEN, description: "A bias-cut satin midi skirt with an elasticated waist." },
  { name: "Margot Wool-Blend Coat", dept: "WOMEN", cat: "coats", gbp: 14900, sale: 11900, usd: 19500, collection: "Autumn Occasion Edit", featured: true, colours: [["Camel", "#b8925f"]], sizes: WOMEN, description: "A tailored single-breasted coat with notch lapels and a longline silhouette." },
  { name: "Ava Cable-Knit Jumper", dept: "WOMEN", cat: "knitwear", gbp: 5900, usd: 7700, bestseller: true, colours: [["Oatmeal", "#d8ccb6"], ["Navy", "#26324a"]], sizes: ["XS", "S", "M", "L", "XL"], description: "A relaxed cable-knit jumper with a ribbed crew neck." },
  { name: "Luna Star Pyjama Set", dept: "GIRLS", cat: "nightwear", gbp: 1800, usd: 2400, age: "3–12 years", colours: [["Lilac", "#c7b7d8"]], sizes: KID, description: "Long-sleeve top and bottoms with a star print, designed for cosy nights." },
  { name: "Bunny Knitted Romper", dept: "BABY", cat: "sets", gbp: 2400, usd: 3100, featured: true, bestseller: true, age: "0–24 months", colours: [["Blush", "#e8b4bc"], ["Cream", "#efe6d2"]], sizes: BABY, description: "A soft knitted romper with a bunny motif and popper fastening for easy changes." },
  { name: "Freddie Quilted Jacket", dept: "BABY", cat: "coats", gbp: 3200, sale: 2400, usd: 4200, age: "0–24 months", colours: [["Sage", "#b7c4a8"]], sizes: BABY, description: "A lightweight quilted jacket with a cosy lining and hood." },
  { name: "Poppy Ballet Flats", dept: "GIRLS", cat: "accessories", gbp: 2200, usd: 2900, age: "3–12 years", colours: [["Gold", "#c9a85b"], ["Blush", "#e8b4bc"]], sizes: ["UK 8", "UK 9", "UK 10", "UK 11", "UK 12", "UK 13", "UK 1", "UK 2"], description: "Party ballet flats with a bow trim and padded insole." },
];

function sku(name: string, colour: string, size: string) {
  const base = name.split(" ").map((w) => w[0]).join("").toUpperCase();
  return `FR-${base}-${colour.slice(0, 3).toUpperCase()}-${size.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) in .env before seeding");
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name: "Owner", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    update: { passwordHash: await bcrypt.hash(password, 12), active: true, role: "SUPER_ADMIN" },
  });
  console.log(`Admin account ready: ${email}`);

  for (const [i, [slug, name, description]] of CATEGORIES.entries())
    await prisma.category.upsert({ where: { slug }, create: { slug, name, description, sortOrder: i }, update: {} });

  if ((await prisma.product.count()) > 0) {
    console.log("Products already exist — skipping sample products.");
    return;
  }
  const status = process.env.SEED_PUBLISH_SAMPLES === "1" ? "PUBLISHED" : "DRAFT";
  for (const s of SAMPLES) {
    const cat = await prisma.category.findUniqueOrThrow({ where: { slug: s.cat } });
    await prisma.product.create({
      data: {
        name: s.name,
        slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""),
        description: s.description,
        department: s.dept,
        categoryId: cat.id,
        status,
        priceGBP: s.gbp,
        salePriceGBP: s.sale ?? null,
        priceUSD: s.usd ?? null,
        salePriceUSD: s.sale && s.usd ? Math.round((s.usd * s.sale) / s.gbp) : null,
        collection: s.collection ?? null,
        featured: s.featured ?? false,
        bestseller: s.bestseller ?? false,
        ageRange: s.age ?? null,
        variants: {
          create: s.colours.flatMap(([colour, hex], ci) =>
            s.sizes.map((size, si) => ({ sku: sku(s.name, colour, size), size, colour, colourHex: hex, stock: (si * 3 + ci * 5 + s.gbp) % 13, sortOrder: ci * 100 + si })),
          ),
        },
      },
    });
  }
  console.log(`Created ${SAMPLES.length} sample products as ${status}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
