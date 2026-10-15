import type { Metadata } from "next";
import { Listing, type SearchParams } from "@/components/Listing";
import { getCurrency } from "@/lib/currency-server";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, currency] = await Promise.all([searchParams, getCurrency()]);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? "";
  return (
    <Listing
      title={q ? `Results for “${q}”` : "Search"}
      blurb={q ? undefined : "Search by product name, colour, collection or SKU."}
      crumbs={[{ label: "Search" }]}
      basePath="/search"
      searchParams={sp}
      currency={currency}
      collection={q ? undefined : "all"}
      q={q || undefined}
    />
  );
}
