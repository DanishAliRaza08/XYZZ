"use client";

import { useState } from "react";
import { saveProduct } from "@/app/admin/actions";
import { focusStyle, parseImage } from "@/lib/image-focus";
import { SECTIONS, menuPlacesFor, placementForPage, sectionPages } from "@/lib/navigation";
import type { Department } from "@prisma/client";
import { ActionForm } from "./ActionForm";
import { AdjustButton, SizeHint } from "./ImageField";

type VariantRow = { id?: string; sku: string; size: string; colour: string; colourHex: string; stock: number };
type ImageRow = { url: string; alt: string; colour?: string }; // colour "" = shown for every colour

export type ProductInitial = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  department: string;
  categoryId: string;
  status: string;
  priceGBP: string;
  salePriceGBP: string;
  priceUSD: string;
  salePriceUSD: string;
  composition: string;
  care: string;
  origin: string;
  ageRange: string;
  collection: string;
  featured: boolean;
  bestseller: boolean;
  variants: VariantRow[];
  images: ImageRow[];
};

const EMPTY: ProductInitial = {
  name: "", slug: "", description: "", department: "WOMEN", categoryId: "", status: "DRAFT",
  priceGBP: "", salePriceGBP: "", priceUSD: "", salePriceUSD: "",
  composition: "", care: "", origin: "", ageRange: "", collection: "", featured: false, bestseller: false,
  variants: [], images: [],
};

const COLLECTION_SUGGESTIONS = ["Halloween", "Christmas", "Eid", "Diwali", "World Book Day"];

export function ProductForm({ categories, initial }: { categories: { id: string; name: string; slug: string }[]; initial?: ProductInitial }) {
  const init = initial ?? { ...EMPTY, categoryId: categories[0]?.id ?? "" };
  // Where the product appears in the menu depends on these three (see src/lib/navigation.ts).
  const [department, setDepartment] = useState(init.department);
  const [categoryId, setCategoryId] = useState(init.categoryId);
  const [collection, setCollection] = useState(init.collection);
  const [placeNote, setPlaceNote] = useState<string | null>(null);
  const categorySlug = categories.find((c) => c.id === categoryId)?.slug;
  const places = menuPlacesFor({ department: department as Department, categorySlug, collection: collection.trim() || null });

  const placeIn = (value: string) => {
    const [sectionSlug, pageSlug] = value.split("/");
    const p = placementForPage(sectionSlug, pageSlug);
    if (!p) return;
    setPlaceNote(null);
    if (p.department) setDepartment(p.department);
    if (p.categorySlug) {
      const c = categories.find((x) => x.slug === p.categorySlug);
      if (c) setCategoryId(c.id);
      else setPlaceNote(`The category for this page (“${p.categorySlug}”) doesn't exist yet — create it in Admin → Categories.`);
    }
    if (p.collection) setCollection(p.collection);
  };
  const [variants, setVariants] = useState<VariantRow[]>(init.variants.length ? init.variants : [{ sku: "", size: "", colour: "", colourHex: "#cccccc", stock: 0 }]);
  const [images, setImages] = useState<ImageRow[]>(init.images);
  const [bulk, setBulk] = useState({ sizes: "", colour: "", hex: "#cccccc", stock: "10", prefix: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadColour, setUploadColour] = useState("");
  const colourNames = [...new Set(variants.map((v) => v.colour.trim()).filter(Boolean))];

  const updateVariant = (i: number, patch: Partial<VariantRow>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const generate = () => {
    const sizes = bulk.sizes.split(",").map((s) => s.trim()).filter(Boolean);
    if (!sizes.length || !bulk.colour.trim()) return;
    const prefix = (bulk.prefix || "FR").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const colourCode = bulk.colour.trim().slice(0, 3).toUpperCase();
    const rows = sizes.map((size) => ({ sku: `${prefix}-${colourCode}-${size.toUpperCase().replace(/[^A-Z0-9]/g, "")}`, size, colour: bulk.colour.trim(), colourHex: bulk.hex, stock: Number(bulk.stock) || 0 }));
    setVariants((vs) => [...vs.filter((v) => v.sku || v.size || v.colour), ...rows]);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        break;
      }
      setImages((imgs) => [...imgs, { url: data.url, alt: "", colour: uploadColour }]);
    }
    setUploading(false);
  };

  return (
    <ActionForm action={saveProduct} submitLabel={init.id ? "Save changes" : "Create product"}>
      {init.id && <input type="hidden" name="id" value={init.id} />}
      <input type="hidden" name="variants" value={JSON.stringify(variants.filter((v) => v.sku || v.size || v.colour))} />
      <input type="hidden" name="images" value={JSON.stringify(images.filter((i) => i.url))} />

      <section className="panel stack">
        <h3>Details</h3>
        <div className="grid-2">
          <div className="field"><label htmlFor="name">Product name *</label><input id="name" name="name" className="input" defaultValue={init.name} required maxLength={120} /></div>
          <div className="field"><label htmlFor="slug">URL (optional)</label><input id="slug" name="slug" className="input" defaultValue={init.slug} placeholder="auto from name" maxLength={80} /></div>
        </div>
        <div className="field"><label htmlFor="description">Description *</label><textarea id="description" name="description" className="textarea" defaultValue={init.description} required maxLength={5000} /></div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" className="select" defaultValue={init.status}>
              <option value="DRAFT">Draft (hidden)</option><option value="PUBLISHED">Published (live)</option><option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="field"><label htmlFor="ageRange">Age range (children)</label><input id="ageRange" name="ageRange" className="input" defaultValue={init.ageRange} placeholder="e.g. 3–10 years" /></div>
        </div>
        <div className="row">
          <label className="checkbox"><input type="checkbox" name="featured" defaultChecked={init.featured} /> Featured on homepage</label>
          <label className="checkbox"><input type="checkbox" name="bestseller" defaultChecked={init.bestseller} /> Bestseller</label>
        </div>
      </section>

      <section className="panel stack">
        <h3>Where it appears in the shop</h3>
        <div className="field">
          <label htmlFor="placeIn">Put it in the menu</label>
          <select id="placeIn" className="select" value="" onChange={(e) => placeIn(e.target.value)} style={{ maxWidth: 480 }}>
            <option value="">Choose a menu page, e.g. Girls → Dresses…</option>
            {SECTIONS.map((sec) => (
              <optgroup key={sec.slug} label={sec.label}>
                {sectionPages(sec).map((pg) => <option key={pg.slug} value={`${sec.slug}/${pg.slug}`}>{sec.label} → {pg.label}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="muted small">Picking a page fills in the department, category and collection below. Then pick a festival page (e.g. Festival Special → Halloween) to show it there too — that only sets the collection.</span>
        </div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="department">Department</label>
            <select id="department" name="department" className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="WOMEN">Women</option><option value="GIRLS">Girls</option><option value="BOYS">Boys</option><option value="BABY">Baby & toddler</option><option value="MEN">Men</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="categoryId">Category</label>
            <select id="categoryId" name="categoryId" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="collection">Collection / edit (optional)</label>
            <input id="collection" name="collection" className="input" list="collection-suggestions" value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="e.g. Halloween" />
            <datalist id="collection-suggestions">{COLLECTION_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        {placeNote && <p className="field-error" style={{ margin: 0 }}>{placeNote}</p>}
        <div className="small">
          {places.length ? (
            <>
              <strong>Shows on:</strong>{" "}
              {places.map((pl, i) => (
                <span key={pl.href}>{i > 0 && " · "}<a href={pl.href} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{pl.label}</a></span>
              ))}
            </>
          ) : (
            <span className="field-error">Not on any menu page yet — choose one above (it can still be found by search).</span>
          )}
        </div>
      </section>

      <section className="panel stack">
        <h3>Pricing</h3>
        <p className="muted small">Enter prices like 29.99. UK prices include VAT. Leave the US price empty to hide this product from the US store. A sale price must be lower than the regular price.</p>
        <div className="grid-2">
          <div className="field"><label htmlFor="priceGBP">UK price (£) *</label><input id="priceGBP" name="priceGBP" className="input" inputMode="decimal" defaultValue={init.priceGBP} required /></div>
          <div className="field"><label htmlFor="salePriceGBP">UK sale price (£)</label><input id="salePriceGBP" name="salePriceGBP" className="input" inputMode="decimal" defaultValue={init.salePriceGBP} /></div>
          <div className="field"><label htmlFor="priceUSD">US price ($)</label><input id="priceUSD" name="priceUSD" className="input" inputMode="decimal" defaultValue={init.priceUSD} /></div>
          <div className="field"><label htmlFor="salePriceUSD">US sale price ($)</label><input id="salePriceUSD" name="salePriceUSD" className="input" inputMode="decimal" defaultValue={init.salePriceUSD} /></div>
        </div>
      </section>

      <section className="panel stack">
        <h3>Sizes, colours & stock</h3>
        <div className="panel" style={{ background: "var(--surface-2)" }}>
          <strong className="small">Quick add</strong>
          <div className="grid-3" style={{ marginTop: 8 }}>
            <input className="input" placeholder="Sizes, comma separated: 3-4y, 5-6y" value={bulk.sizes} onChange={(e) => setBulk({ ...bulk, sizes: e.target.value })} aria-label="Sizes" />
            <input className="input" placeholder="Colour name" value={bulk.colour} onChange={(e) => setBulk({ ...bulk, colour: e.target.value })} aria-label="Colour" />
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="color" value={bulk.hex} onChange={(e) => setBulk({ ...bulk, hex: e.target.value })} aria-label="Colour swatch" style={{ width: 44, height: 44, border: 0, background: "none" }} />
              <input className="input" placeholder="Stock each" value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value })} aria-label="Stock per size" />
              <input className="input" placeholder="SKU prefix" value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} aria-label="SKU prefix" />
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={generate}>Add these variants</button>
        </div>
        <div className="variant-row small muted desktop-only"><span>SKU</span><span>Size</span><span>Colour</span><span>Swatch</span><span>Stock</span><span /></div>
        {variants.map((v, i) => (
          <div className="variant-row" key={i}>
            <input className="input" placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value.toUpperCase() })} aria-label="SKU" />
            <input className="input" placeholder="Size" value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} aria-label="Size" />
            <input className="input" placeholder="Colour" value={v.colour} onChange={(e) => updateVariant(i, { colour: e.target.value })} aria-label="Colour" />
            <input type="color" value={v.colourHex} onChange={(e) => updateVariant(i, { colourHex: e.target.value })} aria-label="Swatch colour" style={{ width: "100%", height: 40, border: 0, background: "none" }} />
            <input className="input" type="number" min={0} value={v.stock} onChange={(e) => updateVariant(i, { stock: Math.max(0, Number(e.target.value) || 0) })} aria-label="Stock" />
            <button type="button" className="icon-btn" aria-label="Remove variant" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVariants((vs) => [...vs, { sku: "", size: "", colour: vs.at(-1)?.colour ?? "", colourHex: vs.at(-1)?.colourHex ?? "#cccccc", stock: 0 }])}>+ Add variant row</button>
      </section>

      <section className="panel stack">
        <h3>Photos</h3>
        <p className="muted small">Upload JPG, PNG or WebP (max 5MB) or paste an image URL. Use only photos you own or are licensed to use. The first photo is the main image. Use <strong>Adjust</strong> on a photo to choose which part shows in the product tiles.</p>
        <SizeHint kind="product" />
        <p className="muted small">
          <strong>Photos per colour:</strong> set each photo&apos;s colour to match a variant colour above (e.g. a white skirt photo → &quot;White&quot;).
          When a shopper picks that colour, its photos become the main images. Photos left on &quot;All colours&quot; show for every colour.
        </p>
        <div className="row">
          {images.map((img, i) => (
            <div key={img.url + i} style={{ width: 120 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ width: 120, height: 160, overflow: "hidden", borderRadius: 4, background: "var(--surface-2)" }}>
                <img src={parseImage(img.url).src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", ...focusStyle(parseImage(img.url)) }} />
              </div>
              <input className="input small" placeholder="Alt text" value={img.alt} onChange={(e) => setImages((imgs) => imgs.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} style={{ minHeight: 30, marginTop: 4 }} aria-label="Image description" />
              <ColourSelect value={img.colour ?? ""} colours={colourNames} onChange={(colour) => setImages((imgs) => imgs.map((x, j) => (j === i ? { ...x, colour } : x)))} label="Photo colour" />
              <div className="row" style={{ gap: 2 }}>
                <button type="button" className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => setImages((imgs) => { const n = [...imgs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label="Move left">←</button>
                <AdjustButton value={img.url} kind="product" onChange={(url) => setImages((imgs) => imgs.map((x, j) => (j === i ? { ...x, url } : x)))} />
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          {colourNames.length > 1 && (
            <div style={{ width: 170 }}>
              <ColourSelect value={uploadColour} colours={colourNames} onChange={setUploadColour} label="Colour for new photos" />
            </div>
          )}
          <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
            {uploading ? "Uploading…" : uploadColour ? `Upload ${uploadColour} photos` : "Upload photos"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
          <ImageUrlAdder onAdd={(url) => setImages((imgs) => [...imgs, { url, alt: "", colour: uploadColour }])} />
        </div>
        {uploadError && <p className="field-error">{uploadError}</p>}
      </section>

      <section className="panel stack">
        <h3>Fabric & care</h3>
        <p className="muted small">Only enter information you have verified with your supplier.</p>
        <div className="grid-3">
          <div className="field"><label htmlFor="composition">Composition</label><input id="composition" name="composition" className="input" defaultValue={init.composition} placeholder="e.g. 100% cotton" /></div>
          <div className="field"><label htmlFor="care">Care</label><input id="care" name="care" className="input" defaultValue={init.care} placeholder="e.g. Machine wash 30°C" /></div>
          <div className="field"><label htmlFor="origin">Country of origin</label><input id="origin" name="origin" className="input" defaultValue={init.origin} /></div>
        </div>
      </section>
    </ActionForm>
  );
}

function ColourSelect({ value, colours, onChange, label }: { value: string; colours: string[]; onChange: (colour: string) => void; label: string }) {
  // Keep a colour that was renamed/removed visible so it isn't silently changed; saving resets it to "All colours".
  const options = value && !colours.includes(value) ? [...colours, value] : colours;
  return (
    <select className="select small" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} title={label} style={{ minHeight: 30, marginTop: 4, width: "100%" }}>
      <option value="">All colours</option>
      {options.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function ImageUrlAdder({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="row" style={{ flex: 1, flexWrap: "nowrap" }}>
      <input className="input" placeholder="https://… image URL" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Image URL" />
      <button type="button" className="btn btn-sm btn-outline" onClick={() => { if (/^https:\/\//.test(url.trim())) { onAdd(url.trim()); setUrl(""); } }}>Add URL</button>
    </div>
  );
}
