import type { Metadata } from "next";
import { CheckoutView } from "@/components/BagAndCheckout";
import { getCurrency } from "@/lib/currency-server";
import { getStripe, stripePublishableKey } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const currency = await getCurrency();
  return (
    <div className="container">
      <h1 style={{ marginTop: 30 }}>Checkout</h1>
      <p className="muted">Guest checkout — no account needed.</p>
      {/* Card payments need both Stripe keys; without them the page explains that payments aren't available yet. */}
      <CheckoutView currency={currency} publishableKey={getStripe() ? stripePublishableKey() : null} />
    </div>
  );
}
