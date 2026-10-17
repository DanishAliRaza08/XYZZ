import { cookies } from "next/headers";
import type { Customer } from "@prisma/client";
import { prisma } from "./db";
import { CUSTOMER_COOKIE, CUSTOMER_ROLE, CUSTOMER_TTL_SECONDS, createSessionToken, verifySessionToken } from "./session";
import { getStripe } from "./stripe";

// Shop customer accounts (optional — guest checkout still works). Passwords are bcrypt-hashed; card details
// are saved by Stripe against the account's Stripe customer and never reach this server.

/** Accounts need SESSION_SECRET (it signs the sign-in cookie). Without it the shop still works, guest-only. */
export function customerAccountsEnabled() {
  return (process.env.SESSION_SECRET?.length ?? 0) >= 16;
}

/** The signed-in shop customer, or null. */
export async function getCustomer(): Promise<Customer | null> {
  if (!customerAccountsEnabled()) return null;
  const payload = verifySessionToken((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!payload || payload.role !== CUSTOMER_ROLE) return null;
  return prisma.customer.findUnique({ where: { id: payload.sub } });
}

export async function startCustomerSession(customerId: string) {
  (await cookies()).set(CUSTOMER_COOKIE, createSessionToken(customerId, CUSTOMER_ROLE, Date.now(), undefined, CUSTOMER_TTL_SECONDS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // lax so the account stays signed in when returning from a bank's 3D Secure page
    path: "/",
    maxAge: CUSTOMER_TTL_SECONDS,
  });
}

export async function endCustomerSession() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** Creates the customer's Stripe record the first time it's needed (saved cards hang off it). */
export async function ensureStripeCustomer(customer: Customer): Promise<string | null> {
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const stripe = getStripe();
  if (!stripe) return null;
  const created = await stripe.customers.create(
    { email: customer.email, name: customer.name, metadata: { customerId: customer.id } },
    { idempotencyKey: `cus-${customer.id}` },
  );
  await prisma.customer.update({ where: { id: customer.id }, data: { stripeCustomerId: created.id } });
  return created.id;
}

export type SavedCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number };

/** Cards the customer chose to save at checkout ("Save for future purchases"). */
export async function listSavedCards(customer: Customer): Promise<SavedCard[]> {
  const stripe = getStripe();
  if (!stripe || !customer.stripeCustomerId) return [];
  const list = await stripe.customers.listPaymentMethods(customer.stripeCustomerId, { type: "card", limit: 20 }).catch(() => null);
  return (list?.data ?? [])
    .filter((pm) => pm.card && pm.allow_redisplay === "always")
    .map((pm) => ({ id: pm.id, brand: pm.card!.brand, last4: pm.card!.last4, expMonth: pm.card!.exp_month, expYear: pm.card!.exp_year }));
}
