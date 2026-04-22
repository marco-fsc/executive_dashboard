import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { SignOutButton } from "@/app/_components/AuthButtons";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { canKpis, executiveKpis, programList, programSummary, serviceCounts } from "@/lib/metrics";
import { readAcl, resolveRole, PAGE_ROLES } from "@/lib/acl";
import { ProgramSummaryTable } from "./ProgramSummaryTable";

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

  const userEmail = session.user?.email ?? "";
  const acl = await readAcl();
  const userRole = resolveRole(userEmail, acl);
  if (!userRole || !PAGE_ROLES.dashboard.includes(userRole.role)) {
    redirect("/unauthorized");
  }

  const sp = await searchParams;
  const rawProgram = sp?.program ?? "";
  // Directors/Supervisors are locked to their assigned program.
  const isLockedRole = userRole.role === "cm_supervisor" || userRole.role === "shelter_supervisor";
  const program =
    isLockedRole && userRole.program
      ? userRole.program
      : rawProgram;
  const range = sp?.range ?? "6";
  const months = monthsFromRange(range);

  const ds = await readCurrentDataset();

  return (
    <>
      <TopNav email={session.user?.email ?? null} role={userRole.role} />
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
              {isLockedRole ? (
                <div>
                  <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Program</span>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{program}</div>
                  <input type="hidden" name="program" value={program} />
                </div>
              ) : (
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
              )}

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
                  {/* ── Outcome hero cards ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        Clients Navigated into Shelter
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {kpis.temp_housing_exits}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-muted, #666)", marginTop: 8 }}>
                        Temporary housing exits · shelter programs
                      </div>
                    </div>

                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        Clients Housed on Exit
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {kpis.perm_housing_exits}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-muted, #666)", marginTop: 8 }}>
                        Permanent housing exits · shelter programs
                      </div>
                    </div>

                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        CAN Positive Outcomes
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {can.positive_exits}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-muted, #666)", marginTop: 8 }}>
                        {can.positive_pct}% of CAN exits · selected period
                      </div>
                    </div>
                  </div>

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
                    <ProgramSummaryTable programs={programs} />
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
