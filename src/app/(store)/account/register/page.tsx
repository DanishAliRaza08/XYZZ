import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/AccountForms";
import { getCustomer } from "@/lib/customer";
import { isSitePath } from "@/lib/events";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && isSitePath(sp.next) ? sp.next : "/account";
  if (await getCustomer()) redirect(next);
  return (
    <div className="container section" style={{ maxWidth: 460 }}>
      <h1>Create an account</h1>
      <p className="muted">Keep track of your orders, save your delivery address and save cards for faster checkout. Card details are stored securely by Stripe, never by us.</p>
      <div className="panel" style={{ marginTop: 18 }}>
        <RegisterForm next={next} />
      </div>
      <p className="center" style={{ marginTop: 16 }}>
        Already have an account? <Link href={`/account/login?next=${encodeURIComponent(next)}`} style={{ textDecoration: "underline" }}>Sign in</Link>
      </p>
    </div>
  );
}
