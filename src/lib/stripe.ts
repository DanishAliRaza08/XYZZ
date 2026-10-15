import Stripe from "stripe";

let client: Stripe | null = null;

/** Returns null when Stripe is not configured, so the UI can say payments are unavailable instead of failing. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export function siteUrl() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
