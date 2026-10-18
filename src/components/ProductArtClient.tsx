import { ShopImage } from "./ShopImage";

/** Small product photo in the bag (96px wide). */
export function ProductArtClient({ name, url }: { name: string; url: string | null }) {
  if (url) return <ShopImage src={url} alt={name} sizes="120px" />;
  return (
    <div className="placeholder-art" style={{ background: "linear-gradient(160deg, #c9a7ad55, #c9a7adcc)" }} role="img" aria-label={name}>
      <span style={{ fontSize: "0.7rem" }}>{name}</span>
    </div>
  );
}
