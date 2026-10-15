import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("variantId");
  if (!id || id.length > 40) return NextResponse.json({ error: "Missing variant" }, { status: 400 });
  const v = await prisma.variant.findUnique({ where: { id }, select: { stock: true, product: { select: { status: true } } } });
  if (!v || v.product.status !== "PUBLISHED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ stock: Math.max(0, v.stock) });
}
