import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer, listSavedCards } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { removeSavedCard, signOutCustomer } from "./actions";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/account/login");
  const [orders, cards] = await Promise.all([
    prisma.order.findMany({
      // Unpaid checkouts that were abandoned or cancelled aren't real orders, so they're left out.
      where: { customerId: customer.id, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    }),
    listSavedCards(customer),
  ]);

  return (
    <div className="container section" style={{ maxWidth: 860 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <span className="eyebrow">My account</span>
          <h1 style={{ margin: 0 }}>Hello, {customer.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{customer.email}</p>
        </div>
        <form action={signOutCustomer}>
          <button className="btn btn-outline btn-sm">Sign out</button>
        </form>
      </div>

      <section className="panel stack" style={{ marginTop: 24 }}>
        <h3>My orders</h3>
        {orders.length === 0 && (
          <p className="muted">No orders yet. Orders you place while signed in will appear here. <Link href="/shop/new-arrivals" style={{ textDecoration: "underline" }}>Start shopping</Link></p>
        )}
        {orders.map((o) => (
          <details key={o.id} className="acc">
            <summary>
              <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "center" }}>
                <strong>{o.number}</strong>
                <span className="muted small">{o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className={`status status-${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                <strong style={{ marginLeft: "auto" }}>{formatMoney(o.total, o.currency)}</strong>
              </span>
            </summary>
            <div>
              {o.items.map((i) => (
                <div key={i.id} className="summary-row small"><span>{i.quantity} × {i.productName} ({i.colour}, {i.size})</span><span>{formatMoney(i.unitPrice * i.quantity, o.currency)}</span></div>
              ))}
              <p className="muted small">Delivering to {o.name}, {o.addressLine1}, {o.city} {o.postcode}</p>
              {o.trackingNumber && <p className="small">Tracking: {o.trackingCarrier ? `${o.trackingCarrier} ` : ""}<strong>{o.trackingNumber}</strong></p>}
            </div>
          </details>
        ))}
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h3>Saved cards</h3>
        {cards.length === 0 ? (
          <p className="muted">No saved cards. At checkout, tick <em>Save payment details for future purchases</em> to save your card.</p>
        ) : (
          cards.map((c) => (
            <div key={c.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <span><strong style={{ textTransform: "capitalize" }}>{c.brand}</strong> ending {c.last4} <span className="muted small">· expires {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}</span></span>
              <form action={removeSavedCard}>
                <input type="hidden" name="paymentMethodId" value={c.id} />
                <button className="btn btn-ghost btn-sm">Remove</button>
              </form>
            </div>
          ))
        )}
        <p className="muted small">🔒 Cards are stored securely by our payment provider, Stripe. We never see or keep your full card number.</p>
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h3>Delivery address</h3>
        {customer.addressLine1 ? (
          <p style={{ margin: 0 }}>
            {customer.name}<br />
            {customer.addressLine1}<br />
            {customer.addressLine2 && <>{customer.addressLine2}<br /></>}
            {customer.city}{customer.region ? `, ${customer.region}` : ""} {customer.postcode}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Your address is saved automatically when you place an order, and filled in for you next time.</p>
        )}
      </section>
    </div>
  );
}
