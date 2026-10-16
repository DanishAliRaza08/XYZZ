import { prisma } from "./db";
import { DEFAULT_SHIPPING, type ShippingRates } from "./pricing";

export type SiteSettings = {
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  whatsappNumber: string;
  supportPhone: string;
  supportEmail: string;
  companyAddress: string;
  companyNumber: string;
  vatNumber: string;
  usStoreEnabled: boolean;
  shipping: ShippingRates;
  // Admin overrides for the homepage "Shop by department" tiles, keyed by menu section slug
  // (src/lib/navigation.ts). Empty values fall back to the defaults in navigation.ts.
  departmentTiles: Record<string, DepartmentTileOverride>;
};

export type DepartmentTileOverride = { image: string; text: string; button: string };

export const DEFAULT_SETTINGS: SiteSettings = {
  announcement: "Free UK standard delivery on orders over £50 · Free returns within 28 days",
  heroEyebrow: "Autumn / Winter",
  heroTitle: "Dressed for every occasion",
  heroSubtitle: "Considered occasionwear and everyday pieces for women and children — designed in Britain.",
  heroImage: "",
  heroCtaLabel: "Shop new arrivals",
  heroCtaHref: "/shop/new-arrivals",
  whatsappNumber: process.env.SUPPORT_WHATSAPP_NUMBER ?? "",
  supportPhone: "",
  supportEmail: "hello@fashionrockstar.co.uk",
  companyAddress: "",
  companyNumber: "",
  vatNumber: "",
  usStoreEnabled: true,
  shipping: DEFAULT_SHIPPING,
  departmentTiles: {},
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[];

export async function getSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of KEYS) {
    const raw = map.get(key);
    if (raw == null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      // ignore malformed values and keep the default
    }
  }
  if (!out.whatsappNumber && process.env.SUPPORT_WHATSAPP_NUMBER) out.whatsappNumber = process.env.SUPPORT_WHATSAPP_NUMBER;
  return out as SiteSettings;
}

export async function saveSettings(patch: Partial<SiteSettings>) {
  const ops = Object.entries(patch)
    .filter(([k]) => (KEYS as string[]).includes(k))
    .map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: { value: JSON.stringify(value) },
      }),
    );
  await prisma.$transaction(ops);
}

export function whatsappLink(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
