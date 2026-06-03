"use client";

import { useState } from "react";

interface ReportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  programList: string[];
  defaultProgram?: string;
  defaultStartDate?: string | null;
  defaultEndDate?: string | null;
}

export function ReportConfigModal({
  isOpen,
  onClose,
  programList,
  defaultProgram,
  defaultStartDate,
  defaultEndDate,
}: ReportConfigModalProps) {
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(
    defaultProgram ? [defaultProgram] : []
  );
  const [startDate, setStartDate] = useState(defaultStartDate ?? "");
  const [endDate, setEndDate] = useState(defaultEndDate ?? "");
  const [includeServices, setIncludeServices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleProgram = (program: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(program)
        ? prev.filter((p) => p !== program)
        : [...prev, program]
    );
  };

  const handleSelectAll = () => {
    setSelectedPrograms(programList);
  };

  const handleDeselectAll = () => {
    setSelectedPrograms([]);
  };

  const handleGenerate = () => {
    setError(null);

    if (selectedPrograms.length === 0) {
      setError("Please select at least one program");
      return;
    }

    const params = new URLSearchParams();
    params.set("programs", selectedPrograms.join(","));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("includeServices", includeServices.toString());
    params.set("autoprint", "1");

    window.open(`/report/preview?${params.toString()}`, "_blank");
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          padding: 24,
          maxWidth: 600,
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h2 id="modal-title" style={{ marginTop: 0, fontSize: 20, color: "var(--color-brand-dark)" }}>
          Generate PDF Report
        </h2>

        {/* Program Selection */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Programs
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={handleSelectAll}
              className="secondary"
              style={{ fontSize: 12, padding: "4px 12px" }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="secondary"
              style={{ fontSize: 12, padding: "4px 12px" }}
            >
              Deselect All
            </button>
          </div>
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: 8,
            }}
          >
            {programList.map((program) => (
              <label
                key={program}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPrograms.includes(program)}
                  onChange={() => handleToggleProgram(program)}
                  style={{ marginRight: 8 }}
                />
                {program}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
            {selectedPrograms.length} program{selectedPrograms.length !== 1 ? "s" : ""} selected
          </div>
        </div>

        {/* Date Range */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              Start Date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              End Date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>
        </div>

        {/* Include Services */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeServices}
              onChange={(e) => setIncludeServices(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            <span style={{ fontSize: 14 }}>Include Services Table</span>
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            className="secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedPrograms.length === 0}
            style={{
              opacity: selectedPrograms.length === 0 ? 0.5 : 1,
              cursor: selectedPrograms.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Open Print View
          </button>
        </div>
      </div>
    </div>
  );
}
