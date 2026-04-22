import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import UploadForm from "@/app/upload/UploadForm";
import { readAcl, resolveRole, PAGE_ROLES } from "@/lib/acl";

export default async function UploadPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/upload");
  }

  const userEmail = session.user?.email ?? "";
  const acl = await readAcl();
  const userRole = resolveRole(userEmail, acl);
  if (!userRole || !PAGE_ROLES.upload.includes(userRole.role)) {
    redirect("/unauthorized");
  }

  return (
    <>
      <TopNav email={session.user?.email ?? null} role={userRole.role} />
      <main>
        <h1>Upload Data</h1>
        <p>Upload the latest SUP2 CSV export. Data is stored privately in Vercel Blob.</p>
        <UploadForm />
      </main>
    </>
  );
}
