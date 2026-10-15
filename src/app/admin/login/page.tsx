import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="panel" style={{ width: "min(420px, 100%)" }}>
        <div className="logo" style={{ marginBottom: 6 }}>Fashion Rockstar</div>
        <p className="muted center small" style={{ marginBottom: 20 }}>Staff & admin sign in</p>
        <LoginForm />
      </div>
    </main>
  );
}
