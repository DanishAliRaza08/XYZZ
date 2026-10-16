import { describe, expect, it } from "vitest";
import { category, collection, colourHex, department, htmlToText } from "../scripts/import-shopify";
import { accentVars, isLive, parseBanners } from "../src/lib/events";

describe("product import mapping", () => {
  it("picks a department from the title and tags", () => {
    expect(department(" girls unicorn hoodie ")).toBe("GIRLS");
    expect(department(" boys football tracksuit ")).toBe("BOYS");
    expect(department(" baby sleepsuit 0-3m ")).toBe("BABY");
    expect(department(" womens wrap midi dress ")).toBe("WOMEN");
    expect(department(" mens lounge pyjamas ")).toBe("MEN");
  });
  it("maps product types to categories", () => {
    expect(category(" kids witch costume ")).toBe("costumes");
    expect(category(" school pinafore dress ")).toBe("school-uniform");
    expect(category(" christmas pyjamas ")).toBe("nightwear");
    expect(category(" something unusual ")).toBe("more-styles");
  });
  it("tags seasonal products so events can show them", () => {
    expect(collection(" spooky skeleton onesie ")).toBe("Halloween");
    expect(collection(" xmas jumper ")).toBe("Christmas");
    expect(collection(" plain t-shirt ")).toBeNull();
  });
  it("matches colour names as whole words", () => {
    expect(colourHex("Navy")).toBe("#26324a");
    expect(colourHex("As pictured")).toBe("#cccccc");
  });
  it("turns product HTML into plain text", () => {
    expect(htmlToText("<p>Soft &amp; warm</p><ul><li>Cotton</li></ul>")).toBe("Soft & warm\n• Cotton");
  });
});

describe("seasonal events", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("is live only when switched on and inside its dates", () => {
    expect(isLive({ active: true, startsAt: new Date("2026-10-01"), endsAt: new Date("2026-10-31") }, now)).toBe(true);
    expect(isLive({ active: false, startsAt: null, endsAt: null }, now)).toBe(false);
    expect(isLive({ active: true, startsAt: new Date("2026-11-15"), endsAt: null }, now)).toBe(false);
  });
  it("drops promo tiles with unsafe images or off-site links", () => {
    expect(
      parseBanners([
        { image: "/uploads/a.png", title: "Ok", href: "/shop/sale" },
        { image: "javascript:alert(1)", title: "Bad", href: "" },
        { image: "//evil.example/x.png", title: "Bad", href: "" },
        { image: "/uploads/b.png", title: "Bad link", href: "https://evil.example" },
        "nonsense",
      ]),
    ).toEqual([{ image: "/uploads/a.png", title: "Ok", href: "/shop/sale" }]);
  });
  it("only accepts hex accent colours and picks readable text", () => {
    expect(accentVars("red;}body{display:none")).toBeUndefined();
    expect(accentVars("#2b59c3")?.["--accent-contrast"]).toBe("#ffffff");
    expect(accentVars("#ffe066")?.["--accent-contrast"]).toBe("#1c1a17");
  });
});
