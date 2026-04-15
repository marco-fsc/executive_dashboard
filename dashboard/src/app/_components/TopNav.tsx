import Link from "next/link";

export function TopNav({ email }: { email: string | null }) {
  return (
    <div style={{ borderBottom: "1px solid #e5e5e5", padding: "12px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/" style={{ fontWeight: 700, textDecoration: "none", color: "#111" }}>
          FSC Dashboard
        </Link>
        <Link href="/dashboard">Executive</Link>
        <Link href="/supervisor">Supervisor</Link>
        <Link href="/clients">Clients</Link>
        <Link href="/upload">Upload</Link>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
          {email ?? ""}
        </div>
      </div>
    </div>
  );
}
