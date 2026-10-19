"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AdminRole, Department, EventTheme, OrderStatus, ProductStatus } from "@prisma/client";
import { audit, requireAdminPage } from "@/lib/auth";
import { invalidateStoreCache } from "@/lib/cache";
import { startImport } from "@/lib/import-job";
import { normaliseSource } from "@/lib/shopify-import";
import { slugify } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { HEX_COLOUR, isSafeImage, isSitePath, parseBanners } from "@/lib/events";
import { parseMoney } from "@/lib/money";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";
import { SECTIONS } from "@/lib/navigation";
import { getSettings, saveSettings, type DepartmentTileOverride } from "@/lib/settings";

export type FormState = { error?: string; ok?: string } | undefined;

/** After any change the shop shows (products, prices, categories, settings, events): drop cached data and pages. */
function refreshStore() {
  invalidateStoreCache();
  revalidatePath("/", "layout");
}

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

// ---------- Blog (Admin → Blog) ----------
export async function saveBlogPost(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("settings");
  const id = optStr(fd, "id");
  const title = str(fd, "title").slice(0, 200);
  if (title.length < 3) return { error: "Give the post a title." };
  const content = String(fd.get("content") ?? "").trim();
  if (content.length < 20) return { error: "Write the post (at least a sentence or two) before saving." };
  if (content.length > 200_000) return { error: "This post is too long — split it into two posts." };
  const coverImage = optStr(fd, "coverImage");
  if (coverImage && !isSafeImage(coverImage)) return { error: "The cover photo must be uploaded or an https:// address." };
  const status = str(fd, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  let slug = slugify(str(fd, "slug") || title);
  if (!slug) return { error: "Could not make a web address from the title — enter one in “Web address”." };
  const clash = await prisma.blogPost.findUnique({ where: { slug } });
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const before = id ? await prisma.blogPost.findUnique({ where: { id } }) : null;
  if (id && !before) return { error: "This post no longer exists." };
  const data = {
    title,
    slug,
    content,
    coverImage,
    excerpt: optStr(fd, "excerpt")?.slice(0, 400) ?? null,
    author: optStr(fd, "author")?.slice(0, 120) ?? null,
    status: status as "DRAFT" | "PUBLISHED",
    // The post's date is when it was first published; editing later keeps it.
    publishedAt: status === "PUBLISHED" ? (before?.publishedAt ?? new Date()) : (before?.publishedAt ?? null),
  };
  const post = before ? await prisma.blogPost.update({ where: { id: before.id }, data }) : await prisma.blogPost.create({ data });
  await audit(admin.id, before ? "update" : "create", "BlogPost", post.id, `${title} · ${status}`);
  refreshStore();
  if (!before) redirect(`/admin/blog/${post.id}?saved=1`);
  return { ok: status === "PUBLISHED" ? "Saved and published." : "Saved as a draft (not visible in the shop)." };
}

export async function deleteBlogPost(fd: FormData) {
  const admin = await requireAdminPage("settings");
  const id = str(fd, "id");
  const post = await prisma.blogPost.delete({ where: { id } }).catch(() => null);
  if (post) await audit(admin.id, "delete", "BlogPost", id, post.title);
  refreshStore();
  redirect("/admin/blog");
}

// ---------- Import products (Admin → Import products) ----------
export async function startProductImport(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("products");
  let source: string;
  try {
    source = normaliseSource(str(fd, "source"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Enter a website address." };
  }
  const num = (k: string, min: number, max: number, fallback: number) => {
    const n = Number(str(fd, k));
    return str(fd, k) && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const status: ProductStatus = str(fd, "status") === "DRAFT" ? "DRAFT" : "PUBLISHED";
  const error = startImport(
    { source, status, maxImages: num("maxImages", 0, 10, 4), defaultStock: num("defaultStock", 0, 10000, 10), limit: num("limit", 1, 10000, Infinity) },
    admin.id,
  );
  if (error) return { error };
  await audit(admin.id, "start-import", "Product", undefined, `${source} · ${status}`);
  revalidatePath("/admin/import");
  return { ok: "Import started — progress is shown below." };
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
// colour: which variant colour the photo shows (empty = all colours); the product page swaps photos when the colour changes.
const ImageInput = z.object({ url: z.string().trim().min(1).max(500), alt: z.string().trim().max(200), colour: z.string().trim().max(40).nullish() });

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
      const colours = new Set(variants.map((v) => v.colour));
      if (images.length)
        await tx.productImage.createMany({
          data: images.map((img, i) => ({
            url: img.url,
            alt: img.alt || name,
            // A colour that no longer exists on any variant falls back to "all colours".
            colour: img.colour && colours.has(img.colour) ? img.colour : null,
            position: i,
            productId: product.id,
          })),
        });
      return product.id;
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not save the product. Check for duplicate SKUs or size/colour combinations." };
  }
  await audit(admin.id, id ? "update" : "create", "Product", productId, `${name} · ${data.status} · £${(priceGBP / 100).toFixed(2)}`);
  refreshStore();
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
  refreshStore();
}

/** Admin → Products: publish, move to draft, archive or delete every ticked product at once. */
export async function bulkProducts(fd: FormData) {
  const admin = await requireAdminPage("products");
  const ids = [...new Set(fd.getAll("ids").map(String).filter(Boolean))].slice(0, 1000);
  const action = str(fd, "bulk");
  const back = new URLSearchParams();
  for (const k of ["q", "status"]) if (str(fd, k)) back.set(k, str(fd, k));
  let message = "Select at least one product first.";

  if (ids.length && (action === "PUBLISHED" || action === "DRAFT" || action === "ARCHIVED")) {
    const { count } = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { status: action } });
    message = `${count} product${count === 1 ? "" : "s"} ${action === "PUBLISHED" ? "published" : action === "DRAFT" ? "moved to draft" : "archived"}.`;
    await audit(admin.id, `bulk-status:${action}`, "Product", undefined, `${count} products`);
  } else if (ids.length && action === "delete") {
    // Products with order history are archived instead, so past orders keep their details.
    const withOrders = new Set(
      (await prisma.variant.findMany({ where: { productId: { in: ids }, orderItems: { some: {} } }, select: { productId: true }, distinct: ["productId"] })).map((v) => v.productId),
    );
    const deletable = ids.filter((id) => !withOrders.has(id));
    const { count } = await prisma.product.deleteMany({ where: { id: { in: deletable } } });
    if (withOrders.size) await prisma.product.updateMany({ where: { id: { in: [...withOrders] } }, data: { status: "ARCHIVED" } });
    message = `${count} product${count === 1 ? "" : "s"} deleted${withOrders.size ? `; ${withOrders.size} with past orders archived instead` : ""}.`;
    await audit(admin.id, "bulk-delete", "Product", undefined, message);
  }
  refreshStore();
  back.set("done", message);
  redirect(`/admin/products?${back}`);
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
  refreshStore();
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
  refreshStore();
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
  refreshStore();
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
  refreshStore();
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
  refreshStore();
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
  // Allow https:// URLs or files in the public/ folder (e.g. /hero-img.jpg), but not protocol-relative //host URLs.
  if (heroImage && !/^(https:\/\/|\/(?!\/))/.test(heroImage)) return { error: "Hero image must be an https:// URL or a path like /hero-img.jpg (file in the public folder)." };
  const departmentTiles: Record<string, DepartmentTileOverride> = {};
  for (const sec of SECTIONS.filter((x) => x.tile)) {
    const tile = { image: str(fd, `tile_${sec.slug}_image`), text: str(fd, `tile_${sec.slug}_text`).slice(0, 160), button: str(fd, `tile_${sec.slug}_button`).slice(0, 40) };
    if (tile.image && !isSafeImage(tile.image)) return { error: `${sec.label} tile: the picture must be uploaded or an https:// URL.` };
    if (tile.image || tile.text || tile.button) departmentTiles[sec.slug] = tile;
  }
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
    departmentTiles,
    shipping: {
      GBP: { standard: money("gbpStandard", current.shipping.GBP.standard), express: money("gbpExpress", current.shipping.GBP.express), freeOver: money("gbpFreeOver", current.shipping.GBP.freeOver) },
      USD: { standard: money("usdStandard", current.shipping.USD.standard), express: money("usdExpress", current.shipping.USD.express), freeOver: money("usdFreeOver", current.shipping.USD.freeOver) },
    },
  });
  await audit(admin.id, "update", "Settings");
  refreshStore();
  return { ok: "Settings saved." };
}

// ---------- Seasonal events ----------
const THEMES: EventTheme[] = ["HALLOWEEN", "CHRISTMAS", "CUSTOM"];

export async function saveEvent(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdminPage("settings");
  const id = optStr(fd, "id");
  const name = str(fd, "name").slice(0, 60);
  if (name.length < 2) return { error: "Give the event a name, e.g. Halloween 2026." };
  const theme = str(fd, "theme") as EventTheme;
  if (!THEMES.includes(theme)) return { error: "Choose a theme." };
  const barText = str(fd, "barText").slice(0, 200);
  if (!barText) return { error: "Add the text for the bar at the top of the page." };
  const heroTitle = str(fd, "heroTitle").slice(0, 120);
  if (!heroTitle) return { error: "Add a homepage title for the event." };

  const date = (k: string, end: boolean) => {
    const v = str(fd, k);
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    return new Date(`${v}T${end ? "23:59:59" : "00:00:00"}Z`);
  };
  const startsAt = date("startsAt", false);
  const endsAt = date("endsAt", true);
  if (startsAt === undefined || endsAt === undefined) return { error: "Dates must be valid." };
  if (startsAt && endsAt && endsAt < startsAt) return { error: "The end date must be after the start date." };

  for (const k of ["barLinkHref", "heroCtaHref"])
    if (str(fd, k) && !isSitePath(str(fd, k))) return { error: "Links must be pages on this site, starting with / (e.g. /shop/girls)." };
  const heroImage = str(fd, "heroImage");
  if (heroImage && !isSafeImage(heroImage)) return { error: "Hero image must be uploaded, an https:// URL or a path like /images/halloween.jpg." };
  const accentColor = str(fd, "accentColor");
  if (accentColor && !HEX_COLOUR.test(accentColor)) return { error: "Accent colour must look like #ff7a1a." };

  let banners;
  try {
    const raw = z.array(z.object({ image: z.string(), title: z.string().max(80), href: z.string().max(300) })).max(12).parse(JSON.parse(str(fd, "banners") || "[]"));
    banners = parseBanners(raw.filter((b) => b.image));
    if (banners.length !== raw.filter((b) => b.image).length) return { error: "Each promo tile needs an uploaded image, and its link must start with /." };
  } catch {
    return { error: "Promo tiles could not be read — please try again." };
  }

  const data = {
    name,
    theme,
    active: fd.get("active") === "on",
    startsAt,
    endsAt,
    barText,
    barLinkLabel: optStr(fd, "barLinkLabel")?.slice(0, 40) ?? null,
    barLinkHref: optStr(fd, "barLinkHref"),
    heroEyebrow: optStr(fd, "heroEyebrow")?.slice(0, 60) ?? null,
    heroTitle,
    heroSubtitle: optStr(fd, "heroSubtitle")?.slice(0, 300) ?? null,
    heroImage: heroImage || null,
    heroCtaLabel: optStr(fd, "heroCtaLabel")?.slice(0, 40) ?? null,
    heroCtaHref: optStr(fd, "heroCtaHref"),
    collection: optStr(fd, "collection")?.slice(0, 80) ?? null,
    sectionTitle: optStr(fd, "sectionTitle")?.slice(0, 80) ?? null,
    accentColor: accentColor || null,
    decorations: fd.get("decorations") === "on",
    banners,
  };
  const saved = id ? await prisma.seasonalEvent.update({ where: { id }, data }) : await prisma.seasonalEvent.create({ data });
  await audit(admin.id, id ? "update" : "create", "SeasonalEvent", saved.id, `${name} · ${data.active ? "on" : "off"}`);
  refreshStore();
  if (!id) redirect(`/admin/events/${saved.id}?saved=1`);
  return { ok: "Event saved." };
}

export async function toggleEvent(fd: FormData) {
  const admin = await requireAdminPage("settings");
  const id = str(fd, "id");
  const e = await prisma.seasonalEvent.findUniqueOrThrow({ where: { id } });
  await prisma.seasonalEvent.update({ where: { id }, data: { active: !e.active } });
  await audit(admin.id, e.active ? "deactivate" : "activate", "SeasonalEvent", id, e.name);
  refreshStore();
}

export async function deleteEvent(fd: FormData) {
  const admin = await requireAdminPage("settings");
  const id = str(fd, "id");
  await prisma.seasonalEvent.delete({ where: { id } });
  await audit(admin.id, "delete", "SeasonalEvent", id);
  refreshStore();
  redirect("/admin/events");
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
