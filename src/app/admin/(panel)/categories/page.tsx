import { deleteCategory, saveCategory } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CategoriesAdmin() {
  await requireAdminPage("products");
  const categories = await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Categories</h1>
      <p className="muted">Categories appear in the menu under each department that has published products in them.</p>
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
          <thead><tr><th>Name</th><th>Description</th><th>Order</th><th>Products</th><th></th></tr></thead>
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
                  {c._count.products === 0 ? (
                    <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><button className="btn btn-sm btn-ghost">Delete</button></form>
                  ) : <span className="muted small">In use</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
