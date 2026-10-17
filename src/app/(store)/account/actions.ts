"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { endCustomerSession, getCustomer, startCustomerSession } from "@/lib/customer";
import { isSitePath } from "@/lib/events";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** Where to go after signing in — only pages on this site, never another domain. */
const nextPath = (fd: FormData) => (isSitePath(str(fd, "next")) ? str(fd, "next") : "/account");

const Register = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
  password: z.string().min(8, "Use at least 8 characters for your password").max(200),
});

export async function registerCustomer(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`register:${clientIp(await headers())}`, 5, 60 * 60_000)) return { error: "Too many sign-ups from this connection. Try again later." };
  const parsed = Register.safeParse({ name: str(fd, "name"), email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await prisma.customer.findUnique({ where: { email } })) return { error: "An account with this email already exists. Sign in instead." };
  const customer = await prisma.customer.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12) } }).catch(() => null);
  if (!customer) return { error: "An account with this email already exists. Sign in instead." };
  await startCustomerSession(customer.id);
  redirect(nextPath(fd));
}

let dummyHash: string | undefined;

export async function signInCustomer(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`customer-login:${clientIp(await headers())}`, 10, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const email = str(fd, "email").toLowerCase();
  const customer = await prisma.customer.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email has an account.
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  const ok = await bcrypt.compare(String(fd.get("password") ?? ""), customer?.passwordHash ?? dummyHash);
  if (!customer || !ok) return { error: "Incorrect email or password." };
  await prisma.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
  await startCustomerSession(customer.id);
  redirect(nextPath(fd));
}

export async function signOutCustomer() {
  await endCustomerSession();
  redirect("/");
}

/** Removes a saved card from the customer's Stripe record (only cards that belong to this account). */
export async function removeSavedCard(fd: FormData) {
  const customer = await getCustomer();
  const stripe = getStripe();
  const id = str(fd, "paymentMethodId");
  if (!customer?.stripeCustomerId || !stripe || !/^pm_[A-Za-z0-9]+$/.test(id)) return;
  const pm = await stripe.paymentMethods.retrieve(id).catch(() => null);
  if (pm && pm.customer === customer.stripeCustomerId) await stripe.paymentMethods.detach(id).catch(() => undefined);
  revalidatePath("/account");
}
