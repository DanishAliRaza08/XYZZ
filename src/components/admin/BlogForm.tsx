"use client";

import { useRef, useState } from "react";
import { saveBlogPost } from "@/app/admin/actions";
import { renderBlog } from "@/lib/blog-format";
import { ActionForm } from "./ActionForm";

export type BlogInitial = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  coverImage: string;
  status: "DRAFT" | "PUBLISHED";
  content: string;
};

export const EMPTY_POST: BlogInitial = { title: "", slug: "", excerpt: "", author: "", coverImage: "", status: "DRAFT", content: "" };

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

/** The blog post editor: title, cover photo, the post text with a formatting toolbar, and a live preview. */
export function BlogForm({ initial }: { initial: BlogInitial }) {
  const [content, setContent] = useState(initial.content);
  const [cover, setCover] = useState(initial.coverImage);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  /** Wraps the selected text (or a placeholder) in formatting marks, or starts the current line with a prefix. */
  const format = (before: string, after = "", placeholder = "text", linePrefix = false) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = content.slice(s, e) || placeholder;
    let next: string;
    let cursor: number;
    if (linePrefix) {
      const lineStart = content.lastIndexOf("\n", s - 1) + 1;
      next = content.slice(0, lineStart) + before + content.slice(lineStart);
      cursor = e + before.length;
    } else {
      next = content.slice(0, s) + before + selected + after + content.slice(e);
      cursor = s + before.length + selected.length;
    }
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(linePrefix ? cursor : s + before.length, cursor);
    });
  };

  const insertBlock = (block: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? content.length;
    const pre = content.slice(0, at).replace(/\s*$/, "");
    const next = `${pre}${pre ? "\n\n" : ""}${block}\n\n${content.slice(at).replace(/^\s*/, "")}`;
    setContent(next);
  };

  const upload = async (files: FileList | null, onUrl: (url: string, name: string) => void) => {
    if (!files?.length) return;
    setBusy(true);
    setUploadError(null);
    try {
      for (const f of Array.from(files)) onUrl(await uploadImage(f), f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
  };

  const tool = (label: string, title: string, onClick: () => void) => (
    <button type="button" className="btn btn-sm btn-ghost" title={title} aria-label={title} onClick={onClick} disabled={tab === "preview"}>{label}</button>
  );

  return (
    <ActionForm action={saveBlogPost} submitLabel={initial.id ? "Save post" : "Create post"}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="coverImage" value={cover} />
      <input type="hidden" name="content" value={content} />

      <section className="panel stack">
        <div className="field">
          <label htmlFor="title">Title *</label>
          <input id="title" name="title" className="input" defaultValue={initial.title} required maxLength={200} placeholder="5 party outfits for Christmas 2026" />
        </div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" className="select" defaultValue={initial.status}>
              <option value="DRAFT">Draft (only you can see it)</option>
              <option value="PUBLISHED">Published (live on /blog)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="author">Author (optional)</label>
            <input id="author" name="author" className="input" defaultValue={initial.author} maxLength={120} placeholder="e.g. Ayesha, Fashion Rockstar" />
          </div>
          <div className="field">
            <label htmlFor="slug">Web address (optional)</label>
            <input id="slug" name="slug" className="input" defaultValue={initial.slug} maxLength={80} placeholder="made from the title" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="excerpt">Short summary (optional)</label>
          <textarea id="excerpt" name="excerpt" className="textarea" defaultValue={initial.excerpt} maxLength={400} rows={2} placeholder="Shown on the blog page and in Google results. Leave empty to use the first lines of the post." />
        </div>
      </section>

      <section className="panel stack">
        <h3>Cover photo</h3>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" style={{ width: "100%", maxWidth: 480, aspectRatio: "16/9", objectFit: "cover", borderRadius: 6, background: "var(--surface-2)" }} />
        )}
        <div className="row">
          <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : cover ? "Replace cover photo" : "Upload cover photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files, (url) => setCover(url))} />
          </label>
          {cover && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCover("")}>Remove</button>}
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Post</h3>
          <div className="row" style={{ gap: 4 }} role="tablist">
            <button type="button" role="tab" aria-selected={tab === "write"} className={`btn btn-sm ${tab === "write" ? "" : "btn-ghost"}`} onClick={() => setTab("write")}>Write</button>
            <button type="button" role="tab" aria-selected={tab === "preview"} className={`btn btn-sm ${tab === "preview" ? "" : "btn-ghost"}`} onClick={() => setTab("preview")}>Preview</button>
          </div>
        </div>
        <div className="row" style={{ gap: 2, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
          {tool("H2", "Heading", () => format("## ", "", "", true))}
          {tool("H3", "Smaller heading", () => format("### ", "", "", true))}
          {tool("B", "Bold", () => format("**", "**", "bold text"))}
          {tool("I", "Italic", () => format("*", "*", "italic text"))}
          {tool("Link", "Link", () => {
            const url = window.prompt("Link address (https://… or a page on this site like /shop/girls)");
            if (url) format("[", `](${url.trim()})`, "link text");
          })}
          {tool("• List", "Bullet list", () => format("- ", "", "", true))}
          {tool("1. List", "Numbered list", () => format("1. ", "", "", true))}
          {tool("“ Quote", "Quote", () => format("> ", "", "", true))}
          <label className={`btn btn-sm btn-ghost${tab === "preview" ? " disabled" : ""}`} style={{ cursor: "pointer" }} title="Insert a photo">
            {busy ? "Uploading…" : "+ Photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={tab === "preview"} onChange={(e) => upload(e.target.files, (url, name) => insertBlock(`![${name}](${url})`))} />
          </label>
        </div>
        {tab === "write" ? (
          <textarea
            ref={area}
            className="textarea"
            rows={22}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            aria-label="Post text"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.92rem", lineHeight: 1.6 }}
            placeholder={"Start writing…\n\n## A heading\nA paragraph with **bold** and *italic* words and a [link](/shop/girls).\n\n- A bullet point\n- Another one\n\nUse + Photo to add pictures."}
          />
        ) : (
          <div className="prose blog-body" style={{ minHeight: 300, maxWidth: "none" }}>
            {content.trim() ? renderBlog(content) : <p className="muted">Nothing to preview yet.</p>}
          </div>
        )}
        <p className="muted small">
          Formatting: <code>## Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>[text](https://…)</code> · <code>- list</code> · <code>&gt; quote</code>. Leave an empty line between paragraphs. The toolbar adds these for you.
        </p>
        {uploadError && <p className="field-error">{uploadError}</p>}
      </section>
    </ActionForm>
  );
}
