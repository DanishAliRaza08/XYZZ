import Link from "next/link";
import { BlogUpload } from "@/components/admin/BlogUpload";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BlogUploadPage() {
  await requireAdminPage("settings");
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Upload several posts</h1>
        <Link href="/admin/blog" className="btn btn-sm btn-ghost">← Blog</Link>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
        Upload many blog posts at once. Every post is saved as a <strong>draft</strong>, so nothing appears in the shop until you open it, check it and
        click Publish. A post whose title is already on the blog is skipped, so uploading the same files twice doesn&apos;t make copies.
      </p>

      <BlogUpload />

      <section className="panel stack" aria-labelledby="how">
        <h2 id="how" style={{ margin: 0, fontSize: "1.4rem" }}>How to prepare your posts</h2>

        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ margin: 0 }}>Option 1 — Word documents (one file per post) · easiest</h3>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>Write each post in its own Word document and save it as <strong>.docx</strong> (Google Docs: File → Download → Microsoft Word).</li>
            <li>Make the <strong>first line the title</strong>, using Word&apos;s <em>Heading 1</em> or <em>Title</em> style. Without one, the first short line (or the file name) is used.</li>
            <li>Use <em>Heading 2</em> / <em>Heading 3</em> for section headings. Bold, italic, links, bullet and numbered lists are kept.</li>
            <li>Pictures inside the document are uploaded too. The <strong>first picture becomes the cover photo</strong> (best 1600 × 900 px, landscape); the others stay where they are in the post.</li>
          </ol>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ margin: 0 }}>Option 2 — Text files (.txt or .md, one file per post)</h3>
          <p className="small" style={{ margin: 0 }}>Start with the title, then any of these optional lines, then an empty line and the post. Use the same formatting as the post editor:</p>
          <pre className="small" style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, whiteSpace: "pre-wrap", margin: 0 }}>{`# 5 cosy outfits for winter
Summary: Our favourite warm outfits for kids this winter.
Author: Fashion Rockstar
Cover: https://example.com/winter-cover.jpg

Winter is here, so we've picked our favourite outfits.

## 1. The puffer coat
A **warm** puffer coat goes with everything. [Shop coats](/shop/girls/coats)

- Easy to wash
- Packs small`}</pre>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h3 style={{ margin: 0 }}>Option 3 — One spreadsheet with many posts (.xlsx or .csv)</h3>
          <p className="small" style={{ margin: 0 }}>
            One post per row. The first row has the column names <strong>Title</strong> and <strong>Post</strong> (required), and optionally <strong>Summary</strong>,{" "}
            <strong>Author</strong> and <strong>Cover photo</strong> (an https:// picture address). In Excel, press Alt + Enter inside a cell for a new line.
          </p>
          <a className="btn btn-sm btn-outline" href="/api/admin/blog/import" download style={{ alignSelf: "flex-start" }}>Download the example spreadsheet</a>
        </div>

        <p className="muted small" style={{ margin: 0 }}>
          After uploading: open each draft (Edit &amp; publish), check the text and cover photo — use Adjust to choose which part of the cover shows — then set Status to Published and save.
        </p>
      </section>
    </div>
  );
}
