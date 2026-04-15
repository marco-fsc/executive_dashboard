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

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {cmSummary(ds, program || null).map((cm) => (
                <div key={String(cm.cm)} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "var(--color-surface-alt)", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
                    <strong style={{ color: "var(--color-brand-dark)" }}>{String(cm.cm)}</strong>
                    <span className="badge badge-active">{String(cm.active_clients)} active</span>
                  </div>
                  <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 14 }}>
                    <div>Perm exits <strong style={{ float: "right" }}>{String(cm.perm_exits)}</strong></div>
                    <div>Homeless exits <strong style={{ float: "right" }}>{String(cm.homeless_exits)}</strong></div>
                    <div>Services logged <strong style={{ float: "right" }}>{String(cm.services_logged)}</strong></div>
                    <div>No services <strong style={{ float: "right" }}>{String(cm.zero_services)}</strong></div>
                    <div>No recent contact <strong style={{ float: "right" }}>{String(cm.no_recent_contact)}</strong></div>
                    <div>High risk <strong style={{ float: "right" }}>{String(cm.high_risk_clients)}</strong></div>
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
