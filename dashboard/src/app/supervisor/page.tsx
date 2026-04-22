import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { cmSummary, programList, clientList, PROGRAM_ORDER, CAN_IDENTIFIER } from "@/lib/metrics";
import { readAcl, resolveRole, PAGE_ROLES } from "@/lib/acl";
import { CmCardsGroup } from "./CmCardsGroup";
import type { ClientEntry, ServiceLogEntry } from "./CmCardsGroup";

const APPOINTMENT_REMINDER = "Appointment Reminders";

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string; range?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/supervisor");
  }

  const userEmail = session.user?.email ?? "";
  const acl = await readAcl();
  const userRole = resolveRole(userEmail, acl);
  if (!userRole || !PAGE_ROLES.supervisor.includes(userRole.role)) {
    redirect("/unauthorized");
  }

  // Supervisors are locked to their assigned program; ignore the query param.
  const sp = await searchParams;
  const rawProgram = sp?.program ?? "";
  const program =
    userRole.role === "cm_supervisor" && userRole.program
      ? userRole.program
      : rawProgram;

  const rawRange = sp?.range ?? "";
  const days = rawRange === "30" ? 30 : rawRange === "60" ? 60 : rawRange === "180" ? 180 : rawRange === "365" ? 365 : null;

  const ds = await readCurrentDataset();

  return (
    <>
      <TopNav email={session.user?.email ?? null} role={userRole.role} />
      <main>
        <h1>Supervisor Dashboard</h1>

        {!ds ? (
          <div className="card">
            <p>No data uploaded yet. Go to <a href="/upload">Upload</a>.</p>
          </div>
        ) : (
          <>
            {userRole.role !== "cm_supervisor" && (
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
                <div>
                  <label>
                    Date range
                    <select name="range" defaultValue={rawRange} style={{ display: "block", marginTop: 6 }}>
                      <option value="">All time</option>
                      <option value="30">Past 30 days</option>
                      <option value="60">Past 60 days</option>
                      <option value="180">Past 180 days</option>
                      <option value="365">Past year</option>
                    </select>
                  </label>
                </div>
                <button type="submit">Apply</button>
                {(program || rawRange) ? <a href="/supervisor" style={{ marginLeft: "auto" }}>Clear</a> : <span style={{ marginLeft: "auto" }} />}
              </form>
            )}
            {userRole.role === "cm_supervisor" && program && (
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Showing program:</span>
                <strong>{program}</strong>
              </div>
            )}

            {(() => {
              const allClients = clientList(ds, { active_only: false }) as ClientEntry[];
              const allPrograms = programList(ds);

              const programsToShow: string[] = program
                ? [program]
                : [
                    ...PROGRAM_ORDER.filter((p) => allPrograms.includes(p)),
                    ...allPrograms.filter(
                      (p) =>
                        !(PROGRAM_ORDER as readonly string[]).includes(p) &&
                        !p.toLowerCase().includes(CAN_IDENTIFIER.toLowerCase())
                    ),
                    ...allPrograms.filter((p) => p.toLowerCase().includes(CAN_IDENTIFIER.toLowerCase())),
                  ];

              return programsToShow.map((prog) => {
                const cms = cmSummary(ds, prog, days);
                if (!cms.length) return null;
                const progClients = allClients.filter((c) => c.program === prog);
                const progServices: ServiceLogEntry[] = ds.services
                  .filter((s) => s.Name === prog)
                  .map((s) => ({
                    uid: s.uid,
                    service_item: s["Service Item Name"],
                    attendance_date: s["Service Attendance Date"],
                    category: s["Service Item Name"].toLowerCase() === APPOINTMENT_REMINDER.toLowerCase()
                      ? "reminder"
                      : "real",
                    program: s.Name,
                  }));

                return (
                  <section key={prog} style={{ marginTop: 28 }}>
                    <h2
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--color-brand-dark)",
                        borderBottom: "2px solid var(--color-brand)",
                        paddingBottom: 6,
                        marginBottom: 14,
                      }}
                    >
                      {prog}
                    </h2>
                    <CmCardsGroup cms={cms} clients={progClients} services={progServices} rangeDays={days ?? undefined} />
                  </section>
                );
              });
            })()}
          </>
        )}
      </main>
    </>
  );
}
