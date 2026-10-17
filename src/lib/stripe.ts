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

/**
 * What's wrong with the Stripe keys, in plain words — empty when card payments can be taken.
 * Only names the settings (never their values), for the setup note shown on the checkout page in development.
 */
export function stripeSetupProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  const secret = env.STRIPE_SECRET_KEY?.trim();
  const publishable = env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (!secret) problems.push("STRIPE_SECRET_KEY is empty or missing.");
  else if (!/^(sk|rk)_(test|live)_/.test(secret)) problems.push("STRIPE_SECRET_KEY should start with sk_test_ (or sk_live_).");
  if (!publishable) problems.push("STRIPE_PUBLISHABLE_KEY is empty or missing.");
  else if (!/^pk_(test|live)_/.test(publishable)) problems.push("STRIPE_PUBLISHABLE_KEY should start with pk_test_ (or pk_live_).");
  if (secret && publishable && secret.includes("_test_") !== publishable.includes("_test_"))
    problems.push("One key is a test key and the other a live key — use both test keys (or both live keys).");
  return problems;
}

/** "pi_123_secret_abc" → "pi_123". Returns null for anything that isn't a PaymentIntent client secret. */
export function paymentIntentIdFromSecret(secret: string): string | null {
  const m = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/.exec(secret);
  return m ? m[1] : null;
}
