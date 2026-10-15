import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section center">
      <span className="eyebrow">404</span>
      <h1>We couldn't find that page</h1>
      <p className="muted">It may have moved, or the product is no longer available.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/" className="btn">Go to homepage</Link>
        <Link href="/search" className="btn btn-outline">Search the shop</Link>
      </div>
    </div>
  );
}
