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

        {/* Source report link */}
        <a
          href="https://sac.clarityhs.com/report/embed/117577/1"
          target="_blank"
          rel="noopener noreferrer"
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            textDecoration: "none",
            background: "var(--color-brand-dark)",
            color: "white",
            padding: "18px 24px",
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
              Open Source Report in Clarity HS →
            </div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              Export the latest SUP2 CSV from this Looker report, then upload it below.
            </div>
          </div>
          <span style={{ fontSize: 32, flexShrink: 0 }}>↗</span>
        </a>

        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-muted)" }}>
          Upload the latest SUP2 CSV export. Data is stored privately in Vercel Blob.
        </p>
        <UploadForm />
      </main>
    </>
  );
}
