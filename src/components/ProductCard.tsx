import Link from "next/link";
import type { ListingProduct } from "@/lib/catalog";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { resolvePrice } from "@/lib/pricing";
import { WishButton } from "./HeaderClient";

export function ProductArt({ name, hex, url, alt, priority }: { name: string; hex: string; url?: string | null; alt?: string; priority?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt ?? name} loading={priority ? "eager" : "lazy"} />;
  }
  // Elegant placeholder until product photography is uploaded in the admin.
  return (
    <div className="placeholder-art" style={{ background: `linear-gradient(160deg, ${hex}55, ${hex}cc)` }} role="img" aria-label={`${name} — photo coming soon`}>
      <span>{name}</span>
    </div>
  );
}

export function PriceTag({ product, currency }: { product: Parameters<typeof resolvePrice>[0]; currency: CurrencyCode }) {
  const p = resolvePrice(product, currency);
  if (!p) return <span className="muted small">Not available in this region</span>;
  return (
    <div className="price">
      <span className={p.compareAt ? "now-sale" : undefined}>{formatMoney(p.price, currency)}</span>
      {p.compareAt && (
        <>
          <span className="was"><span className="sr-only">Was </span>{formatMoney(p.compareAt, currency)}</span>
          <span className="small" style={{ color: "var(--accent)" }}>−{p.percentOff}%</span>
        </>
      )}
    </div>
  );
}

export function ProductCard({ product, currency, priority }: { product: ListingProduct; currency: CurrencyCode; priority?: boolean }) {
  const colours = [...new Map(product.variants.map((v) => [v.colour, v.colourHex])).entries()];
  const inStock = product.variants.some((v) => v.stock > 0);
  const price = resolvePrice(product, currency);
  const isNew = Date.now() - product.createdAt.getTime() < 1000 * 60 * 60 * 24 * 30;
  const flag = !inStock ? "Out of stock" : price?.compareAt ? "Sale" : isNew ? "New" : product.bestseller ? "Bestseller" : null;
  return (
    <article className="card">
      <Link href={`/product/${product.slug}`} className="card-media" aria-label={product.name}>
        {flag && <span className={`card-flag${flag === "Sale" ? " sale" : ""}`}>{flag}</span>}
        <ProductArt name={product.name} hex={colours[0]?.[1] ?? "#cccccc"} url={product.images[0]?.url} alt={product.images[0]?.alt} priority={priority} />
      </Link>
      <WishButton slug={product.slug} name={product.name} />
      <Link href={`/product/${product.slug}`} className="card-title">{product.name}</Link>
      <PriceTag product={product} currency={currency} />
      {colours.length > 1 && (
        <div className="swatches" aria-label={`${colours.length} colours`}>
          {colours.slice(0, 6).map(([name, hex]) => (
            <span key={name} className="swatch" style={{ background: hex }} title={name} />
          ))}
        </div>
      )}
    </article>
  );
}
