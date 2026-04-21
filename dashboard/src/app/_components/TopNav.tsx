import Image from "next/image";
import Link from "next/link";
import { isAdminEmail } from "@/lib/acl";

export function TopNav({ email }: { email: string | null }) {
  const admin = email ? isAdminEmail(email) : false;

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
        <Link href="/supervisor">Supervisor</Link>
        <Link href="/clients">Clients</Link>
        <Link href="/upload">Upload</Link>
        {admin && <Link href="/admin">Admin</Link>}
        <span className="topnav-email">{email ?? ""}</span>
      </div>
    </nav>
  );
}
