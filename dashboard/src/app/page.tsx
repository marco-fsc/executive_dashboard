import { auth } from "@/auth";
import { SignInButton, SignOutButton } from "@/app/_components/AuthButtons";
import { TopNav } from "@/app/_components/TopNav";
import { LocalAdminLogin } from "@/app/_components/LocalAdminLogin";

export default async function HomePage() {
  const session = await auth();

  return (
    <>
      <TopNav email={session?.user?.email ?? null} />
      <main>
        <h1>FSC Dashboard</h1>
        <p>Sign in with your Microsoft account or a local administrator account.</p>

        {!session ? (
          <div className="card">
            <p>You are not signed in.</p>
            <SignInButton />
            {process.env.LOCAL_ADMIN_PASSWORD_HASH ? <LocalAdminLogin /> : null}
          </div>
        ) : (
          <div className="card">
            <p style={{ marginTop: 0 }}>
              Signed in as <strong>{session.user?.email ?? "(no email)"}</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><a href="/dashboard">Executive dashboard</a></li>
              <li><a href="/supervisor">Supervisor dashboard</a></li>
              <li><a href="/clients">Client list</a></li>
              <li><a href="/upload">Upload data</a></li>
            </ul>
            <div style={{ marginTop: 16 }}>
              <SignOutButton />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
