import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * Handles two phases of the Vercel Blob client-upload protocol:
 *
 *  Phase 1 — token generation:
 *    The browser calls this BEFORE uploading. We auth-check and return a
 *    short-lived client token that allows a direct browser → Blob upload.
 *
 *  Phase 2 — upload-completed webhook:
 *    Vercel Blob calls this after the browser finishes uploading.
 *    We just return 200; actual CSV processing is triggered by the client
 *    via /api/data/process so it can show progress and errors.
 */
export async function POST(request: Request) {
  // Auth is only required during token generation (phase 1).
  // Phase 2 is an internal webhook from Vercel infrastructure — no cookie.
  const body = (await request.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => ({
        allowedContentTypes: [
          "text/csv",
          "application/csv",
          "text/plain",
          "application/octet-stream",
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
      }),
      // Actual processing is triggered by the client via /api/data/process.
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
