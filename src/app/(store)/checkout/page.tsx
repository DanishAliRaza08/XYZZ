import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutView } from "@/components/BagAndCheckout";
import { getCurrency } from "@/lib/currency-server";
import { getCustomer } from "@/lib/customer";
import { getStripe, stripePublishableKey, stripeSetupProblems } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [currency, customer] = await Promise.all([getCurrency(), getCustomer()]);
  // Signed-in customers get their details filled in (empty saved fields are left out so they don't overwrite anything).
  const prefill = customer
    ? Object.fromEntries(
        Object.entries({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2,
          city: customer.city,
          region: customer.region,
          postcode: customer.postcode,
        }).filter(([, v]) => v),
      )
    : undefined;
  return (
    <div className="container">
      <h1 style={{ marginTop: 30 }}>Checkout</h1>
      {customer ? (
        <p className="muted">Signed in as {customer.email} — your saved cards will be offered at payment. <Link href="/account" style={{ textDecoration: "underline" }}>My account</Link></p>
      ) : (
        <p className="muted">
          Checking out as a guest — no account needed.{" "}
          <Link href="/account/login?next=/checkout" style={{ textDecoration: "underline" }}>Sign in</Link> or{" "}
          <Link href="/account/register?next=/checkout" style={{ textDecoration: "underline" }}>create an account</Link> to track orders and save your card.
        </p>
      )}
      {/* Card payments need both Stripe keys; without them the page explains that payments aren't available yet. */}
      <CheckoutView
        currency={currency}
        publishableKey={getStripe() ? stripePublishableKey() : null}
        prefill={prefill}
        // On your own computer (npm run dev) the checkout says exactly which Stripe setting is wrong; customers never see this.
        setupProblems={process.env.NODE_ENV === "production" ? [] : stripeSetupProblems()}
      />
    </div>
  );
}
