import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { clientList, cmList, programList } from "@/lib/metrics";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/clients");
  }

  const sp = (await searchParams) ?? {};

  const ds = await readCurrentDataset();

  const program = sp.program ?? "";
  const cm = sp.cm ?? "";
  const risk = sp.risk ?? "";

  const activeOnly = (sp.active_only ?? "1") === "1";
  const noServices = (sp.no_services ?? "0") === "1";
  const noRecent = (sp.no_recent ?? "0") === "1";
  const approaching = (sp.approaching_60 ?? "0") === "1";

  const minDays = sp.min_days ? Number(sp.min_days) : null;
  const maxDays = sp.max_days ? Number(sp.max_days) : null;

  const rows = ds
    ? clientList(ds, {
        program: program || null,
        cm: cm || null,
        risk: risk || null,
        active_only: activeOnly,
        no_services: noServices,
        no_recent: noRecent,
        approaching_60: approaching,
        min_days: Number.isFinite(minDays) ? minDays : null,
        max_days: Number.isFinite(maxDays) ? maxDays : null,
      })
    : [];

  const exportHref = `/api/export?format=excel&report=clients&${new URLSearchParams(sp as Record<string, string>).toString()}`;

  return (
    <>
      <TopNav email={session.user?.email ?? null} />
      <main>
        <h1>Client List</h1>

        {!ds ? (
          <div className="card">
            <p>No data uploaded yet. Go to <a href="/upload">Upload</a>.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Total:</strong> {rows.length} clients
              </div>
              <a href={exportHref}>Export Excel</a>
            </div>

            <form method="get" className="card" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                Program
                <select name="program" defaultValue={program} style={{ display: "block", marginTop: 4, width: "100%" }}>
                  <option value="">All</option>
                  {programList(ds).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Case Manager
                <select name="cm" defaultValue={cm} style={{ display: "block", marginTop: 4, width: "100%" }}>
                  <option value="">All</option>
                  {cmList(ds, program || null).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Risk
                <select name="risk" defaultValue={risk} style={{ display: "block", marginTop: 4, width: "100%" }}>
                  <option value="">All</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>

              <label>
                Min days
                <input type="number" name="min_days" defaultValue={sp.min_days ?? ""} style={{ display: "block", marginTop: 4, width: "100%" }} />
              </label>

              <label>
                Max days
                <input type="number" name="max_days" defaultValue={sp.max_days ?? ""} style={{ display: "block", marginTop: 4, width: "100%" }} />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                <input type="checkbox" name="active_only" value="1" defaultChecked={activeOnly} />
                Active only
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                <input type="checkbox" name="no_services" value="1" defaultChecked={noServices} />
                No services
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                <input type="checkbox" name="no_recent" value="1" defaultChecked={noRecent} />
                No recent contact (&gt;21d)
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                <input type="checkbox" name="approaching_60" value="1" defaultChecked={approaching} />
                Approaching 60 days
              </label>

              <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
                <button type="submit">Apply</button>
                <a href="/clients">Reset</a>
              </div>
            </form>

            <div className="card" style={{ overflowX: "auto", padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Program</th>
                    <th>Case Manager</th>
                    <th style={{ textAlign: "right" }}>Days In</th>
                    <th style={{ textAlign: "right" }}>Last Svc</th>
                    <th style={{ textAlign: "right" }}>Services</th>
                    <th>Risk</th>
                    <th>Flags</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const riskClass =
                      r.risk_level === "High" ? "badge-high" :
                      r.risk_level === "Medium" ? "badge-medium" : "badge-low";
                    return (
                      <tr key={r.uid}>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-muted)" }}>{r.uid}</td>
                        <td>{r.program}</td>
                        <td>{r.cm}</td>
                        <td style={{ textAlign: "right" }}>{r.days_in_program ?? ""}</td>
                        <td style={{ textAlign: "right" }}>{r.days_since_service ?? ""}</td>
                        <td style={{ textAlign: "right" }}>{r.services_count}</td>
                        <td>
                          <span className={`badge ${riskClass}`}>{r.risk_level}</span>
                          {" "}
                          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>({r.risk_score})</span>
                        </td>
                        <td style={{ fontSize: 12 }}>{r.flags.join(", ") || "—"}</td>
                        <td>
                          {r.exit_date ? (
                            <div>
                              <div style={{ fontSize: 12 }}>{r.exit_date}</div>
                              <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{r.destination}</div>
                            </div>
                          ) : (
                            <span className="badge badge-active">Active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
