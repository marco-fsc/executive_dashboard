import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { cmSummary, programList } from "@/lib/metrics";

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/supervisor");
  }

  const sp = await searchParams;
  const program = sp?.program ?? "";

  const ds = await readCurrentDataset();

  return (
    <>
      <TopNav email={session.user?.email ?? null} />
      <main>
        <h1>Supervisor Dashboard</h1>

        {!ds ? (
          <div className="card">
            <p>No data uploaded yet. Go to <a href="/upload">Upload</a>.</p>
          </div>
        ) : (
          <>
            <form method="get" className="card" style={{ display: "flex", gap: 12, alignItems: "end" }}>
              <div>
                <label>
                  Program
                  <select name="program" defaultValue={program} style={{ display: "block", marginTop: 6 }}>
                    <option value="">All Programs</option>
                    {programList(ds).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit">Apply</button>
              {program ? <a href="/supervisor" style={{ marginLeft: "auto" }}>Clear</a> : <span style={{ marginLeft: "auto" }} />}
            </form>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {cmSummary(ds, program || null).map((cm) => (
                <div key={String(cm.cm)} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{String(cm.cm)}</strong>
                    <span>{String(cm.active_clients)} active</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <div>Perm exits: {String(cm.perm_exits)}</div>
                    <div>Homeless exits: {String(cm.homeless_exits)}</div>
                    <div>Services logged: {String(cm.services_logged)}</div>
                    <div>No services: {String(cm.zero_services)}</div>
                    <div>No recent contact: {String(cm.no_recent_contact)}</div>
                    <div>High risk clients: {String(cm.high_risk_clients)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
