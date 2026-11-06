// Admin → Blog → Upload several posts: POST files (Word, text, spreadsheet) → each post saved as a draft.
// GET returns the example spreadsheet.
import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requireAdminApi } from "@/lib/auth";
import { fileToPosts, postProblem } from "@/lib/blog-import";
import { invalidateStoreCache } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/shopify-import";

export const dynamic = "force-dynamic";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type PostResult = { file: string; title: string; ok: boolean; id?: string; message: string };

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("settings");
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Upload up to ${MAX_FILES} files at a time.` }, { status: 400 });

  const results: PostResult[] = [];
  const titles = new Set((await prisma.blogPost.findMany({ select: { title: true } })).map((p) => p.title.trim().toLowerCase()));
  for (const file of files) {
    const name = file.name.slice(0, 150);
    if (file.size > MAX_FILE_BYTES) {
      results.push({ file: name, title: "", ok: false, message: "The file is bigger than 20MB" });
      continue;
    }
    const { posts, error } = await fileToPosts(Buffer.from(await file.arrayBuffer()), name);
    if (error) results.push({ file: name, title: "", ok: false, message: error });
    for (const p of posts) {
      const problem = postProblem(p);
      if (problem) {
        results.push({ file: name, title: p.title, ok: false, message: problem });
        continue;
      }
      // Uploading the same post twice doesn't make a copy.
      if (titles.has(p.title.trim().toLowerCase())) {
        results.push({ file: name, title: p.title, ok: false, message: "A post with this title already exists — skipped" });
        continue;
      }
      let slug = slugify(p.slug || p.title) || `post-${Date.now().toString(36)}`;
      if (await prisma.blogPost.findUnique({ where: { slug } })) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
      const post = await prisma.blogPost.create({
        data: {
          title: p.title.trim(), slug, content: p.content.trim(), status: "DRAFT",
          excerpt: p.excerpt?.slice(0, 400) || null, author: p.author?.slice(0, 120) || null, coverImage: p.coverImage || null,
        },
      });
      titles.add(p.title.trim().toLowerCase());
      results.push({ file: name, title: post.title, ok: true, id: post.id, message: post.coverImage ? "Saved as a draft, with a cover photo" : "Saved as a draft" });
    }
  }
  const saved = results.filter((r) => r.ok).length;
  if (saved) {
    await audit(admin.id, "import", "BlogPost", undefined, `${saved} drafts from ${files.length} files`);
    invalidateStoreCache();
  }
  return NextResponse.json({ results, saved });
}

/** The example spreadsheet: one post per row. */
export async function GET() {
  if (!(await requireAdminApi("settings"))) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Posts");
  ws.columns = [
    { header: "Title", key: "title", width: 40 },
    { header: "Post", key: "content", width: 90 },
    { header: "Summary", key: "excerpt", width: 40 },
    { header: "Author", key: "author", width: 20 },
    { header: "Cover photo", key: "cover", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({
    title: "5 cosy outfits for winter",
    content: "Winter is here, so we've picked our favourite warm outfits.\n\n## 1. The puffer coat\nA **warm** puffer coat goes with everything. [Shop coats](/shop/girls/coats)\n\n- Easy to wash\n- Packs small",
    excerpt: "Our favourite warm outfits for kids this winter.",
    author: "Fashion Rockstar",
    cover: "",
  });
  ws.getColumn("content").alignment = { wrapText: true, vertical: "top" };
  return new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="blog-posts-example.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
