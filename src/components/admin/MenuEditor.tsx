"use client";

// Admin → Menu: edit the shop's top menu (Boys, Girls, Women…), the columns and pages in each dropdown,
// and which products each one lists. Saved as one piece with saveMenu (src/app/admin/actions.ts).
import { useState } from "react";
import { saveMenu } from "@/app/admin/actions";
import type { NavColumn, NavFilter, NavLink, NavPage, Section } from "@/lib/navigation";
import { ActionForm } from "./ActionForm";

type Cat = { slug: string; name: string };
type Dept = { value: string; label: string };

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const iconBtn = (label: string, onClick: () => void, disabled = false, text?: string) => (
  <button type="button" className="btn btn-sm btn-ghost" onClick={onClick} disabled={disabled} aria-label={label} title={label}>{text ?? label}</button>
);

/** Which products a menu item or page lists: a department, any of some categories, and/or any of some collections. */
function FilterFields({ value, onChange, cats, depts, inherit }: { value: NavFilter; onChange: (f: NavFilter) => void; cats: Cat[]; depts: Dept[]; inherit?: NavFilter }) {
  const [collections, setCollections] = useState((value.collections ?? []).join(", "));
  const chosen = new Set(value.categories ?? []);
  const deptLabel = (v?: string) => depts.find((d) => d.value === v)?.label;
  const summary = [
    deptLabel(value.department) ?? (inherit?.department ? `${deptLabel(inherit.department)} (from the menu item)` : null),
    chosen.size ? cats.filter((c) => chosen.has(c.slug)).map((c) => c.name).join(", ") : null,
    value.collections?.length ? `collection: ${value.collections.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <details className="menu-filter">
      <summary className="small">Shows: <strong>{summary || (inherit ? "everything in the menu item" : "every product")}</strong> <span className="muted">(change)</span></summary>
      <div className="stack" style={{ gap: 8, paddingTop: 8 }}>
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="small">Department</span>
          <select className="select" value={value.department ?? ""} onChange={(e) => onChange({ ...value, department: (e.target.value || undefined) as NavFilter["department"] })}>
            <option value="">{inherit ? "Same as the menu item" : "Any department"}</option>
            {depts.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
        <div>
          <span className="small">Categories (products in any of the ticked ones; none ticked = all categories)</span>
          <div className="menu-cats">
            {cats.map((c) => (
              <label key={c.slug} className="chip">
                <input
                  type="checkbox"
                  checked={chosen.has(c.slug)}
                  onChange={(e) => onChange({ ...value, categories: e.target.checked ? [...chosen, c.slug] : [...chosen].filter((x) => x !== c.slug) })}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="small">Collections (optional, separated by commas — products whose Collection field matches, e.g. Halloween, Christmas)</span>
          <input
            className="input"
            value={collections}
            onChange={(e) => setCollections(e.target.value)}
            onBlur={() => onChange({ ...value, collections: collections.split(",").map((x) => x.trim()).filter(Boolean) })}
          />
        </label>
      </div>
    </details>
  );
}

function PageRow({ page, onChange, onRemove, onMove, first, last, cats, depts, inherit, sectionSlug }: {
  page: NavPage & { _auto?: boolean }; onChange: (p: NavPage & { _auto?: boolean }) => void; onRemove: () => void; onMove: (by: number) => void;
  first: boolean; last: boolean; cats: Cat[]; depts: Dept[]; inherit: NavFilter; sectionSlug: string;
}) {
  return (
    <li className="menu-page">
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <input className="input" style={{ maxWidth: 240 }} aria-label="Page name" placeholder="Page name, e.g. Dresses" value={page.label}
          onChange={(e) => onChange({ ...page, label: e.target.value, ...(page._auto ? { slug: slugify(e.target.value) } : {}) })} />
        <span className="muted small">/shop/{sectionSlug}/</span>
        <input className="input" style={{ maxWidth: 180 }} aria-label="Page web address" value={page.slug} onChange={(e) => onChange({ ...page, slug: slugify(e.target.value), _auto: false })} />
        <span className="spacer" />
        {iconBtn("Move up", () => onMove(-1), first, "↑")}
        {iconBtn("Move down", () => onMove(1), last, "↓")}
        {iconBtn(`Remove ${page.label || "page"}`, onRemove, false, "✕")}
      </div>
      <FilterFields value={page.filter ?? {}} onChange={(filter) => onChange({ ...page, filter })} cats={cats} depts={depts} inherit={inherit} />
    </li>
  );
}

function ColumnBox({ column, onChange, onRemove, onMove, first, last, cats, depts, section }: {
  column: NavColumn; onChange: (c: NavColumn) => void; onRemove: () => void; onMove: (by: number) => void; first: boolean; last: boolean; cats: Cat[]; depts: Dept[]; section: Section;
}) {
  const pages = column.pages ?? [];
  const links = column.links ?? [];
  const setPages = (p: NavPage[]) => onChange({ ...column, pages: p });
  const setLinks = (l: NavLink[]) => onChange({ ...column, links: l });
  return (
    <div className="menu-column">
      <div className="row" style={{ gap: 6 }}>
        <input className="input" style={{ maxWidth: 280, fontWeight: 600 }} aria-label="Column heading" placeholder="Column heading, e.g. Clothing" value={column.title} onChange={(e) => onChange({ ...column, title: e.target.value })} />
        <span className="spacer" />
        {iconBtn("Move column up", () => onMove(-1), first, "↑")}
        {iconBtn("Move column down", () => onMove(1), last, "↓")}
        {iconBtn("Remove column", onRemove, false, "Remove column")}
      </div>
      <ul className="menu-pages">
        {pages.map((p, i) => (
          <PageRow key={i} page={p} cats={cats} depts={depts} inherit={section.filter} sectionSlug={section.slug} first={i === 0} last={i === pages.length - 1}
            onChange={(np) => setPages(pages.map((x, j) => (j === i ? np : x)))}
            onRemove={() => setPages(pages.filter((_, j) => j !== i))}
            onMove={(by) => setPages(move(pages, i, by))} />
        ))}
      </ul>
      {links.length > 0 && (
        <ul className="menu-pages">
          {links.map((l, i) => (
            <li key={i} className="row" style={{ gap: 6 }}>
              <span className="small muted">Link</span>
              <input className="input" style={{ maxWidth: 220 }} aria-label="Link name" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="input" style={{ maxWidth: 260 }} aria-label="Link address" placeholder="/shop/… or https://…" value={l.href} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, href: e.target.value.trim() } : x)))} />
              {iconBtn(`Remove ${l.label || "link"}`, () => setLinks(links.filter((_, j) => j !== i)), false, "✕")}
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setPages([...pages, { slug: "", label: "", filter: {}, _auto: true } as NavPage])}>+ Add page</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLinks([...links, { label: "", href: "/shop/" }])}>+ Add link to another page</button>
      </div>
    </div>
  );
}

function SectionBox({ section, onChange, onRemove, onMove, first, last, cats, depts, open }: {
  section: Section & { _auto?: boolean }; onChange: (s: Section & { _auto?: boolean }) => void; onRemove: () => void; onMove: (by: number) => void;
  first: boolean; last: boolean; cats: Cat[]; depts: Dept[]; open: boolean;
}) {
  const cols = section.columns;
  const setCols = (c: NavColumn[]) => onChange({ ...section, columns: c });
  const pageCount = cols.reduce((n, c) => n + (c.pages?.length ?? 0), 0);
  return (
    <details className="panel menu-section" open={open}>
      <summary className="row" style={{ gap: 8 }}>
        <strong style={{ fontSize: "1.05rem" }}>{section.label || "New menu item"}</strong>
        <span className="muted small">/shop/{section.slug} · {pageCount} page{pageCount === 1 ? "" : "s"}</span>
        <span className="spacer" />
        <span onClick={(e) => e.preventDefault()} className="row" style={{ gap: 2 }}>
          {iconBtn(`Move ${section.label} left`, () => onMove(-1), first, "↑")}
          {iconBtn(`Move ${section.label} right`, () => onMove(1), last, "↓")}
          {iconBtn(`Remove ${section.label || "menu item"}`, () => { if (window.confirm(`Remove “${section.label || "this item"}” from the menu? Its products stay in the shop.`)) onRemove(); }, false, "Remove")}
        </span>
      </summary>
      <div className="stack" style={{ paddingTop: 12 }}>
        <div className="grid-2">
          <label className="field">
            <span>Name in the menu</span>
            <input className="input" value={section.label} maxLength={40} onChange={(e) => onChange({ ...section, label: e.target.value, ...(section._auto ? { slug: slugify(e.target.value) } : {}) })} />
          </label>
          <label className="field">
            <span>Web address: /shop/…</span>
            <input className="input" value={section.slug} onChange={(e) => onChange({ ...section, slug: slugify(e.target.value), _auto: false })} />
          </label>
        </div>
        <label className="field">
          <span>Description (shown at the top of its page and in the dropdown)</span>
          <input className="input" value={section.description} maxLength={300} onChange={(e) => onChange({ ...section, description: e.target.value })} />
        </label>
        <div>
          <span className="small"><strong>Which products its page shows</strong> — its pages below show part of these</span>
          <FilterFields value={section.filter} onChange={(filter) => onChange({ ...section, filter })} cats={cats} depts={depts} />
        </div>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <label className="checkbox small">
            <input type="checkbox" checked={Boolean(section.tile)} onChange={(e) => onChange({ ...section, tile: e.target.checked ? { image: "", button: `Shop ${section.label.toLowerCase()}` } : undefined })} />
            Show a tile in “Shop by department” on the homepage (picture and text: Site settings)
          </label>
          {section.filter.department && (
            <label className="checkbox small">
              <input type="checkbox" checked={Boolean(section.autoCategories)} onChange={(e) => onChange({ ...section, autoCategories: e.target.checked })} />
              Add other categories with products under “More in {section.label || "…"}”
            </label>
          )}
        </div>

        <h4 style={{ margin: "8px 0 0" }}>Dropdown columns and pages</h4>
        {cols.length === 0 && <p className="muted small" style={{ margin: 0 }}>No dropdown — the menu item goes straight to its page.</p>}
        {cols.map((c, i) => (
          <ColumnBox key={i} column={c} section={section} cats={cats} depts={depts} first={i === 0} last={i === cols.length - 1}
            onChange={(nc) => setCols(cols.map((x, j) => (j === i ? nc : x)))}
            onRemove={() => { if (!(c.pages?.length || c.links?.length) || window.confirm(`Remove the column “${c.title || "untitled"}” and its pages?`)) setCols(cols.filter((_, j) => j !== i)); }}
            onMove={(by) => setCols(move(cols, i, by))} />
        ))}
        <button type="button" className="btn btn-sm btn-outline" style={{ alignSelf: "flex-start" }} onClick={() => setCols([...cols, { title: "", pages: [] }])} disabled={cols.length >= 6}>+ Add column</button>

        <details>
          <summary className="small">Promo box in the dropdown (optional)</summary>
          <div className="grid-2" style={{ paddingTop: 8 }}>
            {(["title", "text", "href", "cta"] as const).map((k) => (
              <label key={k} className="field">
                <span className="small">{{ title: "Heading", text: "Text", href: "Link (e.g. /shop/girls/partywear)", cta: "Button text" }[k]}</span>
                <input className="input" value={section.promo?.[k] ?? ""}
                  onChange={(e) => onChange({ ...section, promo: { title: "", text: "", href: "", cta: "", ...section.promo, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>Leave the heading empty for no promo box.</p>
        </details>
      </div>
    </details>
  );
}

export function MenuEditor({ initial, cats, depts }: { initial: Section[]; cats: Cat[]; depts: Dept[] }) {
  const [sections, setSections] = useState<(Section & { _auto?: boolean })[]>(initial);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Strip the editor's own helper fields before saving.
  const json = JSON.stringify(sections.map(({ _auto, ...s }) => ({
    ...s,
    columns: s.columns.map((c) => ({ ...c, pages: c.pages?.map(({ _auto: _a, ...p }: NavPage & { _auto?: boolean }) => p) })),
  })));

  return (
    <ActionForm action={saveMenu} submitLabel="Save menu">
      <input type="hidden" name="menu" value={json} />
      <div className="menu-preview" aria-label="Menu preview">
        {sections.map((s, i) => <span key={i}>{s.label || "…"}</span>)}
        <span style={{ color: "var(--accent)" }}>Sale</span>
      </div>
      {sections.map((s, i) => (
        <SectionBox key={i} section={s} cats={cats} depts={depts} first={i === 0} last={i === sections.length - 1} open={openIndex === i}
          onChange={(ns) => setSections(sections.map((x, j) => (j === i ? ns : x)))}
          onRemove={() => setSections(sections.filter((_, j) => j !== i))}
          onMove={(by) => setSections(move(sections, i, by))} />
      ))}
      <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} disabled={sections.length >= 15}
        onClick={() => { setSections([...sections, { slug: "", label: "", description: "", filter: {}, columns: [{ title: "", pages: [] }], _auto: true }]); setOpenIndex(sections.length); }}>
        + Add menu item
      </button>
      <p className="muted small" style={{ margin: 0 }}>Changes go live when you click Save menu. “Sale” is always last in the menu.</p>
    </ActionForm>
  );
}
