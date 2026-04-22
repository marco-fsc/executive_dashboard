import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildDatasetFromRawCsv } from "@/lib/ingest";
import { writeCurrentDataset } from "@/lib/blob-dataset-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file !== "object" || !("text" in file)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const name = "name" in file ? String((file as { name?: unknown }).name ?? "") : "";
  const size = "size" in file ? Number((file as { size?: unknown }).size ?? 0) : 0;

  // Basic guardrails.
  if (size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (name && !name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "invalid_file_type" }, { status: 400 });
  }

  const csvText = await (file as unknown as { text: () => Promise<string> }).text();

  let dataset;
  try {
    dataset = buildDatasetFromRawCsv(csvText, name || undefined);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload] CSV ingest failed:", message, { name, size });
    return NextResponse.json({ error: `Processing failed: ${message}` }, { status: 422 });
  }

  try {
    await writeCurrentDataset(dataset);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload] Blob write failed:", message);
    return NextResponse.json({ error: `Storage failed: ${message}` }, { status: 500 });
  }

  console.info("[upload] success:", { name, size, enrollments: dataset.enrollments.length, services: dataset.services.length });
  return NextResponse.json({ ok: true, meta: dataset.meta });
}
