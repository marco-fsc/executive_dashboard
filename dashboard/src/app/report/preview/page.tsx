import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { resolveExecutiveDateFilter } from "@/lib/date-filter";
import { 
  executiveKpis, 
  executiveOutcomeKpis, 
  programSummary, 
  serviceCounts,
  type ProgramSummaryRow,
  type ExitDestinationBreakdown
} from "@/lib/metrics";
import { AutoPrint } from "./AutoPrint";

// Group by category for the expanded breakdown view
function groupByCategory(rows: ExitDestinationBreakdown[]): Map<string, ExitDestinationBreakdown[]> {
  const map = new Map<string, ExitDestinationBreakdown[]>();
  for (const r of rows) {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category)!.push(r);
  }
  return map;
}

const CATEGORY_ORDER = [
  "Permanent Housing Situations",
  "Temporary Housing Situations",
  "Institutional Situations",
  "Other",
  "Homeless Situations",
  "Unknown",
];

function sortedCategories(map: Map<string, ExitDestinationBreakdown[]>): string[] {
  const known = CATEGORY_ORDER.filter((c) => map.has(c));
  const rest = Array.from(map.keys()).filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  return [...known, ...rest];
}

function categoryPositive(entries: ExitDestinationBreakdown[]): boolean {
  return entries.some((e) => e.is_positive);
}

export default async function ReportPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ 
    programs?: string; 
    startDate?: string; 
    endDate?: string; 
    includeServices?: string;
    autoprint?: string;
  }>;
}) {
  const session = await auth();
  if (!session) {
    return <div>Unauthorized</div>;
  }

  const sp = await searchParams;
  const programsParam = sp?.programs ?? "";
  const programs = programsParam.split(",").filter(Boolean);
  const includeServices = sp?.includeServices === "true";
  const autoprint = sp?.autoprint === "1";
  
  const dateFilter = resolveExecutiveDateFilter({
    startDate: sp?.startDate,
    endDate: sp?.endDate,
  });

  const ds = await readCurrentDataset();
  if (!ds) {
    return <div>No data available</div>;
  }

  const dateRangeStr = dateFilter.startDate && dateFilter.endDate 
    ? `${new Date(dateFilter.startDate).toLocaleDateString()} - ${new Date(dateFilter.endDate).toLocaleDateString()}`
    : dateFilter.startDate 
    ? `From ${new Date(dateFilter.startDate).toLocaleDateString()}`
    : dateFilter.endDate 
    ? `Until ${new Date(dateFilter.endDate).toLocaleDateString()}`
    : "All time";

  return (
    <div className="report-view">
      {autoprint && <AutoPrint />}
      {programs.length === 0 ? (
        // All programs report
        <div className="report-page">
          <div className="report-header">
            <h1>FSC Executive Dashboard Report</h1>
            <div className="report-meta">
              <div><strong>Programs:</strong> All Programs</div>
              <div><strong>Date Range:</strong> {dateRangeStr}</div>
              <div><strong>Generated:</strong> {new Date(ds.meta.uploadedAt).toLocaleString()}</div>
            </div>
          </div>

          {(() => {
            const kpis = executiveKpis(ds, null, dateFilter);
            const outcomes = executiveOutcomeKpis(ds, null, dateFilter);
            const programsData = programSummary(ds, null, dateFilter);
            const svc = serviceCounts(ds, { dateFilter, program: null });

            return (
              <>
                {/* Outcome hero cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
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

                {/* KPI Grid */}
                <div className="kpi-grid" style={{ marginBottom: 24 }}>
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

                {/* Program Summary Table */}
                <div className="card" style={{ overflowX: "auto", marginBottom: 24 }}>
                  <h2 style={{ marginTop: 0, fontSize: 18 }}>Program Summary</h2>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Program</th>
                        <th style={{ textAlign: "right" }}>Active</th>
                        <th style={{ textAlign: "right" }}>Exits</th>
                        <th style={{ textAlign: "right" }}>Perm %</th>
                        <th style={{ textAlign: "right" }}>Positive %</th>
                        <th style={{ textAlign: "right" }}>Zero svcs</th>
                        <th style={{ textAlign: "right" }}>Avg LOS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programsData.map((r) => {
                        const grouped = groupByCategory(r.exit_destinations);
                        const cats = sortedCategories(grouped);
                        const hasDestinations = r.exit_destinations.length > 0;

                        return (
                          <>
                            <tr key={r.program}>
                              <td style={{ fontWeight: 500 }}>{r.program}</td>
                              <td style={{ textAlign: "right" }}>{r.active}</td>
                              <td style={{ textAlign: "right" }}>{r.exits}</td>
                              <td style={{ textAlign: "right" }}>{r.perm_pct}%</td>
                              <td style={{ textAlign: "right" }}>{r.positive_pct}%</td>
                              <td style={{ textAlign: "right" }}>{r.zero_services}</td>
                              <td style={{ textAlign: "right" }}>{r.avg_los}</td>
                            </tr>

                            {hasDestinations && cats.map((cat) => {
                              const entries = grouped.get(cat)!;
                              const isPositive = categoryPositive(entries);
                              return (
                                <tr key={`${r.program}-${cat}`} style={{ fontSize: 13, background: "#fafafa" }}>
                                  <td colSpan={7} style={{ paddingLeft: 24 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4, color: isPositive ? "#1a7f4e" : "#b91c1c" }}>
                                      {cat}
                                    </div>
                                    {entries.map((e) => (
                                      <div key={e.destination} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                        <span style={{ paddingLeft: 12 }}>{e.destination}</span>
                                        <span>{e.count}</span>
                                      </div>
                                    ))}
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Services (optional) */}
                {includeServices && (
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
                )}
              </>
            );
          })()}
        </div>
      ) : (
        // Per-program pages
        programs.map((program, idx) => {
          const kpis = executiveKpis(ds, program, dateFilter);
          const outcomes = executiveOutcomeKpis(ds, program, dateFilter);
          const programsData = programSummary(ds, program, dateFilter);
          const svc = serviceCounts(ds, { dateFilter, program });

          return (
            <div key={program} className="report-page">
              <div className="report-header">
                <h1>{program}</h1>
                <div className="report-meta">
                  <div><strong>Date Range:</strong> {dateRangeStr}</div>
                  <div><strong>Generated:</strong> {new Date(ds.meta.uploadedAt).toLocaleString()}</div>
                  <div><strong>Page:</strong> {idx + 1} of {programs.length}</div>
                </div>
              </div>

              {/* Outcome hero cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
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

              {/* KPI Grid */}
              <div className="kpi-grid" style={{ marginBottom: 24 }}>
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

              {/* Program Summary Table */}
              <div className="card" style={{ overflowX: "auto", marginBottom: 24 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Program Summary</h2>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Program</th>
                      <th style={{ textAlign: "right" }}>Active</th>
                      <th style={{ textAlign: "right" }}>Exits</th>
                      <th style={{ textAlign: "right" }}>Perm %</th>
                      <th style={{ textAlign: "right" }}>Positive %</th>
                      <th style={{ textAlign: "right" }}>Zero svcs</th>
                      <th style={{ textAlign: "right" }}>Avg LOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programsData.map((r) => {
                      const grouped = groupByCategory(r.exit_destinations);
                      const cats = sortedCategories(grouped);
                      const hasDestinations = r.exit_destinations.length > 0;

                      return (
                        <>
                          <tr key={r.program}>
                            <td style={{ fontWeight: 500 }}>{r.program}</td>
                            <td style={{ textAlign: "right" }}>{r.active}</td>
                            <td style={{ textAlign: "right" }}>{r.exits}</td>
                            <td style={{ textAlign: "right" }}>{r.perm_pct}%</td>
                            <td style={{ textAlign: "right" }}>{r.positive_pct}%</td>
                            <td style={{ textAlign: "right" }}>{r.zero_services}</td>
                            <td style={{ textAlign: "right" }}>{r.avg_los}</td>
                          </tr>

                          {hasDestinations && cats.map((cat) => {
                            const entries = grouped.get(cat)!;
                            const isPositive = categoryPositive(entries);
                            return (
                              <tr key={`${r.program}-${cat}`} style={{ fontSize: 13, background: "#fafafa" }}>
                                <td colSpan={7} style={{ paddingLeft: 24 }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4, color: isPositive ? "#1a7f4e" : "#b91c1c" }}>
                                    {cat}
                                  </div>
                                  {entries.map((e) => (
                                    <div key={e.destination} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                                      <span style={{ paddingLeft: 12 }}>{e.destination}</span>
                                      <span>{e.count}</span>
                                    </div>
                                  ))}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Services (optional) */}
              {includeServices && (
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
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
