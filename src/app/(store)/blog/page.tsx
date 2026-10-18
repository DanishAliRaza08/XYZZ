import type { Metadata } from "next";
import Link from "next/link";
import { ShopImage } from "@/components/ShopImage";
import { formatPostDate, getPublishedPosts } from "@/lib/blog";
import { autoExcerpt, readingMinutes } from "@/lib/blog-format";

export const metadata: Metadata = {
  title: "Blog",
  description: "Style notes, occasionwear ideas and seasonal edits from Fashion Rockstar.",
  alternates: { canonical: "/blog" },
};
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  return (
    <div className="container section">
      <span className="eyebrow">Journal</span>
      <h1>The Fashion Rockstar blog</h1>
      <p className="muted" style={{ maxWidth: 640 }}>Style notes, occasionwear ideas and seasonal edits for the whole family.</p>
      {posts.length === 0 ? (
        <div className="empty" style={{ margin: "30px 0 60px" }}>
          <h2>New stories coming soon</h2>
          <Link href="/shop/new-arrivals" className="btn">Shop new arrivals</Link>
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((p, i) => (
            <article key={p.id} className="blog-card">
              <Link href={`/blog/${p.slug}`} className="blog-card-media" tabIndex={-1} aria-hidden>
                {p.coverImage ? (
                  <ShopImage src={p.coverImage} alt="" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" priority={i < 3} />
                ) : (
                  <div className="placeholder-art"><span>{p.title}</span></div>
                )}
              </Link>
              <p className="muted small" style={{ margin: "12px 0 4px" }}>
                {formatPostDate(p.publishedAt)} · {readingMinutes(p.content)} min read
              </p>
              <h2 className="blog-card-title"><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
              <p className="muted">{p.excerpt || autoExcerpt(p.content)}</p>
              <Link href={`/blog/${p.slug}`} className="small" style={{ textDecoration: "underline" }}>Read more</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
