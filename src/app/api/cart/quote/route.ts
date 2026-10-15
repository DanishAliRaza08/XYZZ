import { NextResponse, type NextRequest } from "next/server";
import { QuoteRequest } from "@/lib/checkout-schema";
import { getCurrency } from "@/lib/currency-server";
import { buildQuote } from "@/lib/quote";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const parsed = QuoteRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid bag" }, { status: 400 });
  const [currency, settings] = await Promise.all([getCurrency(), getSettings()]);
  const quote = await buildQuote({ ...parsed.data, currency, rates: settings.shipping });
  return NextResponse.json(quote);
}
