import { auth } from "@/auth";
import { SignOutButton } from "@/app/_components/AuthButtons";

export default async function DashboardPage() {
  const session = await auth();

  // Route is also protected by middleware; this is just a safe fallback.
  if (!session) {
    return null;
  }

  return (
    <main>
      <h1>Executive Dashboard</h1>
      <p>Authenticated as {session.user?.email ?? "(no email)"}.</p>

      <div className="card">
        <p>
          Next step: connect this UI to your existing Django-generated metrics/API.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <SignOutButton />
      </div>
    </main>
  );
}
