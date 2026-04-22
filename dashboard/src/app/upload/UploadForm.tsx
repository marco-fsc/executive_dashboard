"use client";

import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { useState } from "react";

const INCOMPLETE_THRESHOLD = 4999;

type FileStatus =
  | { kind: "none" }
  | { kind: "ok"; name: string; rows: number }
  | { kind: "warning"; name: string; rows: number };

type UploadPhase = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadForm() {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>({ kind: "none" });

  const busy = phase === "uploading" || phase === "processing";

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMessage(null);
    setPhase("idle");
    if (!file) { setFileStatus({ kind: "none" }); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string ?? "";
      const rows = text.split("\n").filter((l) => l.trim().length > 0).length - 1;
      setFileStatus(rows <= INCOMPLETE_THRESHOLD
        ? { kind: "warning", name: file.name, rows }
        : { kind: "ok", name: file.name, rows }
      );
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

    try {
      // ── Step 1: upload directly from browser → Vercel Blob ──────────────
      setPhase("uploading");
      setProgress(0);

      const blob = await upload(
        `csv-uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/data/upload-handle",
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        }
      );

      // ── Step 2: server ingests from Blob URL ─────────────────────────────
      setPhase("processing");
      setProgress(100);

      const res = await fetch("/api/data/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, filename: file.name }),
      });

      const text = await res.text();
      let json: { ok?: boolean; error?: string; meta?: { uploadedAt: string } } = {};
      try { json = JSON.parse(text); } catch { /* plain text error */ }

      if (!res.ok || !json.ok) {
        setMessage({ text: `Upload failed: ${json.error ?? text.slice(0, 200)}`, ok: false });
        setPhase("error");
        return;
      }

      setMessage({ text: `Upload complete. Processed at: ${json.meta?.uploadedAt ?? ""}`, ok: true });
      setPhase("done");
      form.reset();
      setFileStatus({ kind: "none" });
    } catch (err: unknown) {
      setMessage({ text: `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`, ok: false });
      setPhase("error");
    }
  }

  const buttonLabel =
    phase === "uploading" ? `Uploading… ${progress}%` :
    phase === "processing" ? "Processing…" :
    "Upload & Process";

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

        {/* Progress bar */}
        {busy && (
          <div style={{ background: "#e8f4e8", borderRadius: 6, overflow: "hidden", height: 10 }}>
            <div
              style={{
                height: "100%",
                width: `${phase === "processing" ? 100 : progress}%`,
                background: "var(--color-brand)",
                transition: "width 0.3s ease",
                backgroundImage: phase === "processing"
                  ? "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)"
                  : "none",
              }}
            />
          </div>
        )}
        {busy && (
          <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center" }}>
            {phase === "uploading" ? `Uploading file… ${progress}%` : "Processing data — please wait…"}
          </div>
        )}

        <button type="submit" disabled={busy}>
          {buttonLabel}
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
                Only <strong>{fileStatus.rows.toLocaleString()} rows</strong> were detected. When exporting,
                please ensure you select <strong>All results</strong> and not &ldquo;Current result table&rdquo;.
                Use the settings shown below:
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

    // Pre-check: Vercel serverless limit is ~4.5 MB
    if (file.size > 4.5 * 1024 * 1024) {
      setMessage({
        text: "File is too large for browser upload (limit ~4.5 MB). Use the CLI instead: npx tsx scripts/push-dataset.ts \"path/to/file.csv\"",
        ok: false,
      });
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/data/upload", { method: "POST", body: fd });

      // Read as text first — platform-level errors (e.g. 413) come back as plain text, not JSON
      const text = await res.text();
      let json: { ok?: boolean; error?: string; meta?: { uploadedAt: string } } = {};
      try {
        json = JSON.parse(text);
      } catch {
        if (res.status === 413) {
          setMessage({
            text: "File too large for browser upload. Use the CLI instead: npx tsx scripts/push-dataset.ts \"path/to/file.csv\"",
            ok: false,
          });
        } else {
          setMessage({ text: `Upload failed: HTTP ${res.status} — ${text.slice(0, 120)}`, ok: false });
        }
        return;
      }

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

