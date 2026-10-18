import Image from "next/image";

/**
 * A shop photo that fills its frame (the frame sets the shape with aspect-ratio and position: relative).
 * Next.js serves it resized to the width the screen actually needs, as WebP/AVIF, instead of the full
 * original — much less to download on listing pages. `sizes` says how wide the frame is on screen.
 * SVGs can't be resized, so they're shown as they are.
 */
export function ShopImage({ src, alt, sizes, priority, onClick }: { src: string; alt: string; sizes: string; priority?: boolean; onClick?: () => void }) {
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={/\.svg(\?|$)/i.test(src)} onClick={onClick} />;
}

/** Product grids: 2 columns on phones, 3 on tablets, 4 on desktop. */
export const GRID_SIZES = "(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw";
