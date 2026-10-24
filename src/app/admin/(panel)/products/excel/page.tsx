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
    </div>
  );
}
