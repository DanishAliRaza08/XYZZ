import type { Metadata } from "next";
import { WishlistView } from "@/components/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="container" style={{ paddingBottom: 60 }}>
      <h1 style={{ marginTop: 30 }}>Your wishlist</h1>
      <p className="muted">Saved on this device.</p>
      <WishlistView />
    </div>
  );
}
