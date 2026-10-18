import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatPostDate } from "@/lib/blog";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  await requireAdminPage("settings");
  const posts = await prisma.blogPost.findMany({ orderBy: [{ updatedAt: "desc" }], select: { id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true } });
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Blog</h1>
        <Link href="/admin/blog/new" className="btn">New post</Link>
      </div>
      <p className="muted">Write posts for <Link href="/blog" style={{ textDecoration: "underline" }}>your blog</Link>. Drafts are only visible here; published posts appear on /blog straight away.</p>
      {posts.length === 0 ? (
        <div className="panel"><p className="muted" style={{ margin: 0 }}>No posts yet. <Link href="/admin/blog/new" style={{ textDecoration: "underline" }}>Write your first post</Link>.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>Status</th><th>Published</th><th>Last edited</th><th /></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/blog/${p.id}`}><strong>{p.title}</strong></Link></td>
                  <td><span className={`status status-${p.status === "PUBLISHED" ? "PAID" : "PENDING_PAYMENT"}`}>{p.status === "PUBLISHED" ? "Published" : "Draft"}</span></td>
                  <td className="small">{p.publishedAt ? formatPostDate(p.publishedAt) : "—"}</td>
                  <td className="small">{formatPostDate(p.updatedAt)}</td>
                  <td className="row" style={{ gap: 6 }}>
                    <Link href={`/admin/blog/${p.id}`} className="btn btn-sm btn-outline">Edit</Link>
                    {p.status === "PUBLISHED" && <Link href={`/blog/${p.slug}`} className="btn btn-sm btn-ghost" target="_blank">View</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
