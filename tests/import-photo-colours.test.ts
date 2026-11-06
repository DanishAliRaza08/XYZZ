// Shopify import: each photo is linked to its colour, and every colour keeps a photo.
import { describe, expect, it } from "vitest";
import { mapShopifyProduct, pickPhotos, type ShopifyProduct } from "@/lib/shopify-import";

const v = (id: number, size: string, colour: string, extra: Partial<ShopifyProduct["variants"][number]> = {}) => ({
  id, title: `${size} / ${colour}`, sku: null, price: "10.99", compare_at_price: null, available: true, option1: size, option2: colour, option3: null, ...extra,
});

const product: ShopifyProduct = {
  id: 7, title: "Kids Christmas Jumper", handle: "kids-christmas-jumper", body_html: "<p>Warm knitted jumper.</p>", vendor: "x", product_type: "Jumper", tags: [],
  options: [{ name: "Size", position: 1 }, { name: "Colour", position: 2 }],
  variants: [v(1, "3-4y", "Navy"), v(2, "5-6y", "Navy"), v(3, "3-4y", "Red", { featured_image: { src: "https://cdn.shopify.com/red.jpg?v=2" } }), v(4, "3-4y", "Green"), v(5, "3-4y", "Cream")],
  images: [
    { src: "https://cdn.shopify.com/both.jpg", variant_ids: [] },
    { src: "https://cdn.shopify.com/navy.jpg", variant_ids: [1, 2] },
    { src: "https://cdn.shopify.com/red.jpg?v=1", variant_ids: [] },
    { src: "https://cdn.shopify.com/mixed.jpg", variant_ids: [1, 3] },
    { src: "https://cdn.shopify.com/a.jpg", alt: "Christmas jumper in green" },
    { src: "https://cdn.shopify.com/b.jpg", alt: "Back view" },
    { src: "https://cdn.shopify.com/cream.jpg", variant_ids: [5] },
  ],
};

describe("photo colours", () => {
  it("links photos to colours from the shop's variant links, featured images and photo descriptions", () => {
    const mapped = mapShopifyProduct(product, { source: "https://shop.example", defaultStock: 5, usdRate: 0 }, new Set(), new Set())!;
    expect(mapped.photos.map((p) => [p.src.split("/").pop(), p.colour])).toEqual([
      ["both.jpg", null],
      ["navy.jpg", "Navy"],
      ["red.jpg?v=1", "Red"],
      ["mixed.jpg", null], // two colours: suits both
      ["a.jpg", "Green"],
      ["b.jpg", null],
      ["cream.jpg", "Cream"],
    ]);
  });

  it("keeps a photo for every colour even past the photo limit", () => {
    const mapped = mapShopifyProduct(product, { source: "https://shop.example", defaultStock: 5, usdRate: 0 }, new Set(), new Set())!;
    expect(pickPhotos(mapped.photos, 2).map((p) => p.colour)).toEqual([null, "Navy", "Red", "Green", "Cream"]);
    expect(pickPhotos(mapped.photos, 0).map((p) => p.colour)).toEqual(["Navy", "Red", "Green", "Cream"]);
  });
});
