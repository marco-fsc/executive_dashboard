"use client";

import { useState } from "react";
import type { CmSummaryEntry } from "@/lib/metrics";

export interface ClientEntry {
  uid: string;
  program: string;
  cm: string;
  days_in_program: number | null;
  days_since_service: number | null;
  days_since_real_service: number | null;
  services_count: number;
  attempted_engagements: number;
  appointment_reminders: number;
  risk_level: string;
  risk_score: number;
  flags: string[];
  destination: string;
  exit_date: string;
}

export interface ServiceLogEntry {
  uid: string;
  service_item: string;
  attendance_date: string; // ISO
  category: "real" | "reminder";
  program: string;
}

interface Props {
  cms: CmSummaryEntry[];
  clients: ClientEntry[];
  services: ServiceLogEntry[];
}

type DrawerTab = "clients" | "service-log";

// ── helpers ────────────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: "real" | "reminder" }) {
  if (cat === "reminder") {
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#fff3cd", color: "#856404", fontWeight: 600 }}>
        Reminder
      </span>
    );
  }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#d1e7dd", color: "#0a3622", fontWeight: 600 }}>
      Service
    </span>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function CmCardsGroup({ cms, clients, services }: Props) {
  const [selectedCm, setSelectedCm] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("clients");

  const cmName = selectedCm ?? "";

  const drawerClients = selectedCm
    ? clients
        .filter((c) => (c.cm || "(unassigned)") === selectedCm)
        .sort((a, b) => (b.days_in_program ?? 0) - (a.days_in_program ?? 0))
    : [];

  const cmUids = new Set(drawerClients.map((c) => c.uid));

  const drawerServices = selectedCm
    ? services
        .filter((s) => cmUids.has(s.uid))
        .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
    : [];

  const activeCount = drawerClients.filter((c) => !c.exit_date).length;
  const exitedCount = drawerClients.filter((c) => !!c.exit_date).length;
  const totalAttempted = drawerClients.reduce((s, c) => s + c.attempted_engagements, 0);

  function openDrawer(cm: string) {
    setSelectedCm(cm);
    setTab("clients");
  }

  return (
    <>
      {/* ── Cards grid ── */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
        {cms.map((cm) => (
          <button
            key={String(cm.cm)}
            onClick={() => openDrawer(String(cm.cm))}
            style={{ all: "unset", display: "block", cursor: "pointer", width: "100%" }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* header */}
              <div style={{ background: "var(--color-surface-alt)", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)" }}>
                <strong style={{ color: "var(--color-brand-dark)" }}>{String(cm.cm)}</strong>
                <span className="badge badge-active">{cm.active_clients} sheltered</span>
              </div>

              {/* outcome stats */}
              <div style={{ padding: "12px 18px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14 }}>
                <div>Perm exits <strong style={{ float: "right" }}>{cm.perm_exits}</strong></div>
                <div>Perm exit % <strong style={{ float: "right" }}>{cm.perm_exit_pct}%</strong></div>
                <div>Homeless exits <strong style={{ float: "right" }}>{cm.homeless_exits}</strong></div>
                <div title="Active clients with no real service attended in the past 21 days">No real svc (21d) <strong style={{ float: "right" }}>{cm.no_real_svc_21d}</strong></div>
                <div>High risk <strong style={{ float: "right" }}>{cm.high_risk_clients}</strong></div>
              </div>

              {/* engagement breakdown */}
              <div style={{ margin: "10px 18px", padding: "8px 0", background: "var(--color-surface-alt)", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", border: "1px solid var(--color-border)" }}>
                <div style={{ textAlign: "center", padding: "4px 0" }} title="Real services in the last 30 days">
                  <div style={{ color: "#0a3622", fontWeight: 700, fontSize: 18 }}>{cm.services_last_30d}</div>
                  <div style={{ fontSize: 11, color: "#0a3622", opacity: 0.8 }}>Svcs (30d)</div>
                </div>
                <div style={{ textAlign: "center", padding: "4px 0", borderLeft: "1px solid var(--color-border)" }} title="Average real services per month since this CM's first logged service">
                  <div style={{ color: "#0a3622", fontWeight: 700, fontSize: 18 }}>{cm.avg_services_per_month}</div>
                  <div style={{ fontSize: 11, color: "#0a3622", opacity: 0.8 }}>Avg/mo</div>
                </div>
                <div style={{ textAlign: "center", padding: "4px 0", borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)" }} title="Appointment Reminders: dated note, not full service">
                  <div style={{ color: "#856404", fontWeight: 700, fontSize: 18 }}>{cm.appointment_reminders}</div>
                  <div style={{ fontSize: 11, color: "#856404", opacity: 0.8 }}>Reminders</div>
                </div>
                <div style={{ textAlign: "center", padding: "4px 0" }} title="Attempted Engagements: CM tried but client was unavailable">
                  <div style={{ color: "#842029", fontWeight: 700, fontSize: 18 }}>{cm.attempted_engagements}</div>
                  <div style={{ fontSize: 11, color: "#842029", opacity: 0.8 }}>Attempted</div>
                </div>
              </div>

              {/* footer */}
              <div style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)", fontSize: 12, color: "var(--color-muted)", textAlign: "right" }}>
                Click to view clients &amp; service log →
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Backdrop ── */}
      {selectedCm && (
        <div
          role="presentation"
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSelectedCm(null)}
        />
      )}

      {/* ── Drawer ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(95vw, 820px)",
          background: "white",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
          transform: selectedCm ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s ease",
        }}
      >
        {/* Drawer header */}
        <div style={{ padding: "18px 24px 0", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{cmName}</h2>
              <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>
                {activeCount} active · {exitedCount} exited
                {totalAttempted > 0 && (
                  <span style={{ marginLeft: 10, color: "#842029" }}>
                    · {totalAttempted} attempted engagement{totalAttempted !== 1 ? "s" : ""} (client unavailable)
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedCm(null)}
              style={{ background: "none", border: "1px solid var(--color-border)", cursor: "pointer", padding: "6px 16px", borderRadius: 6, fontSize: 14 }}
            >
              ✕ Close
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex" }}>
            {(["clients", "service-log"] as DrawerTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: tab === t ? "3px solid var(--color-brand)" : "3px solid transparent",
                  cursor: "pointer",
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: tab === t ? 700 : 400,
                  color: tab === t ? "var(--color-brand-dark)" : "var(--color-muted)",
                }}
              >
                {t === "clients"
                  ? `Clients (${drawerClients.length})`
                  : `Service Log (${drawerServices.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "clients" && <ClientsTab clients={drawerClients} />}
          {tab === "service-log" && (
            <ServiceLogTab services={drawerServices} totalAttempted={totalAttempted} />
          )}
        </div>
      </div>
    </>
  );
}

// ── Clients tab ────────────────────────────────────────────────────────────────

function ClientsTab({ clients }: { clients: ClientEntry[] }) {
  if (clients.length === 0) {
    return <p style={{ padding: 24, color: "var(--color-muted)" }}>No clients found.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ position: "sticky", top: 0, background: "white", zIndex: 1, borderBottom: "2px solid var(--color-border)" }}>
          <th style={{ padding: "10px 16px", textAlign: "left" }}>UID</th>
          <th style={{ padding: "10px 8px", textAlign: "right" }}>Days In</th>
          <th style={{ padding: "10px 8px", textAlign: "right" }} title="Days since last real service">Last Real Svc</th>
          <th style={{ padding: "10px 8px", textAlign: "right" }}>Svcs</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }} title="Attempted Engagements: CM tried, client unavailable">Att.</th>
          <th style={{ padding: "10px 8px", textAlign: "center" }} title="Appointment Reminders">Rem.</th>
          <th style={{ padding: "10px 8px", textAlign: "left" }}>Risk</th>
          <th style={{ padding: "10px 8px", textAlign: "left" }}>Status</th>
          <th style={{ padding: "10px 16px", textAlign: "left" }}>Flags</th>
        </tr>
      </thead>
      <tbody>
        {clients.map((c, i) => {
          const riskClass =
            c.risk_level === "High" ? "badge-high" :
            c.risk_level === "Medium" ? "badge-medium" : "badge-low";

          // Highlight rows where CM is trying but client hasn't had a real service
          const attemptingOnly = c.attempted_engagements > 0 && c.services_count === 0 && !c.exit_date;

          return (
            <tr key={`${c.uid}-${i}`} style={{ borderBottom: "1px solid var(--color-border)", background: attemptingOnly ? "#fff5f5" : i % 2 === 0 ? "white" : "var(--color-surface-alt)" }}>
              <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 11, color: "var(--color-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.uid}>
                {c.uid}
              </td>
              <td style={{ padding: "8px", textAlign: "right" }}>{c.days_in_program ?? "—"}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>
                {c.days_since_real_service != null
                  ? `${c.days_since_real_service}d`
                  : <span style={{ color: "#842029" }}>—</span>}
              </td>
              <td style={{ padding: "8px", textAlign: "right" }}>{c.services_count}</td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {c.attempted_engagements > 0 ? (
                  <span style={{ display: "inline-block", minWidth: 22, padding: "1px 6px", borderRadius: 10, background: "#f8d7da", color: "#842029", fontSize: 11, fontWeight: 700 }} title="CM attempted contact — client unavailable">
                    {c.attempted_engagements}
                  </span>
                ) : <span style={{ color: "var(--color-muted)", fontSize: 11 }}>—</span>}
              </td>
              <td style={{ padding: "8px", textAlign: "center" }}>
                {c.appointment_reminders > 0 ? (
                  <span style={{ display: "inline-block", minWidth: 22, padding: "1px 6px", borderRadius: 10, background: "#fff3cd", color: "#856404", fontSize: 11, fontWeight: 700 }} title="Appointment reminders left">
                    {c.appointment_reminders}
                  </span>
                ) : <span style={{ color: "var(--color-muted)", fontSize: 11 }}>—</span>}
              </td>
              <td style={{ padding: "8px" }}>
                <span className={`badge ${riskClass}`}>{c.risk_level || "—"}</span>
              </td>
              <td style={{ padding: "8px" }}>
                {c.exit_date ? (
                  <span title={c.destination} style={{ fontSize: 11, color: "var(--color-muted)" }}>
                    Exited {c.exit_date}
                  </span>
                ) : <span className="badge badge-active">Active</span>}
              </td>
              <td style={{ padding: "8px 16px", fontSize: 11, color: "var(--color-muted)" }}>
                {c.flags.join(", ") || "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Service Log tab ────────────────────────────────────────────────────────────

function ServiceLogTab({ services, totalAttempted }: { services: ServiceLogEntry[]; totalAttempted: number }) {
  const byDate = new Map<string, ServiceLogEntry[]>();
  for (const s of services) {
    byDate.set(s.attendance_date, [...(byDate.get(s.attendance_date) ?? []), s]);
  }
  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  const realCount = services.filter((s) => s.category === "real").length;
  const reminderCount = services.filter((s) => s.category === "reminder").length;

  return (
    <div style={{ padding: "16px 24px" }}>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 20, marginBottom: 16, padding: "10px 16px", background: "var(--color-surface-alt)", borderRadius: 8, fontSize: 13, border: "1px solid var(--color-border)", flexWrap: "wrap" }}>
        <span>
          <strong style={{ color: "#0a3622" }}>{realCount}</strong>{" "}
          <span style={{ color: "var(--color-muted)" }}>real services</span>
        </span>
        <span>
          <strong style={{ color: "#856404" }}>{reminderCount}</strong>{" "}
          <span style={{ color: "var(--color-muted)" }}>reminders</span>
        </span>
        {totalAttempted > 0 && (
          <span>
            <strong style={{ color: "#842029" }}>{totalAttempted}</strong>{" "}
            <span style={{ color: "var(--color-muted)" }}>attempted (no date — client unavailable)</span>
          </span>
        )}
      </div>

      {services.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>No dated service events found for this case manager&apos;s clients.</p>
      ) : (
        dates.map((date) => (
          <div key={date} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
              {date}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {(byDate.get(date) ?? []).map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "0 12px",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: s.category === "reminder" ? "#fffdf0" : "#f6fff8",
                    border: `1px solid ${s.category === "reminder" ? "#f0d080" : "#b7dfbf"}`,
                    fontSize: 13,
                  }}
                >
                  <CategoryBadge cat={s.category} />
                  <span>{s.service_item}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--color-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }} title={s.uid}>
                    {s.uid}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
