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
                <strong>Total:</strong> {rows.length}
              </div>
              <a href={exportHref}>Export Excel</a>
            </div>

            <form method="get" className="card" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <label>
                Program
                <select name="program" defaultValue={program}>
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
                <select name="cm" defaultValue={cm}>
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
                <select name="risk" defaultValue={risk}>
                  <option value="">All</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>

              <label>
                Min days
                <input type="number" name="min_days" defaultValue={sp.min_days ?? ""} />
              </label>

              <label>
                Max days
                <input type="number" name="max_days" defaultValue={sp.max_days ?? ""} />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="active_only" value="1" defaultChecked={activeOnly} />
                Active only
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="no_services" value="1" defaultChecked={noServices} />
                No services
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="no_recent" value="1" defaultChecked={noRecent} />
                No recent contact (&gt;21d)
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="approaching_60" value="1" defaultChecked={approaching} />
                Approaching 60 days
              </label>

              <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
                <button type="submit">Apply</button>
                <a href="/clients">Reset</a>
              </div>
            </form>

            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Client ID</th>
                    <th style={{ textAlign: "left" }}>Program</th>
                    <th style={{ textAlign: "left" }}>CM</th>
                    <th style={{ textAlign: "right" }}>Days In</th>
                    <th style={{ textAlign: "right" }}>Last Svc</th>
                    <th style={{ textAlign: "right" }}>Services</th>
                    <th style={{ textAlign: "left" }}>Risk</th>
                    <th style={{ textAlign: "left" }}>Flags</th>
                    <th style={{ textAlign: "left" }}>Exit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.uid}>
                      <td style={{ fontFamily: "monospace", color: "#666" }}>{r.uid}</td>
                      <td>{r.program}</td>
                      <td>{r.cm}</td>
                      <td style={{ textAlign: "right" }}>{r.days_in_program ?? ""}</td>
                      <td style={{ textAlign: "right" }}>{r.days_since_service ?? ""}</td>
                      <td style={{ textAlign: "right" }}>{r.services_count}</td>
                      <td>{r.risk_level} ({r.risk_score})</td>
                      <td>{r.flags.join(", ")}</td>
                      <td>
                        {r.exit_date ? (
                          <>
                            {r.exit_date}
                            <br />
                            <span style={{ color: "#666" }}>{r.destination}</span>
                          </>
                        ) : (
                          <span style={{ color: "#0a7" }}>Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
