"use client";

// Admin → Products → Excel: choose a file, "Check file" shows what would change (and any problem rows),
// "Import" saves it in the background and this shows the progress.
import { useCallback, useEffect, useState } from "react";
import type { SheetJob } from "@/lib/sheet-import-job";

type Summary = {
  rows: number;
  create: number;
  update: number;
  errorCount: number;
  errors: { row: number; product: string; message: string }[];
  ignoredColumns: string[];
  products: { name: string; slug: string; action: "create" | "update"; row: number; sizes: number; newSizes: number; photos: number | null }[];
};

export function ExcelImport({ initialJob }: { initialJob: SheetJob | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // changing it empties the file box after an import starts
  const [defaultStatus, setDefaultStatus] = useState("DRAFT");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [job, setJob] = useState<SheetJob | null>(initialJob);
  const running = job?.status === "running";

  const poll = useCallback(async () => {
    const res = await fetch("/api/admin/products/excel/import", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (data && "job" in data) setJob(data.job);
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [running, poll]);

  const send = async (mode: "check" | "import") => {
    if (!file) return;
    setBusy(mode);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    fd.append("defaultStatus", defaultStatus);
    try {
      const res = await fetch("/api/admin/products/excel/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: "The server didn't answer properly — try again." }));
      if (data.summary) setSummary(data.summary);
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      if (data.job) {
        setJob(data.job);
        setSummary(null);
        setFile(null);
        setInputKey((k) => k + 1);
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(null);
  };

  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="grid-2">
          <div className="field">
            <label htmlFor="excel-file">Excel file (.xlsx or .csv)</label>
            <input
              id="excel-file"
              key={inputKey}
              type="file"
              className="input"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={running || !!busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setSummary(null);
                setError(null);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="defaultStatus">New products with an empty Status are added as</label>
            <select id="defaultStatus" className="select" value={defaultStatus} onChange={(e) => { setDefaultStatus(e.target.value); setSummary(null); }} disabled={running || !!busy}>
              <option value="DRAFT">Draft (hidden until you publish)</option>
              <option value="PUBLISHED">Published (live in the shop)</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-outline" disabled={!file || running || !!busy} onClick={() => send("check")}>
            {busy === "check" ? "Checking…" : "Check file"}
          </button>
          <button type="button" className="btn" disabled={!file || !summary || summary.create + summary.update === 0 || running || !!busy} onClick={() => send("import")}>
            {busy === "import" ? "Starting…" : summary ? `Import ${summary.create + summary.update} product${summary.create + summary.update === 1 ? "" : "s"}` : "Import"}
          </button>
          {!summary && file && !busy && <span className="muted small">Check the file first to see what will change.</span>}
        </div>
        {error && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </section>

      {summary && (
        <section className="panel stack" aria-label="Check result">
          <h3 style={{ margin: 0 }}>What this file will do</h3>
          <p style={{ margin: 0 }}>
            {summary.rows} rows read · <strong>{summary.create}</strong> new product{summary.create === 1 ? "" : "s"} · <strong>{summary.update}</strong> product{summary.update === 1 ? "" : "s"} updated
            {summary.errorCount > 0 && <> · <strong className="field-error">{summary.errorCount} problem{summary.errorCount === 1 ? "" : "s"}</strong> (those products are left out)</>}
          </p>
          {summary.ignoredColumns.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>Columns not used: {summary.ignoredColumns.join(", ")}.</p>
          )}
          {summary.errors.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Row</th><th>Product</th><th>Problem</th></tr></thead>
                <tbody>
                  {summary.errors.map((e, i) => (
                    <tr key={i}><td>{e.row}</td><td>{e.product}</td><td className="field-error">{e.message}</td></tr>
                  ))}
                </tbody>
              </table>
              {summary.errorCount > summary.errors.length && <p className="muted small">…and {summary.errorCount - summary.errors.length} more.</p>}
            </div>
          )}
          {summary.products.length > 0 && (
            <details open={summary.products.length <= 20}>
              <summary>Products in the file</summary>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Row</th><th>Product</th><th></th><th>Sizes in file</th><th>Photos</th></tr></thead>
                  <tbody>
                    {summary.products.map((p) => (
                      <tr key={p.slug}>
                        <td>{p.row}</td>
                        <td>{p.name}<div className="muted small">{p.slug}</div></td>
                        <td><span className={`status status-${p.action === "create" ? "PUBLISHED" : "DRAFT"}`}>{p.action === "create" ? "new" : "update"}</span></td>
                        <td>{p.sizes}{p.newSizes > 0 && p.action === "update" && <span className="muted small"> ({p.newSizes} new)</span>}</td>
                        <td>{p.photos == null ? <span className="muted">unchanged</span> : p.photos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      {job && (
        <section className="panel stack" aria-label="Import progress">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{running ? "Importing…" : job.status === "done" ? "Last Excel import" : "Import stopped"}</h3>
            <span className="muted small">{job.fileName}</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${running ? pct : 100}%`, height: "100%", background: job.status === "failed" ? "var(--danger)" : "var(--accent)", transition: "width .3s" }} />
          </div>
          <p style={{ margin: 0 }} role="status">
            {running ? `${job.processed} of ${job.total} products · ${job.created} added · ${job.updated} updated${job.photos ? ` · ${job.photos} photos downloaded` : ""}` : job.message}
          </p>
          {job.log.length > 0 && (
            <pre className="small" style={{ maxHeight: 220, overflow: "auto", background: "var(--surface-2)", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap", margin: 0 }}>{job.log.join("\n")}</pre>
          )}
        </section>
      )}
    </div>
  );
}
