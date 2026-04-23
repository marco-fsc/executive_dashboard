import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * Returns a short-lived Vercel Blob client token so the browser can upload
 * directly to Vercel Blob without going through a serverless function body.
 * No webhook / phase-2 callback — processing is handled separately by
 * /api/data/process after the upload completes.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename") ?? "upload.csv";
  const pathname = `csv-uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      pathname,
      allowedContentTypes: [
        "text/csv",
        "application/csv",
        "text/plain",
        "application/octet-stream",
      ],
      maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
    });

    return NextResponse.json({ clientToken, pathname });
  } catch (err: unknown) {
    console.error("[upload-handle]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
