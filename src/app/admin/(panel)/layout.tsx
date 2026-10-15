import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "../actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { can, requireAdminPage, type Permission } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage("dashboard");
  const [waitingChats, attentionOrders] = await Promise.all([
    prisma.chatConversation.count({ where: { status: "HUMAN", unreadByStaff: true } }),
    prisma.order.count({ where: { status: { in: ["PAID", "NEEDS_ATTENTION"] } } }),
  ]);
  const links: { href: string; label: string; perm: Permission; badge?: number }[] = [
    { href: "/admin", label: "Dashboard", perm: "dashboard" },
    { href: "/admin/products", label: "Products", perm: "products" },
    { href: "/admin/pricing", label: "Pricing", perm: "products" },
    { href: "/admin/categories", label: "Categories", perm: "products" },
    { href: "/admin/discounts", label: "Discount codes", perm: "products" },
    { href: "/admin/orders", label: "Orders", perm: "orders", badge: attentionOrders },
    { href: "/admin/chats", label: "Customer chats", perm: "chats", badge: waitingChats },
    { href: "/admin/settings", label: "Site settings", perm: "settings" },
    { href: "/admin/staff", label: "Staff", perm: "staff" },
    { href: "/admin/account", label: "My account", perm: "dashboard" },
  ];
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <Link href="/admin" className="logo" style={{ fontSize: "1rem", textAlign: "left" }}>FR Admin</Link>
          <ThemeToggle />
        </div>
        <AdminNav links={links.filter((l) => can(admin.role, l.perm)).map(({ perm: _perm, ...l }) => l)} />
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }} className="small">
          <div><strong>{admin.name}</strong></div>
          <div className="muted">{admin.role.replace(/_/g, " ").toLowerCase()}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <Link href="/" className="btn btn-sm btn-outline" target="_blank">View shop</Link>
            <form action={logout}><button className="btn btn-sm btn-ghost">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
