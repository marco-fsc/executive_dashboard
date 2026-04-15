import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readCurrentDataset } from "@/lib/blob-dataset-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ds = await readCurrentDataset();
  if (!ds) {
    return NextResponse.json({ meta: null });
  }

  return NextResponse.json({ meta: ds.meta });
}
