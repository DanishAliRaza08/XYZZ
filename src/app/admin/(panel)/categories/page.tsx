import Link from "next/link";
import { deleteCategory, saveCategory } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireAdminPage("products");
  const sp = await searchParams;
  const categories = await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Categories</h1>
      <p className="muted" style={{ maxWidth: 820 }}>
        Categories are the types of product (Dresses, Hoodies, School uniform…). Every product has one. To show a category in the menu as a page
        (e.g. Girls → Party dresses), add a page for it in <Link href="/admin/menu" style={{ textDecoration: "underline" }}>Menu</Link>; categories
        with products also appear by themselves under “More in …” for each department.
      </p>
      {sp.done && <p className="alert alert-success" role="status" style={{ margin: 0 }}>{sp.done}</p>}
      <section className="panel">
        <h3>Add category</h3>
        <ActionForm action={saveCategory} submitLabel="Add category" resetOnSuccess className="row">
          <input name="name" className="input" placeholder="Name, e.g. Party dresses" required style={{ maxWidth: 260 }} aria-label="Name" />
          <input name="description" className="input" placeholder="Short description (optional)" style={{ maxWidth: 320 }} aria-label="Description" />
          <input name="sortOrder" className="input" type="number" placeholder="Order" style={{ width: 90 }} aria-label="Sort order" />
        </ActionForm>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Description</th><th>Order</th><th>Products</th><th>Delete</th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td colSpan={3}>
                  <ActionForm action={saveCategory} submitLabel="Save" className="row">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" className="input" defaultValue={c.name} style={{ maxWidth: 200 }} aria-label="Name" />
                    <input name="description" className="input" defaultValue={c.description ?? ""} style={{ maxWidth: 280 }} aria-label="Description" />
                    <input name="sortOrder" className="input" type="number" defaultValue={c.sortOrder} style={{ width: 80 }} aria-label="Sort order" />
                    <input type="hidden" name="slug" value={c.slug} />
                  </ActionForm>
                </td>
                <td>{c._count.products}</td>
                <td>
                  <form action={deleteCategory} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={c.id} />
                    {c._count.products > 0 && (
                      <select name="moveTo" className="select" required defaultValue="" aria-label={`Move the products of ${c.name} to`} style={{ width: 170 }}>
                        <option value="" disabled>Move products to…</option>
                        {categories.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                    <button className="btn btn-sm btn-ghost" aria-label={`Delete ${c.name}`}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
