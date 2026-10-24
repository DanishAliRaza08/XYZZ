import Image from "next/image";
import { focusStyle, parseImage } from "@/lib/image-focus";

/**
 * A shop photo that fills its frame (the frame sets the shape with aspect-ratio and position: relative).
 * Next.js serves it resized to the width the screen actually needs, as WebP/AVIF, instead of the full
 * original — much less to download on listing pages. `sizes` says how wide the frame is on screen.
 * SVGs can't be resized, so they're shown as they are. A framing chosen with Adjust in the admin
 * ("…#fp=x,y,zoom", src/lib/image-focus.ts) decides which part of the picture stays in the frame.
 */
export function ShopImage({ src: value, alt, sizes, priority, onClick }: { src: string; alt: string; sizes: string; priority?: boolean; onClick?: () => void }) {
  const focus = parseImage(value);
  return (
    <Image src={focus.src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={/\.svg(\?|$)/i.test(focus.src)} onClick={onClick} style={focusStyle(focus)} />
  );
}

/** Product grids: 2 columns on phones, 3 on tablets, 4 on desktop. */
export const GRID_SIZES = "(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw";
