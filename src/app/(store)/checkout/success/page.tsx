import type { Metadata } from "next";
import Link from "next/link";
import { ClearBagOnSuccess } from "@/components/BagAndCheckout";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { findPaidOrder } from "@/lib/orders";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = { order?: string; session_id?: string; payment_intent?: string };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const order = await findPaidOrder({ orderNumber: sp.order, paymentIntentId: sp.payment_intent, checkoutSessionId: sp.session_id });

  if (!order)
    return (
      <div className="container section center">
        <h1>Order not found</h1>
        <p className="muted">If you've just paid, you'll receive a confirmation shortly. You can also <Link href="/order-status" style={{ textDecoration: "underline" }}>check your order status</Link>.</p>
      </div>
    );

  const paid = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "NEEDS_ATTENTION"].includes(order.status);
  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      {order.status !== "CANCELLED" && <ClearBagOnSuccess />}
      <span className="eyebrow">Order {order.number}</span>
      <h1>{paid ? "Thank you for your order" : "We're confirming your payment"}</h1>
      <p className="muted">
        {paid
          ? `Your payment has been received. We'll email ${order.email} when your order is on its way.`
          : "Your payment is being confirmed with our payment provider. This usually takes a few seconds — refresh this page or check your order status shortly."}
      </p>
      <div className="panel" style={{ marginTop: 20 }}>
        {order.items.map((i) => (
          <div key={i.id} className="summary-row small">
            <span>{i.quantity} × {i.productName} ({i.colour}, {i.size})</span>
            <span>{formatMoney(i.unitPrice * i.quantity, order.currency)}</span>
          </div>
        ))}
        <div className="summary-row summary-total"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        <Link href="/" className="btn">Continue shopping</Link>
        <Link href="/order-status" className="btn btn-outline">Track order</Link>
      </div>
    </div>
  );
}
