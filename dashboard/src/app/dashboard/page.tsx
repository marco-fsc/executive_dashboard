import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { SignOutButton } from "@/app/_components/AuthButtons";
import { ExportSection } from "@/app/_components/ExportSection";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { resolveExecutiveDateFilter } from "@/lib/date-filter";
import { executiveKpis, executiveOutcomeKpis, programList, programSummary, serviceCounts } from "@/lib/metrics";
import { readAcl, resolveRole, PAGE_ROLES } from "@/lib/acl";
import { ProgramSummaryTable } from "./ProgramSummaryTable";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string; startDate?: string; endDate?: string }>;
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
  const dateFilter = resolveExecutiveDateFilter({
    startDate: sp?.startDate,
    endDate: sp?.endDate,
  });

  const ds = await readCurrentDataset();
  const exportDateParams = new URLSearchParams();
  if (dateFilter.startDate) exportDateParams.set("startDate", dateFilter.startDate);
  if (dateFilter.endDate) exportDateParams.set("endDate", dateFilter.endDate);
  const exportDateQuery = exportDateParams.toString();

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
            <ExportSection
              uploadedAt={ds.meta.uploadedAt}
              exportDateQuery={exportDateQuery}
              program={program}
              programList={programList(ds)}
              startDate={dateFilter.startDate}
              endDate={dateFilter.endDate}
            />

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
                Start date
                <input type="date" name="startDate" defaultValue={dateFilter.startDate ?? ""} style={{ display: "block", marginTop: 6 }} />
              </label>

              <label>
                End date
                <input type="date" name="endDate" defaultValue={dateFilter.endDate ?? ""} style={{ display: "block", marginTop: 6 }} />
              </label>

              <button type="submit">Apply</button>
              {(program || dateFilter.startDate || dateFilter.endDate) ? <a href="/dashboard" style={{ marginLeft: "auto" }}>Reset</a> : <span style={{ marginLeft: "auto" }} />}
            </form>

            {(() => {
              const kpis = executiveKpis(ds, program || null, dateFilter);
              const outcomes = executiveOutcomeKpis(ds, program || null, dateFilter);
              const programs = programSummary(ds, program || null, dateFilter);
              const svc = serviceCounts(ds, { dateFilter, program: program || null });

              return (
                <>
                  {/* ── Outcome hero cards ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        Shelter Placements
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {outcomes.shelter_placements}
                      </div>
                    </div>

                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        Clients Housed on Exit
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {outcomes.housed_on_exit}
                      </div>
                    </div>

                    <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted, #666)", marginBottom: 8 }}>
                        Total Positive Outcomes
                      </div>
                      <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#1a7f4e" }}>
                        {outcomes.total_positive_outcomes}
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
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">No recent contact (&gt;21d)</div>
                      <div className="kpi-value">{kpis.no_recent_contact}</div>
                    </div>
                    <div className="kpi-card highlight">
                      <div className="kpi-label">Positive outcomes</div>
                      <div className="kpi-value">{outcomes.total_positive_outcome_pct}%</div>
                      <div className="kpi-sub">{outcomes.total_positive_outcomes} of {outcomes.total_exit_clients} exits</div>
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
