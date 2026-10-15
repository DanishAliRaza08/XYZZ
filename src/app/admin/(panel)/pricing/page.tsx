import Link from "next/link";
import { adjustPrices, savePricing } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toInputValue } from "@/lib/money";

export default async function PricingAdmin() {
  await requireAdminPage("products");
  const products = await prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ department: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Pricing</h1>
      <p className="muted">Edit every price in one place. UK prices include VAT. Leave a sale price empty for no sale; leave the US price empty to hide a product from the US store.</p>

      <section className="panel">
        <h3>Bulk adjust</h3>
        <ActionForm action={adjustPrices} submitLabel="Apply to products" className="row">
          <select name="mode" className="select" style={{ width: "auto" }} defaultValue="sale">
            <option value="sale">Put on sale: % off regular price</option>
            <option value="regular">Change regular prices by %</option>
            <option value="clear-sale">End sale (remove sale prices)</option>
          </select>
          <input name="percent" className="input" type="number" step="1" min={-90} max={90} placeholder="% e.g. 20" style={{ width: 120 }} aria-label="Percent" />
          <select name="department" className="select" style={{ width: "auto" }} defaultValue="">
            <option value="">All departments</option><option value="WOMEN">Women</option><option value="GIRLS">Girls</option><option value="BOYS">Boys</option><option value="BABY">Baby</option><option value="MEN">Men</option>
          </select>
        </ActionForm>
      </section>

      {products.length === 0 ? (
        <p className="muted">No products yet. <Link href="/admin/products/new">Create one</Link>.</p>
      ) : (
        <ActionForm action={savePricing} submitLabel="Save all prices" className="stack">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th>UK £</th><th>UK sale £</th><th>US $</th><th>US sale $</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input type="hidden" name="ids" value={p.id} />
                      <input type="hidden" name={`name_${p.id}`} value={p.name} />
                      <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                      <div className="muted small">{p.department.toLowerCase()} · {p.status.toLowerCase()}</div>
                    </td>
                    <td><input className="input" name={`gbp_${p.id}`} defaultValue={toInputValue(p.priceGBP)} inputMode="decimal" style={{ width: 100 }} aria-label={`${p.name} UK price`} /></td>
                    <td><input className="input" name={`gbpsale_${p.id}`} defaultValue={toInputValue(p.salePriceGBP)} inputMode="decimal" style={{ width: 100 }} aria-label={`${p.name} UK sale price`} /></td>
                    <td><input className="input" name={`usd_${p.id}`} defaultValue={toInputValue(p.priceUSD)} inputMode="decimal" style={{ width: 100 }} aria-label={`${p.name} US price`} /></td>
                    <td><input className="input" name={`usdsale_${p.id}`} defaultValue={toInputValue(p.salePriceUSD)} inputMode="decimal" style={{ width: 100 }} aria-label={`${p.name} US sale price`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
