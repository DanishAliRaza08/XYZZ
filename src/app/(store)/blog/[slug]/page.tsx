import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopImage } from "@/components/ShopImage";
import { formatPostDate, getPublishedPost, getPublishedPosts } from "@/lib/blog";
import { autoExcerpt, readingMinutes, renderBlog } from "@/lib/blog-format";
import { siteUrl } from "@/lib/stripe";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return {};
  const description = post.excerpt || autoExcerpt(post.content, 160);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description, images: post.coverImage ? [post.coverImage] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();
  const more = (await getPublishedPosts()).filter((p) => p.id !== post.id).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || autoExcerpt(post.content, 160),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.author || "Fashion Rockstar" },
    publisher: { "@type": "Organization", name: "Fashion Rockstar" },
    image: post.coverImage ? [post.coverImage.startsWith("/") ? `${siteUrl()}${post.coverImage}` : post.coverImage] : undefined,
    mainEntityOfPage: `${siteUrl()}/blog/${post.slug}`,
  };

  return (
    <div className="container section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="prose blog-article">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/blog">Blog</Link></li>
          </ol>
        </nav>
        <h1>{post.title}</h1>
        <p className="muted small">
          {formatPostDate(post.publishedAt)} · {readingMinutes(post.content)} min read{post.author ? ` · By ${post.author}` : ""}
        </p>
        {post.coverImage && (
          <div className="blog-cover">
            <ShopImage src={post.coverImage} alt="" sizes="(max-width: 760px) 100vw, 720px" priority />
          </div>
        )}
        <div className="blog-body">{renderBlog(post.content)}</div>
      </article>

      {more.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head"><h2>More from the blog</h2><Link href="/blog" className="btn btn-outline btn-sm">All posts</Link></div>
          <div className="blog-grid">
            {more.map((p) => (
              <article key={p.id} className="blog-card">
                <Link href={`/blog/${p.slug}`} className="blog-card-media" tabIndex={-1} aria-hidden>
                  {p.coverImage ? <ShopImage src={p.coverImage} alt="" sizes="(max-width: 700px) 100vw, 33vw" /> : <div className="placeholder-art"><span>{p.title}</span></div>}
                </Link>
                <h3 className="blog-card-title"><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
