"use client";

import { useState, useMemo } from "react";

export interface ClientRow {
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

type SortKey = "days_in_program" | "days_since_service" | "services_count" | "risk_score";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  days_in_program: "Days In",
  days_since_service: "Last Svc",
  services_count: "Services",
  risk_score: "Risk",
};

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>;
  return <span style={{ marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

export function ClientTable({ rows }: { rows: ClientRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      const diff = (av as number) - (bv as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [rows, sortKey, sortDir]);

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: "10px 8px",
    textAlign: "right",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    background: sortKey === key ? "var(--color-surface-alt)" : undefined,
  });

  if (rows.length === 0) {
    return <p style={{ padding: 24, color: "var(--color-muted)" }}>No clients match the current filters.</p>;
  }

  return (
    <div className="card" style={{ overflowX: "auto", padding: 0 }}>
      <table>
        <thead>
          <tr>
            <th style={{ padding: "10px 16px", textAlign: "left" }}>Client ID</th>
            <th style={{ padding: "10px 8px", textAlign: "left" }}>Program</th>
            <th style={{ padding: "10px 8px", textAlign: "left" }}>Case Manager</th>
            <th style={thStyle("days_in_program")} onClick={() => handleSort("days_in_program")}>
              {SORT_LABELS.days_in_program}<SortIndicator active={sortKey === "days_in_program"} dir={sortDir} />
            </th>
            <th style={thStyle("days_since_service")} onClick={() => handleSort("days_since_service")}>
              {SORT_LABELS.days_since_service}<SortIndicator active={sortKey === "days_since_service"} dir={sortDir} />
            </th>
            <th style={thStyle("services_count")} onClick={() => handleSort("services_count")}>
              {SORT_LABELS.services_count}<SortIndicator active={sortKey === "services_count"} dir={sortDir} />
            </th>
            <th style={thStyle("risk_score")} onClick={() => handleSort("risk_score")}>
              {SORT_LABELS.risk_score}<SortIndicator active={sortKey === "risk_score"} dir={sortDir} />
            </th>
            <th style={{ padding: "10px 8px", textAlign: "left" }}>Flags</th>
            <th style={{ padding: "10px 8px", textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const riskClass =
              r.risk_level === "High" ? "badge-high" :
              r.risk_level === "Medium" ? "badge-medium" : "badge-low";
            return (
              <tr key={`${r.uid}-${i}`}>
                <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12, color: "var(--color-muted)" }}>
                  {r.uid}
                </td>
                <td style={{ padding: "8px" }}>{r.program}</td>
                <td style={{ padding: "8px" }}>{r.cm}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{r.days_in_program ?? "—"}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{r.days_since_service ?? "—"}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{r.services_count}</td>
                <td style={{ padding: "8px" }}>
                  <span className={`badge ${riskClass}`}>{r.risk_level}</span>{" "}
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>({r.risk_score})</span>
                </td>
                <td style={{ padding: "8px", fontSize: 12 }}>{r.flags.join(", ") || "—"}</td>
                <td style={{ padding: "8px" }}>
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
  );
}
