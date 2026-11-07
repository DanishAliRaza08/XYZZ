import type { Metadata } from "next";
import { CheckoutSteps, PayView } from "@/components/CheckoutPay";
import { getStripe, stripePublishableKey } from "@/lib/stripe";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

// Checkout step 2: the card form. Step 1 (/checkout) has already created the order.
export default function PayPage() {
  return (
    <div className="container">
      <h1 style={{ marginTop: 30 }}>Payment</h1>
      <CheckoutSteps current={2} />
      <PayView publishableKey={getStripe() ? stripePublishableKey() : null} />
    </div>
  );
}
