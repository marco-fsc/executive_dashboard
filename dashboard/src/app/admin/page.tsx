import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { isAdminEmail, getAdminEmail, readAcl } from "@/lib/acl";
import { PROGRAM_ORDER } from "@/lib/metrics";
import { AclEditor } from "./AclEditor";

export default async function AdminPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  const email = session.user?.email ?? "";
  if (!isAdminEmail(email)) {
    redirect("/unauthorized");
  }

  const acl = await readAcl();
  const adminEmail = getAdminEmail();

  return (
    <>
      <TopNav email={email} />
      <main>
        <h1>Admin — Access Control</h1>
        <p style={{ color: "var(--color-muted)", marginBottom: 8, maxWidth: 640 }}>
          All access is allow-list based. Unlisted users are denied sign-in.
        </p>
        <ul style={{ color: "var(--color-muted)", marginBottom: 24, fontSize: 13, paddingLeft: 20 }}>
          <li><strong>Executive</strong> — all pages and all programs</li>
          <li><strong>Board</strong> — executive KPI dashboard only (high-level view)</li>
          <li><strong>Supervisor</strong> — supervisor + client pages, locked to their program</li>
        </ul>
        <AclEditor initialAcl={acl} programs={PROGRAM_ORDER} adminEmail={adminEmail} />
      </main>
    </>
  );
}
