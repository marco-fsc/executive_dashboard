import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { isAdminEmail, readAcl } from "@/lib/acl";
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

  return (
    <>
      <TopNav email={email} />
      <main>
        <h1>Admin — Access Control</h1>
        <p style={{ color: "var(--color-muted)", marginBottom: 24, maxWidth: 640 }}>
          Assign roles to signed-in users.{" "}
          <strong>Executives</strong> can see all programs and all pages.{" "}
          <strong>Supervisors</strong> are restricted to their assigned program across the Supervisor and Client pages.
          Users not listed here default to <em>Executive</em>.
        </p>
        <AclEditor initialAcl={acl} programs={PROGRAM_ORDER} />
      </main>
    </>
  );
}
