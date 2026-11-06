// Admin → Blog → Upload several posts: reading Word, text and spreadsheet files into drafts.
import ExcelJS from "exceljs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileToPosts, htmlToPost, postProblem, textToPost } from "@/lib/blog-import";

describe("text and Markdown files", () => {
  it("reads the title, the optional lines at the top and the post", () => {
    const post = textToPost("# Winter outfits\nSummary: Warm picks\nAuthor: Ayesha\nCover: https://cdn.example.com/c.jpg\n\nIntro line.\n\n## Coats\n- Warm\n", "ignored.md");
    expect(post).toEqual({ title: "Winter outfits", excerpt: "Warm picks", author: "Ayesha", coverImage: "https://cdn.example.com/c.jpg", content: "Intro line.\n\n## Coats\n- Warm" });
  });

  it("uses the file name when there's no title line, and ignores unsafe covers", () => {
    const post = textToPost("Cover: javascript:alert(1)\n\nJust the post text here.", "back-to-school_tips.txt");
    expect(post.title).toBe("Back to school tips");
    expect(post.coverImage).toBeUndefined();
    expect(post.content).toBe("Just the post text here.");
  });
});

describe("Word HTML", () => {
  it("keeps headings, bold, italic, safe links and lists; first picture is the cover", () => {
    const post = htmlToPost(
      '<h1>My <strong>title</strong></h1><p><img src="/uploads/a.png" alt="x" /></p><p>Hello <strong>bold</strong> and <em>it</em> <a href="https://shop.example/x">link</a> <a href="javascript:alert(1)">bad</a></p>' +
        '<h2>Part</h2><ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol><p><img src="/uploads/b.png" alt="Second [photo]" /></p><blockquote><p>Quote</p></blockquote><p><script>alert(1)</script>Safe &amp; sound</p>',
      "f.docx",
    );
    expect(post.title).toBe("My title");
    expect(post.coverImage).toBe("/uploads/a.png");
    expect(post.content.split("\n\n")).toEqual([
      "Hello **bold** and *it* [link](https://shop.example/x) bad",
      "## Part",
      "- One\n- Two",
      "1. First",
      "![Second photo](/uploads/b.png)",
      "> Quote",
      "alert(1)Safe & sound",
    ]);
  });

  it("without a heading, a short first line becomes the title", () => {
    expect(htmlToPost("<p>Party season guide</p><p>Here is the guide.</p>", "x.docx")).toMatchObject({ title: "Party season guide", content: "Here is the guide." });
    expect(htmlToPost("<p>This is a sentence that ends with a full stop.</p>", "my-post.docx").title).toBe("My post");
  });
});

describe("files", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fr-blog-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("reads a real Word file, saving its picture as the cover", async () => {
    const { posts, error } = await fileToPosts(await readFile(path.join(__dirname, "fixtures/blog-post.docx")), "blog-post.docx");
    expect(error).toBeUndefined();
    const [p] = posts;
    expect(p.title).toBe("Christmas jumpers for the whole family");
    expect(p.coverImage).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    expect(await readdir(dir)).toEqual([p.coverImage!.slice("/uploads/".length)]);
    expect(p.content).toBe("Our **favourite** festive knits are *back* for 2026.\n\n## Why kids love them\n\n- Soft and warm\n- Machine washable\n\n### Sizes\n\nFrom 2 years to 14 years, in navy, red and green.");
    expect(postProblem(p)).toBeNull();
  });

  it("reads many posts from a spreadsheet", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Posts");
    ws.addRow(["Title", "Post", "Summary", "Cover photo"]);
    ws.addRow(["First post", "Line one.\r\n\r\n## A heading", "Short", "https://cdn.example.com/1.jpg"]);
    ws.addRow(["", "", "", ""]);
    ws.addRow(["Second post", "Some text for the second post.", "", ""]);
    const { posts } = await fileToPosts(Buffer.from(await wb.xlsx.writeBuffer()), "posts.xlsx");
    expect(posts).toEqual([
      { title: "First post", content: "Line one.\n\n## A heading", excerpt: "Short", coverImage: "https://cdn.example.com/1.jpg" },
      { title: "Second post", content: "Some text for the second post." },
    ]);
    expect(postProblem(posts[0])).toBeNull();
    expect(postProblem({ title: "Tiny", content: "Too short" })).toBe("The post is empty or too short");
  });

  it("explains files it can't read", async () => {
    expect((await fileToPosts(Buffer.from("x"), "old.doc")).error).toMatch(/save it as \.docx/);
    expect((await fileToPosts(Buffer.from("x"), "photo.jpg")).error).toMatch(/Use Word/);
    expect((await fileToPosts(Buffer.from("not a zip"), "broken.docx")).error).toMatch(/Couldn't read this Word file/);
    expect((await fileToPosts(Buffer.from("Name,Body\nA,B\n"), "x.csv")).error).toMatch(/"Title" column/);
  });
});
