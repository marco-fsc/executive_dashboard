import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { buildDatasetFromRawCsv } from "@/lib/ingest";
import { writeCurrentDataset } from "@/lib/blob-dataset-store";

export const runtime = "nodejs";
// Allow up to 5 minutes for large CSV processing
export const maxDuration = 300;

/**
 * Triggered by the client after a successful direct-to-Blob upload.
 * Downloads the raw CSV from Vercel Blob, ingests it into a dataset,
 * saves it, then deletes the temporary raw CSV blob.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { blobUrl?: string; filename?: string };
  if (!body.blobUrl) {
    return NextResponse.json({ error: "missing_blob_url" }, { status: 400 });
  }

  // Download the CSV from Vercel Blob
  let csvText: string;
  try {
    const csvRes = await fetch(body.blobUrl);
    if (!csvRes.ok) {
      throw new Error(`Failed to fetch uploaded file: HTTP ${csvRes.status}`);
    }
    csvText = await csvRes.text();
  } catch (err: unknown) {
    console.error("[process] fetch blob failed:", err);
    return NextResponse.json(
      { error: `Could not retrieve uploaded file: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  // Ingest the CSV
  let dataset;
  try {
    dataset = buildDatasetFromRawCsv(csvText, body.filename);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[process] ingest failed:", message);
    // Clean up the temporary blob even on failure
    await del(body.blobUrl).catch(() => {});
    return NextResponse.json({ error: `Processing failed: ${message}` }, { status: 422 });
  }

  // Save the processed dataset
  try {
    await writeCurrentDataset(dataset);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[process] blob write failed:", message);
    await del(body.blobUrl).catch(() => {});
    return NextResponse.json({ error: `Storage failed: ${message}` }, { status: 500 });
  }

  // Delete the temporary raw CSV blob
  await del(body.blobUrl).catch((err) =>
    console.warn("[process] could not delete temp blob:", err)
  );

  console.info("[process] success:", {
    filename: body.filename,
    enrollments: dataset.enrollments.length,
    services: dataset.services.length,
  });

  return NextResponse.json({ ok: true, meta: dataset.meta });
}
