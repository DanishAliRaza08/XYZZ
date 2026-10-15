"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AdminRole, Department, OrderStatus, ProductStatus } from "@prisma/client";
import { audit, requireAdminPage } from "@/lib/auth";
import { slugify } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";
import { getSettings, saveSettings } from "@/lib/settings";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;

// ---------- Auth ----------
let dummyHash: string | undefined;

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const ip = clientIp(await headers());
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? dummyHash);
  if (!admin || !admin.active || !ok) return { error: "Incorrect email or password." };
  (await cookies()).set(SESSION_COOKIE, createSessionToken(admin.id, admin.role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await audit(admin.id, "login", "AdminUser", admin.id, ip);
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- Products ----------
const VariantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1).max(60),
  size: z.string().trim().min(1).max(30),
  colour: z.string().trim().min(1).max(40),
  colourHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stock: z.coerce.number().int().min(0).max(100000),
});
const ImageInput = z.object({ url: z.string().trim().min(1).max(500), alt: z.string().trim().max(200) });

export async function saveProduct(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Product name is required." };
  const description = str(fd, "description");
  if (description.length < 10) return { error: "Please add a description (at least 10 characters)." };
  const categoryId = str(fd, "categoryId");
  if (!categoryId) return { error: "Choose a category." };

  const priceGBP = parseMoney(str(fd, "priceGBP"));
  if (priceGBP == null || priceGBP <= 0) return { error: "Enter a valid UK price, e.g. 29.99" };
  const salePriceGBP = parseMoney(str(fd, "salePriceGBP"));
  const priceUSD = parseMoney(str(fd, "priceUSD"));
  const salePriceUSD = parseMoney(str(fd, "salePriceUSD"));
  if (salePriceGBP != null && salePriceGBP >= priceGBP) return { error: "UK sale price must be lower than the regular price." };
  if (salePriceUSD != null && (priceUSD == null || salePriceUSD >= priceUSD)) return { error: "US sale price must be lower than the US price." };

  let variants: z.infer<typeof VariantInput>[];
  let images: z.infer<typeof ImageInput>[];
  try {
    variants = z.array(VariantInput).min(1).max(200).parse(JSON.parse(str(fd, "variants") || "[]"));
    images = z.array(ImageInput).max(20).parse(JSON.parse(str(fd, "images") || "[]"));
  } catch {
    return { error: "Each variant needs a SKU, size, colour and stock quantity (at least one variant)." };
  }
  const combos = new Set(variants.map((v) => `${v.size}|${v.colour}`));
  if (combos.size !== variants.length) return { error: "Each size + colour combination must be unique." };
  const skus = new Set(variants.map((v) => v.sku));
  if (skus.size !== variants.length) return { error: "SKUs must be unique." };

  let slug = slugify(str(fd, "slug") || name);
  if (!slug) return { error: "Could not create a URL from the product name." };
  const clash = await prisma.product.findUnique({ where: { slug } });
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const skuClash = await prisma.variant.findFirst({ where: { sku: { in: [...skus] }, NOT: id ? { productId: id } : undefined } });
  if (skuClash) return { error: `SKU ${skuClash.sku} is already used by another product.` };

  const data = {
    name,
    slug,
    description,
    categoryId,
    department: str(fd, "department") as Department,
    status: str(fd, "status") as ProductStatus,
    priceGBP,
    salePriceGBP,
    priceUSD,
    salePriceUSD,
    composition: optStr(fd, "composition"),
    care: optStr(fd, "care"),
    origin: optStr(fd, "origin"),
    ageRange: optStr(fd, "ageRange"),
    collection: optStr(fd, "collection"),
    featured: fd.get("featured") === "on",
    bestseller: fd.get("bestseller") === "on",
  };

  let productId: string;
  try {
    productId = await prisma.$transaction(async (tx) => {
      const product = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });
      // Variants referenced by past orders are kept (stock set to 0) rather than deleted.
      const existing = await tx.variant.findMany({ where: { productId: product.id }, include: { _count: { select: { orderItems: true } } } });
      const keepIds = new Set(variants.map((v) => v.id).filter(Boolean));
      for (const old of existing.filter((e) => !keepIds.has(e.id))) {
        if (old._count.orderItems > 0) await tx.variant.update({ where: { id: old.id }, data: { stock: 0, sku: `${old.sku}-retired-${Date.now().toString(36)}`, size: `${old.size} (retired)` } });
        else await tx.variant.delete({ where: { id: old.id } });
      }
      for (const [i, v] of variants.entries()) {
        const vData = { sku: v.sku, size: v.size, colour: v.colour, colourHex: v.colourHex, stock: v.stock, sortOrder: i };
        if (v.id && existing.some((e) => e.id === v.id)) await tx.variant.update({ where: { id: v.id }, data: vData });
        else await tx.variant.create({ data: { ...vData, productId: product.id } });
      }
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      if (images.length) await tx.productImage.createMany({ data: images.map((img, i) => ({ ...img, alt: img.alt || name, position: i, productId: product.id })) });
      return product.id;
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not save the product. Check for duplicate SKUs or size/colour combinations." };
  }
  await audit(admin.id, id ? "update" : "create", "Product", productId, `${name} · ${data.status} · £${(priceGBP / 100).toFixed(2)}`);
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/products/${productId}?saved=1`);
  return { ok: "Product saved." };
}

export async function setProductStatus(fd: FormData) {
  const admin = await requireAdminPage("products");
  const id = str(fd, "id");
  const status = str(fd, "status") as ProductStatus;
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;
  await prisma.product.update({ where: { id }, data: { status } });
  await audit(admin.id, `status:${status}`, "Product", id);
  revalidatePath("/", "layout");
}

export async function deleteProduct(fd: FormData) {
  const admin = await requireAdminPage("products");
  const id = str(fd, "id");
  const used = await prisma.orderItem.count({ where: { variant: { productId: id } } });
  if (used > 0) {
    // Products with order history are archived so financial records stay intact.
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    await audit(admin.id, "archive", "Product", id, "has orders — archived instead of deleted");
  } else {
    await prisma.product.delete({ where: { id } });
    await audit(admin.id, "delete", "Product", id);
  }
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

// ---------- Pricing ----------
export async function savePricing(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  const ids = fd.getAll("ids").map(String);
  const errors: string[] = [];
  const updates: { id: string; priceGBP: number; salePriceGBP: number | null; priceUSD: number | null; salePriceUSD: number | null }[] = [];
  for (const id of ids) {
    const priceGBP = parseMoney(str(fd, `gbp_${id}`));
    const salePriceGBP = parseMoney(str(fd, `gbpsale_${id}`));
    const priceUSD = parseMoney(str(fd, `usd_${id}`));
    const salePriceUSD = parseMoney(str(fd, `usdsale_${id}`));
    const label = str(fd, `name_${id}`);
    if (priceGBP == null || priceGBP <= 0) errors.push(`${label}: UK price is required`);
    else if (salePriceGBP != null && salePriceGBP >= priceGBP) errors.push(`${label}: UK sale price must be lower`);
    else if (salePriceUSD != null && (priceUSD == null || salePriceUSD >= priceUSD)) errors.push(`${label}: US sale price must be lower than US price`);
    else updates.push({ id, priceGBP, salePriceGBP, priceUSD, salePriceUSD });
  }
  if (errors.length) return { error: errors.slice(0, 5).join(" · ") };
  const current = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, priceGBP: true, salePriceGBP: true, priceUSD: true, salePriceUSD: true } });
  const changed = updates.filter((u) => {
    const c = current.find((p) => p.id === u.id);
    return c && (c.priceGBP !== u.priceGBP || c.salePriceGBP !== u.salePriceGBP || c.priceUSD !== u.priceUSD || c.salePriceUSD !== u.salePriceUSD);
  });
  await prisma.$transaction(changed.map(({ id, ...data }) => prisma.product.update({ where: { id }, data })));
  if (changed.length) await audit(admin.id, "bulk-pricing", "Product", undefined, `${changed.length} products updated`);
  revalidatePath("/", "layout");
  return { ok: changed.length ? `Updated prices for ${changed.length} product${changed.length === 1 ? "" : "s"}.` : "No changes to save." };
}

export async function adjustPrices(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  const pct = Number(str(fd, "percent"));
  const mode = str(fd, "mode"); // "regular" | "sale" | "clear-sale"
  const department = str(fd, "department");
  if (mode !== "clear-sale" && (!Number.isFinite(pct) || pct === 0 || Math.abs(pct) > 90)) return { error: "Enter a percentage between -90 and 90." };
  const products = await prisma.product.findMany({ where: department ? { department: department as Department } : {} });
  const round = (n: number) => Math.max(1, Math.round(n));
  const ops = products.map((p) => {
    if (mode === "clear-sale") return prisma.product.update({ where: { id: p.id }, data: { salePriceGBP: null, salePriceUSD: null } });
    if (mode === "sale") {
      const off = Math.abs(pct);
      return prisma.product.update({
        where: { id: p.id },
        data: { salePriceGBP: round((p.priceGBP * (100 - off)) / 100), salePriceUSD: p.priceUSD ? round((p.priceUSD * (100 - off)) / 100) : null },
      });
    }
    return prisma.product.update({
      where: { id: p.id },
      data: {
        priceGBP: round((p.priceGBP * (100 + pct)) / 100),
        priceUSD: p.priceUSD ? round((p.priceUSD * (100 + pct)) / 100) : null,
        // A sale price that's no longer below the regular price is removed.
        salePriceGBP: p.salePriceGBP && p.salePriceGBP < round((p.priceGBP * (100 + pct)) / 100) ? p.salePriceGBP : null,
        salePriceUSD: p.salePriceUSD && p.priceUSD && p.salePriceUSD < round((p.priceUSD * (100 + pct)) / 100) ? p.salePriceUSD : null,
      },
    });
  });
  await prisma.$transaction(ops);
  await audit(admin.id, `bulk-adjust:${mode}`, "Product", undefined, `${pct}% on ${products.length} products${department ? ` (${department})` : ""}`);
  revalidatePath("/", "layout");
  return { ok: `${mode === "clear-sale" ? "Removed sale prices from" : "Adjusted"} ${products.length} products.` };
}

// ---------- Categories ----------
export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Category name is required." };
  const slug = slugify(str(fd, "slug") || name);
  const data = { name, slug, description: optStr(fd, "description"), sortOrder: Number(str(fd, "sortOrder")) || 0 };
  try {
    const cat = id ? await prisma.category.update({ where: { id }, data }) : await prisma.category.create({ data });
    await audit(admin.id, id ? "update" : "create", "Category", cat.id, name);
  } catch {
    return { error: "A category with that URL already exists." };
  }
  revalidatePath("/", "layout");
  return { ok: "Category saved." };
}

export async function deleteCategory(fd: FormData) {
  const admin = await requireAdminPage("products");
  const id = str(fd, "id");
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count === 0) {
    await prisma.category.delete({ where: { id } });
    await audit(admin.id, "delete", "Category", id);
  }
  revalidatePath("/", "layout");
}

// ---------- Orders ----------
const ORDER_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "NEEDS_ATTENTION", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export async function updateOrder(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("orders");
  const id = str(fd, "id");
  const status = str(fd, "status") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { error: "Invalid status." };
  const before = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (before.status === "PENDING_PAYMENT" && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(status))
    return { error: "Unpaid orders can't be fulfilled. Payment is confirmed automatically by Stripe." };
  await prisma.order.update({
    where: { id },
    data: { status, trackingCarrier: optStr(fd, "trackingCarrier"), trackingNumber: optStr(fd, "trackingNumber"), notes: optStr(fd, "notes") },
  });
  await audit(admin.id, "update", "Order", id, `${before.status} → ${status}`);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: status === "REFUNDED" ? "Saved. Remember to issue the refund in your Stripe dashboard." : "Order updated." };
}

// ---------- Chats ----------
export async function sendStaffReply(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("chats");
  const id = str(fd, "conversationId");
  const content = str(fd, "content").slice(0, 2000);
  if (!content) return { error: "Type a reply first." };
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { conversationId: id, role: "STAFF", content } }),
    prisma.chatConversation.update({ where: { id }, data: { status: "HUMAN", unreadByStaff: false } }),
  ]);
  await audit(admin.id, "reply", "ChatConversation", id);
  revalidatePath("/admin/chats");
  return { ok: "Sent." };
}

export async function setChatStatus(fd: FormData) {
  const admin = await requireAdminPage("chats");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!["AI", "HUMAN", "CLOSED"].includes(status)) return;
  await prisma.chatConversation.update({ where: { id }, data: { status: status as "AI" | "HUMAN" | "CLOSED", unreadByStaff: false } });
  await audit(admin.id, `status:${status}`, "ChatConversation", id);
  revalidatePath("/admin/chats");
}

// ---------- Discounts ----------
export async function saveDiscount(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  const code = str(fd, "code").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) return { error: "Code must be at least 3 letters or numbers." };
  const percentOff = str(fd, "percentOff") ? Number(str(fd, "percentOff")) : null;
  const amountOffGBP = parseMoney(str(fd, "amountOffGBP"));
  if ((percentOff == null) === (amountOffGBP == null)) return { error: "Set either a percentage or a fixed £ amount (not both)." };
  if (percentOff != null && (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 90)) return { error: "Percentage must be 1–90." };
  const expires = str(fd, "expiresAt");
  try {
    await prisma.discountCode.create({
      data: {
        code,
        percentOff,
        amountOffGBP,
        minSubtotalGBP: parseMoney(str(fd, "minSubtotalGBP")),
        usageLimit: str(fd, "usageLimit") ? Number(str(fd, "usageLimit")) : null,
        expiresAt: expires ? new Date(`${expires}T23:59:59Z`) : null,
      },
    });
  } catch {
    return { error: "That code already exists." };
  }
  await audit(admin.id, "create", "DiscountCode", code);
  revalidatePath("/admin/discounts");
  return { ok: `Code ${code} created.` };
}

export async function toggleDiscount(fd: FormData) {
  const admin = await requireAdminPage("products");
  const id = str(fd, "id");
  const d = await prisma.discountCode.findUniqueOrThrow({ where: { id } });
  await prisma.discountCode.update({ where: { id }, data: { active: !d.active } });
  await audit(admin.id, d.active ? "deactivate" : "activate", "DiscountCode", d.code);
  revalidatePath("/admin/discounts");
}

// ---------- Settings ----------
export async function updateSettings(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("settings");
  const current = await getSettings();
  const money = (k: string, fallback: number) => parseMoney(str(fd, k)) ?? fallback;
  const whatsapp = str(fd, "whatsappNumber").replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) return { error: "WhatsApp number must be in international format, e.g. 447700900123." };
  const heroCtaHref = str(fd, "heroCtaHref");
  if (heroCtaHref && !heroCtaHref.startsWith("/")) return { error: "Hero button link must be a page on this site, starting with /" };
  const heroImage = str(fd, "heroImage");
  if (heroImage && !/^(https:\/\/|\/uploads\/)/.test(heroImage)) return { error: "Hero image must be an https:// URL or an uploaded image." };
  await saveSettings({
    announcement: str(fd, "announcement").slice(0, 200),
    heroEyebrow: str(fd, "heroEyebrow").slice(0, 60),
    heroTitle: str(fd, "heroTitle").slice(0, 120) || current.heroTitle,
    heroSubtitle: str(fd, "heroSubtitle").slice(0, 300),
    heroImage,
    heroCtaLabel: str(fd, "heroCtaLabel").slice(0, 40),
    heroCtaHref: heroCtaHref || "/shop/new-arrivals",
    whatsappNumber: whatsapp,
    supportPhone: str(fd, "supportPhone").slice(0, 30),
    supportEmail: str(fd, "supportEmail").slice(0, 120),
    companyAddress: str(fd, "companyAddress").slice(0, 200),
    companyNumber: str(fd, "companyNumber").slice(0, 20),
    vatNumber: str(fd, "vatNumber").slice(0, 20),
    usStoreEnabled: fd.get("usStoreEnabled") === "on",
    shipping: {
      GBP: { standard: money("gbpStandard", current.shipping.GBP.standard), express: money("gbpExpress", current.shipping.GBP.express), freeOver: money("gbpFreeOver", current.shipping.GBP.freeOver) },
      USD: { standard: money("usdStandard", current.shipping.USD.standard), express: money("usdExpress", current.shipping.USD.express), freeOver: money("usdFreeOver", current.shipping.USD.freeOver) },
    },
  });
  await audit(admin.id, "update", "Settings");
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

// ---------- Staff ----------
const ROLES: AdminRole[] = ["SUPER_ADMIN", "PRODUCT_MANAGER", "ORDER_MANAGER", "CUSTOMER_SERVICE", "CONTENT_EDITOR", "ANALYST"];

export async function createStaff(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("staff");
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const password = str(fd, "password");
  const role = str(fd, "role") as AdminRole;
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Password must be at least 10 characters." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  try {
    const u = await prisma.adminUser.create({ data: { email, name: name || email, role, passwordHash: await bcrypt.hash(password, 12) } });
    await audit(admin.id, "create", "AdminUser", u.id, `${email} as ${role}`);
  } catch {
    return { error: "A staff account with that email already exists." };
  }
  revalidatePath("/admin/staff");
  return { ok: "Staff account created." };
}

export async function toggleStaff(fd: FormData) {
  const admin = await requireAdminPage("staff");
  const id = str(fd, "id");
  if (id === admin.id) return; // can't lock yourself out
  const u = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  await prisma.adminUser.update({ where: { id }, data: { active: !u.active } });
  await audit(admin.id, u.active ? "deactivate" : "activate", "AdminUser", id);
  revalidatePath("/admin/staff");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("dashboard");
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (!(await bcrypt.compare(current, admin.passwordHash))) return { error: "Current password is incorrect." };
  if (next.length < 10) return { error: "New password must be at least 10 characters." };
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await audit(admin.id, "change-password", "AdminUser", admin.id);
  return { ok: "Password changed." };
}
