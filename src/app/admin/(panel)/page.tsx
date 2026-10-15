import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

const PAID = ["PAID", "NEEDS_ATTENTION", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireAdminPage("dashboard");
  const sp = await searchParams;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [revenue, orderCount, refunds, published, lowStock, waitingChats, recent, byDept] = await Promise.all([
    prisma.order.groupBy({ by: ["currency"], where: { status: { in: [...PAID] }, paidAt: { gte: since } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { status: { in: [...PAID] }, paidAt: { gte: since } } }),
    prisma.order.count({ where: { status: "REFUNDED", updatedAt: { gte: since } } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.variant.findMany({ where: { stock: { lte: 3 }, product: { status: "PUBLISHED" } }, include: { product: true }, orderBy: { stock: "asc" }, take: 10 }),
    prisma.chatConversation.count({ where: { status: "HUMAN" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.orderItem.findMany({ where: { order: { status: { in: [...PAID] }, paidAt: { gte: since } } }, select: { unitPrice: true, quantity: true, order: { select: { currency: true } }, variant: { select: { product: { select: { department: true } } } } } }),
  ]);
  const deptTotals = new Map<string, number>();
  for (const i of byDept) if (i.order.currency === "GBP") deptTotals.set(i.variant.product.department, (deptTotals.get(i.variant.product.department) ?? 0) + i.unitPrice * i.quantity);

  return (
    <div className="stack">
      {sp.denied && <div className="alert alert-warning">Your role doesn't have access to that section.</div>}
      <h1 style={{ fontSize: "2rem" }}>Dashboard</h1>
      <p className="muted">Last 30 days · paid orders only</p>
      <div className="stat-grid">
        {revenue.length === 0 && <div className="stat"><b>{formatMoney(0, "GBP")}</b><span>Revenue</span></div>}
        {revenue.map((r) => (
          <div className="stat" key={r.currency}><b>{formatMoney(r._sum.total ?? 0, r.currency)}</b><span>Revenue ({r.currency})</span></div>
        ))}
        {revenue.map((r) => (
          <div className="stat" key={`aov-${r.currency}`}><b>{formatMoney(Math.round((r._sum.total ?? 0) / Math.max(1, r._count)), r.currency)}</b><span>Avg order ({r.currency})</span></div>
        ))}
        <div className="stat"><b>{orderCount}</b><span>Orders</span></div>
        <div className="stat"><b>{refunds}</b><span>Refunds</span></div>
        <div className="stat"><b>{published}</b><span>Live products</span></div>
        <div className="stat"><b>{waitingChats}</b><span>Chats with team</span></div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="panel">
          <h3>Recent orders</h3>
          {recent.length === 0 ? <p className="muted">No orders yet.</p> : (
            <table className="table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                    <td><span className={`status status-${o.status}`}>{o.status.replace(/_/g, " ")}</span></td>
                    <td>{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel">
          <h3>Low stock</h3>
          {lowStock.length === 0 ? <p className="muted">All published variants have more than 3 in stock.</p> : (
            <table className="table">
              <tbody>
                {lowStock.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/admin/products/${v.productId}`}>{v.product.name}</Link><div className="muted small">{v.sku} · {v.colour} · {v.size}</div></td>
                    <td><span className={`status ${v.stock === 0 ? "status-NEEDS_ATTENTION" : "status-PENDING_PAYMENT"}`}>{v.stock} left</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      {deptTotals.size > 0 && (
        <section className="panel">
          <h3>UK sales by department</h3>
          <table className="table"><tbody>
            {[...deptTotals.entries()].sort((a, b) => b[1] - a[1]).map(([d, t]) => (
              <tr key={d}><td>{d.charAt(0) + d.slice(1).toLowerCase()}</td><td>{formatMoney(t, "GBP")}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}
    </div>
  );
}
