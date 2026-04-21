"use client";

import { useState } from "react";
import type { CmSummaryEntry } from "@/lib/metrics";

export interface ClientEntry {
  uid: string;
  program: string;
  cm: string;
  days_in_program: number | null;
  days_since_service: number | null;
  services_count: number;
  risk_level: string;
  risk_score: number;
  flags: string[];
  destination: string;
  exit_date: string;
}

interface Props {
  cms: CmSummaryEntry[];
  clients: ClientEntry[];
}

export function CmCardsGroup({ cms, clients }: Props) {
  const [selectedCm, setSelectedCm] = useState<string | null>(null);

  const drawerClients = selectedCm
    ? clients
        .filter((c) => (c.cm || "(unassigned)") === selectedCm)
        .sort((a, b) => (b.days_in_program ?? 0) - (a.days_in_program ?? 0))
    : [];
  const activeCount = drawerClients.filter((c) => !c.exit_date).length;
  const exitedCount = drawerClients.filter((c) => !!c.exit_date).length;

  return (
    <>
      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {cms.map((cm) => (
          <button
            key={String(cm.cm)}
            onClick={() => setSelectedCm(String(cm.cm))}
            style={{
              all: "unset",
              display: "block",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <div
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  background: "var(--color-surface-alt)",
                  padding: "12px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <strong style={{ color: "var(--color-brand-dark)" }}>
                  {String(cm.cm)}
                </strong>
                <span className="badge badge-active">
                  {String(cm.active_clients)} active
                </span>
              </div>
              <div
                style={{
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 24px",
                  fontSize: 14,
                }}
              >
                <div>Perm exits <strong style={{ float: "right" }}>{String(cm.perm_exits)}</strong></div>
                <div>Homeless exits <strong style={{ float: "right" }}>{String(cm.homeless_exits)}</strong></div>
                <div>Services logged <strong style={{ float: "right" }}>{String(cm.services_logged)}</strong></div>
                <div>No services <strong style={{ float: "right" }}>{String(cm.zero_services)}</strong></div>
                <div>No recent contact <strong style={{ float: "right" }}>{String(cm.no_recent_contact)}</strong></div>
                <div>High risk <strong style={{ float: "right" }}>{String(cm.high_risk_clients)}</strong></div>
              </div>
              <div
                style={{
                  padding: "8px 18px",
                  borderTop: "1px solid var(--color-border)",
                  fontSize: 12,
                  color: "var(--color-muted)",
                  textAlign: "right",
                }}
              >
                Click to view clients →
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Backdrop */}
      {selectedCm && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setSelectedCm(null)}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(95vw, 760px)",
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
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{selectedCm ?? ""}</h2>
            {selectedCm && (
              <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 4 }}>
                {activeCount} active · {exitedCount} exited
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedCm(null)}
            style={{
              background: "none",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {drawerClients.length === 0 ? (
            <p style={{ padding: 24, color: "var(--color-muted)" }}>
              No clients found.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "white",
                    zIndex: 1,
                    borderBottom: "2px solid var(--color-border)",
                  }}
                >
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>UID</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>Days In</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>Last Svc</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>Svcs</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600 }}>Risk</th>
                  <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600 }}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {drawerClients.map((c, i) => {
                  const riskClass =
                    c.risk_level === "High"
                      ? "badge-high"
                      : c.risk_level === "Medium"
                      ? "badge-medium"
                      : "badge-low";
                  return (
                    <tr
                      key={`${c.uid}-${i}`}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        background: i % 2 === 0 ? "white" : "var(--color-surface-alt)",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 16px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "var(--color-muted)",
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={c.uid}
                      >
                        {c.uid}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        {c.days_in_program ?? "—"}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        {c.days_since_service != null ? `${c.days_since_service}d` : "—"}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        {c.services_count}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span className={`badge ${riskClass}`}>{c.risk_level || "—"}</span>
                      </td>
                      <td style={{ padding: "8px" }}>
                        {c.exit_date ? (
                          <span
                            title={c.destination}
                            style={{ fontSize: 11, color: "var(--color-muted)" }}
                          >
                            Exited {c.exit_date}
                          </span>
                        ) : (
                          <span className="badge badge-active">Active</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "8px 16px",
                          fontSize: 11,
                          color: "var(--color-muted)",
                        }}
                      >
                        {c.flags.join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
