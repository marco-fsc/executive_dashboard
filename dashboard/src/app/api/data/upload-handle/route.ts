import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * Handles the two-phase Vercel Blob client-upload protocol.
 *
 * Phase 1 (blob.generate-client-token): auth-check + return upload token.
 * Phase 2 (blob.upload-completed): browser confirms bytes are in Blob.
 *   We return 200 immediately — processing happens via /api/data/process.
 *   We bypass handleUpload's signature verification for phase 2 because
 *   it can fail in certain environments and cause upload() to hang at 99%.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  // Phase 2: browser notifies us the upload is done — just ack it.
  if (body.type === "blob.upload-completed") {
    return NextResponse.json({
      type: "blob.upload-completed",
      response: "ok",
    });
  }

  // Phase 1: generate a client token (auth required).
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "text/csv",
          "application/csv",
          "text/plain",
          "application/octet-stream",
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err: unknown) {
    console.error("[upload-handle]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
