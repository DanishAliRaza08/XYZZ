import { describe, expect, it } from "vitest";
import { CustomerSchema } from "@/lib/checkout-schema";
import { sniffImage, SAFE_NAME } from "@/lib/uploads";

const uk = { email: "A@Example.com", name: "Jane Doe", addressLine1: "1 High Street", city: "London", postcode: "SW1A 1AA", country: "GB" as const };

describe("checkout validation", () => {
  it("accepts a valid UK address and normalises email", () => {
    const r = CustomerSchema.safeParse(uk);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("a@example.com");
  });
  it("rejects an invalid UK postcode", () => {
    expect(CustomerSchema.safeParse({ ...uk, postcode: "12345" }).success).toBe(false);
  });
  it("requires ZIP and state for US addresses", () => {
    expect(CustomerSchema.safeParse({ ...uk, country: "US", postcode: "10001", region: "NY" }).success).toBe(true);
    expect(CustomerSchema.safeParse({ ...uk, country: "US", postcode: "10001", region: "" }).success).toBe(false);
    expect(CustomerSchema.safeParse({ ...uk, country: "US", postcode: "SW1A 1AA", region: "NY" }).success).toBe(false);
  });
});

describe("uploads", () => {
  it("detects real image types from magic bytes", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
  it("only serves generated file names (no path traversal)", () => {
    expect(SAFE_NAME.test("0123456789abcdef0123456789abcdef.jpg")).toBe(true);
    expect(SAFE_NAME.test("../../etc/passwd")).toBe(false);
    expect(SAFE_NAME.test("evil.svg")).toBe(false);
  });
});

describe("Stripe setup check", () => {
  it("names missing or wrong keys without showing them", async () => {
    const { stripeSetupProblems } = await import("@/lib/stripe");
    expect(stripeSetupProblems({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_PUBLISHABLE_KEY: "pk_test_abc" })).toEqual([]);
    expect(stripeSetupProblems({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_PUBLISHABLE_KEY: "" })).toEqual(["STRIPE_PUBLISHABLE_KEY is empty or missing."]);
    expect(stripeSetupProblems({ STRIPE_SECRET_KEY: "pk_test_abc", STRIPE_PUBLISHABLE_KEY: "pk_test_abc" })[0]).toMatch(/STRIPE_SECRET_KEY should start with sk_test_/);
    expect(stripeSetupProblems({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_PUBLISHABLE_KEY: "pk_test_abc" })[0]).toMatch(/test key and the other a live key/);
    expect(stripeSetupProblems({}).join(" ")).not.toMatch(/sk_test_abc/);
  });
});
