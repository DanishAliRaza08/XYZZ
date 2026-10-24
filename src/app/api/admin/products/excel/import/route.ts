// Admin → Products → Excel: POST a file with mode=check (what would change) or mode=import (save it in the background);
// GET returns the running import's progress.
import { NextResponse, type NextRequest } from "next/server";
import type { ProductStatus } from "@prisma/client";
import { requireAdminApi } from "@/lib/auth";
import { planSheetImport, readProductSheet } from "@/lib/product-sheet";
import { currentSheetImport, loadSnapshot, startSheetImport } from "@/lib/sheet-import-job";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function GET() {
  if (!(await requireAdminApi("products"))) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  return NextResponse.json({ job: currentSheetImport() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("products");
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose an Excel file first." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "The file is bigger than 15MB — split it into smaller files." }, { status: 400 });
  const mode = form?.get("mode") === "import" ? "import" : "check";
  const defaultStatus: ProductStatus = form?.get("defaultStatus") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  let sheet;
  try {
    sheet = await readProductSheet(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read the file." }, { status: 400 });
  }
  const plan = planSheetImport(sheet, await loadSnapshot(), { defaultStatus });
  const summary = {
    rows: sheet.rows.length,
    create: plan.items.filter((p) => p.action === "create").length,
    update: plan.items.filter((p) => p.action === "update").length,
    errorCount: plan.errors.length,
    errors: plan.errors.slice(0, 200),
    ignoredColumns: sheet.ignored,
    products: plan.items.slice(0, 300).map((p) => ({
      name: p.name, slug: p.slug, action: p.action, row: p.rows[0], sizes: p.variants.length,
      newSizes: p.variants.filter((v) => !v.id).length, photos: p.photos?.length ?? null,
    })),
  };
  if (mode === "check") return NextResponse.json({ summary });
  if (!plan.items.length) return NextResponse.json({ error: "Nothing to import — fix the problems listed and check the file again.", summary }, { status: 400 });
  const error = startSheetImport(plan, file.name.slice(0, 120), admin.id);
  if (error) return NextResponse.json({ error, summary }, { status: 409 });
  return NextResponse.json({ started: true, summary, job: currentSheetImport() });
}
