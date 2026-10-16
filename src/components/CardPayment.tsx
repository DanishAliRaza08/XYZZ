"use client";

// The card form on the checkout page. Card number, expiry and CVC are typed into Stripe's secure fields
// (Stripe Payment Element, loaded from js.stripe.com) — they go straight to Stripe and never reach our server,
// which keeps the shop out of PCI card-data scope. 3D Secure checks open as a Stripe pop-up when the bank asks.
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { useState } from "react";

export type BillingDetails = {
  name: string;
  email: string;
  phone?: string;
  address: { line1: string; line2?: string; city: string; state?: string; postal_code: string; country: string };
};

const stripeLoaders = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string) {
  if (!stripeLoaders.has(publishableKey)) stripeLoaders.set(publishableKey, loadStripe(publishableKey));
  return stripeLoaders.get(publishableKey)!;
}

/** Matches Stripe's form to the shop's current colours (light/dark mode and seasonal event themes). */
function shopAppearance(): Appearance {
  const root = getComputedStyle(document.documentElement);
  const v = (name: string) => root.getPropertyValue(name).trim();
  const dark = root.colorScheme.includes("dark");
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: v("--accent") || "#7a2e3b",
      colorBackground: v("--surface") || (dark ? "#1b1a18" : "#ffffff"),
      colorText: v("--text") || (dark ? "#f2ede5" : "#1c1a17"),
      colorTextSecondary: v("--muted") || "#6d665c",
      colorDanger: v("--danger") || "#a3302b",
      fontFamily: getComputedStyle(document.body).fontFamily,
      borderRadius: "4px",
    },
    rules: { ".Input": { borderColor: v("--border") || "#e4ddd1", boxShadow: "none" } },
  };
}

export function CardPayment(props: { publishableKey: string; clientSecret: string; orderNumber: string; amountLabel: string; billing: BillingDetails }) {
  const [appearance] = useState(shopAppearance);
  return (
    <Elements stripe={stripeFor(props.publishableKey)} options={{ clientSecret: props.clientSecret, appearance, locale: "en-GB" }}>
      <PayForm {...props} />
    </Elements>
  );
}

function PayForm({ orderNumber, amountLabel, billing }: { orderNumber: string; amountLabel: string; billing: BillingDetails }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successUrl = (intentId?: string) =>
    `${window.location.origin}/checkout/success?order=${encodeURIComponent(orderNumber)}${intentId ? `&payment_intent=${encodeURIComponent(intentId)}` : ""}`;

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Cards complete here without leaving the page; payment methods that need a bank's site come back to return_url.
      redirect: "if_required",
      confirmParams: {
        return_url: successUrl(),
        payment_method_data: { billing_details: { name: billing.name, email: billing.email, phone: billing.phone || undefined } },
      },
    });
    if (err) {
      // Card errors (declined, wrong CVC, expired…) have messages written for customers.
      setError(err.type === "card_error" || err.type === "validation_error" ? (err.message ?? "Your card was declined.") : "The payment couldn't be completed. Please try again.");
      setBusy(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      window.location.href = successUrl(paymentIntent.id);
      return;
    }
    setError("The payment wasn't completed. Please try again or use a different card.");
    setBusy(false);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: { billingDetails: { name: billing.name, email: billing.email, address: billing.address } },
          fields: { billingDetails: { name: "never", email: "never" } },
        }}
        onReady={() => setReady(true)}
        onLoadError={() => setError("The card form couldn't load. Check your connection and refresh the page.")}
      />
      {!ready && !error && <p className="muted small">Loading secure card form…</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button type="button" className="btn btn-accent btn-block" onClick={pay} disabled={!stripe || !ready || busy}>
        {busy ? "Processing payment…" : `Pay ${amountLabel}`}
      </button>
    </div>
  );
}
