import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "../src/lib/catalog";
import { CATEGORIES } from "../src/lib/categories";
import { homeTiles, resolveSectionPath, SECTIONS, sectionPages } from "../src/lib/navigation";

const categorySlugs = new Set(CATEGORIES.map((c) => c.slug));

describe("menu config (src/lib/navigation.ts)", () => {
  it("only links to categories that exist in src/lib/categories.ts", () => {
    for (const s of SECTIONS)
      for (const f of [s.filter, ...sectionPages(s).map((p) => p.filter ?? {})])
        for (const c of f.categories ?? []) expect(categorySlugs, `${s.slug} → ${c}`).toContain(c);
  });
  it("has unique section slugs that don't clash with /shop collections", () => {
    const slugs = SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(Object.keys(COLLECTIONS)).not.toContain(s);
  });
  it("has unique page slugs within each section", () => {
    for (const s of SECTIONS) {
      const slugs = sectionPages(s).map((p) => p.slug);
      expect(new Set(slugs).size, s.slug).toBe(slugs.length);
    }
  });
  it("resolves section and page URLs, layering the page filter over the section's", () => {
    expect(resolveSectionPath(["boys", "tops"])?.filter).toEqual({ department: "BOYS", categories: ["tops"] });
    expect(resolveSectionPath(["footwear", "girls"])?.filter).toEqual({ categories: ["footwear"], department: "GIRLS" });
    expect(resolveSectionPath(["festival-special", "halloween"])?.filter).toEqual({ categories: [], collections: ["Halloween"] });
    expect(resolveSectionPath(["boys", "not-a-page"])).toBeNull();
    expect(resolveSectionPath(["nope"])).toBeNull();
  });
  it("applies admin overrides to homepage tiles and falls back to defaults", () => {
    const tiles = homeTiles({ boys: { image: "/uploads/x.jpg", text: "", button: "" } });
    const boys = tiles.find((t) => t.slug === "boys")!;
    expect(boys.image).toBe("/uploads/x.jpg");
    expect(boys.button).toBe("Shop boys");
    expect(tiles.find((t) => t.slug === "more")!.href).toBe("/shop/more/baby");
  });
});
