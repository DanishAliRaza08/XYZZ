"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { Quote } from "@/lib/quote";
import { CardPayment } from "./CardPayment";
import { ProductArtClient } from "./ProductArtClient";
import { useStore } from "./StoreProvider";

function useQuote(shippingMethod: "standard" | "express", discountCode: string | null) {
  const { bag, ready } = useStore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(bag);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: bag, shippingMethod, discountCode }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load your bag"))))
      .then((q: Quote) => {
        setQuote(q);
        setError(null);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, shippingMethod, discountCode]);

  return { quote, loading: loading || !ready, error };
}

function Summary({ quote, children }: { quote: Quote; children?: React.ReactNode }) {
  const c = quote.currency as CurrencyCode;
  return (
    <div className="panel">
      <h3>Order summary</h3>
      <div className="summary-row"><span>Subtotal</span><span>{formatMoney(quote.subtotal, c)}</span></div>
      {quote.discount > 0 && (
        <div className="summary-row" style={{ color: "var(--success)" }}><span>Discount ({quote.discountCode})</span><span>−{formatMoney(quote.discount, c)}</span></div>
      )}
      <div className="summary-row"><span>{quote.shippingMethod === "express" ? "Express" : "Standard"} delivery</span><span>{quote.shipping === 0 ? "Free" : formatMoney(quote.shipping, c)}</span></div>
      <div className="summary-row summary-total"><span>Total</span><span>{formatMoney(quote.total, c)}</span></div>
      <p className="muted small" style={{ marginTop: 6 }}>{c === "GBP" ? "Includes UK VAT." : "US sales tax and import duties, if any, are not included."}</p>
      {quote.shippingMethod === "standard" && quote.freeShippingRemaining > 0 && quote.lines.length > 0 && (
        <p className="small">Spend {formatMoney(quote.freeShippingRemaining, c)} more for free standard delivery.</p>
      )}
      {children}
    </div>
  );
}

export function BagView({ cancelled }: { cancelled: boolean }) {
  const { setQuantity, removeFromBag } = useStore();
  const { quote, loading, error } = useQuote("standard", null);

  if (loading && !quote) return <p className="muted" style={{ padding: "40px 0" }}>Loading your bag…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!quote || quote.lines.length === 0)
    return (
      <div className="empty" style={{ margin: "30px 0 60px" }}>
        <h2>Your bag is empty</h2>
        <p className="muted">Discover new arrivals and seasonal favourites.</p>
        <Link href="/shop/new-arrivals" className="btn">Start shopping</Link>
      </div>
    );

  const c = quote.currency as CurrencyCode;
  return (
    <div className="two-col">
      <div>
        {cancelled && <div className="alert alert-warning" style={{ marginBottom: 12 }}>Payment was cancelled — your bag has been saved.</div>}
        {quote.lines.map((l) => (
          <div className="bag-line" key={l.variantId}>
            <Link href={`/product/${l.productSlug}`} className="card-media">
              <ProductArtClient name={l.productName} url={l.image} />
            </Link>
            <div>
              <Link href={`/product/${l.productSlug}`}><strong>{l.productName}</strong></Link>
              <p className="muted small" style={{ margin: "4px 0 10px" }}>{l.colour} · Size {l.size} · {formatMoney(l.unitPrice, c)}</p>
              <div className="row">
                <label className="sr-only" htmlFor={`q-${l.variantId}`}>Quantity</label>
                <select id={`q-${l.variantId}`} className="select" style={{ width: 80 }} value={l.quantity} onChange={(e) => setQuantity(l.variantId, Number(e.target.value))}>
                  {Array.from({ length: Math.max(1, Math.min(10, Math.max(l.available, l.quantity))) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeFromBag(l.variantId)}>Remove</button>
              </div>
              {l.problem && <p className="field-error" role="alert">{l.problem}</p>}
            </div>
            <strong>{formatMoney(l.lineTotal, c)}</strong>
          </div>
        ))}
      </div>
      <aside>
        <Summary quote={quote}>
          <Link href="/checkout" className={`btn btn-accent btn-block${quote.ok ? "" : " disabled"}`} aria-disabled={!quote.ok} style={{ marginTop: 14, pointerEvents: quote.ok ? undefined : "none", opacity: quote.ok ? 1 : 0.4 }}>
            Checkout securely
          </Link>
          {!quote.ok && <p className="field-error small">Please resolve the issues in your bag first.</p>}
          <Link href="/" className="btn btn-ghost btn-block" style={{ marginTop: 6 }}>Continue shopping</Link>
        </Summary>
      </aside>
    </div>
  );
}

type Fields = { email: string; name: string; phone: string; addressLine1: string; addressLine2: string; city: string; region: string; postcode: string };

type PaymentStep = { clientSecret: string; orderNumber: string; total: number };

/**
 * Checkout in two steps on one page: 1) contact, delivery address and method, then "Continue to payment"
 * creates the order; 2) the card form (CardPayment) appears and the customer pays without leaving the page.
 */
export function CheckoutView({ currency, publishableKey }: { currency: CurrencyCode; publishableKey: string | null }) {
  const paymentsEnabled = Boolean(publishableKey);
  const [payment, setPayment] = useState<PaymentStep | null>(null);
  const [method, setMethod] = useState<"standard" | "express">("standard");
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const { quote, loading, error } = useQuote(method, code);
  const [f, setF] = useState<Fields>({ email: "", name: "", phone: "", addressLine1: "", addressLine2: "", city: "", region: "", postcode: "" });
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { bag } = useStore();
  const country = currency === "GBP" ? "GB" : "US";

  const field = (k: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-invalid={Boolean(fieldErrors[k])} aria-describedby={fieldErrors[k] ? `e-${k}` : undefined} {...props} />
      {fieldErrors[k] && <span id={`e-${k}`} className="field-error">{fieldErrors[k]}</span>}
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || payment) return;
    setFormError(null);
    setFieldErrors({});
    if (!terms) return setFormError("Please accept the terms and returns policy to continue.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: bag, shippingMethod: method, discountCode: code, customer: { ...f, country }, acceptTerms: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) {
        setFieldErrors(data.fieldErrors ?? {});
        setFormError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setPayment({ clientSecret: data.clientSecret, orderNumber: data.orderNumber, total: data.total });
      setSubmitting(false);
    } catch {
      setFormError("Network error — please check your connection and try again.");
      setSubmitting(false);
    }
  };

  // Back to step 1: cancels the unpaid order so a new one is made with the edited details.
  const editDetails = async () => {
    if (!payment) return;
    setSubmitting(true);
    setFormError(null);
    const res = await fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: payment.orderNumber, clientSecret: payment.clientSecret }),
    }).catch(() => null);
    setSubmitting(false);
    if (res?.status === 409) return setFormError("This order has already been paid. Check your email or track your order.");
    setPayment(null);
  };

  if (loading && !quote) return <p className="muted" style={{ padding: "40px 0" }}>Loading checkout…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!quote || quote.lines.length === 0)
    return (
      <div className="empty" style={{ margin: "30px 0 60px" }}>
        <h2>Your bag is empty</h2>
        <Link href="/" className="btn">Continue shopping</Link>
      </div>
    );

  const c = quote.currency as CurrencyCode;
  return (
    <form className="two-col" onSubmit={submit} noValidate>
      <fieldset className="stack" disabled={Boolean(payment)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {!paymentsEnabled && (
          <div className="alert alert-warning">Online payments are being set up. You can review your order, but card payments aren't available yet — please contact us via chat to order.</div>
        )}
        <section className="panel stack">
          <h3>Contact</h3>
          {field("email", "Email address", { type: "email", autoComplete: "email", required: true })}
          {field("phone", "Phone (for delivery updates, optional)", { type: "tel", autoComplete: "tel" })}
        </section>
        <section className="panel stack">
          <h3>Delivery address — {currency === "GBP" ? "United Kingdom" : "United States"}</h3>
          {field("name", "Full name", { autoComplete: "name", required: true })}
          {field("addressLine1", "Address line 1", { autoComplete: "address-line1", required: true })}
          {field("addressLine2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
          <div className="grid-3">
            {field("city", currency === "GBP" ? "Town / city" : "City", { autoComplete: "address-level2", required: true })}
            {field("region", currency === "GBP" ? "County (optional)" : "State (e.g. NY)", { autoComplete: "address-level1", maxLength: currency === "GBP" ? 80 : 2 })}
            {field("postcode", currency === "GBP" ? "Postcode" : "ZIP code", { autoComplete: "postal-code", required: true })}
          </div>
          <p className="muted small">Shipping to {currency === "GBP" ? "the US" : "the UK"}? Switch region in the header.</p>
        </section>
        <section className="panel stack">
          <h3>Delivery method</h3>
          <label className="radio-card">
            <input type="radio" name="method" checked={method === "standard"} onChange={() => setMethod("standard")} />
            <span style={{ flex: 1 }}>Standard delivery <span className="muted small">· 3–5 working days</span></span>
            <strong>{method === "standard" && quote.shipping === 0 ? "Free" : "Standard"}</strong>
          </label>
          <label className="radio-card">
            <input type="radio" name="method" checked={method === "express"} onChange={() => setMethod("express")} />
            <span style={{ flex: 1 }}>Express delivery <span className="muted small">· 1–2 working days</span></span>
            <strong>Express</strong>
          </label>
          <p className="muted small">Delivery times are estimates from dispatch and are not guaranteed.</p>
        </section>
      </fieldset>

      <aside className="stack">
        <div className="panel">
          {quote.lines.map((l) => (
            <div key={l.variantId} className="summary-row small">
              <span>{l.quantity} × {l.productName} <span className="muted">({l.colour}, {l.size})</span></span>
              <span>{formatMoney(l.lineTotal, c)}</span>
            </div>
          ))}
          {quote.lines.some((l) => l.problem) && <p className="field-error small">Some items are unavailable. <Link href="/bag">Review your bag</Link>.</p>}
        </div>
        <div className="panel">
          <label htmlFor="code" className="label">Discount code</label>
          <div className="row" style={{ flexWrap: "nowrap", marginTop: 6 }}>
            <input id="code" className="input" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} maxLength={40} disabled={Boolean(payment)} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCode(codeInput.trim() || null)} disabled={Boolean(payment)}>Apply</button>
          </div>
          {code && quote.discountError && <p className="field-error small">{quote.discountError}</p>}
          {code && quote.discountCode && <p className="small" style={{ color: "var(--success)" }}>Code {quote.discountCode} applied.</p>}
        </div>
        <Summary quote={quote}>
          {!payment ? (
            <>
              <label className="checkbox small" style={{ marginTop: 12, alignItems: "flex-start" }}>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>I agree to the <Link href="/terms" style={{ textDecoration: "underline" }}>terms</Link> and <Link href="/delivery-returns" style={{ textDecoration: "underline" }}>returns policy</Link>, and understand my order is placed with an obligation to pay.</span>
              </label>
              {formError && <div className="alert alert-error" role="alert" style={{ marginTop: 10 }}>{formError}</div>}
              <button className="btn btn-accent btn-block" style={{ marginTop: 14 }} disabled={submitting || !quote.ok || !paymentsEnabled || (Boolean(code) && !quote.discountCode)}>
                {submitting ? "Please wait…" : "Continue to payment"}
              </button>
            </>
          ) : (
            <div className="stack" style={{ marginTop: 14, gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Card details</h3>
                <button type="button" className="btn btn-sm btn-ghost" onClick={editDetails} disabled={submitting}>Edit details</button>
              </div>
              <p className="muted small" style={{ margin: 0 }}>Order {payment.orderNumber} · delivering to {f.name}, {f.postcode}</p>
              {formError && <div className="alert alert-error" role="alert">{formError}</div>}
              <CardPayment
                publishableKey={publishableKey!}
                clientSecret={payment.clientSecret}
                orderNumber={payment.orderNumber}
                amountLabel={formatMoney(payment.total, c)}
                billing={{
                  name: f.name,
                  email: f.email,
                  phone: f.phone,
                  address: { line1: f.addressLine1, line2: f.addressLine2, city: f.city, state: f.region, postal_code: f.postcode, country },
                }}
              />
            </div>
          )}
          <p className="muted small center" style={{ marginTop: 8 }}>🔒 Card payments are processed securely by Stripe. We never see or store your card details.</p>
        </Summary>
      </aside>
    </form>
  );
}

export function ClearBagOnSuccess() {
  const { clearBag, ready } = useStore();
  useEffect(() => {
    if (ready) clearBag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
