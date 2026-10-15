import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateAssistantReply } from "@/lib/chat";
import { conversationPayload, loadConversation, newVisitorToken } from "@/lib/chat-store";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const conv = await loadConversation(req.nextUrl.searchParams.get("id"), req.nextUrl.searchParams.get("token"));
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payload = await conversationPayload(conv.id);
  return NextResponse.json({ ...payload, token: undefined });
}

const PostBody = z.object({
  id: z.string().max(40).optional().nullable(),
  token: z.string().max(64).optional().nullable(),
  message: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`chat:${clientIp(req.headers)}`, 20, 60_000))
    return NextResponse.json({ error: "You're sending messages too quickly. Please wait a moment." }, { status: 429 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter a message (up to 1000 characters)." }, { status: 400 });
  const { id, token, message } = parsed.data;

  let conv = id && token ? await loadConversation(id, token) : null;
  if (!conv) conv = await prisma.chatConversation.create({ data: { visitorToken: newVisitorToken() } });

  await prisma.chatMessage.create({ data: { conversationId: conv.id, role: "CUSTOMER", content: message } });

  if (conv.status !== "HUMAN") {
    // A closed conversation reopens with the assistant.
    const reply = await generateAssistantReply(conv.id);
    await prisma.chatMessage.create({ data: { conversationId: conv.id, role: "ASSISTANT", content: reply.text } });
    await prisma.chatConversation.update({ where: { id: conv.id }, data: { status: "AI" } });
  } else {
    // A person is handling this conversation: notify staff instead of answering automatically.
    await prisma.chatConversation.update({ where: { id: conv.id }, data: { unreadByStaff: true } });
  }

  return NextResponse.json(await conversationPayload(conv.id));
}
