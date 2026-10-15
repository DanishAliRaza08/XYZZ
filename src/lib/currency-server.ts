import { cookies } from "next/headers";
import { isCurrency, type CurrencyCode } from "./money";

export const CURRENCY_COOKIE = "fr_currency";

export async function getCurrency(): Promise<CurrencyCode> {
  const v = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return isCurrency(v) ? v : "GBP";
}
