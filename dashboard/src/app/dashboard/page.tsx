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
                  <div className="kpi-grid" style={{ marginTop: 16 }}>
                    <div className="kpi-card">
                      <div className="kpi-label">Active clients</div>
                      <div className="kpi-value">{kpis.total_active}</div>
                    </div>
                    <div className="kpi-card highlight">
                      <div className="kpi-label">Perm housing exit rate</div>
                      <div className="kpi-value">{kpis.perm_housing_pct}%</div>
                      <div className="kpi-sub">{kpis.perm_housing_exits} of {kpis.total_exits} exits</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">No recent contact (&gt;21d)</div>
                      <div className="kpi-value">{kpis.no_recent_contact}</div>
                    </div>
                    <div className="kpi-card highlight">
                      <div className="kpi-label">CAN positive outcomes</div>
                      <div className="kpi-value">{can.positive_exits} <span style={{ fontSize: 18, fontWeight: 400 }}>({can.positive_pct}%)</span></div>
                    </div>
                  </div>

                  <div className="card" style={{ overflowX: "auto" }}>
                    <h2 style={{ marginTop: 0, fontSize: 18 }}>Program Summary</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Program</th>
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
                            <td style={{ fontWeight: 500 }}>{String(r.program)}</td>
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
                    <div>
                      {svc.slice(0, 12).map((s) => (
                        <div key={s.name} className="service-row">
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
