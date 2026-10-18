import Link from "next/link";
import { BlogForm, EMPTY_POST } from "@/components/admin/BlogForm";
import { requireAdminPage } from "@/lib/auth";

export default async function NewBlogPostPage() {
  const admin = await requireAdminPage("settings");
  return (
    <div className="stack">
      <Link href="/admin/blog" className="small">← All posts</Link>
      <h1 style={{ margin: 0 }}>New blog post</h1>
      <BlogForm initial={{ ...EMPTY_POST, author: admin.name === "Owner" ? "" : admin.name }} />
    </div>
  );
}
