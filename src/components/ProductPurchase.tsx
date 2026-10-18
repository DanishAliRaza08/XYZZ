"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import { photosForColour } from "@/lib/photos";
import { HeartIcon } from "./Icons";
import { ShopImage } from "./ShopImage";
import { useStore } from "./StoreProvider";

type V = { id: string; size: string; colour: string; colourHex: string; stock: number };

// The selected colour is shared by the colour buttons (ProductPurchase) and the photos (Gallery),
// so picking "White" shows the white photos.
const ColourContext = createContext<{ colour: string | undefined; setColour: (c: string) => void }>({ colour: undefined, setColour: () => {} });

/** Wraps the product page; starts on the first colour that has stock. */
export function ProductColourProvider({ variants, children }: { variants: Pick<V, "colour" | "stock">[]; children: React.ReactNode }) {
  const [colour, setColour] = useState(() => (variants.find((v) => v.stock > 0) ?? variants[0])?.colour);
  return <ColourContext.Provider value={{ colour, setColour }}>{children}</ColourContext.Provider>;
}

export function ProductPurchase({ slug, name, variants, sizes, purchasable }: { slug: string; name: string; variants: V[]; sizes: string[]; purchasable: boolean }) {
  const { addToBag, wishlist, toggleWishlist } = useStore();
  const colours = useMemo(() => [...new Map(variants.map((v) => [v.colour, v.colourHex])).entries()], [variants]);
  const { colour, setColour } = useContext(ColourContext);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = variants.find((v) => v.colour === colour && v.size === size) ?? null;
  const stockFor = (s: string) => variants.find((v) => v.colour === colour && v.size === s)?.stock ?? 0;
  const saved = wishlist.includes(slug);

  const add = async () => {
    setError(null);
    if (!size) return setError("Please select a size.");
    if (!variant || variant.stock <= 0) return setError("Sorry, this option is out of stock.");
    // Server-side availability check before adding.
    const res = await fetch(`/api/stock?variantId=${encodeURIComponent(variant.id)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return setError("Couldn't check stock. Please try again.");
    if (data.stock < qty) return setError(data.stock > 0 ? `Only ${data.stock} left in this size.` : "Sorry, this size has just sold out.");
    addToBag(variant.id, qty);
    setAdded(true);
  };

  return (
    <div>
      {colours.length > 0 && (
        <div className="option-group">
          <span className="label">Colour: <span className="muted" style={{ fontWeight: 400 }}>{colour}</span></span>
          <div className="colour-options" role="group" aria-label="Colour">
            {colours.map(([c, hex]) => (
              <button key={c} type="button" className="colour-btn" style={{ background: hex }} aria-pressed={c === colour} aria-label={c} title={c} onClick={() => { setColour(c); setAdded(false); }} />
            ))}
          </div>
        </div>
      )}
      <div className="option-group">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="label">Size</span>
          <Link href="/size-guide" className="small" style={{ textDecoration: "underline" }}>Size guide</Link>
        </div>
        <div className="size-options" role="group" aria-label="Size">
          {sizes.map((s) => {
            const st = stockFor(s);
            return (
              <button key={s} type="button" className="size-btn" aria-pressed={s === size} disabled={st <= 0} onClick={() => { setSize(s); setAdded(false); }} aria-label={st <= 0 ? `${s} — out of stock` : s}>
                {s}
              </button>
            );
          })}
        </div>
        {variant && variant.stock > 0 && variant.stock <= 5 && <p className="stock-note stock-low" style={{ marginTop: 8 }}>Only {variant.stock} left in stock</p>}
        {variant && variant.stock > 5 && <p className="stock-note muted" style={{ marginTop: 8 }}>In stock</p>}
      </div>

      <div className="row" style={{ margin: "18px 0" }}>
        <div className="qty" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <input aria-label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(10, q + 1))}>+</button>
        </div>
        <button type="button" className="btn btn-accent" style={{ flex: 1 }} disabled={!purchasable || !size || !variant || variant.stock <= 0} onClick={add}>
          {!purchasable ? "Unavailable" : !size ? "Select a size" : variant && variant.stock <= 0 ? "Out of stock" : "Add to bag"}
        </button>
        <button type="button" className="icon-btn" style={{ border: "1px solid var(--border)", borderRadius: 4, width: 46, height: 46 }} aria-pressed={saved} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"} onClick={() => toggleWishlist(slug)}>
          <HeartIcon filled={saved} style={saved ? { color: "var(--accent)" } : undefined} />
        </button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {added && (
        <div className="alert alert-success" role="status">
          Added {qty} × {name} ({size}, {colour}) to your bag. <Link href="/bag" style={{ textDecoration: "underline" }}>View bag</Link>
        </div>
      )}
    </div>
  );
}

export function Gallery({ images: allImages, name, hexByColour }: { images: { url: string; alt: string; colour: string | null }[]; name: string; hexByColour: Record<string, string> }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const { colour } = useContext(ColourContext);
  const images = photosForColour(allImages, colour);
  const hex = (colour && hexByColour[colour]) || Object.values(hexByColour)[0] || "#cccccc";
  if (!images.length)
    return (
      <div className="gallery">
        <div className="card-media">
          <div className="placeholder-art" style={{ background: `linear-gradient(160deg, ${hex}55, ${hex}cc)` }} role="img" aria-label={`${name} — photo coming soon`}>
            <span>{name}</span>
          </div>
        </div>
      </div>
    );
  return (
    <>
      <div className="gallery">
        {images.map((img, i) => (
          <div className="card-media" key={img.url + i}>
            {/* Main photo spans the gallery (half the page on desktop); the rest sit two to a row. */}
            <ShopImage src={img.url} alt={img.alt || name} sizes={i === 0 ? "(max-width: 900px) 100vw, 50vw" : "(max-width: 900px) 100vw, 25vw"} priority={i === 0} onClick={() => setZoom(img.url)} />
          </div>
        ))}
      </div>
      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Zoomed image" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={name} />
        </div>
      )}
    </>
  );
}
