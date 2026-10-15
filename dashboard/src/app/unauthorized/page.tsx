import Link from "next/link";
import { TopNav } from "@/app/_components/TopNav";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <>
      <TopNav email={null} />
      <main>
        <h1>Access denied</h1>
        <p>
          Sign-in failed or your account is not authorized to access this dashboard.
          Use the configured Microsoft administrator account, an account granted access
          by the administrator, or the local administrator login.
        </p>
        {sp?.error === "AccessDenied" ? (
          <p style={{ fontSize: 13, color: "#888" }}>
            The account you used is not the configured administrator or on the access list.
          </p>
        ) : null}
        <p>
          <Link href="/">Back to sign-in</Link>
        </p>
      </main>
    </>
  );
}
