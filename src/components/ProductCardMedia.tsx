"use client";

// The photo and colour dots of a product card. Clicking (or hovering) a dot shows that colour's photo,
// and the card's links then open the product page on that colour. Shows up to 4 dots, then "+N".
import Link from "next/link";
import { useState } from "react";
import { photoForColour } from "@/lib/photos";
import { GRID_SIZES, ShopImage } from "./ShopImage";

const MAX_DOTS = 4;

type Img = { url: string; alt: string; colour: string | null };

export function ProductCardMedia({
  slug, name, flag, images, colours, priority, children,
}: {
  slug: string;
  name: string;
  flag: string | null;
  images: Img[];
  colours: [string, string][]; // [colour name, hex]
  priority?: boolean;
  children: React.ReactNode; // wishlist button, title and price, shown between the photo and the dots
}) {
  const [colour, setColour] = useState<string | null>(null);
  const img = colour ? photoForColour(images, colour) : images[0];
  const href = `/product/${slug}${colour ? `?colour=${encodeURIComponent(colour)}` : ""}`;
  const hex = colours.find(([c]) => c === colour)?.[1] ?? colours[0]?.[1] ?? "#cccccc";
  const extra = colours.length - MAX_DOTS;

  return (
    <>
      <Link href={href} className="card-media" aria-label={colour ? `${name} in ${colour}` : name}>
        {flag && <span className={`card-flag${flag === "Sale" ? " sale" : ""}`}>{flag}</span>}
        {img ? (
          <ShopImage key={img.url} src={img.url} alt={img.alt || name} sizes={GRID_SIZES} priority={priority} />
        ) : (
          <div className="placeholder-art" style={{ background: `linear-gradient(160deg, ${hex}55, ${hex}cc)` }} role="img" aria-label={`${name} — photo coming soon`}>
            <span>{name}</span>
          </div>
        )}
      </Link>
      {children}
      {colours.length > 1 && (
        <div className="swatches" role="group" aria-label={`${colours.length} colours`}>
          {colours.slice(0, MAX_DOTS).map(([c, h]) => (
            <button
              key={c}
              type="button"
              className={`swatch swatch-btn${c === colour ? " selected" : ""}`}
              style={{ background: h }}
              title={c}
              aria-label={`Show ${c}`}
              aria-pressed={c === colour}
              onClick={() => setColour(c)}
              onMouseEnter={() => setColour(c)}
            />
          ))}
          {extra > 0 && (
            <Link href={href} className="swatch-more" aria-label={`See all ${colours.length} colours`}>+{extra}</Link>
          )}
        </div>
      )}
    </>
  );
}
