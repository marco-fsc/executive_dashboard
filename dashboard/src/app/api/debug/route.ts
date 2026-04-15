import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Temporary debug endpoint — shows session + env config (redacted).
 * Remove after auth is working.
 */
export async function GET() {
  const session = await auth();

  return NextResponse.json({
    session: session
      ? {
          user: session.user,
          expires: session.expires,
        }
      : null,
    env: {
      AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
      AUTH_MICROSOFT_ENTRA_ID_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "(not set)",
      AUTH_MICROSOFT_ENTRA_ID_SECRET_SET: !!process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "(not set)",
      EXEC_ALLOWED_EMAILS_RAW: JSON.stringify(process.env.EXEC_ALLOWED_EMAILS),
      BLOB_READ_WRITE_TOKEN_SET: !!process.env.BLOB_READ_WRITE_TOKEN,
      INGEST_SALT_SET: !!process.env.INGEST_SALT,
    },
  });
}
