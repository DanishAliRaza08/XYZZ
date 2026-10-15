import Link from "next/link";
import type { Department } from "@prisma/client";
import { COLLECTIONS, listProducts, type ListingQuery } from "@/lib/catalog";
import { formatMoney, parseMoney, type CurrencyCode } from "@/lib/money";
import { AutoSubmitForm } from "./AutoSubmitForm";
import { ProductCard } from "./ProductCard";

export type SearchParams = Record<string, string | string[] | undefined>;

const SORTS: { value: NonNullable<ListingQuery["sort"]>; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "bestseller", label: "Bestsellers" },
];

const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]).filter(Boolean).slice(0, 20);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function hasFilters(sp: SearchParams) {
  return ["size", "colour", "min", "max", "instock", "sort", "page"].some((k) => sp[k] != null);
}

export async function Listing(props: {
  title: string;
  blurb?: string;
  crumbs: { label: string; href?: string }[];
  basePath: string;
  searchParams: SearchParams;
  currency: CurrencyCode;
  department?: Department;
  categorySlug?: string;
  collection?: keyof typeof COLLECTIONS;
  q?: string;
}) {
  const sp = props.searchParams;
  const sort = (SORTS.find((s) => s.value === one(sp.sort))?.value ?? "recommended") as ListingQuery["sort"];
  const sizes = arr(sp.size);
  const colours = arr(sp.colour);
  const min = parseMoney(one(sp.min));
  const max = parseMoney(one(sp.max));
  const inStock = one(sp.instock) === "1";
  const page = Math.max(1, Math.min(500, Number(one(sp.page)) || 1));

  const result = await listProducts({
    currency: props.currency,
    department: props.department,
    categorySlug: props.categorySlug,
    collection: props.collection,
    q: props.q,
    sizes,
    colours,
    minPrice: min ?? undefined,
    maxPrice: max ?? undefined,
    inStock,
    sort,
    page,
  });

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const val of arr(v)) if (k !== "page") params.append(k, val);
    if (p > 1) params.set("page", String(p));
    return `${props.basePath}${params.size ? `?${params}` : ""}`;
  };
  const symbol = props.currency === "GBP" ? "£" : "$";

  const filterForm = (
    <AutoSubmitForm action={props.basePath} className="filters">
      {props.q && <input type="hidden" name="q" value={props.q} />}
      <input type="hidden" name="sort" value={sort} />
      {result.facets.sizes.length > 0 && (
        <fieldset>
          <legend>Size</legend>
          <div className="filter-options">
            {result.facets.sizes.map((s) => (
              <label key={s} className="chip">
                <input type="checkbox" name="size" value={s} defaultChecked={sizes.includes(s)} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {result.facets.colours.length > 0 && (
        <fieldset>
          <legend>Colour</legend>
          <div className="filter-options">
            {result.facets.colours.map((c) => (
              <label key={c.name} className="chip">
                <input type="checkbox" name="colour" value={c.name} defaultChecked={colours.includes(c.name)} />
                <span className="swatch" style={{ background: c.hex }} aria-hidden />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend>Price ({symbol})</legend>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input" type="number" min={0} step="1" name="min" placeholder="Min" aria-label="Minimum price" defaultValue={one(sp.min)} />
          <span>–</span>
          <input className="input" type="number" min={0} step="1" name="max" placeholder="Max" aria-label="Maximum price" defaultValue={one(sp.max)} />
        </div>
      </fieldset>
      <fieldset>
        <legend>Availability</legend>
        <label className="checkbox">
          <input type="checkbox" name="instock" value="1" defaultChecked={inStock} /> In stock only
        </label>
      </fieldset>
      <div className="row">
        <button className="btn btn-sm">Apply</button>
        <Link href={`${props.basePath}${props.q ? `?q=${encodeURIComponent(props.q)}` : ""}`} className="btn btn-sm btn-ghost">Clear all</Link>
      </div>
    </AutoSubmitForm>
  );

  return (
    <div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          {props.crumbs.map((c) => (
            <li key={c.label}>{c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
          ))}
        </ol>
      </nav>
      <header style={{ margin: "12px 0 28px" }}>
        <h1>{props.title}</h1>
        {props.blurb && <p className="muted">{props.blurb}</p>}
      </header>

      <div className="listing" style={{ paddingBottom: 60 }}>
        <aside>
          <details className="filters-mobile" style={{ marginBottom: 12 }}>
            <summary>Filter</summary>
            {filterForm}
          </details>
          <div className="desktop-only">{filterForm}</div>
        </aside>

        <div>
          <div className="listing-toolbar">
            <span className="muted small" role="status">{result.total} {result.total === 1 ? "product" : "products"}</span>
            <form action={props.basePath} method="get" className="row">
              {Object.entries(sp).flatMap(([k, v]) => (k === "sort" || k === "page" ? [] : arr(v).map((val, i) => <input key={`${k}${i}`} type="hidden" name={k} value={val} />)))}
              <label htmlFor="sort" className="small">Sort by</label>
              <select id="sort" name="sort" defaultValue={sort} className="select" style={{ width: "auto" }}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button className="btn btn-sm btn-outline">Sort</button>
            </form>
          </div>

          {result.items.length === 0 ? (
            <div className="empty">
              <h3>No products found</h3>
              <p className="muted">Try removing a filter or searching for something else.</p>
              <div className="row" style={{ justifyContent: "center" }}>
                <Link href="/shop/new-arrivals" className="btn btn-outline">New arrivals</Link>
                <Link href="/shop/bestsellers" className="btn">Bestsellers</Link>
              </div>
            </div>
          ) : (
            <div className="product-grid">
              {result.items.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={props.currency} priority={i < 4} />
              ))}
            </div>
          )}

          {result.pages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              {result.page > 1 && <Link className="btn btn-sm btn-outline" href={pageHref(result.page - 1)}>Previous</Link>}
              <span className="btn btn-sm btn-ghost" aria-current="page">Page {result.page} of {result.pages}</span>
              {result.page < result.pages && <Link className="btn btn-sm btn-outline" href={pageHref(result.page + 1)}>Next</Link>}
            </nav>
          )}
          {min != null && max != null && min > max && (
            <p className="field-error small">Minimum price {formatMoney(min, props.currency)} is above the maximum.</p>
          )}
        </div>
      </div>
    </div>
  );
}
