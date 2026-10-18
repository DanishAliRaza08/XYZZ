import type { EventTheme, SeasonalEvent } from "@prisma/client";
import { cached } from "./cache";
import { prisma } from "./db";

export type EventBanner = { image: string; title: string; href: string };

export const EVENT_THEMES: { value: EventTheme; label: string; slug: string }[] = [
  { value: "HALLOWEEN", label: "Halloween (orange & purple, falling bats)", slug: "halloween" },
  { value: "CHRISTMAS", label: "Christmas (red & green, falling snow)", slug: "christmas" },
  { value: "CUSTOM", label: "Custom (your accent colour only)", slug: "custom" },
];

export function themeSlug(theme: EventTheme) {
  return EVENT_THEMES.find((t) => t.value === theme)?.slug ?? "custom";
}

/** The event currently shown on the storefront: switched on and inside its date window. Newest start wins. */
export async function getActiveEvent(now = new Date()): Promise<SeasonalEvent | null> {
  // The switched-on events are cached; the date window is checked on every call so events start and end on time.
  const switchedOn = await cached("events", () =>
    prisma.seasonalEvent.findMany({ where: { active: true }, orderBy: [{ startsAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }] }),
  );
  return switchedOn.find((e) => isLive(e, now)) ?? null;
}

export function isLive(e: Pick<SeasonalEvent, "active" | "startsAt" | "endsAt">, now = new Date()) {
  return e.active && (!e.startsAt || e.startsAt <= now) && (!e.endsAt || e.endsAt >= now);
}

/** Banners are stored as JSON; anything malformed is dropped rather than breaking the homepage. */
export function parseBanners(value: unknown): EventBanner[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({ image: String(b.image ?? ""), title: String(b.title ?? ""), href: String(b.href ?? "") }))
    .filter((b) => isSafeImage(b.image) && (!b.href || isSitePath(b.href)));
}

/** https:// URLs, uploaded images (/uploads/…) or files in the public folder — never protocol-relative //host. */
export function isSafeImage(url: string) {
  return /^(https:\/\/|\/(?!\/))/.test(url);
}

export function isSitePath(href: string) {
  return /^\/(?!\/)/.test(href);
}

export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/** CSS variables for an admin-chosen accent colour (applied on the event wrapper). */
export function accentVars(hex: string | null | undefined): Record<string, string> | undefined {
  if (!hex || !HEX_COLOUR.test(hex)) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return {
    "--accent": hex,
    "--accent-contrast": luminance > 0.4 ? "#1c1a17" : "#ffffff",
    "--accent-soft": `color-mix(in srgb, ${hex} 14%, var(--bg))`,
  };
}
