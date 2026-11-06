// Admin → Menu: checking an edited menu before it's saved, and the menu helpers using an edited menu.
import { describe, expect, it } from "vitest";
import { parseMenu } from "@/lib/menu";
import { SECTIONS, menuPlacesFor, resolveSectionPath, type Section } from "@/lib/navigation";

const clone = (): Section[] => JSON.parse(JSON.stringify(SECTIONS));

describe("parseMenu", () => {
  it("accepts the starting menu unchanged", () => {
    const r = parseMenu(clone());
    expect("sections" in r && r.sections.map((s) => s.slug)).toEqual(SECTIONS.map((s) => s.slug));
    if ("sections" in r) expect(r.sections[0].columns[0].pages?.[0]).toEqual({ slug: "tops", label: "T-shirts & tops", description: SECTIONS[0].columns[0].pages![0].description, filter: { categories: ["tops"] } });
  });

  it("adds a new menu item with a page, and drops empty columns and the editor's helper fields", () => {
    const menu = [
      ...clone(),
      { slug: "teens", label: "Teens", description: "", filter: { categories: ["tops", "hoodies"] }, _auto: true, columns: [{ title: "", pages: [] }, { title: "Clothing", pages: [{ slug: "tees", label: "Tees", filter: { categories: ["tops"], collections: [" "] }, _auto: false }] }] },
    ];
    const r = parseMenu(menu);
    expect(r).not.toHaveProperty("error");
    const teens = "sections" in r ? r.sections.at(-1) : null;
    expect(teens).toEqual({ slug: "teens", label: "Teens", description: "", filter: { categories: ["tops", "hoodies"] }, columns: [{ title: "Clothing", pages: [{ slug: "tees", label: "Tees", filter: { categories: ["tops"] } }] }] });
    expect(resolveSectionPath(["teens", "tees"], "sections" in r ? r.sections : [])).toMatchObject({ filter: { categories: ["tops"] } });
    expect(menuPlacesFor({ department: "GIRLS", categorySlug: "tops" }, "sections" in r ? r.sections : []).map((p) => p.label)).toContain("Teens → Tees");
  });

  it("explains what to fix", () => {
    const err = (m: unknown) => ("error" in parseMenu(m) ? (parseMenu(m) as { error: string }).error : "ok");
    expect(err([])).toMatch(/at least one item/);
    const dup = clone();
    dup[1].slug = "boys";
    expect(err(dup)).toMatch(/Two menu items have the web address "boys"/);
    const reserved = clone();
    reserved[0].slug = "sale";
    expect(err(reserved)).toMatch(/used by another shop page/);
    const badLink = clone();
    badLink[4].columns[1].links = [{ label: "Evil", href: "javascript:alert(1)" }];
    expect(err(badLink)).toMatch(/School & Stationery → Bags & stationery: links must start with/);
    const noName = clone();
    noName[1].columns[0].pages![2].label = "";
    expect(err(noName)).toMatch(/Girls → Clothing → page 3: every page needs a name/);
    const twoPages = clone();
    twoPages[1].columns[1].pages![0].slug = "dresses";
    expect(err(twoPages)).toMatch(/Girls: two pages have the web address "dresses"/);
    const badSlug = clone();
    badSlug[0].slug = "Boys Stuff!";
    expect(err(badSlug)).toMatch(/letters, numbers and dashes/);
  });
});
