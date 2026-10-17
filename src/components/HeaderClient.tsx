"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon } from "./Icons";
import { useStore } from "./StoreProvider";

import type { NavItem } from "@/lib/navigation";

export function MobileMenuButton({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  return (
    <>
      <button type="button" className="icon-btn mobile-only" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
      </button>
      {/* Rendered into <body>: the sticky header's backdrop blur would otherwise trap this full-screen panel inside the header. */}
      {open && createPortal(
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <strong className="eyebrow" style={{ margin: 0 }}>Menu</strong>
            <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <form action="/search" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="input" name="q" placeholder="Search" aria-label="Search products" />
            <button className="btn">Go</button>
          </form>
          <nav>
            {nav.map((item) =>
              item.columns ? (
                <details key={item.href}>
                  <summary>{item.label}</summary>
                  <Link href={item.href}>Shop all {item.label}</Link>
                  {item.columns.map((col) => (
                    <div key={col.title} className="mobile-menu-group">
                      <span className="eyebrow">{col.title}</span>
                      {col.links.map((l) => (
                        <Link key={l.href} href={l.href}>{l.label}</Link>
                      ))}
                    </div>
                  ))}
                </details>
              ) : (
                <Link key={item.href} href={item.href} style={item.sale ? { color: "var(--accent)" } : undefined}>{item.label}</Link>
              ),
            )}
            <Link href="/account">My account</Link>
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/order-status">Track an order</Link>
            <Link href="/delivery-returns">Delivery & returns</Link>
            <Link href="/contact">Contact us</Link>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}

export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <>
      <button type="button" className="icon-btn desktop-only" aria-label="Search" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SearchIcon />
      </button>
      {open && (
        <div className="search-panel" style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          <form
            className="container"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) {
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(q.trim())}`);
              }
            }}
          >
            <input autoFocus className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dresses, knitwear, SKU…" aria-label="Search products" maxLength={80} />
            <button className="btn">Search</button>
          </form>
        </div>
      )}
    </>
  );
}

export function BagLink() {
  const { bagCount, ready } = useStore();
  return (
    <Link href="/bag" className="icon-btn" aria-label={`Shopping bag, ${bagCount} items`}>
      <BagIcon />
      {ready && bagCount > 0 && <span className="badge">{bagCount}</span>}
    </Link>
  );
}

export function WishlistLink() {
  const { wishlist, ready } = useStore();
  return (
    <Link href="/wishlist" className="icon-btn desktop-only" aria-label={`Wishlist, ${wishlist.length} items`}>
      <HeartIcon />
      {ready && wishlist.length > 0 && <span className="badge">{wishlist.length}</span>}
    </Link>
  );
}

export function WishButton({ slug, name }: { slug: string; name: string }) {
  const { wishlist, toggleWishlist } = useStore();
  const saved = wishlist.includes(slug);
  return (
    <button
      type="button"
      className="icon-btn card-wish"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        toggleWishlist(slug);
      }}
    >
      <HeartIcon filled={saved} style={saved ? { color: "var(--accent)" } : undefined} />
    </button>
  );
}
