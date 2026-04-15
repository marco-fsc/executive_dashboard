import Link from "next/link";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main>
      <h1>Access denied</h1>
      <p>
        Your account is not authorized to access this dashboard.
        {sp?.error ? (
          <>
            <br />
            Error: <code>{sp.error}</code>
          </>
        ) : null}
      </p>
      <p>
        <Link href="/">Back to sign-in</Link>
      </p>
    </main>
  );
}
