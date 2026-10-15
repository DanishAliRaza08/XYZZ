"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "ok" | "error"; msg?: string }>({ kind: "idle" });

  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!consent) return setState({ kind: "error", msg: "Please confirm you'd like to receive marketing emails." });
          const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent }) });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setState({ kind: "ok", msg: "Thank you — you're on the list." });
            setEmail("");
          } else setState({ kind: "error", msg: data.error ?? "Something went wrong. Please try again." });
        }}
      >
        <label className="sr-only" htmlFor="nl-email">Email address</label>
        <input id="nl-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" />
        <button className="btn">Sign up</button>
      </form>
      <label className="checkbox small" style={{ justifyContent: "center", marginTop: 10 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        I'd like to receive marketing emails. See our <a href="/privacy" style={{ textDecoration: "underline" }}>privacy policy</a>.
      </label>
      {state.kind !== "idle" && (
        <p role="status" className={`small ${state.kind === "ok" ? "" : "field-error"}`} style={{ marginTop: 8 }}>{state.msg}</p>
      )}
    </>
  );
}
