/* eslint-disable @next/next/no-img-element */
export function ProductArtClient({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt={name} />;
  return (
    <div className="placeholder-art" style={{ background: "linear-gradient(160deg, #c9a7ad55, #c9a7adcc)" }} role="img" aria-label={name}>
      <span style={{ fontSize: "0.7rem" }}>{name}</span>
    </div>
  );
}
