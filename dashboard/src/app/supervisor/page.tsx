import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/app/_components/TopNav";
import { readCurrentDataset } from "@/lib/blob-dataset-store";
import { cmSummary, programList, clientList, PROGRAM_ORDER } from "@/lib/metrics";
import { readAcl, resolveRole } from "@/lib/acl";
import { CmCardsGroup } from "./CmCardsGroup";
import type { ClientEntry, ServiceLogEntry } from "./CmCardsGroup";

const APPOINTMENT_REMINDER = "Appointment Reminders";

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/supervisor");
  }

  const userEmail = session.user?.email ?? "";
  const acl = await readAcl();
  const userRole = resolveRole(userEmail, acl);

  // Supervisors are locked to their assigned program; ignore the query param.
  const sp = await searchParams;
  const rawProgram = sp?.program ?? "";
  const program =
    userRole.role === "supervisor" && userRole.program
      ? userRole.program
      : rawProgram;

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
            {userRole.role !== "supervisor" && (
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
            )}
            {userRole.role === "supervisor" && program && (
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
                    ...allPrograms.filter((p) => !(PROGRAM_ORDER as readonly string[]).includes(p)),
                  ];

              return programsToShow.map((prog) => {
                const cms = cmSummary(ds, prog);
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
                    <CmCardsGroup cms={cms} clients={progClients} services={progServices} />
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
