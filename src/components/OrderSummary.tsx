"use client";

// The order summary box used on the bag, checkout details and payment pages.
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { Quote } from "@/lib/quote";

export function Summary({ quote, children }: { quote: Quote; children?: React.ReactNode }) {
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
