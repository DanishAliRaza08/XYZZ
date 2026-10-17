import crypto from "node:crypto";

// Stateless, HMAC-signed session token: base64url(payload).base64url(signature)
export const SESSION_COOKIE = "fr_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
// Shop customer accounts use their own cookie and role, so a customer token is never accepted as an admin one.
export const CUSTOMER_COOKIE = "fr_customer";
export const CUSTOMER_ROLE = "customer";
export const CUSTOMER_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = { sub: string; role: string; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set to at least 16 characters");
  return s;
}

function sign(data: string, key: string) {
  return crypto.createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(sub: string, role: string, now = Date.now(), key = secret(), ttlSeconds = SESSION_TTL_SECONDS): string {
  const payload: SessionPayload = { sub, role, exp: Math.floor(now / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now(), key = secret()): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}
