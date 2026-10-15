import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requireAdminApi } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, sniffImage, uploadDir } from "@/lib/uploads";

export async function POST(req: NextRequest) {
  const admin = (await requireAdminApi("products")) ?? (await requireAdminApi("settings"));
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be 5MB or smaller" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) return NextResponse.json({ error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 });
  const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), buf);
  await audit(admin.id, "upload", "Image", name, `${file.size} bytes`);
  return NextResponse.json({ url: `/uploads/${name}` });
}
