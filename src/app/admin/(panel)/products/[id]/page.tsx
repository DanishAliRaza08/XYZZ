import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct } from "../../../actions";
import { ConfirmButton } from "@/components/admin/ActionForm";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toInputValue } from "@/lib/money";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdminPage("products");
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { position: "asc" } } } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  if (!product) notFound();
  const saved = (await searchParams).saved;
  return (
    <div className="stack">
      <Link href="/admin/products" className="small muted">← All products</Link>
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{product.name}</h1>
        <span className="spacer" />
        {product.status === "PUBLISHED" && <Link href={`/product/${product.slug}`} target="_blank" className="btn btn-sm btn-outline">View in shop</Link>}
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <ConfirmButton label="Delete" message="Delete this product? Products with orders will be archived instead." className="btn btn-sm btn-danger" />
        </form>
      </div>
      {saved && <div className="alert alert-success">Product created.</div>}
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          department: product.department,
          categoryId: product.categoryId,
          status: product.status,
          priceGBP: toInputValue(product.priceGBP),
          salePriceGBP: toInputValue(product.salePriceGBP),
          priceUSD: toInputValue(product.priceUSD),
          salePriceUSD: toInputValue(product.salePriceUSD),
          composition: product.composition ?? "",
          care: product.care ?? "",
          origin: product.origin ?? "",
          ageRange: product.ageRange ?? "",
          collection: product.collection ?? "",
          featured: product.featured,
          bestseller: product.bestseller,
          variants: product.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, colour: v.colour, colourHex: v.colourHex, stock: v.stock })),
          images: product.images.map((i) => ({ url: i.url, alt: i.alt, colour: i.colour ?? "" })),
        }}
      />
    </div>
  );
}
