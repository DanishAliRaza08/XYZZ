import path from "node:path";

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Detect image type from the file's leading bytes rather than trusting the browser-supplied MIME type. */
export function sniffImage(buf: Buffer): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export const SAFE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
