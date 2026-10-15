"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductArtClient } from "./ProductArtClient";
import { useStore } from "./StoreProvider";

type Item = { slug: string; name: string; image: string | null; price: string };

export function WishlistView() {
  const { wishlist, toggleWishlist, ready } = useStore();
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!wishlist.length) return setItems([]);
    fetch(`/api/products/by-slug?slugs=${encodeURIComponent(wishlist.join(","))}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [wishlist, ready]);

  if (!items) return <p className="muted">Loading…</p>;
  if (!items.length)
    return (
      <div className="empty" style={{ marginTop: 20 }}>
        <h3>No saved items yet</h3>
        <p className="muted">Tap the heart on any product to save it here.</p>
        <Link href="/shop/new-arrivals" className="btn">Browse new arrivals</Link>
      </div>
    );
  return (
    <div className="product-grid" style={{ marginTop: 20 }}>
      {items.map((i) => (
        <article className="card" key={i.slug}>
          <Link href={`/product/${i.slug}`} className="card-media"><ProductArtClient name={i.name} url={i.image} /></Link>
          <Link href={`/product/${i.slug}`} className="card-title">{i.name}</Link>
          <span className="price">{i.price}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => toggleWishlist(i.slug)}>Remove</button>
        </article>
      ))}
    </div>
  );
}
