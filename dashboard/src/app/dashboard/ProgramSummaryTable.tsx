"use client";

import { useState } from "react";
import type { ProgramSummaryRow, ExitDestinationBreakdown } from "@/lib/metrics";

// Group by category for the expanded breakdown view
function groupByCategory(rows: ExitDestinationBreakdown[]): Map<string, ExitDestinationBreakdown[]> {
  const map = new Map<string, ExitDestinationBreakdown[]>();
  for (const r of rows) {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category)!.push(r);
  }
  return map;
}

// Order categories: positive first, then negative
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

function categoryPositive(cat: string, entries: ExitDestinationBreakdown[]): boolean {
  return entries.some((e) => e.is_positive);
}

export function ProgramSummaryTable({ programs }: { programs: ProgramSummaryRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(prog: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(prog)) next.delete(prog);
      else next.add(prog);
      return next;
    });
  }

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 28 }} />
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
        {programs.map((r) => {
          const isExpanded = expanded.has(r.program);
          const grouped = groupByCategory(r.exit_destinations);
          const cats = sortedCategories(grouped);
          const hasDestinations = r.exit_destinations.length > 0;

          return (
            <>
              <tr key={r.program}>
                <td style={{ textAlign: "center", padding: "6px 4px" }}>
                  {hasDestinations ? (
                    <button
                      onClick={() => toggle(r.program)}
                      title={isExpanded ? "Collapse" : "Expand exit destinations"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "2px 4px",
                        color: "var(--color-brand)",
                        lineHeight: 1,
                      }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  ) : null}
                </td>
                <td style={{ fontWeight: 500 }}>{r.program}</td>
                <td style={{ textAlign: "right" }}>{r.active}</td>
                <td style={{ textAlign: "right" }}>{r.exits}</td>
                <td style={{ textAlign: "right" }}>{r.perm_pct}%</td>
                <td style={{ textAlign: "right" }}>{r.positive_pct}%</td>
                <td style={{ textAlign: "right" }}>{r.zero_services}</td>
                <td style={{ textAlign: "right" }}>{r.avg_los}</td>
              </tr>

              {isExpanded && (
                <tr key={`${r.program}-detail`}>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <div
                      style={{
                        background: "var(--color-surface-alt)",
                        borderLeft: "3px solid var(--color-brand)",
                        margin: "0 0 2px 28px",
                        padding: "12px 16px",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "var(--color-brand-dark)" }}>
                        Exit Destinations — {r.exits} total exits
                      </div>
                      {cats.map((cat) => {
                        const entries = grouped.get(cat)!;
                        const catIsPos = categoryPositive(cat, entries);
                        const catTotal = entries.reduce((s, e) => s + e.count, 0);
                        return (
                          <div key={cat} style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{cat}</span>
                              <span style={{ fontSize: 11, color: "var(--color-muted)" }}>({catTotal})</span>
                              {catIsPos && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    background: "var(--color-brand)",
                                    color: "#fff",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  POSITIVE
                                </span>
                              )}
                            </div>
                            <div style={{ paddingLeft: 12 }}>
                              {entries.map((e) => (
                                <div
                                  key={e.destination}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "2px 0",
                                    fontSize: 12,
                                  }}
                                >
                                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {e.is_positive ? (
                                      <span style={{ color: "var(--color-brand)", fontSize: 10 }}>✓</span>
                                    ) : (
                                      <span style={{ color: "var(--color-muted)", fontSize: 10 }}>✗</span>
                                    )}
                                    {e.destination}
                                    {e.is_permanent && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 700,
                                          padding: "1px 5px",
                                          borderRadius: 3,
                                          background: "var(--color-brand-dark)",
                                          color: "#fff",
                                        }}
                                      >
                                        PERM
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      minWidth: 28,
                                      textAlign: "right",
                                      color: e.is_positive ? "inherit" : "var(--color-muted)",
                                    }}
                                  >
                                    {e.count}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}
