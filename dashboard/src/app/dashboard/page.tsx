import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { SignOutButton } from "@/app/_components/AuthButtons";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { canKpis, executiveKpis, programList, programSummary, serviceCounts } from "@/lib/metrics";

function monthsFromRange(range: string | undefined): number {
  if (range === "1") return 1;
  if (range === "18") return 18;
  return 6;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string; range?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }

  const sp = await searchParams;
  const program = sp?.program ?? "";
  const range = sp?.range ?? "6";
  const months = monthsFromRange(range);

  const ds = await readCurrentDataset();

  return (
    <>
      <TopNav email={session.user?.email ?? null} />
      <main>
        <h1>Executive Dashboard</h1>

        {!ds ? (
          <div className="card">
            <p>No data uploaded yet. Go to <a href="/upload">Upload</a>.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#555" }}>
                Data uploaded: <strong>{new Date(ds.meta.uploadedAt).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <a
                  href={`/api/export?format=excel&report=executive&range=${encodeURIComponent(range)}${program ? `&program=${encodeURIComponent(program)}` : ""}`}
                >
                  Export Excel
                </a>
                <a
                  href={`/api/export?format=pdf&report=executive&range=${encodeURIComponent(range)}${program ? `&program=${encodeURIComponent(program)}` : ""}`}
                >
                  Export PDF
                </a>
              </div>
            </div>

            <form method="get" className="card" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
              <label>
                Program
                <select name="program" defaultValue={program} style={{ display: "block", marginTop: 6, minWidth: 260 }}>
                  <option value="">All Programs</option>
                  {programList(ds).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date range
                <select name="range" defaultValue={range} style={{ display: "block", marginTop: 6 }}>
                  <option value="1">Last month</option>
                  <option value="6">Last 6 months</option>
                  <option value="18">Last 18 months</option>
                </select>
              </label>

              <button type="submit">Apply</button>
              {(program || range !== "6") ? <a href="/dashboard" style={{ marginLeft: "auto" }}>Reset</a> : <span style={{ marginLeft: "auto" }} />}
            </form>

            {(() => {
              const kpis = executiveKpis(ds, program || null, months);
              const can = canKpis(ds, months);
              const programs = programSummary(ds, program || null, months);
              const svc = serviceCounts(ds, { months, program: program || null });

              return (
                <>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <div className="card">
                      <div><strong>Active clients</strong></div>
                      <div style={{ fontSize: 28 }}>{kpis.total_active}</div>
                    </div>
                    <div className="card">
                      <div><strong>Perm housing exit rate</strong></div>
                      <div style={{ fontSize: 28 }}>{kpis.perm_housing_pct}%</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{kpis.perm_housing_exits} of {kpis.total_exits} exits</div>
                    </div>
                    <div className="card">
                      <div><strong>No recent contact (&gt;21d)</strong></div>
                      <div style={{ fontSize: 28 }}>{kpis.no_recent_contact}</div>
                    </div>
                    <div className="card">
                      <div><strong>CAN positive outcomes</strong></div>
                      <div style={{ fontSize: 28 }}>{can.positive_exits} ({can.positive_pct}%)</div>
                    </div>
                  </div>

                  <div className="card" style={{ overflowX: "auto" }}>
                    <h2 style={{ marginTop: 0, fontSize: 18 }}>Program Summary</h2>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Program</th>
                          <th style={{ textAlign: "right" }}>Active</th>
                          <th style={{ textAlign: "right" }}>Exits</th>
                          <th style={{ textAlign: "right" }}>Perm %</th>
                          <th style={{ textAlign: "right" }}>Positive %</th>
                          <th style={{ textAlign: "right" }}>Zero services</th>
                          <th style={{ textAlign: "right" }}>Avg LOS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programs.map((r) => (
                          <tr key={String(r.program)}>
                            <td>{String(r.program)}</td>
                            <td style={{ textAlign: "right" }}>{String(r.active)}</td>
                            <td style={{ textAlign: "right" }}>{String(r.exits)}</td>
                            <td style={{ textAlign: "right" }}>{String(r.perm_pct)}%</td>
                            <td style={{ textAlign: "right" }}>{String(r.positive_pct)}%</td>
                            <td style={{ textAlign: "right" }}>{String(r.zero_services)}</td>
                            <td style={{ textAlign: "right" }}>{String(r.avg_los)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="card">
                    <h2 style={{ marginTop: 0, fontSize: 18 }}>Services Provided (top)</h2>
                    <div style={{ display: "grid", gap: 8 }}>
                      {svc.slice(0, 12).map((s) => (
                        <div key={s.name} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{s.name}</span>
                          <strong>{s.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <SignOutButton />
                  </div>
                </>
              );
            })()}
          </>
        )}
      </main>
    </>
  );
}
