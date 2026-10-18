// Builds the header menu from SECTIONS (src/lib/navigation.ts). For department sections it also adds
// any category that has published products there but isn't in the menu yet, under "More in <Section>",
// so categories created in Admin → Categories appear in the dropdown without code changes.
import { DEPARTMENTS, getCatalog } from "./catalog";
import { SALE_LINK, SECTIONS, sectionHref, type NavItem } from "./navigation";

export async function buildNav(): Promise<NavItem[]> {
  // One entry per department + category that has published products (from the cached catalogue).
  const rows = [...new Map((await getCatalog()).products.map((p) => [`${p.department}|${p.categoryId}`, p])).values()];

  const items: NavItem[] = SECTIONS.map((section) => {
    const columns = section.columns.map((col) => ({
      title: col.title,
      links: [...(col.pages ?? []).map((p) => ({ label: p.label, href: sectionHref(section, p) })), ...(col.links ?? [])],
    }));
    if (section.autoCategories && section.filter.department) {
      const listed = new Set(section.columns.flatMap((c) => c.pages ?? []).flatMap((p) => p.filter?.categories ?? []));
      const dept = DEPARTMENTS.find((d) => d.value === section.filter.department)!;
      const extra = rows
        .filter((r) => r.department === section.filter.department && !listed.has(r.category.slug))
        .map((r) => r.category)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((c) => ({ label: c.name, href: `/shop/${dept.slug}/${c.slug}` }));
      if (extra.length) columns.push({ title: `More in ${section.label}`, links: extra });
    }
    return { label: section.label, href: sectionHref(section), description: section.description, columns, promo: section.promo };
  });
  items.push({ ...SALE_LINK, sale: true });
  return items;
}
