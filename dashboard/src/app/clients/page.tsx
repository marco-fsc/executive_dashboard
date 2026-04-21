import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { clientList, cmList, programList } from "@/lib/metrics";
import { readAcl, resolveRole, PAGE_ROLES } from "@/lib/acl";
import { ClientTable } from "./ClientTable";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/clients");
  }

  const userEmail = session.user?.email ?? "";
  const sp: Record<string, string | undefined> = (await searchParams) ?? {};
  const acl = await readAcl();
  const userRole = resolveRole(userEmail, acl);
  if (!userRole || !PAGE_ROLES.clients.includes(userRole.role)) {
    redirect("/unauthorized");
  }

  const ds = await readCurrentDataset();

  // Supervisors are locked to their assigned program.
  const rawProgram = sp.program ?? "";
  const program =
    userRole.role === "supervisor" && userRole.program
      ? userRole.program
      : rawProgram;
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
              {userRole.role === "supervisor" ? (
                <div>
                  <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Program</span>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{program}</div>
                  <input type="hidden" name="program" value={program} />
                </div>
              ) : (
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
              )}

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

            <ClientTable rows={rows} />
          </>
        )}
      </main>
    </>
  );
}
