"use client";

import Image from "next/image";
import { useState } from "react";

const INCOMPLETE_THRESHOLD = 4999;

type FileStatus =
  | { kind: "none" }
  | { kind: "ok"; name: string; rows: number }
  | { kind: "warning"; name: string; rows: number };

export default function UploadForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>({ kind: "none" });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMessage(null);
    if (!file) { setFileStatus({ kind: "none" }); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string ?? "";
      // Count non-empty lines, subtract 1 for header
      const rows = text.split("\n").filter((l) => l.trim().length > 0).length - 1;
      if (rows <= INCOMPLETE_THRESHOLD) {
        setFileStatus({ kind: "warning", name: file.name, rows });
      } else {
        setFileStatus({ kind: "ok", name: file.name, rows });
      }
    };
    reader.readAsText(file);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) { setMessage({ text: "Select a CSV file.", ok: false }); return; }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/data/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; error?: string; meta?: { uploadedAt: string } };

      if (!res.ok || !json.ok) {
        setMessage({ text: `Upload failed: ${json.error ?? `HTTP ${res.status}`}`, ok: false });
        return;
      }

      setMessage({ text: `Upload complete. Processed at: ${json.meta?.uploadedAt ?? ""}`, ok: true });
      form.reset();
      setFileStatus({ kind: "none" });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Network error";
      setMessage({ text: `Upload failed: ${detail}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div>
          <label>
            CSV File
            <input
              name="file"
              type="file"
              accept=".csv"
              required
              disabled={busy}
              onChange={onFileChange}
              style={{ display: "block", marginTop: 6 }}
            />
          </label>
        </div>

        {fileStatus.kind !== "none" && (
          <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
            <strong>{fileStatus.name}</strong> — {fileStatus.rows.toLocaleString()} data rows detected
          </div>
        )}

        <button type="submit" disabled={busy}>
          {busy ? "Uploading..." : "Upload & Process"}
        </button>

        {message && (
          <p style={{ margin: 0, fontWeight: 600, color: message.ok ? "#0a3622" : "#842029", background: message.ok ? "#d1e7dd" : "#f8d7da", padding: "10px 14px", borderRadius: 6 }}>
            {message.text}
          </p>
        )}
      </div>

      {fileStatus.kind === "warning" && (
        <div className="card" style={{ borderLeft: "4px solid #f0a500", background: "#fffbf0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#856404", marginBottom: 6 }}>
                This report seems incomplete!
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>
                Only <strong>{fileStatus.rows.toLocaleString()} rows</strong> were detected. When exporting, please ensure you select{" "}
                <strong>All results</strong> and not &ldquo;Current result table&rdquo;. Use the settings shown below:
              </p>
              <Image
                src="/looker-export-guide.png"
                alt="Looker export dialog — select All results"
                width={480}
                height={340}
                style={{ borderRadius: 8, border: "1px solid #e0c060", maxWidth: "100%", height: "auto" }}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

