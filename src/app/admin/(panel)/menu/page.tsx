import Link from "next/link";
import { resetMenu } from "../../actions";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { requireAdminPage } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { getSections, menuIsEdited } from "@/lib/navigation-server";

export const dynamic = "force-dynamic";

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  await requireAdminPage("settings");
  const [sections, edited, categories, sp] = await Promise.all([
    getSections(),
    menuIsEdited(),
    prisma.category.findMany({ select: { slug: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    searchParams,
  ]);
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Menu</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
        The shop&apos;s top menu. Each <strong>menu item</strong> (Boys, Girls, Women…) has its own page and a dropdown with <strong>columns</strong> of{" "}
        <strong>pages</strong> (sub-categories, e.g. Girls → Dresses). Add, rename, reorder or remove them here, and choose which products each one shows:
        a department, one or more <Link href="/admin/categories" style={{ textDecoration: "underline" }}>categories</Link>, and/or a collection.
        Removing a menu item or page doesn&apos;t delete any products.
      </p>
      <details className="small muted" style={{ maxWidth: 820 }}>
        <summary>How it works</summary>
        <ul style={{ paddingLeft: 18 }}>
          <li>A <strong>page</strong> shows the products of its menu item narrowed down by what you choose for the page — e.g. the Girls item shows department Girls, and its “Dresses” page adds the category Dresses.</li>
          <li>To add a new sub-category: create the category in <Link href="/admin/categories">Categories</Link>, then add a page for it here and tick that category. Put products in it on each product&apos;s page.</li>
          <li>Departments (Women, Men, Girls, Boys, Baby) are the fixed groups every product belongs to. A menu item doesn&apos;t need one: e.g. “Footwear” shows the category Footwear from every department.</li>
          <li>Pictures and text of the homepage “Shop by department” tiles are in <Link href="/admin/settings">Site settings</Link>.</li>
        </ul>
      </details>
      {sp.reset && <p className="alert alert-success" role="status" style={{ margin: 0 }}>The original menu is back.</p>}
      {/* Rebuilt only after a reset (a new ?reset= value), so "Menu saved" stays on screen after saving. */}
      <MenuEditor key={sp.reset ?? "menu"} initial={sections} cats={categories} depts={DEPARTMENTS.map((d) => ({ value: d.value, label: d.label }))} />
      {edited && (
        <form action={resetMenu} className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }}>Reset to the original menu</button>
          <span className="muted small">Undoes every change made here.</span>
        </form>
      )}
    </div>
  );
}
