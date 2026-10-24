import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function NewProduct() {
  await requireAdminPage("products");
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  if (!categories.length)
    return (
      <div className="stack">
        <h1 style={{ fontSize: "2rem" }}>New product</h1>
        <div className="alert alert-warning">Create at least one category first. <Link href="/admin/categories" style={{ textDecoration: "underline" }}>Go to categories</Link></div>
      </div>
    );
  return (
    <div className="stack">
      <Link href="/admin/products" className="small muted">← All products</Link>
      <h1 style={{ fontSize: "2rem" }}>New product</h1>
      <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} />
    </div>
  );
}
