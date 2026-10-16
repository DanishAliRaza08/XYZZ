import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { DEPARTMENTS, listProducts } from "@/lib/catalog";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";
import { getActiveEvent, isSafeImage, parseBanners, themeSlug } from "@/lib/events";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const TILE_TINTS = ["#c9a7ad", "#b9c4cf", "#c7c1a6", "#d8c5b5", "#a9b8a8"];

export default async function HomePage() {
  const [settings, currency, event] = await Promise.all([getSettings(), getCurrency(), getActiveEvent()]);
  const [featured, bestsellers, collections] = await Promise.all([
    listProducts({ currency, sort: "recommended" }),
    listProducts({ currency, collection: "bestsellers" }),
    prisma.product.findMany({
      where: { status: "PUBLISHED", collection: { not: null } },
      select: { collection: true },
      distinct: ["collection"],
      take: 3,
    }),
  ]);
  const featuredItems = featured.items.filter((p) => p.featured).slice(0, 8);
  const shownFeatured = featuredItems.length ? featuredItems : featured.items.slice(0, 8);
  const ship = settings.shipping[currency];

  // A live seasonal event takes over the hero and adds its own shop section.
  const hero = event
    ? {
        eyebrow: event.heroEyebrow ?? "",
        title: event.heroTitle,
        subtitle: event.heroSubtitle ?? "",
        image: event.heroImage && isSafeImage(event.heroImage) ? event.heroImage : "",
        ctaLabel: event.heroCtaLabel || "Shop the edit",
        ctaHref: event.heroCtaHref || event.barLinkHref || "/shop/new-arrivals",
      }
    : {
        eyebrow: settings.heroEyebrow,
        title: settings.heroTitle,
        subtitle: settings.heroSubtitle,
        image: settings.heroImage,
        ctaLabel: settings.heroCtaLabel || "Shop now",
        ctaHref: settings.heroCtaHref || "/shop/new-arrivals",
      };
  const banners = event ? parseBanners(event.banners) : [];
  const eventProducts = event?.collection
    ? (await listProducts({ currency, q: event.collection })).items.filter((p) => p.collection?.toLowerCase() === event.collection!.toLowerCase()).slice(0, 8)
    : [];

  return (
    <>
      <section className={`hero${hero.image ? " has-image" : ""}`}>
        {hero.image ? (
          <div className="hero-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.image} alt="" />
          </div>
        ) : (
          <div className="hero-art" data-event={event ? themeSlug(event.theme) : undefined} aria-hidden />
        )}
        <div className="container">
          <div className="hero-content">
            {hero.eyebrow && <span className="eyebrow">{hero.eyebrow}</span>}
            <h1>{hero.title}</h1>
            {hero.subtitle && <p>{hero.subtitle}</p>}
            <div className="row" style={{ marginTop: 22 }}>
              <Link href={hero.ctaHref} className={event ? "btn btn-accent" : "btn"}>{hero.ctaLabel}</Link>
              <Link href="/shop/girls" className="btn btn-outline" style={hero.image ? { color: "#fff", borderColor: "#fff" } : undefined}>Shop girls</Link>
            </div>
          </div>
        </div>
      </section>

      {event && (banners.length > 0 || eventProducts.length > 0) && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">{event.name}</span>
                <h2>{event.sectionTitle || `Shop ${event.name}`}</h2>
              </div>
              {event.collection && (
                <Link href={`/search?q=${encodeURIComponent(event.collection)}`} className="btn btn-outline btn-sm">View all</Link>
              )}
            </div>
            {banners.length > 0 && (
              <div className="event-banners" style={{ marginBottom: eventProducts.length ? 32 : 0 }}>
                {banners.map((b, i) => {
                  const tile = (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt={b.title} loading={i < 3 ? "eager" : "lazy"} />
                      {b.title && <span>{b.title}</span>}
                    </>
                  );
                  return b.href ? (
                    <Link key={i} href={b.href} className="event-banner">{tile}</Link>
                  ) : (
                    <div key={i} className="event-banner">{tile}</div>
                  );
                })}
              </div>
            )}
            {eventProducts.length > 0 && (
              <div className="product-grid">
                {eventProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} currency={currency} priority={i < 4} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="container">
        <div className="trust" style={{ marginTop: 0 }}>
          <div><strong>Free delivery</strong><span>On {currency === "GBP" ? "UK" : "US"} orders over {formatMoney(ship.freeOver, currency)}</span></div>
          <div><strong>Free returns</strong><span>Within 28 days of delivery</span></div>
          <div><strong>Secure checkout</strong><span>Cards, Apple Pay & Google Pay</span></div>
          <div><strong>Real people</strong><span>Chat with our team any time</span></div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Shop by department</span>
              <h2>Something for everyone</h2>
            </div>
          </div>
          <div className="tiles">
            {DEPARTMENTS.slice(0, 4).map((d, i) => (
              <Link key={d.slug} href={`/shop/${d.slug}`} className="tile">
                <div className="tile-art" style={{ background: `linear-gradient(170deg, ${TILE_TINTS[i]}40, ${TILE_TINTS[i]}aa)` }} aria-hidden />
                <span className="tile-label">
                  {d.label}
                  <small>{d.blurb}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {shownFeatured.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Featured</span>
                <h2>The season's edit</h2>
              </div>
              <Link href="/shop/new-arrivals" className="btn btn-outline btn-sm">View all</Link>
            </div>
            <div className="product-grid">
              {shownFeatured.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={currency} priority={i < 4} />
              ))}
            </div>
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <section className="section" style={{ background: "var(--surface-2)" }}>
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Collections</span>
                <h2>Seasonal edits & occasionwear</h2>
              </div>
            </div>
            <div className="tiles" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
              {collections.map((c, i) => (
                <Link key={c.collection} href={`/search?q=${encodeURIComponent(c.collection ?? "")}`} className="tile" style={{ aspectRatio: "4/3" }}>
                  <div className="tile-art" style={{ background: `linear-gradient(140deg, ${TILE_TINTS[(i + 2) % 5]}55, ${TILE_TINTS[(i + 2) % 5]})` }} aria-hidden />
                  <span className="tile-label">{c.collection}<small>Discover the edit →</small></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {bestsellers.items.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Loved by customers</span>
                <h2>Bestsellers</h2>
              </div>
              <Link href="/shop/bestsellers" className="btn btn-outline btn-sm">Shop bestsellers</Link>
            </div>
            <div className="product-grid">
              {bestsellers.items.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
