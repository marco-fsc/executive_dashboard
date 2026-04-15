import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import UploadForm from "@/app/upload/UploadForm";

export default async function UploadPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/upload");
  }

  return (
    <>
      <TopNav email={session.user?.email ?? null} />
      <main>
        <h1>Upload Data</h1>
        <p>Upload the latest SUP2 CSV export. Data is stored privately in Vercel Blob.</p>
        <UploadForm />
      </main>
    </>
  );
}
