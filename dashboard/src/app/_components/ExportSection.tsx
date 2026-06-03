"use client";

import { useState } from "react";
import { ReportConfigModal } from "./ReportConfigModal";

interface ExportSectionProps {
  uploadedAt: string;
  exportDateQuery: string;
  program: string;
  programList: string[];
  startDate?: string | null;
  endDate?: string | null;
}

export function ExportSection({
  uploadedAt,
  exportDateQuery,
  program,
  programList,
  startDate,
  endDate,
}: ExportSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#555" }}>
          Data uploaded: <strong>{new Date(uploadedAt).toLocaleString()}</strong>
        </div>
        <div style={{ display: "flex", gap: 12 }} className="export-buttons">
          <a
            href={`/api/export?format=excel&report=executive${exportDateQuery ? `&${exportDateQuery}` : ""}${program ? `&program=${encodeURIComponent(program)}` : ""}`}
          >
            Export Excel
          </a>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-link)",
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
              fontSize: "inherit",
              textDecoration: "underline",
            }}
          >
            Generate Report
          </button>
        </div>
      </div>

      <ReportConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        programList={programList}
        defaultProgram={program}
        defaultStartDate={startDate}
        defaultEndDate={endDate}
      />
    </>
  );
}
