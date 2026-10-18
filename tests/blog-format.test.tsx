import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { autoExcerpt, blogPlainText, isSafeLink, readingMinutes, renderBlog } from "@/lib/blog-format";

const html = (content: string) => renderToStaticMarkup(<>{renderBlog(content) as ReactNode[]}</>);

describe("blog formatting", () => {
  it("turns the simple marks into headings, paragraphs, lists, quotes and photos", () => {
    const out = html(`## Party season\nOur **favourite** *velvet* dresses.\nSecond line.\n\n- Red\n- Green\n\n1. One\n2. Two\n\n> Love it\n\n![Girl in red dress](/uploads/abc.jpg)\n\n### Shop it\nSee [the edit](/shop/girls).`);
    expect(out).toContain("<h2>Party season</h2>");
    expect(out).toContain("<p>Our <strong>favourite</strong> <em>velvet</em> dresses.<br/>Second line.</p>");
    expect(out).toContain("<ul><li>Red</li><li>Green</li></ul>");
    expect(out).toContain("<ol><li>One</li><li>Two</li></ol>");
    expect(out).toContain("<blockquote>Love it</blockquote>");
    expect(out).toContain('<img src="/uploads/abc.jpg" alt="Girl in red dress" loading="lazy"/><figcaption>Girl in red dress</figcaption>');
    expect(out).toContain('<h3>Shop it</h3><p>See <a href="/shop/girls">the edit</a>.</p>');
  });

  it("opens outside links in a new tab", () => {
    expect(html("Read [this](https://example.com/a)")).toContain('<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">this</a>');
  });

  it("never lets a post run scripts or inject HTML", () => {
    const out = html(`<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n![x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n![y](//evil.example/a.png)`);
    expect(out).not.toMatch(/<script|href="javascript|src="javascript|<img src=x|src="\/\/evil/);
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("[click](javascript:alert(1))"); // shown as plain text, not a link
    expect(isSafeLink("mailto:hello@example.com")).toBe(true);
    expect(isSafeLink("//evil.example")).toBe(false);
  });

  it("makes summaries and reading times from the text", () => {
    const content = "## Hello\nThis is **a** [post](/x).\n\n![p](/uploads/a.jpg)";
    expect(blogPlainText(content)).toBe("Hello This is a post.");
    expect(autoExcerpt("word ".repeat(100), 20)).toBe("word word word word…");
    expect(readingMinutes("word ".repeat(1000))).toBe(5);
    expect(isValidElement(renderBlog("hi")[0])).toBe(true);
  });
});
