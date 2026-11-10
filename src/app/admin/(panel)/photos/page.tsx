import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { checkPhotos } from "@/lib/photo-check";
import { uploadsInsideApp } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  await requireAdminPage("products");
  const check = await checkPhotos();
  const atRisk = uploadsInsideApp(check.dir);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Photo storage</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
        Pictures uploaded in the admin (and photos downloaded by imports) are saved in this folder on the server:
      </p>
      <p style={{ margin: 0 }}><code>{check.dir}</code> · {check.stored} file{check.stored === 1 ? "" : "s"}</p>

      {atRisk ? (
        <div className="alert alert-error stack" role="alert" style={{ gap: 6 }}>
          <strong>This folder is inside the website&apos;s own folder, so redeploying the website deletes every uploaded picture.</strong>
          <span>To fix it for good (Hostinger): in your website&apos;s <strong>Environment variables</strong>, set <code>UPLOAD_DIR</code> to a folder outside the website,
            e.g. <code>/home/YOUR-HOSTINGER-USER/uploads</code> (your user name starts with <code>u</code> and is shown in hPanel → File Manager), then redeploy.
            Pictures uploaded before that are lost and need uploading again once.</span>
        </div>
      ) : (
        <div className="alert alert-success" role="status">The folder is outside the website&apos;s own folder, so redeploying keeps your pictures.</div>
      )}

      {check.missing === 0 ? (
        <p className="alert alert-success" style={{ margin: 0 }}>All {check.used} uploaded pictures used in the shop are there.</p>
      ) : (
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>{check.missing} picture{check.missing === 1 ? " is" : "s are"} missing</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li><strong>Products imported from a Shopify shop:</strong> go to <Link href="/admin/import">Import products</Link>, enter the shop&apos;s address, tick <em>Also refresh the photos of products already imported</em> and start — their photos are downloaded again.</li>
            <li><strong>Pictures you uploaded yourself:</strong> open each product (or blog post, banner) below and upload the picture again.</li>
          </ul>
          {check.otherPlaces.length > 0 && (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {check.otherPlaces.map((p) => <li key={p.href}><Link href={p.href} style={{ textDecoration: "underline" }}>{p.label}</Link>: {p.missing} missing</li>)}
            </ul>
          )}
          {check.products.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th>Missing photos</th><th /></tr></thead>
                <tbody>
                  {check.products.slice(0, 500).map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.missing} of {p.total}</td>
                      <td><Link href={`/admin/products/${p.id}`} className="btn btn-sm btn-outline">Edit</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {check.products.length > 500 && <p className="muted small">…and {check.products.length - 500} more products.</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
