import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { setProductStatus } from "../../actions";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage("products");
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {};
  if (sp.status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(sp.status)) where.status = sp.status as ProductStatus;
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { variants: { some: { sku: { contains: sp.q } } } }];
  const products = await prisma.product.findMany({ where, include: { category: true, variants: true, images: { take: 1, orderBy: { position: "asc" } } }, orderBy: { updatedAt: "desc" }, take: 300 });

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Products</h1>
        <span className="spacer" />
        <Link href="/admin/pricing" className="btn btn-outline btn-sm">Edit prices</Link>
        <Link href="/admin/products/new" className="btn btn-sm">+ New product</Link>
      </div>
      <form className="row" method="get">
        <input className="input" name="q" placeholder="Search name or SKU" defaultValue={sp.q} style={{ maxWidth: 280 }} />
        <select className="select" name="status" defaultValue={sp.status ?? ""} style={{ width: "auto" }}>
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="btn btn-sm btn-outline">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th></th><th>Product</th><th>Department</th><th>UK price</th><th>US price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={8} className="muted center">No products yet — create your first listing.</td></tr>}
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={p.id}>
                  <td>{p.images[0] ? <img src={p.images[0].url} alt="" className="thumb" /> : <div className="thumb" />}</td>
                  <td><Link href={`/admin/products/${p.id}`}><strong>{p.name}</strong></Link><div className="muted small">{p.category.name} · {p.variants.length} variants</div></td>
                  <td>{p.department.toLowerCase()}</td>
                  <td>{formatMoney(p.salePriceGBP ?? p.priceGBP, "GBP")}{p.salePriceGBP && <div className="muted small" style={{ textDecoration: "line-through" }}>{formatMoney(p.priceGBP, "GBP")}</div>}</td>
                  <td>{p.priceUSD ? formatMoney(p.salePriceUSD ?? p.priceUSD, "USD") : <span className="muted">—</span>}</td>
                  <td><span className={stock === 0 ? "field-error" : undefined}>{stock}</span></td>
                  <td><span className={`status status-${p.status}`}>{p.status.toLowerCase()}</span></td>
                  <td>
                    <form action={setProductStatus} className="row" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="id" value={p.id} />
                      {p.status !== "PUBLISHED" ? (
                        <button className="btn btn-sm btn-outline" name="status" value="PUBLISHED">Publish</button>
                      ) : (
                        <button className="btn btn-sm btn-ghost" name="status" value="DRAFT">Unpublish</button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
