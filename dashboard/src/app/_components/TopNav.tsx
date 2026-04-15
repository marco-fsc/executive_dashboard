import Image from "next/image";
import Link from "next/link";

export function TopNav({ email }: { email: string | null }) {
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <Image
          src="/fsc_logo.avif"
          alt="FSC logo"
          width={36}
          height={36}
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
        <span className="topnav-email">{email ?? ""}</span>
      </div>
    </nav>
  );
}
