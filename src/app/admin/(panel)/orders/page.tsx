import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { AutoRefresh } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

const STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "NEEDS_ATTENTION", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage("orders");
  const sp = await searchParams;
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as OrderStatus)) where.status = sp.status as OrderStatus;
  if (sp.q) where.OR = [{ number: { contains: sp.q } }, { email: { contains: sp.q } }, { name: { contains: sp.q } }];
  const orders = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { items: true } } } });
  return (
    <div className="stack">
      <AutoRefresh seconds={30} />
      <h1 style={{ fontSize: "2rem" }}>Orders</h1>
      <form className="row" method="get">
        <input className="input" name="q" placeholder="Order number, email or name" defaultValue={sp.q} style={{ maxWidth: 300 }} />
        <select className="select" name="status" defaultValue={sp.status ?? ""} style={{ width: "auto" }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
        </select>
        <button className="btn btn-sm btn-outline">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={6} className="muted center">No orders found.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}><strong>{o.number}</strong></Link></td>
                <td>{o.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{o.name}<div className="muted small">{o.email}</div></td>
                <td>{o._count.items}</td>
                <td>{formatMoney(o.total, o.currency)}</td>
                <td><span className={`status status-${o.status}`}>{o.status.replace(/_/g, " ").toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
