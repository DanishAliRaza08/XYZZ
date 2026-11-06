"use client";

// Admin → Blog → Upload several posts: pick (or drop) files; each post is saved as a draft and listed with an Edit link.
import Link from "next/link";
import { useState } from "react";
import type { PostResult } from "@/app/api/admin/blog/import/route";

const ACCEPT = ".docx,.txt,.md,.xlsx,.csv";

export function BlogUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PostResult[] | null>(null);
  const [over, setOver] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const add = (list: FileList | null) => {
    if (!list) return;
    setResults(null);
    setError(null);
    setFiles((cur) => [...cur, ...Array.from(list).filter((f) => !cur.some((c) => c.name === f.name && c.size === f.size))]);
  };

  const upload = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    try {
      const res = await fetch("/api/admin/blog/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: "The server didn't answer properly — try again." }));
      if (!res.ok) setError(data.error ?? "Upload failed.");
      else {
        setResults(data.results);
        setFiles([]);
        setInputKey((k) => k + 1);
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(false);
  };

  const saved = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="stack">
      <section className="panel stack">
        <label
          style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 16px", border: `2px dashed ${over ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", gap: 6 }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        >
          <strong>Drop your files here, or click to choose them</strong>
          <span className="muted small">Word (.docx), text (.txt, .md) or a spreadsheet (.xlsx, .csv) · up to 50 files at a time</span>
          <input key={inputKey} type="file" multiple accept={ACCEPT} hidden onChange={(e) => add(e.target.files)} aria-label="Choose blog files" />
        </label>
        {files.length > 0 && (
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {files.map((f) => (
              <li key={`${f.name}${f.size}`}>
                {f.name} <span className="muted">({Math.max(1, Math.round(f.size / 1024))} KB)</span>{" "}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove ${f.name}`}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn" disabled={!files.length || busy} onClick={upload}>
            {busy ? "Uploading…" : files.length ? `Upload ${files.length} file${files.length === 1 ? "" : "s"} as drafts` : "Upload as drafts"}
          </button>
          {files.length > 0 && !busy && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>Clear</button>}
        </div>
        {error && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </section>

      {results && (
        <section className="panel stack" aria-label="Upload result">
          <p className={saved ? "alert alert-success" : "alert alert-warning"} style={{ margin: 0 }} role="status">
            {saved} post{saved === 1 ? "" : "s"} saved as draft{saved === 1 ? "" : "s"}
            {results.length > saved && ` · ${results.length - saved} not saved (see below)`}. Drafts aren&apos;t visible in the shop until you publish them.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File</th><th>Post</th><th>Result</th><th /></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="small">{r.file}</td>
                    <td>{r.title || <span className="muted">—</span>}</td>
                    <td className={r.ok ? "small" : "small field-error"}>{r.message}</td>
                    <td>{r.id && <Link href={`/admin/blog/${r.id}`} className="btn btn-sm btn-outline">Edit &amp; publish</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/admin/blog" className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }}>← All posts</Link>
        </section>
      )}
    </div>
  );
}
