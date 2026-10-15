import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(160), consent: z.literal(true) });

export async function POST(req: NextRequest) {
  if (!rateLimit(`nl:${clientIp(req.headers)}`, 5, 60_000)) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email and confirm consent." }, { status: 400 });
  await prisma.newsletterSubscriber.upsert({ where: { email: parsed.data.email }, create: { email: parsed.data.email }, update: {} });
  return NextResponse.json({ ok: true });
}
