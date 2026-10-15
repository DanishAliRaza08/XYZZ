import { saveDiscount, toggleDiscount } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function DiscountsAdmin() {
  await requireAdminPage("products");
  const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Discount codes</h1>
      <section className="panel">
        <h3>New code</h3>
        <ActionForm action={saveDiscount} submitLabel="Create code" resetOnSuccess>
          <div className="grid-3">
            <div className="field"><label htmlFor="code">Code</label><input id="code" name="code" className="input" placeholder="WELCOME10" required /></div>
            <div className="field"><label htmlFor="percentOff">% off</label><input id="percentOff" name="percentOff" type="number" min={1} max={90} className="input" placeholder="10" /></div>
            <div className="field"><label htmlFor="amountOffGBP">or £ off (UK only)</label><input id="amountOffGBP" name="amountOffGBP" className="input" placeholder="5.00" /></div>
            <div className="field"><label htmlFor="minSubtotalGBP">Minimum spend £ (optional)</label><input id="minSubtotalGBP" name="minSubtotalGBP" className="input" /></div>
            <div className="field"><label htmlFor="usageLimit">Usage limit (optional)</label><input id="usageLimit" name="usageLimit" type="number" min={1} className="input" /></div>
            <div className="field"><label htmlFor="expiresAt">Expires (optional)</label><input id="expiresAt" name="expiresAt" type="date" className="input" /></div>
          </div>
        </ActionForm>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Discount</th><th>Min spend</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {codes.length === 0 && <tr><td colSpan={7} className="muted center">No codes yet.</td></tr>}
            {codes.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOffGBP ?? 0, "GBP")}</td>
                <td>{c.minSubtotalGBP ? formatMoney(c.minSubtotalGBP, "GBP") : "—"}</td>
                <td>{c.timesUsed}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td>{c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : "—"}</td>
                <td><span className={`status ${c.active ? "status-PAID" : ""}`}>{c.active ? "active" : "off"}</span></td>
                <td><form action={toggleDiscount}><input type="hidden" name="id" value={c.id} /><button className="btn btn-sm btn-ghost">{c.active ? "Deactivate" : "Activate"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
