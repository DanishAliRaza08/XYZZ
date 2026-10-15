import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { SAFE_NAME, uploadDir } from "@/lib/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!SAFE_NAME.test(name)) return new NextResponse("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(uploadDir(), name));
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[name.split(".").pop()!], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
