import Link from "next/link";
import { sendStaffReply, setChatStatus } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { AutoRefresh } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/auth";
import { aiEnabled } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { getSettings, whatsappLink } from "@/lib/settings";

export default async function ChatsAdmin({ searchParams }: { searchParams: Promise<{ id?: string; filter?: string }> }) {
  await requireAdminPage("chats");
  const sp = await searchParams;
  const filter = sp.filter === "all" ? undefined : sp.filter === "ai" ? "AI" : "HUMAN";
  const [list, settings] = await Promise.all([
    prisma.chatConversation.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    getSettings(),
  ]);
  const active = sp.id
    ? await prisma.chatConversation.findUnique({ where: { id: sp.id }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    : null;
  if (active?.unreadByStaff) await prisma.chatConversation.update({ where: { id: active.id }, data: { unreadByStaff: false } });
  const tab = (f: string, label: string) => (
    <Link href={`/admin/chats?filter=${f}`} className={`btn btn-sm ${(sp.filter ?? "human") === f ? "" : "btn-outline"}`}>{label}</Link>
  );

  return (
    <div className="stack">
      <AutoRefresh seconds={8} />
      <h1 style={{ fontSize: "2rem" }}>Customer chats</h1>
      {!aiEnabled() && <div className="alert alert-warning">AI replies are off — set <code>GEMINI_API_KEY</code> to enable the assistant. Customers can still reach your team.</div>}
      {!settings.whatsappNumber && <div className="alert alert-warning">No WhatsApp number set. <Link href="/admin/settings" style={{ textDecoration: "underline" }}>Add it in Site settings</Link> so customers can contact you directly.</div>}
      <div className="row">{tab("human", "Waiting for team")}{tab("ai", "With assistant")}{tab("all", "All")}</div>
      <div className="chat-admin">
        <div className="panel chat-list" style={{ padding: 0, maxHeight: "70vh", overflowY: "auto" }}>
          {list.length === 0 && <p className="muted" style={{ padding: 14 }}>No conversations.</p>}
          {list.map((c) => (
            <Link key={c.id} href={`/admin/chats?filter=${sp.filter ?? "human"}&id=${c.id}`} className={c.id === active?.id ? "active" : undefined}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="small">{c.customerName || c.customerEmail || `Visitor ${c.id.slice(-6).toUpperCase()}`}</strong>
                {c.unreadByStaff && <span className="status status-HUMAN">new</span>}
              </div>
              <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.messages[0]?.content ?? "—"}</div>
              <div className="muted small">{c.updatedAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })} · {c.status.toLowerCase()}</div>
            </Link>
          ))}
        </div>
        <div className="panel">
          {!active ? (
            <p className="muted">Select a conversation to read and reply.</p>
          ) : (
            <div className="stack">
              <div className="row">
                <div>
                  <strong>{active.customerName || "Visitor"}</strong> <span className="muted small">ref {active.id.slice(-8).toUpperCase()}</span>
                  {active.customerEmail && <div className="small"><a href={`mailto:${active.customerEmail}`}>{active.customerEmail}</a></div>}
                </div>
                <span className="spacer" />
                <form action={setChatStatus} className="row">
                  <input type="hidden" name="id" value={active.id} />
                  {active.status !== "AI" && <button className="btn btn-sm btn-outline" name="status" value="AI">Hand back to AI</button>}
                  {active.status !== "HUMAN" && <button className="btn btn-sm btn-outline" name="status" value="HUMAN">Take over</button>}
                  {active.status !== "CLOSED" && <button className="btn btn-sm btn-ghost" name="status" value="CLOSED">Close</button>}
                </form>
              </div>
              <div className="chat-body" style={{ maxHeight: "50vh", borderRadius: 8 }}>
                {active.messages.map((m) => (
                  <div key={m.id} className={`msg msg-${m.role}`} style={m.role === "CUSTOMER" ? { alignSelf: "flex-start", background: "var(--surface-2)", color: "var(--text)" } : { alignSelf: "flex-end" }}>
                    <span className="msg-label">{m.role === "CUSTOMER" ? "Customer" : m.role === "STAFF" ? "Team" : "AI assistant"} · {m.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                    {m.content}
                  </div>
                ))}
              </div>
              <ActionForm action={sendStaffReply} submitLabel="Send reply" resetOnSuccess className="stack">
                <input type="hidden" name="conversationId" value={active.id} />
                <textarea name="content" className="textarea" placeholder="Write a reply — the customer sees it in their chat window" required maxLength={2000} />
              </ActionForm>
              <p className="muted small">Replying takes the conversation over from the AI. {settings.whatsappNumber && whatsappLink(settings.whatsappNumber, "") ? "Customers may also message your WhatsApp with this reference." : ""}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
