import { NextResponse, type NextRequest } from "next/server";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { resolvePrice } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  const slugs = (req.nextUrl.searchParams.get("slugs") ?? "").split(",").filter(Boolean).slice(0, 100);
  const currency = await getCurrency();
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, status: "PUBLISHED" },
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
  });
  return NextResponse.json({
    items: products.map((p) => {
      const price = resolvePrice(p, currency);
      return { slug: p.slug, name: p.name, image: p.images[0]?.url ?? null, price: price ? formatMoney(price.price, currency) : "Unavailable" };
    }),
  });
}
