import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS as LABELS } from "@/lib/orders";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderStatusPage({ searchParams }: { searchParams: Promise<{ number?: string; email?: string }> }) {
  const sp = await searchParams;
  const number = sp.number?.trim().toUpperCase().slice(0, 30);
  const email = sp.email?.trim().toLowerCase().slice(0, 160);
  const order = number && email ? await prisma.order.findFirst({ where: { number, email }, include: { items: true } }) : null;

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <h1>Track your order</h1>
      <p className="muted">Enter your order number (from your confirmation email) and the email address used at checkout.</p>
      <form method="get" className="panel stack" style={{ marginTop: 18 }}>
        <div className="grid-2">
          <div className="field"><label htmlFor="number">Order number</label><input id="number" name="number" className="input" placeholder="FR-251015-ABC123" defaultValue={sp.number} required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue={sp.email} required /></div>
        </div>
        <button className="btn">Find order</button>
      </form>
      {number && email && !order && <div className="alert alert-error" style={{ marginTop: 16 }}>We couldn't find an order with those details.</div>}
      {order && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Order {order.number}</h3>
          <p><span className={`status status-${order.status}`}>{LABELS[order.status]}</span></p>
          {order.trackingNumber && <p>Tracking: {order.trackingCarrier ? `${order.trackingCarrier} ` : ""}<strong>{order.trackingNumber}</strong></p>}
          {order.items.map((i) => (
            <div key={i.id} className="summary-row small"><span>{i.quantity} × {i.productName} ({i.colour}, {i.size})</span><span>{formatMoney(i.unitPrice * i.quantity, order.currency)}</span></div>
          ))}
          <div className="summary-row summary-total"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
        </div>
      )}
    </div>
  );
}
