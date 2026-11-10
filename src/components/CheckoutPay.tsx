"use client";

// Checkout step 2, on its own page (/checkout/pay). Step 1 (/checkout, CheckoutView) creates the order and keeps
// what this page needs — the payment's client secret, the order summary and the delivery details — in the tab's
// sessionStorage, then opens this page. Reloading keeps it; another tab or a cleared session goes back to step 1.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { Quote } from "@/lib/quote";
import { CardPayment, type BillingDetails } from "./CardPayment";
import { Summary } from "./OrderSummary";

export type PendingPayment = {
  clientSecret: string;
  customerSessionClientSecret: string | null;
  orderNumber: string;
  total: number;
  quote: Quote;
  billing: BillingDetails;
  method: "standard" | "express";
};

const PAYMENT_KEY = "fr_checkout_payment_v1";
export const DETAILS_KEY = "fr_checkout_details_v1";

export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function writeSession(key: string, value: unknown) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the payment page then asks to start again
  }
}
export const readPendingPayment = () => readSession<PendingPayment>(PAYMENT_KEY);
export const savePendingPayment = (p: PendingPayment | null) => writeSession(PAYMENT_KEY, p);

/** Cancels an unpaid order so a new one can be made. Returns "paid" if it was already paid. */
export async function cancelPendingPayment(p: PendingPayment): Promise<"ok" | "paid" | "error"> {
  const res = await fetch("/api/checkout/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderNumber: p.orderNumber, clientSecret: p.clientSecret }),
  }).catch(() => null);
  if (res?.status === 409) return "paid";
  if (!res?.ok) return "error";
  savePendingPayment(null);
  return "ok";
}

/** Details → Payment → Done. */
export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Details", "Payment", "Done"];
  return (
    <ol className="checkout-steps" aria-label="Checkout steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "";
        return (
          <li key={label} className={state} aria-current={n === current ? "step" : undefined}>
            <span className="num">{n < current ? "✓" : n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function PayView({ publishableKey }: { publishableKey: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingPayment | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPending(readPendingPayment()), []);

  if (pending === undefined) return <p className="muted" style={{ padding: "40px 0" }}>Loading payment…</p>;
  if (!pending || !publishableKey)
    return (
      <div className="empty" style={{ margin: "30px 0 60px" }}>
        <h2>Nothing to pay yet</h2>
        <p className="muted">Enter your delivery details first, then you&apos;ll come back here to pay.</p>
        <Link href="/checkout" className="btn">Go to checkout</Link>
      </div>
    );

  const c = pending.quote.currency as CurrencyCode;
  const { billing } = pending;
  // Back to step 1: cancels the unpaid order so a new one is made with the edited details.
  const editDetails = async () => {
    setBusy(true);
    setError(null);
    const r = await cancelPendingPayment(pending);
    setBusy(false);
    if (r === "paid") return setError("This order has already been paid. Check your email or track your order.");
    if (r === "error") return setError("Couldn't go back — check your connection and try again.");
    router.push("/checkout");
  };

  return (
    <div className="two-col">
      <div className="stack">
        <section className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Delivery</h3>
            <button type="button" className="btn btn-sm btn-ghost" onClick={editDetails} disabled={busy}>{busy ? "Please wait…" : "Edit details"}</button>
          </div>
          <p className="small" style={{ margin: 0 }}>
            <strong>{billing.name}</strong><br />
            {[billing.address.line1, billing.address.line2, billing.address.city, billing.address.state, billing.address.postal_code].filter(Boolean).join(", ")}<br />
            <span className="muted">{billing.email}{billing.phone ? ` · ${billing.phone}` : ""}</span>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            {pending.quote.ownDeliveryOnly
              ? `Delivery · ${[...new Set(pending.quote.lines.map((l) => l.deliveryTime))].join(" / ")}`
              : pending.method === "express" ? "Express delivery · 1–2 working days" : "Standard delivery · 3–5 working days"}
          </p>
          {!pending.quote.ownDeliveryOnly && pending.quote.lines.filter((l) => l.deliveryTime).map((l) => (
            <p key={l.variantId} className="small" style={{ margin: 0 }}>🚚 {l.productName}: {l.deliveryTime}</p>
          ))}
        </section>
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>Pay by card</h3>
          <p className="muted small" style={{ margin: 0 }}>Order {pending.orderNumber}</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <CardPayment
            publishableKey={publishableKey}
            clientSecret={pending.clientSecret}
            customerSessionClientSecret={pending.customerSessionClientSecret}
            orderNumber={pending.orderNumber}
            amountLabel={formatMoney(pending.total, c)}
            billing={billing}
          />
          <p className="muted small center" style={{ margin: 0 }}>🔒 Card payments are processed securely by Stripe. We never see or store your card details.</p>
        </section>
      </div>
      <aside className="stack">
        <div className="panel">
          {pending.quote.lines.map((l) => (
            <div key={l.variantId} className="summary-row small">
              <span>{l.quantity} × {l.productName} <span className="muted">({l.colour}, {l.size})</span></span>
              <span>{formatMoney(l.lineTotal, c)}</span>
            </div>
          ))}
        </div>
        <Summary quote={{ ...pending.quote, total: pending.total }} />
      </aside>
    </div>
  );
}
