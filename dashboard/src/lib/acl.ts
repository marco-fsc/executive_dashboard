import { get, put } from "@vercel/blob";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "executive" | "board" | "supervisor";

export interface AclEntry {
  role: UserRole;
  /** Only set when role === "supervisor". Locks the user to a single program. */
  program?: string;
}

/**
 * Page-level access: which roles are allowed on each route.
 *   executive         — all pages
 *   board             — executive KPI dashboard only
 *   supervisor        — executive dashboard (own program), supervisor + clients pages (own program)
 *   admin             — everything
 */
export const PAGE_ROLES = {
  dashboard: ["admin", "executive", "board", "supervisor"] as UserRole[],
  supervisor: ["admin", "executive", "supervisor"] as UserRole[],
  clients: ["admin", "executive", "supervisor"] as UserRole[],
  upload: ["admin", "executive"] as UserRole[],
} as const;

export interface Acl {
  /** Keyed by lowercase email address. */
  users: Record<string, AclEntry>;
}

// ─── Admin identity ───────────────────────────────────────────────────────────

/** The site administrator email. Set ADMIN_EMAIL env var to override. */
export function getAdminEmail(): string {
  return (
    process.env.ADMIN_EMAIL ?? "mdelfava@firststepcommunities.org"
  ).toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === getAdminEmail();
}

// ─── Role resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the effective role for a logged-in user.
 * - Admin email always becomes { role: "admin" }.
 * - If the email has an entry in the ACL, that entry is returned.
 * - Otherwise returns null (= no access — deny by default).
 */
export function resolveRole(email: string, acl: Acl): AclEntry | null {
  if (isAdminEmail(email)) return { role: "admin" };
  return acl.users[email.toLowerCase()] ?? null;
}

// ─── Blob persistence ─────────────────────────────────────────────────────────

const ACL_PATHNAME = "fsc-dashboard/acl.json";

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readAcl(): Promise<Acl> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { users: {} };
  try {
    const res = await get(ACL_PATHNAME, { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) return { users: {} };
    const text = await streamToText(res.stream);
    return JSON.parse(text) as Acl;
  } catch {
    return { users: {} };
  }
}

export async function writeAcl(acl: Acl): Promise<void> {
  await put(ACL_PATHNAME, JSON.stringify(acl), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
