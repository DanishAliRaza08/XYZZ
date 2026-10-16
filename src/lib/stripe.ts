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

/** Publishable key for Stripe.js in the browser (safe to expose). Card payments need both keys. */
export function stripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/** "pi_123_secret_abc" → "pi_123". Returns null for anything that isn't a PaymentIntent client secret. */
export function paymentIntentIdFromSecret(secret: string): string | null {
  const m = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/.exec(secret);
  return m ? m[1] : null;
}
