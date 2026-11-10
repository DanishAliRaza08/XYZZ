import Link from "next/link";
import { ExcelImport } from "@/components/admin/ExcelImport";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentSheetImport } from "@/lib/sheet-import-job";

export const dynamic = "force-dynamic";

export default async function ExcelPage() {
  await requireAdminPage("products");
  const counts = await prisma.product.groupBy({ by: ["status"], _count: true });
  const count = (s?: string) => counts.filter((c) => !s || c.status === s).reduce((n, c) => n + c._count, 0);
  const job = currentSheetImport();

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Products in Excel</h1>
        <span className="spacer" />
        <Link href="/admin/products" className="btn btn-sm btn-ghost">← Products</Link>
      </div>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Export</h3>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
          Download your products as an Excel file — one row per size/colour, with prices, stock, categories and photo addresses.
          Edit it in Excel (or Google Sheets / Numbers) and import it below to update many products at once. The file&apos;s Help sheet explains every column.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href="/api/admin/products/excel" download>Export all products ({count()})</a>
          <a className="btn btn-outline btn-sm" href="/api/admin/products/excel?status=PUBLISHED" download>Published only ({count("PUBLISHED")})</a>
          <a className="btn btn-outline btn-sm" href="/api/admin/products/excel?status=DRAFT" download>Drafts only ({count("DRAFT")})</a>
          <a className="btn btn-ghost btn-sm" href="/api/admin/products/excel?template=1" download>Blank template</a>
        </div>
      </section>

      <h2 style={{ margin: "8px 0 0" }}>Import</h2>
      <ul className="muted small" style={{ margin: 0, maxWidth: 760, paddingLeft: 18 }}>
        <li>Rows with a web address that&apos;s already in the shop <strong>update</strong> that product; other rows <strong>add new products</strong>.</li>
        <li>Each row is one size/colour. Sizes not in the file are kept — remove sizes or delete products on the product&apos;s page.</li>
        <li>Photos: addresses from an export are kept as they are; links starting https:// are downloaded into the shop. An empty Photos cell keeps the current photos.</li>
        <li>Nothing changes until you click Import — Check file first to see what will happen and fix any problem rows.</li>
      </ul>
      <ExcelImport initialJob={job} />

      <section className="panel stack" aria-labelledby="marketplaces">
        <h2 id="marketplaces" style={{ margin: 0, fontSize: "1.3rem" }}>Products from Amazon, TikTok Shop, eBay or Etsy</h2>
        <p className="small" style={{ margin: 0 }}>
          Download your listings from your seller account and upload the file above as it is — no editing needed. The import recognises their columns, groups sizes and colours
          into products, downloads the photos and works out the department and category. New products are added as the status chosen above (Draft is safest), so you can check them first.
        </p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li><strong>Amazon (Seller Central):</strong> Inventory → Inventory Reports → Report type <em>Category Listings Report</em> (has photos, descriptions and variations) → Request report → Download. Upload the .txt file. The <em>All Listings Report</em> also works but has fewer details.</li>
          <li><strong>TikTok Shop (Seller Center):</strong> Products → Manage products → Export (all products) → download the .xlsx.</li>
          <li><strong>eBay / Etsy / others:</strong> their listings download (CSV or Excel) works when it has a title column and a SKU or price column.</li>
        </ul>
        <p className="muted small" style={{ margin: 0 }}>Only import products and photos you own or have permission to use. If a file isn&apos;t recognised, the check tells you — send it to your developer to add its column names.</p>
      </section>
    </div>
  );
}
