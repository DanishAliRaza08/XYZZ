// The master list of product categories. The seed creates every one of these in the database,
// the product importer sorts products into them, and the menu (src/lib/navigation.ts) links to them.
// To add a category: add a line here, run `npm run db:seed`, then link to it from navigation.ts.
// (Categories can also be created in Admin → Categories without touching code.)

export type CategoryDef = { slug: string; name: string; description: string };

export const CATEGORIES: CategoryDef[] = [
  { slug: "tops", name: "Tops & T-shirts", description: "T-shirts, polos, shirts and blouses for every day." },
  { slug: "hoodies", name: "Hoodies & sweatshirts", description: "Cosy hoodies, sweatshirts and zip-throughs." },
  { slug: "dresses", name: "Dresses", description: "Day dresses, party dresses and occasionwear." },
  { slug: "skirts-shorts", name: "Skirts & shorts", description: "Skirts, skorts and shorts for warmer days." },
  { slug: "trousers", name: "Trousers, jeans & leggings", description: "Jeans, joggers, leggings and smart trousers." },
  { slug: "sets", name: "Tracksuits & sets", description: "Tracksuits, co-ords and matching outfit sets." },
  { slug: "coats", name: "Coats & jackets", description: "Puffer coats, raincoats, gilets and jackets." },
  { slug: "knitwear", name: "Knitwear & cardigans", description: "Jumpers and cardigans to layer up." },
  { slug: "partywear", name: "Partywear & suits", description: "Suits, waistcoats and outfits for weddings and parties." },
  { slug: "nightwear", name: "Nightwear & pyjamas", description: "Pyjamas, onesies, nighties and dressing gowns." },
  { slug: "underwear-socks", name: "Underwear & socks", description: "Multipacks of underwear, vests and socks." },
  { slug: "swimwear", name: "Swimwear", description: "Swimsuits, swim shorts and beachwear." },
  { slug: "baby-essentials", name: "Bodysuits & sleepsuits", description: "Soft everyday basics for babies, newborn to 24 months." },
  { slug: "school-uniform", name: "School uniform", description: "Polo shirts, jumpers, trousers, skirts and pinafores for school." },
  { slug: "stationery", name: "School bags & stationery", description: "Backpacks, lunch bags, pencil cases and stationery sets." },
  { slug: "footwear", name: "Shoes, trainers & slippers", description: "Trainers, school shoes, boots, sandals and slippers." },
  { slug: "accessories", name: "Hats, bags & accessories", description: "Hats, gloves, scarves, hair accessories and bags." },
  { slug: "costumes", name: "Fancy dress & costumes", description: "Costumes for Halloween, World Book Day and dress-up." },
  { slug: "festive-wear", name: "Festive & traditional wear", description: "Outfits for Christmas, Eid, Diwali and family celebrations." },
  { slug: "more-styles", name: "More styles", description: "Everything else we stock." },
];

export const CATEGORY_NAMES: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));
