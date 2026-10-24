// A picture's chosen framing, set with Adjust in the admin (src/components/admin/ImageField.tsx).
// It's saved on the end of the picture address as "#fp=<x>,<y>,<zoom>", e.g. "/uploads/abc.jpg#fp=30,60,1.4":
// x/y = the point (in %) kept in view when the frame crops the picture, zoom = 1 (whole frame) to 3.
// Browsers ignore the "#…" part when loading a picture, so an address with framing still works everywhere.
// No server-only imports: used by the admin editor in the browser too.
import type { CSSProperties } from "react";

export type ImageFocus = { src: string; x: number; y: number; zoom: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function parseImage(value: string): ImageFocus {
  const [src, frag = ""] = value.split("#", 2);
  const m = /^fp=(-?[\d.]+),(-?[\d.]+)(?:,([\d.]+))?$/.exec(frag);
  if (!m) return { src, x: 50, y: 50, zoom: 1 };
  return { src, x: clamp(Number(m[1]) || 0, 0, 100), y: clamp(Number(m[2]) || 0, 0, 100), zoom: clamp(Number(m[3] ?? 1) || 1, 1, 3) };
}

/** The picture address with its framing; plain address when centred at normal size. */
export function withFocus({ src, x, y, zoom }: ImageFocus): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (r(x) === 50 && r(y) === 50 && r(zoom) === 1) return src;
  return `${src}#fp=${r(x)},${r(y)},${r(zoom)}`;
}

/** CSS for an <img> filling a frame with object-fit: cover, honouring the framing. */
export function focusStyle({ x, y, zoom }: ImageFocus): CSSProperties {
  return {
    objectPosition: `${x}% ${y}%`,
    ...(zoom > 1 ? { transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` } : {}),
  };
}

/** Recommended upload sizes for each kind of picture (shown next to upload buttons). */
export const IMAGE_SIZES = {
  hero: { w: 1920, h: 800, label: "Homepage banner", note: "wide landscape; with “Picture only” it's shown whole at this shape, otherwise keep the main subject away from the edges" },
  tile: { w: 1200, h: 900, label: "Department / promo tile", note: "landscape 4:3" },
  product: { w: 1200, h: 1600, label: "Product photo", note: "portrait 3:4" },
  blogCover: { w: 1600, h: 900, label: "Blog cover", note: "landscape 16:9" },
  blogPhoto: { w: 1200, h: 0, label: "Photo in a blog post", note: "any shape, at least 1200 px wide" },
} as const;

export type ImageKind = keyof typeof IMAGE_SIZES;
