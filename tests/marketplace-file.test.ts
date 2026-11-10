// Amazon / TikTok Shop exports uploaded in Admin → Products → Excel: grouped into products and checked.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { planSheetImport, readProductSheet, type Snapshot } from "@/lib/product-sheet";

const snap: Snapshot = {
  categories: [{ id: "c-dress", slug: "dresses", name: "Dresses" }, { id: "c-knit", slug: "knitwear", name: "Knitwear" }, { id: "c-more", slug: "more-styles", name: "More styles" }, { id: "c-fest", slug: "festive-wear", name: "Festive" }, { id: "c-party", slug: "partywear", name: "Partywear" }],
  products: [],
  skus: [],
};

const tsv = (rows: string[][]) => Buffer.from(rows.map((r) => r.join("\t")).join("\n"));

describe("Amazon report (.txt, tab-separated)", () => {
  const file = tsv([
    ["TemplateType=fptcustom", "Version=2024.1", "", "", "", "", "", "", "", "", "", ""],
    ["Seller SKU", "Product Name", "Parentage", "Parent SKU", "Size", "Colour", "Standard Price", "Quantity", "Main Image URL", "Other Image URL1", "Product Description", "Bullet Point"],
    ["item_sku", "item_name", "parent_child", "parent_sku", "size_name", "color_name", "standard_price", "quantity", "main_image_url", "other_image_url1", "product_description", "bullet_point1"],
    ["FR-DRESS", "Fashion Rockstar Girls Party Dress", "parent", "", "", "", "", "", "https://m.media-amazon.com/images/I/main.jpg", "", "Sparkly <b>party</b> dress.<br>Fully lined.", "Machine washable"],
    ["FR-DRESS-PK-34", "Fashion Rockstar Girls Party Dress Pink 3-4 Years", "child", "FR-DRESS", "3-4 Years", "Pink", "14.99", "5", "https://m.media-amazon.com/images/I/pink.jpg", "", "", ""],
    ["FR-DRESS-PK-56", "Fashion Rockstar Girls Party Dress Pink 5-6 Years", "child", "FR-DRESS", "5-6 Years", "Pink", "15.99", "", "http://m.media-amazon.com/images/I/pink.jpg", "", "", ""],
    ["FR-DRESS-GD-34", "Fashion Rockstar Girls Party Dress Gold 3-4 Years", "child", "FR-DRESS", "3-4 Years", "Gold", "14.99", "2", "https://m.media-amazon.com/images/I/gold.jpg", "https://m.media-amazon.com/images/I/gold-back.jpg", "", ""],
    ["FR-HAT", "Fashion Rockstar Kids Bobble Hat", "", "", "", "", "6.50", "12", "https://m.media-amazon.com/images/I/hat.jpg", "", "Warm hat.", ""],
  ]);

  it("groups variations under their parent with prices, stock, colour photos and description", async () => {
    const sheet = await readProductSheet(file, "Category+Listings+Report.txt");
    expect(sheet.source).toBe("Amazon");
    expect(sheet.notes?.[0]).toMatch(/1 size had no stock number/);
    const plan = planSheetImport(sheet, snap, { defaultStatus: "DRAFT" });
    expect(plan.errors.map((e) => `${e.row}: ${e.message}`)).toEqual([]);
    expect(plan.items.map((p) => p.name)).toEqual(["Fashion Rockstar Girls Party Dress", "Fashion Rockstar Kids Bobble Hat"]);

    const dress = plan.items[0];
    expect(dress.data).toMatchObject({ department: "GIRLS", categoryId: "c-party", priceGBP: 1599, status: "DRAFT", description: "Sparkly party dress.\nFully lined.\n\n• Machine washable" });
    expect(dress.variants.map((v) => [v.sku, v.size, v.colour, v.stock])).toEqual([
      ["FR-DRESS-PK-34", "3-4 Years", "Pink", 5],
      ["FR-DRESS-PK-56", "5-6 Years", "Pink", 0],
      ["FR-DRESS-GD-34", "3-4 Years", "Gold", 2],
    ]);
    expect(dress.photos).toEqual([
      { url: "https://m.media-amazon.com/images/I/main.jpg", colour: null },
      { url: "https://m.media-amazon.com/images/I/pink.jpg", colour: "Pink" },
      { url: "https://m.media-amazon.com/images/I/gold.jpg", colour: "Gold" },
      { url: "https://m.media-amazon.com/images/I/gold-back.jpg", colour: "Gold" },
    ]);

    const hat = plan.items[1];
    expect(hat.variants).toEqual([expect.objectContaining({ sku: "FR-HAT", size: "One size", colour: "One colour", stock: 12 })]);
    expect(hat.data).toMatchObject({ priceGBP: 650, categoryId: "c-more" }); // "accessories" isn't in this shop: More styles
  });
});

describe("TikTok Shop export (.xlsx)", () => {
  it("reads variation name/value pairs and groups by product ID", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Template");
    ws.addRow(["Product ID", "Product Name", "Product Description", "Category", "Main Image", "Image 2", "Variation 1 Name", "Variation 1 Value", "Variation 2 Name", "Variation 2 Value", "SKU ID", "Seller SKU", "Price", "Quantity"]);
    ws.addRow(["17290001", "Kids Christmas Jumper", "Festive knit", "Kidswear/Knitwear", "https://p16.tiktokcdn.com/a.jpg", "", "Color", "Red", "Size", "3-4Y", "1729-1", "TT-RED-34", "£12.99", 4]);
    ws.addRow(["17290001", "Kids Christmas Jumper", "Festive knit", "Kidswear/Knitwear", "https://p16.tiktokcdn.com/navy.jpg", "", "Color", "Navy", "Size", "3-4Y", "1729-2", "TT-NAVY-34", "£12.99", 0]);
    const sheet = await readProductSheet(Buffer.from(await wb.xlsx.writeBuffer()), "tiktok-products.xlsx");
    expect(sheet.source).toBe("TikTok Shop");
    const plan = planSheetImport(sheet, snap, { defaultStatus: "DRAFT" });
    expect(plan.errors).toEqual([]);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].variants.map((v) => [v.sku, v.size, v.colour, v.stock])).toEqual([["TT-RED-34", "3-4Y", "Red", 4], ["TT-NAVY-34", "3-4Y", "Navy", 0]]);
    expect(plan.items[0].data).toMatchObject({ priceGBP: 1299, categoryId: "c-fest" });
    expect(plan.items[0].photos?.map((p) => p.colour)).toEqual(["Red", "Navy"]);
  });
});

describe("other files", () => {
  it("explains old Excel files, and still refuses sheets that aren't products", async () => {
    await expect(readProductSheet(Buffer.from("x"), "report.xls")).rejects.toThrow(/save or download it as \.xlsx/);
    await expect(readProductSheet(tsv([["Order", "Customer", "Total"], ["1", "Ann", "5"]]), "orders.txt")).rejects.toThrow(/doesn't look like a product sheet/);
  });
});
