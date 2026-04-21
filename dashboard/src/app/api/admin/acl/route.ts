import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail, writeAcl } from "@/lib/acl";
import type { Acl } from "@/lib/acl";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email ?? "";

  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Acl;
  try {
    body = (await req.json()) as Acl;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body.users !== "object" || Array.isArray(body.users)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Sanitise: ensure only known roles are persisted
  const allowed: string[] = ["executive", "supervisor"];
  const sanitised: Acl = { users: {} };
  for (const [rawEmail, entry] of Object.entries(body.users)) {
    const lowerEmail = rawEmail.trim().toLowerCase();
    if (!lowerEmail || !entry || !allowed.includes(entry.role)) continue;
    sanitised.users[lowerEmail] = {
      role: entry.role,
      ...(entry.role === "supervisor" && entry.program
        ? { program: String(entry.program) }
        : {}),
    };
  }

  await writeAcl(sanitised);
  return NextResponse.json({ ok: true });
}
