import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { conversationPayload, loadConversation, newVisitorToken } from "@/lib/chat-store";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSettings, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  id: z.string().max(40).optional().nullable(),
  token: z.string().max(64).optional().nullable(),
  name: z.string().trim().max(80).optional().default(""),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional().default(""),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`handoff:${clientIp(req.headers)}`, 5, 60_000))
    return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
  const { id, token, name, email } = parsed.data;

  let conv = id && token ? await loadConversation(id, token) : null;
  if (!conv) conv = await prisma.chatConversation.create({ data: { visitorToken: newVisitorToken() } });

  const settings = await getSettings();
  const ref = conv.id.slice(-8).toUpperCase();
  await prisma.$transaction([
    prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        status: "HUMAN",
        unreadByStaff: true,
        customerName: name || conv.customerName,
        customerEmail: email || conv.customerEmail,
      },
    }),
    prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        role: "ASSISTANT",
        content: `I've passed this conversation to our customer service team (reference ${ref}). A team member will reply here as soon as possible${
          settings.whatsappNumber ? ", or you can message us directly on WhatsApp using the button below" : ""
        }.`,
      },
    }),
  ]);

  const greeting = `Hello Fashion Rockstar, I'd like some help${name ? ` — my name is ${name}` : ""}. Chat reference: ${ref}`;
  return NextResponse.json({
    ...(await conversationPayload(conv.id)),
    whatsappUrl: whatsappLink(settings.whatsappNumber, greeting),
    phone: settings.supportPhone || null,
  });
}
