import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

const KEY = "test-secret-at-least-16-chars";

describe("admin session tokens", () => {
  it("verifies a valid token", () => {
    const token = createSessionToken("admin1", "SUPER_ADMIN", Date.now(), KEY);
    expect(verifySessionToken(token, Date.now(), KEY)?.sub).toBe("admin1");
  });
  it("rejects tampered payloads", () => {
    const token = createSessionToken("admin1", "ANALYST", Date.now(), KEY);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin1", role: "SUPER_ADMIN", exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, Date.now(), KEY)).toBeNull();
  });
  it("rejects tokens signed with another secret", () => {
    const token = createSessionToken("admin1", "SUPER_ADMIN", Date.now(), "another-secret-of-16+chars");
    expect(verifySessionToken(token, Date.now(), KEY)).toBeNull();
  });
  it("rejects expired tokens", () => {
    const token = createSessionToken("admin1", "SUPER_ADMIN", Date.now() - 9 * 60 * 60 * 1000, KEY);
    expect(verifySessionToken(token, Date.now(), KEY)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(verifySessionToken(undefined, Date.now(), KEY)).toBeNull();
    expect(verifySessionToken("abc", Date.now(), KEY)).toBeNull();
  });
});
