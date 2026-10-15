// All money is integer minor units (pence / cents). Never use floats for prices.
export type CurrencyCode = "GBP" | "USD";

export const CURRENCIES: Record<CurrencyCode, { symbol: string; locale: string; label: string }> = {
  GBP: { symbol: "£", locale: "en-GB", label: "United Kingdom (£ GBP)" },
  USD: { symbol: "$", locale: "en-US", label: "United States ($ USD)" },
};

export function formatMoney(minor: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(CURRENCIES[currency].locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Parse a user-entered amount like "19.99" or "£19.99" into minor units. Returns null when invalid. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[£$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function toInputValue(minor: number | null | undefined): string {
  if (minor == null) return "";
  return (minor / 100).toFixed(2);
}

export function isCurrency(v: unknown): v is CurrencyCode {
  return v === "GBP" || v === "USD";
}
