import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { prisma } from "./db";
import { CUSTOMER_ROLE, SESSION_COOKIE, verifySessionToken } from "./session";

export type Permission = "dashboard" | "products" | "orders" | "chats" | "settings" | "staff";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ["dashboard", "products", "orders", "chats", "settings", "staff"],
  PRODUCT_MANAGER: ["dashboard", "products"],
  ORDER_MANAGER: ["dashboard", "orders"],
  CUSTOMER_SERVICE: ["dashboard", "orders", "chats"],
  CONTENT_EDITOR: ["dashboard", "settings"],
  ANALYST: ["dashboard"],
};

export function can(role: AdminRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function getAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload || payload.role === CUSTOMER_ROLE) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.active) return null;
  return admin;
}

/** For admin pages: redirect to login when signed out, show 403 page when lacking permission. */
export async function requireAdminPage(permission: Permission) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (!can(admin.role, permission)) redirect("/admin?denied=1");
  return admin;
}

/** For admin API routes: returns the admin or null (caller responds 401/403). */
export async function requireAdminApi(permission: Permission) {
  const admin = await getAdmin();
  if (!admin || !can(admin.role, permission)) return null;
  return admin;
}

export async function audit(adminId: string | null, action: string, entity: string, entityId?: string, details?: string) {
  await prisma.auditLog.create({ data: { adminId, action, entity, entityId, details } });
}
