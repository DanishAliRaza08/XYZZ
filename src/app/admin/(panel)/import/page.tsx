import Link from "next/link";
import { startProductImport } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { AutoRefresh } from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/auth";
import { currentImport } from "@/lib/import-job";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAdminPage("products");
  const job = currentImport();
  const running = job?.status === "running";
  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="stack">
      <h1>Import products</h1>
      <p className="muted" style={{ maxWidth: 760 }}>
        Copy products, prices, sizes, colours and photos from another online shop built on <strong>Shopify</strong> (for example https://gumandberries.co.uk).
        Products already in your shop are left as they are, so you can run the same import again later to add new arrivals.
        Only import products and photos you have permission to sell and reuse.
      </p>

      {running && <AutoRefresh seconds={2} />}

      <ActionForm action={startProductImport} submitLabel={running ? "Import running…" : "Start import"}>
        <section className="panel stack">
          <div className="field">
            <label htmlFor="source">Shop website address *</label>
            <input id="source" name="source" className="input" placeholder="https://gumandberries.co.uk" required disabled={running} />
          </div>
          <div className="grid-3">
            <div className="field">
              <label htmlFor="status">Add products as</label>
              <select id="status" name="status" className="select" defaultValue="PUBLISHED" disabled={running}>
                <option value="PUBLISHED">Published (live in the shop)</option>
                <option value="DRAFT">Draft (hidden until you publish)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="maxImages">Photos per product</label>
              <input id="maxImages" name="maxImages" className="input" type="number" min={0} max={10} defaultValue={4} disabled={running} />
            </div>
            <div className="field">
              <label htmlFor="defaultStock">Stock per size</label>
              <input id="defaultStock" name="defaultStock" className="input" type="number" min={0} defaultValue={10} disabled={running} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="limit">Only the first … products (optional)</label>
            <input id="limit" name="limit" className="input" type="number" min={1} placeholder="All products" disabled={running} />
          </div>
          <p className="muted small">
            The other shop doesn&apos;t share stock numbers, so every available size gets the stock above (sold-out sizes get 0). Departments and
            categories are chosen from each product&apos;s name and tags — check them in <Link href="/admin/products">Products</Link> afterwards.
          </p>
        </section>
      </ActionForm>

      {job && (
        <section className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{running ? "Import in progress" : job.status === "done" ? "Last import finished" : "Last import stopped"}</h3>
            <span className="muted small">{job.source} · started {job.startedAt.toLocaleTimeString("en-GB")}</span>
          </div>
          <p className={job.status === "failed" ? "alert alert-error" : job.status === "done" ? "alert alert-success" : undefined} style={{ margin: 0 }}>
            {job.message}
          </p>
          {job.total > 0 && (
            <>
              <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width 0.4s" }} />
              </div>
              <p className="small" style={{ margin: 0 }}>
                {job.processed} of {job.total} checked · <strong>{job.created} added</strong> · {job.existing} already in shop · {job.skipped} skipped · {job.photos} photos
              </p>
            </>
          )}
          {job.log.length > 0 && (
            <pre className="small" style={{ maxHeight: 260, overflow: "auto", background: "var(--surface-2)", padding: 12, borderRadius: 6, whiteSpace: "pre-wrap", margin: 0 }}>
              {job.log.slice().reverse().join("\n")}
            </pre>
          )}
          {job.status === "done" && job.created > 0 && <Link href="/admin/products" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}>Review imported products</Link>}
        </section>
      )}
    </div>
  );
}
