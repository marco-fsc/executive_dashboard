import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/app/_components/AuthButtons";

export default async function HomePage() {
  const session = await auth();

  return (
    <main>
      <h1>FSC Executive Dashboard</h1>
      <p>This web app is protected by Microsoft Entra ID.</p>

      {!session ? (
        <div className="card">
          <p>You are not signed in.</p>
          <SignInButton />
        </div>
      ) : (
        <div className="card">
          <p>
            Signed in as <strong>{session.user?.email ?? "(no email)"}</strong>
          </p>
          <p>
            <Link href="/dashboard">Go to dashboard</Link>
          </p>
          <SignOutButton />
        </div>
      )}
    </main>
  );
}
