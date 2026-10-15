import crypto from "node:crypto";
import { prisma } from "./db";

export function newVisitorToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function loadConversation(id: unknown, token: unknown) {
  if (typeof id !== "string" || typeof token !== "string" || id.length > 40 || token.length > 64) return null;
  const conv = await prisma.chatConversation.findUnique({ where: { id } });
  if (!conv) return null;
  const a = Buffer.from(conv.visitorToken);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return conv;
}

export async function conversationPayload(id: string) {
  const conv = await prisma.chatConversation.findUniqueOrThrow({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  return {
    id: conv.id,
    token: conv.visitorToken,
    status: conv.status,
    messages: conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
  };
}
