import Image from "next/image";
import Link from "next/link";
import { isAdminEmail } from "@/lib/acl";
import type { UserRole } from "@/lib/acl";

export function TopNav({ email, role }: { email: string | null; role?: UserRole | null }) {
  const admin = email ? isAdminEmail(email) : false;
  const effectiveRole: UserRole = admin ? "admin" : (role ?? "executive");

  const showSupervisor = ["admin", "executive", "cm_supervisor"].includes(effectiveRole);
  const showClients    = ["admin", "executive", "cm_supervisor", "shelter_supervisor"].includes(effectiveRole);
  const showUpload     = ["admin", "executive"].includes(effectiveRole);

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <Image
          src="/fsc_logo.png"
          alt="FSC logo"
          width={120}
          height={45}
          className="topnav-logo"
          priority
        />
        <Link href="/" className="topnav-brand">
          FSC Dashboard
        </Link>
        <Link href="/dashboard">Executive</Link>
        {showSupervisor && <Link href="/supervisor">Supervisor</Link>}
        {showClients    && <Link href="/clients">Clients</Link>}
        {showUpload     && <Link href="/upload">Upload</Link>}
        {admin && <Link href="/admin">Admin</Link>}
        <span className="topnav-email">{email ?? ""}</span>
      </div>
    </nav>
  );
}
