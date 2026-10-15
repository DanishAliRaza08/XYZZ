import type { Metadata } from "next";
import { BagView } from "@/components/BagAndCheckout";

export const metadata: Metadata = { title: "Shopping bag", robots: { index: false } };

export default async function BagPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container">
      <h1 style={{ marginTop: 30 }}>Shopping bag</h1>
      <BagView cancelled={sp.cancelled === "1"} />
    </div>
  );
}
