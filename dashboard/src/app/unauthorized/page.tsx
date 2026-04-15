import Link from "next/link";

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main>
      <h1>Access denied</h1>
      <p>
        Your account is not authorized to access this dashboard.
        {searchParams?.error ? (
          <>
            <br />
            Error: <code>{searchParams.error}</code>
          </>
        ) : null}
      </p>
      <p>
        <Link href="/">Back to sign-in</Link>
      </p>
    </main>
  );
}
