"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatIcon, CloseIcon } from "./Icons";

type Msg = { id: string; role: "CUSTOMER" | "ASSISTANT" | "STAFF"; content: string; createdAt: string };
type Session = { id: string; token: string };
type Status = "AI" | "HUMAN" | "CLOSED";

const KEY = "fr_chat_v1";
const URL_RE = /(https?:\/\/[^\s)]+|\/(?:product|shop|search|size-guide|delivery-returns|faq|order-status|contact)[^\s)]*)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target={part.startsWith("http") && !part.startsWith(window.location.origin) ? "_blank" : undefined} rel="noopener noreferrer">
            {part.replace(window.location.origin, "")}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function ChatWidget({ hasPhone }: { hasPhone: boolean }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<Status>("AI");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{ whatsappUrl: string | null; phone: string | null } | null>(null);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "" });
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async (s: Session) => {
    const res = await fetch(`/api/chat?id=${encodeURIComponent(s.id)}&token=${encodeURIComponent(s.token)}`, { cache: "no-store" });
    if (res.status === 404 || res.status === 403) {
      setSession(null);
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
    setStatus(data.status);
  }, []);

  useEffect(() => {
    if (!open || !session) return;
    refresh(session);
    const t = setInterval(() => refresh(session), 5000);
    return () => clearInterval(t);
  }, [open, session, refresh]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "CUSTOMER", content: text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session?.id, token: session?.token, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Message could not be sent");
      if (!session || session.id !== data.id) {
        const s = { id: data.id, token: data.token };
        setSession(s);
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
      }
      setMessages(data.messages);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const requestHuman = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session?.id, token: session?.token, ...contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reach the team");
      if (!session || session.id !== data.id) {
        const s = { id: data.id, token: data.token };
        setSession(s);
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
      }
      setMessages(data.messages);
      setStatus(data.status);
      setHandoff({ whatsappUrl: data.whatsappUrl, phone: data.phone });
      setShowHandoffForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the team");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="chat-launcher" aria-label={open ? "Close chat" : "Chat with us"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
      {open && (
        <section className="chat-panel" aria-label="Customer support chat">
          <header className="chat-head">
            <div style={{ flex: 1 }}>
              <strong>Fashion Rockstar help</strong>
              <span>{status === "HUMAN" ? "You're connected to our team" : "Shopping assistant · AI"}</span>
            </div>
            <button type="button" className="icon-btn" aria-label="Close chat" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body" ref={bodyRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="msg msg-ASSISTANT">
                <span className="msg-label">Assistant</span>
                Hello! I can help you find an outfit, check sizes, or explain delivery and returns. What are you shopping for today?
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`}>
                {m.role !== "CUSTOMER" && <span className="msg-label">{m.role === "STAFF" ? "Fashion Rockstar team" : "Assistant (AI)"}</span>}
                <Linkified text={m.content} />
              </div>
            ))}
            {busy && <div className="typing">{status === "HUMAN" ? "Sending…" : "Assistant is typing…"}</div>}
            {error && <div className="alert alert-error small">{error}</div>}
          </div>

          {handoff && (
            <div className="chat-handoff">
              {handoff.whatsappUrl && (
                <a className="btn btn-sm btn-accent" href={handoff.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Continue on WhatsApp
                </a>
              )}
              {handoff.phone && (
                <a className="btn btn-sm btn-outline" href={`tel:${handoff.phone}`}>Call us</a>
              )}
              <span className="muted" style={{ flexBasis: "100%" }}>Or stay here — our team will reply in this chat.</span>
            </div>
          )}

          {showHandoffForm ? (
            <form className="chat-handoff" onSubmit={requestHuman}>
              <span className="muted" style={{ flexBasis: "100%" }}>Optional: leave your details so we can follow up by email.</span>
              <input className="input" placeholder="Your name" value={contact.name} maxLength={80} onChange={(e) => setContact({ ...contact, name: e.target.value })} style={{ flex: 1 }} />
              <input className="input" type="email" placeholder="Email" value={contact.email} maxLength={120} onChange={(e) => setContact({ ...contact, email: e.target.value })} style={{ flex: 1 }} />
              <button className="btn btn-sm" disabled={busy}>Connect me</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowHandoffForm(false)}>Cancel</button>
            </form>
          ) : (
            status !== "HUMAN" && (
              <div className="chat-handoff">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowHandoffForm(true)} disabled={busy}>
                  Talk to a person
                </button>
                {hasPhone && <span className="muted" style={{ alignSelf: "center" }}>WhatsApp or phone</span>}
              </div>
            )
          )}

          <form className="chat-form" onSubmit={send}>
            <label className="sr-only" htmlFor="chat-input">Message</label>
            <input id="chat-input" className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message…" maxLength={1000} autoComplete="off" />
            <button className="btn btn-sm" disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>
      )}
    </>
  );
}
