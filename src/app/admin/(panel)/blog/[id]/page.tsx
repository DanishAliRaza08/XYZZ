import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBlogPost } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ActionForm";
import { BlogForm } from "@/components/admin/BlogForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdminPage("settings");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) notFound();
  return (
    <div className="stack">
      <Link href="/admin/blog" className="small">← All posts</Link>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Edit post</h1>
        <div className="row" style={{ gap: 6 }}>
          {post.status === "PUBLISHED" && <Link href={`/blog/${post.slug}`} target="_blank" className="btn btn-sm btn-outline">View on site</Link>}
          <form action={deleteBlogPost}>
            <input type="hidden" name="id" value={post.id} />
            <ConfirmButton label="Delete post" message={`Delete “${post.title}”? This can't be undone.`} className="btn btn-sm btn-ghost" />
          </form>
        </div>
      </div>
      {sp.saved && <p className="alert alert-success" style={{ margin: 0 }}>Post created.</p>}
      <BlogForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          author: post.author ?? "",
          coverImage: post.coverImage ?? "",
          status: post.status,
          content: post.content,
        }}
      />
    </div>
  );
}
