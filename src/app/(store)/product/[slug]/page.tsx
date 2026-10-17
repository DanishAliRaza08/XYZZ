import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTag, ProductCard } from "@/components/ProductCard";
import { Gallery, ProductColourProvider, ProductPurchase } from "@/components/ProductPurchase";
import { DEPARTMENTS, getProductBySlug, listProducts, sortSizes } from "@/lib/catalog";
import { getCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/money";
import { resolvePrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/stripe";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: product.description.slice(0, 160), images: product.images[0] ? [product.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const [currency, settings] = await Promise.all([getCurrency(), getSettings()]);
  const dept = DEPARTMENTS.find((d) => d.value === product.department)!;
  const price = resolvePrice(product, currency);
  const sizes = sortSizes([...new Set(product.variants.map((v) => v.size))]);
  const related = (await listProducts({ currency, department: product.department, categorySlug: product.category.slug })).items.filter((p) => p.id !== product.id).slice(0, 4);
  const fallbackRelated = related.length ? related : (await listProducts({ currency, department: product.department })).items.filter((p) => p.id !== product.id).slice(0, 4);
  const ship = settings.shipping[currency];
  const anyStock = product.variants.some((v) => v.stock > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.variants[0]?.sku,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Fashion Rockstar" },
    offers: price
      ? {
          "@type": "Offer",
          url: `${siteUrl()}/product/${product.slug}`,
          priceCurrency: currency,
          price: (price.price / 100).toFixed(2),
          availability: anyStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        }
      : undefined,
  };

  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href={`/shop/${dept.slug}`}>{dept.label}</Link></li>
          <li><Link href={`/shop/${dept.slug}/${product.category.slug}`}>{product.category.name}</Link></li>
          <li><span aria-current="page">{product.name}</span></li>
        </ol>
      </nav>

      <ProductColourProvider variants={product.variants.map((v) => ({ colour: v.colour, stock: v.stock }))}>
        <div className="pdp">
          <Gallery
            images={product.images.map((i) => ({ url: i.url, alt: i.alt, colour: i.colour }))}
            name={product.name}
            hexByColour={Object.fromEntries(product.variants.map((v) => [v.colour, v.colourHex]))}
          />

          <div className="pdp-info">
            {product.collection && <span className="eyebrow">{product.collection}</span>}
            <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>{product.name}</h1>
            <PriceTag product={product} currency={currency} />
            <p className="muted small" style={{ marginTop: 6 }}>
              {currency === "GBP" ? "Price includes VAT." : "Price excludes any US sales tax and import duties."}
              {product.ageRange ? ` · Age ${product.ageRange}` : ""}
            </p>

            <ProductPurchase
              slug={product.slug}
              name={product.name}
              purchasable={Boolean(price)}
              sizes={sizes}
              variants={product.variants.map((v) => ({ id: v.id, size: v.size, colour: v.colour, colourHex: v.colourHex, stock: Math.max(0, v.stock) }))}
            />

            <div style={{ marginTop: 24 }}>
              <details className="acc" open>
                <summary>Description</summary>
                <div><p style={{ whiteSpace: "pre-line" }}>{product.description}</p></div>
              </details>
              {(product.composition || product.care || product.origin) && (
                <details className="acc">
                  <summary>Fabric & care</summary>
                  <div>
                    {product.composition && <p><strong>Composition:</strong> {product.composition}</p>}
                    {product.care && <p><strong>Care:</strong> {product.care}</p>}
                    {product.origin && <p><strong>Country of origin:</strong> {product.origin}</p>}
                  </div>
                </details>
              )}
              <details className="acc">
                <summary>Delivery & returns</summary>
                <div>
                  <p>
                    Standard delivery {formatMoney(ship.standard, currency)} — free on orders over {formatMoney(ship.freeOver, currency)}. Express delivery {formatMoney(ship.express, currency)}.
                  </p>
                  <p>Free returns within 28 days of delivery. <Link href="/delivery-returns" style={{ textDecoration: "underline" }}>Full details</Link></p>
                </div>
              </details>
            </div>
          </div>
        </div>
      </ProductColourProvider>

      {fallbackRelated.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head"><h2>Complete the look</h2></div>
          <div className="product-grid">
            {fallbackRelated.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
