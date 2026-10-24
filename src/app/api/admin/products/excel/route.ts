// Admin → Products → Excel: download every product (or one status) as an Excel file, or the blank template (?template=1).
import { NextResponse, type NextRequest } from "next/server";
import type { ProductStatus } from "@prisma/client";
import { audit, requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildProductWorkbook } from "@/lib/product-sheet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi("products");
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const template = req.nextUrl.searchParams.get("template") === "1";
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const where = ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(status) ? { status: status as ProductStatus } : {};

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } }),
    template
      ? []
      : prisma.product.findMany({
          where,
          orderBy: [{ department: "asc" }, { name: "asc" }],
          include: {
            category: { select: { name: true } },
            variants: { orderBy: { sortOrder: "asc" }, select: { sku: true, size: true, colour: true, colourHex: true, stock: true } },
            images: { orderBy: { position: "asc" }, select: { url: true, colour: true } },
          },
        }),
  ]);
  const buf = await buildProductWorkbook(products, categories);
  if (!template) await audit(admin.id, "export-excel", "Product", undefined, `${products.length} products`);
  const name = template ? "fashion-rockstar-products-template.xlsx" : `fashion-rockstar-products-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
