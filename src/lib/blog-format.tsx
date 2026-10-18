// Blog post formatting. Posts are written with a few simple marks (shown in the admin editor):
//   ## Heading   ### Smaller heading   **bold**   *italic*   [link text](https://…)   > quote
//   - bullet list   1. numbered list   ![photo description](/uploads/…)   blank line = new paragraph
// The text is turned into React elements directly — never into raw HTML — so a post can't inject scripts.
// No server-only imports here: the admin editor's live preview uses this file in the browser too.
import { Fragment, type ReactNode } from "react";

/** Photos: https:// addresses, uploads (/uploads/…) or files in the public folder — never protocol-relative //host. */
export function isSafeImage(url: string) {
  return /^(https:\/\/|\/(?!\/))/.test(url);
}

/** Links may go to web pages, pages on this site or email addresses — nothing else (no javascript: etc.). */
export function isSafeLink(href: string) {
  return /^(https?:\/\/|\/(?!\/)|mailto:)/i.test(href);
}

const INLINE = [
  { re: /\[([^\]\n]+)\]\(([^)\s]+)\)/, kind: "link" },
  { re: /\*\*([^*\n]+)\*\*/, kind: "bold" },
  { re: /(?<![*\w])[*_]([^*_\n]+)[*_](?![*\w])/, kind: "italic" },
] as const;

/** Bold, italic and links inside a line of text. */
export function renderInline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { index: number; match: RegExpExecArray; kind: (typeof INLINE)[number]["kind"] } | null = null;
    for (const { re, kind } of INLINE) {
      const m = re.exec(rest);
      if (m && (!best || m.index < best.index)) best = { index: m.index, match: m, kind };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    const k = `${key}-${n++}`;
    const [whole, a, b] = best.match;
    if (best.kind === "bold") out.push(<strong key={k}>{renderInline(a, k)}</strong>);
    else if (best.kind === "italic") out.push(<em key={k}>{renderInline(a, k)}</em>);
    else if (isSafeLink(b)) {
      const external = /^https?:\/\//i.test(b);
      out.push(<a key={k} href={b} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{renderInline(a, k)}</a>);
    } else out.push(whole);
    rest = rest.slice(best.index + whole.length);
  }
  return out;
}

const withBreaks = (lines: string[], key: string) =>
  lines.map((l, i) => (
    <Fragment key={`${key}-${i}`}>
      {i > 0 && <br />}
      {renderInline(l, `${key}-${i}`)}
    </Fragment>
  ));

/** The whole post as page elements. */
export function renderBlog(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    const key = `b${blocks.length}`;
    if (!t) {
      i++;
      continue;
    }
    const image = /^!\[([^\]\n]*)\]\(([^)\s]+)\)$/.exec(t);
    if (image) {
      if (isSafeImage(image[2]))
        blocks.push(
          <figure key={key} className="blog-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image[2]} alt={image[1]} loading="lazy" />
            {image[1] && <figcaption>{image[1]}</figcaption>}
          </figure>,
        );
      i++;
    } else if (t.startsWith("### ")) {
      blocks.push(<h3 key={key}>{renderInline(t.slice(4), key)}</h3>);
      i++;
    } else if (t.startsWith("## ") || t.startsWith("# ")) {
      blocks.push(<h2 key={key}>{renderInline(t.replace(/^#+ /, ""), key)}</h2>);
      i++;
    } else if (/^[-*] /.test(t) || /^\d+[.)] /.test(t)) {
      const ordered = /^\d/.test(t);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+[.)] /.test(lines[i].trim()) : /^[-*] /.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^([-*]|\d+[.)]) /, ""));
        i++;
      }
      const lis = items.map((it, j) => <li key={j}>{renderInline(it, `${key}-${j}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>);
    } else if (t.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) quote.push(lines[i++].trim().replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key}>{withBreaks(quote, key)}</blockquote>);
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3} |[-*] |\d+[.)] |>|!\[[^\]\n]*\]\([^)\s]+\)$)/.test(lines[i].trim())) para.push(lines[i++].trim());
      if (!para.length) para.push(lines[i++].trim()); // e.g. a "#" line that isn't a heading
      blocks.push(<p key={key}>{withBreaks(para, key)}</p>);
    }
  }
  return blocks;
}

/** Plain text of a post (formatting marks removed) — for summaries and search engines. */
export function blogPlainText(content: string) {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,3} |^[-*] |^\d+[.)] |^>\s?/gm, "")
    .replace(/\*\*|[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Short summary…" from the first sentences of a post. */
export function autoExcerpt(content: string, max = 180) {
  const text = blogPlainText(content);
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function readingMinutes(content: string) {
  return Math.max(1, Math.round(blogPlainText(content).split(" ").length / 200));
}
