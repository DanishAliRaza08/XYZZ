import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/AccountForms";
import { getCustomer } from "@/lib/customer";
import { isSitePath } from "@/lib/events";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && isSitePath(sp.next) ? sp.next : "/account";
  if (await getCustomer()) redirect(next);
  return (
    <div className="container section" style={{ maxWidth: 460 }}>
      <h1>Sign in</h1>
      <p className="muted">See your past orders and pay faster with your saved cards.</p>
      <div className="panel" style={{ marginTop: 18 }}>
        <SignInForm next={next} />
      </div>
      <p className="center" style={{ marginTop: 16 }}>
        New here? <Link href={`/account/register?next=${encodeURIComponent(next)}`} style={{ textDecoration: "underline" }}>Create an account</Link>
      </p>
    </div>
  );
}
