// Admin → Blog → Upload several posts: turns files into blog post drafts.
//   • Word (.docx): the first heading (or the file name) is the title; headings, bold, italic, links, lists and
//     pictures are kept; the first picture becomes the cover photo.
//   • Text / Markdown (.txt, .md): "# Title" on the first line (or the file name); optional "Summary:",
//     "Author:" and "Cover:" lines at the top; then the post in the blog's formatting (## Heading, **bold** …).
//   • Spreadsheet (.xlsx, .csv): one post per row, with Title and Post columns (and optional Summary, Author,
//     Cover photo, Web address).
// The posts are saved as drafts by src/app/api/admin/blog/import/route.ts.
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { isSafeImage, isSafeLink } from "./blog-format";
import { cellText } from "./product-sheet";
import { sniffImage, uploadDir } from "./uploads";

export type ImportedPost = { title: string; content: string; excerpt?: string; author?: string; coverImage?: string; slug?: string };
export type FileResult = { posts: ImportedPost[]; error?: string };

const titleFromFileName = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

// ---------- HTML (from Word) → blog formatting ----------

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/** Inline HTML → **bold**, *italic*, [links](…) and plain text. */
function inline(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
        const t = inline(text).trim();
        const h = decode(href);
        return t && isSafeLink(h) && !h.startsWith("#") ? `[${t}](${h})` : t;
      })
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_, __, t: string) => (t.replace(/<[^>]+>/g, "").trim() ? `**${t.trim()}**` : ""))
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_, __, t: string) => (t.replace(/<[^>]+>/g, "").trim() ? `*${t.trim()}*` : ""))
      .replace(/<img\s[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function images(html: string): { src: string; alt: string }[] {
  return [...html.matchAll(/<img\s[^>]*>/gi)].map((m) => ({
    src: decode(/src="([^"]*)"/i.exec(m[0])?.[1] ?? ""),
    alt: decode(/alt="([^"]*)"/i.exec(m[0])?.[1] ?? "").replace(/[[\]]/g, "").slice(0, 120),
  })).filter((i) => isSafeImage(i.src));
}

/** Word's HTML (from mammoth) → title + post text in the blog's formatting. The first picture becomes the cover. */
export function htmlToPost(html: string, fileName: string): ImportedPost {
  const blocks: string[] = [];
  let title = "";
  let coverImage: string | undefined;
  const addImages = (h: string) => {
    for (const img of images(h)) {
      if (!coverImage) coverImage = img.src;
      else blocks.push(`![${img.alt || "Photo"}](${img.src})`);
    }
  };
  for (const m of html.matchAll(/<(h[1-6]|p|ul|ol|blockquote|table)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1].toLowerCase();
    const body = m[2];
    addImages(body);
    if (tag === "ul" || tag === "ol") {
      const items = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => inline(li[1])).filter(Boolean);
      if (items.length) blocks.push(items.map((t, i) => (tag === "ol" ? `${i + 1}. ${t}` : `- ${t}`)).join("\n"));
      continue;
    }
    if (tag === "table") {
      // Tables become one paragraph per row ("cell · cell").
      for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => inline(c[1])).filter(Boolean);
        if (cells.length) blocks.push(cells.join(" · "));
      }
      continue;
    }
    const text = inline(body);
    if (!text) continue;
    if (tag === "h1" && !title) title = text.replace(/\*+/g, "");
    else if (tag === "h1" || tag === "h2") blocks.push(`## ${text.replace(/\*+/g, "")}`);
    else if (tag.startsWith("h")) blocks.push(`### ${text.replace(/\*+/g, "")}`);
    else if (tag === "blockquote") blocks.push(`> ${text}`);
    else blocks.push(text);
  }
  // No heading at the top: a short first line that looks like a title is used as the title.
  if (!title && blocks[0] && blocks[0].length <= 100 && !/[.!?:]$/.test(blocks[0]) && !/^(#|-|>|!\[|\d+\.)/.test(blocks[0])) title = blocks.shift()!.replace(/\*+/g, "");
  return { title: (title || titleFromFileName(fileName)).slice(0, 200), content: blocks.join("\n\n"), coverImage };
}

// ---------- text / markdown ----------

/** A .txt / .md file → post. "# Title" first line; "Summary:", "Author:", "Cover:" lines at the top are read too. */
export function textToPost(text: string, fileName: string): ImportedPost {
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const post: ImportedPost = { title: "", content: "" };
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (/^#\s+/.test(lines[i] ?? "")) post.title = lines[i++].replace(/^#\s+/, "").trim();
  for (; i < lines.length; i++) {
    const m = /^(title|summary|excerpt|author|cover|cover photo|web address)\s*:\s*(.+)$/i.exec(lines[i].trim());
    if (!m) {
      if (lines[i].trim()) break;
      continue;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "title") post.title = value;
    else if (key === "summary" || key === "excerpt") post.excerpt = value;
    else if (key === "author") post.author = value;
    else if (key === "web address") post.slug = value;
    else if (isSafeImage(value)) post.coverImage = value;
  }
  post.title = (post.title || titleFromFileName(fileName)).slice(0, 200);
  post.content = lines.slice(i).join("\n").trim();
  return post;
}

// ---------- spreadsheet ----------

const SHEET_KEYS: Record<string, keyof ImportedPost> = {
  title: "title", posttitle: "title", heading: "title",
  post: "content", content: "content", text: "content", body: "content", posttext: "content",
  summary: "excerpt", shortsummary: "excerpt", excerpt: "excerpt",
  author: "author", cover: "coverImage", coverphoto: "coverImage", coverimage: "coverImage", image: "coverImage",
  webaddress: "slug", slug: "slug", url: "slug",
};

export async function sheetToPosts(buf: Buffer, fileName: string): Promise<FileResult> {
  const wb = new ExcelJS.Workbook();
  try {
    if (/\.csv$/i.test(fileName)) await wb.csv.read(Readable.from(buf), { map: (v: unknown) => v } as never);
    else await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    return { posts: [], error: "Couldn't open this spreadsheet. Save it as .xlsx or .csv." };
  }
  const ws = wb.worksheets.find((w) => w.state !== "hidden" && w.rowCount > 0);
  if (!ws) return { posts: [], error: "The spreadsheet is empty." };
  const cols = new Map<number, keyof ImportedPost>();
  ws.getRow(1).eachCell((cell, c) => {
    const key = SHEET_KEYS[cellText(cell.value).toLowerCase().replace(/[^a-z]/g, "")];
    if (key) cols.set(c, key);
  });
  if (![...cols.values()].includes("title") || ![...cols.values()].includes("content"))
    return { posts: [], error: 'The first row needs a "Title" column and a "Post" column.' };
  const posts: ImportedPost[] = [];
  for (let r = 2; r <= Math.min(ws.rowCount, 501); r++) {
    const post: ImportedPost = { title: "", content: "" };
    for (const [c, key] of cols) {
      const v = cellText(ws.getRow(r).getCell(c).value);
      if (v) post[key] = key === "content" ? v.replace(/\r\n?/g, "\n") : v.replace(/\s+/g, " ");
    }
    if (post.title || post.content) posts.push(post);
  }
  return { posts };
}

// ---------- Word ----------

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A Word file → post; its pictures are saved with the other uploads (/uploads/…). */
export async function docxToPost(buf: Buffer, fileName: string): Promise<FileResult> {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  try {
    const result = await mammoth.convertToHtml(
      { buffer: buf },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const data = Buffer.from(await image.readAsBase64String(), "base64");
          const type = data.length <= MAX_IMAGE_BYTES ? sniffImage(data) : null;
          if (!type) return { src: "" }; // not a JPG/PNG/WebP (e.g. a Word drawing): left out
          const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
          await writeFile(path.join(dir, name), data);
          return { src: `/uploads/${name}` };
        }),
      },
    );
    return { posts: [htmlToPost(result.value, fileName)] };
  } catch {
    return { posts: [], error: "Couldn't read this Word file. Save it as .docx (Word 2007 or later) and try again." };
  }
}

/** Any supported file → posts (a spreadsheet can hold many). */
export async function fileToPosts(buf: Buffer, fileName: string): Promise<FileResult> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx") return docxToPost(buf, fileName);
  if (ext === "txt" || ext === "md" || ext === "markdown") return { posts: [textToPost(buf.toString("utf8"), fileName)] };
  if (ext === "xlsx" || ext === "csv") return sheetToPosts(buf, fileName);
  if (ext === "doc") return { posts: [], error: "Old Word files (.doc) can't be read — open it in Word and save it as .docx." };
  return { posts: [], error: "Use Word (.docx), text (.txt, .md) or spreadsheet (.xlsx, .csv) files." };
}

/** Checks a post before it's saved as a draft; returns a reason it can't be, or null. */
export function postProblem(p: ImportedPost): string | null {
  if (p.title.trim().length < 3) return "No title";
  if (p.content.trim().length < 20) return "The post is empty or too short";
  if (p.content.length > 200_000) return "The post is too long — split it into two";
  if (p.coverImage && !isSafeImage(p.coverImage)) return "The cover photo must be an https:// address or an uploaded picture";
  return null;
}
