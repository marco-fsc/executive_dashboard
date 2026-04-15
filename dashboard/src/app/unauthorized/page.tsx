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
          Your account is not authorized to access this dashboard.
          Please sign in with a <strong>@firststepcommunities.org</strong> account.
        </p>
        {sp?.error === "AccessDenied" ? (
          <p style={{ fontSize: 13, color: "#888" }}>
            The account you used is not on the allowlist.
          </p>
        ) : null}
        <p>
          <Link href="/">Back to sign-in</Link>
        </p>
      </main>
    </>
  );
}
