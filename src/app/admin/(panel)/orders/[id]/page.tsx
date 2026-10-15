import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrder } from "../../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("orders");
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();
  const history = await prisma.auditLog.findMany({ where: { entity: "Order", entityId: id }, include: { admin: true }, orderBy: { createdAt: "desc" } });
  const stripeLink = order.stripePaymentId ? `https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}payments/${order.stripePaymentId}` : null;
  return (
    <div className="stack">
      <Link href="/admin/orders" className="small muted">← All orders</Link>
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Order {order.number}</h1>
        <span className={`status status-${order.status}`}>{order.status.replace(/_/g, " ").toLowerCase()}</span>
      </div>
      {order.status === "NEEDS_ATTENTION" && <div className="alert alert-error">This order was paid but needs review: {order.notes}</div>}
      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel">
          <h3>Items</h3>
          {order.items.map((i) => (
            <div key={i.id} className="summary-row small"><span>{i.quantity} × {i.productName}<br /><span className="muted">{i.sku} · {i.colour} · {i.size}</span></span><span>{formatMoney(i.unitPrice * i.quantity, order.currency)}</span></div>
          ))}
          <div className="summary-row"><span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
          {order.discount > 0 && <div className="summary-row"><span>Discount ({order.discountCode})</span><span>−{formatMoney(order.discount, order.currency)}</span></div>}
          <div className="summary-row"><span>Delivery ({order.shippingMethod})</span><span>{formatMoney(order.shipping, order.currency)}</span></div>
          <div className="summary-row summary-total"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
          {stripeLink && <p className="small"><a href={stripeLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>View payment in Stripe</a></p>}
        </section>
        <section className="panel">
          <h3>Customer</h3>
          <p>{order.name}<br /><a href={`mailto:${order.email}`}>{order.email}</a>{order.phone && <><br />{order.phone}</>}</p>
          <p className="muted">{order.addressLine1}{order.addressLine2 && <>, {order.addressLine2}</>}<br />{order.city}{order.region && `, ${order.region}`} {order.postcode}<br />{order.country}</p>
          <p className="small muted">Placed {order.createdAt.toLocaleString("en-GB")}{order.paidAt && ` · Paid ${order.paidAt.toLocaleString("en-GB")}`}</p>
        </section>
      </div>
      <section className="panel">
        <h3>Fulfilment</h3>
        <ActionForm action={updateOrder} submitLabel="Update order">
          <input type="hidden" name="id" value={order.id} />
          <div className="grid-3">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" className="select" defaultValue={order.status}>
                {["PENDING_PAYMENT", "PAID", "NEEDS_ATTENTION", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="trackingCarrier">Carrier</label><input id="trackingCarrier" name="trackingCarrier" className="input" defaultValue={order.trackingCarrier ?? ""} placeholder="Royal Mail, DPD…" /></div>
            <div className="field"><label htmlFor="trackingNumber">Tracking number</label><input id="trackingNumber" name="trackingNumber" className="input" defaultValue={order.trackingNumber ?? ""} /></div>
          </div>
          <div className="field"><label htmlFor="notes">Internal notes</label><textarea id="notes" name="notes" className="textarea" defaultValue={order.notes ?? ""} /></div>
          <p className="muted small">Refunds are issued in your Stripe dashboard; the order switches to “refunded” automatically when a full refund is processed.</p>
        </ActionForm>
      </section>
      {history.length > 0 && (
        <section className="panel">
          <h3>History</h3>
          {history.map((h) => <div key={h.id} className="small">{h.createdAt.toLocaleString("en-GB")} — {h.admin?.name ?? "system"}: {h.action} {h.details}</div>)}
        </section>
      )}
    </div>
  );
}
