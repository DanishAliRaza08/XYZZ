// Admin → Menu: checking an edited menu before it's saved. The menu is saved as JSON in the Setting table
// under MENU_KEY and read back by getSections (src/lib/navigation-server.ts). No database imports here.
import { z } from "zod";
import type { Section } from "./navigation";

export const MENU_KEY = "menu";

// Addresses already used by other shop pages (/shop/sale etc.), so a menu item can't take them.
export const RESERVED_SLUGS = ["new-arrivals", "bestsellers", "sale", "all"];

const DEPARTMENTS = ["WOMEN", "MEN", "GIRLS", "BOYS", "BABY"] as const;
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use only letters, numbers and dashes").max(60);
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional().transform((v) => v || undefined);
const sitePath = z.string().trim().max(300).refine((h) => /^\/(?!\/)/.test(h) || /^https:\/\//.test(h), "links must start with / (a page of the shop) or https://");
const image = z.string().trim().max(500).refine((h) => /^\/(?!\/)/.test(h) || /^https:\/\//.test(h), "pictures must be uploaded or an https:// address");

const filter = z
  .object({
    department: z.enum(DEPARTMENTS).optional().or(z.literal("").transform(() => undefined)),
    categories: z.array(slug).max(50).optional(),
    collections: z.array(text(60)).max(20).optional(),
  })
  .transform((f) => ({
    ...(f.department ? { department: f.department } : {}),
    ...(f.categories?.length ? { categories: [...new Set(f.categories)] } : {}),
    ...(f.collections?.filter(Boolean).length ? { collections: [...new Set(f.collections.filter(Boolean))] } : {}),
  }));

const page = z.object({ slug, label: text(60).min(1, "every page needs a name"), description: optText(300), filter: filter.optional() });
const link = z.object({ label: text(60).min(1, "every link needs a name"), href: sitePath });
const column = z.object({ title: text(60), pages: z.array(page).max(40).optional(), links: z.array(link).max(20).optional() });
const promo = z.object({ title: text(60), text: text(200), href: z.string().trim().max(300), cta: text(40) });
const tile = z.object({ title: optText(60), text: optText(200), href: optText(300), image: image.or(z.literal("")), button: text(40) });

const section = z.object({
  slug,
  label: text(40).min(1, "every menu item needs a name"),
  description: text(300),
  filter: filter.default({}),
  columns: z.array(column).max(6).default([]),
  promo: promo.optional(),
  tile: tile.optional(),
  autoCategories: z.boolean().optional(),
});

const menu = z.array(section).min(1, "the menu needs at least one item").max(15, "the menu can have up to 15 items");

/** Checks an edited menu. Returns the cleaned-up menu, or a message saying what to fix. */
export function parseMenu(input: unknown): { sections: Section[] } | { error: string } {
  const r = menu.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = describePath(input, issue.path);
    return { error: `${where}${issue.message}` };
  }
  const sections = r.data.map((s) => {
    const columns = s.columns
      .map((c) => ({ title: c.title, ...(c.pages?.length ? { pages: c.pages } : {}), ...(c.links?.length ? { links: c.links } : {}) }))
      .filter((c) => c.pages || c.links);
    const out: Section = { slug: s.slug, label: s.label, description: s.description, filter: s.filter, columns };
    // A promo box needs a title and a link; otherwise it's left out.
    if (s.promo?.title && s.promo.href) {
      if (!/^\/(?!\/)/.test(s.promo.href) && !/^https:\/\//.test(s.promo.href)) return { error: `${s.label}: the promo link must start with / or https://` };
      out.promo = { ...s.promo, cta: s.promo.cta || "Shop now" };
    }
    if (s.tile) out.tile = { ...s.tile, image: s.tile.image || "/images/departments/festival.svg", button: s.tile.button || `Shop ${s.label.toLowerCase()}` };
    if (s.autoCategories && s.filter.department) out.autoCategories = true;
    return out;
  });
  const bad = sections.find((s): s is { error: string } => "error" in s);
  if (bad) return bad;
  const ok = sections as Section[];

  const seen = new Set<string>();
  for (const s of ok) {
    if (RESERVED_SLUGS.includes(s.slug)) return { error: `${s.label}: the web address "${s.slug}" is used by another shop page — choose another` };
    if (seen.has(s.slug)) return { error: `Two menu items have the web address "${s.slug}" — each needs its own` };
    seen.add(s.slug);
    const pages = new Set<string>();
    for (const p of s.columns.flatMap((c) => c.pages ?? [])) {
      if (pages.has(p.slug)) return { error: `${s.label}: two pages have the web address "${p.slug}" — each needs its own` };
      pages.add(p.slug);
    }
  }
  return { sections: ok };
}

/** "Girls → Clothing → page 3: " for an error, from the path zod reports. */
function describePath(input: unknown, path: PropertyKey[]): string {
  const sections = Array.isArray(input) ? (input as { label?: string; columns?: { title?: string; pages?: { label?: string }[] }[] }[]) : [];
  const [si, , ci, kind, pi] = path as (string | number)[];
  const sec = typeof si === "number" ? sections[si] : undefined;
  if (!sec) return "";
  const parts = [sec.label || `Menu item ${Number(si) + 1}`];
  const col = typeof ci === "number" ? sec.columns?.[ci] : undefined;
  if (col) parts.push(col.title || `column ${Number(ci) + 1}`);
  if (col && kind === "pages" && typeof pi === "number") parts.push(col.pages?.[pi]?.label || `page ${pi + 1}`);
  return `${parts.join(" → ")}: `;
}
