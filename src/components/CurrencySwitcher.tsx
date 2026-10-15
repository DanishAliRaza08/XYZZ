"use client";

import { useRouter } from "next/navigation";
import type { CurrencyCode } from "@/lib/money";

export function CurrencySwitcher({ current, usEnabled }: { current: CurrencyCode; usEnabled: boolean }) {
  const router = useRouter();
  if (!usEnabled) return null;
  return (
    <label className="desktop-only" style={{ display: "inline-flex", alignItems: "center" }}>
      <span className="sr-only">Shopping currency</span>
      <select
        className="select"
        style={{ minHeight: 34, padding: "2px 6px", width: "auto", fontSize: "0.8rem", border: 0, background: "transparent" }}
        value={current}
        onChange={(e) => {
          document.cookie = `fr_currency=${e.target.value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.refresh();
        }}
      >
        <option value="GBP">UK · £</option>
        <option value="USD">US · $</option>
      </select>
    </label>
  );
}
