"use client";

import { useState } from "react";

export default function UploadForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setMessage("Select a CSV file.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/data/upload", {
        method: "POST",
        body: fd,
      });

      const json = (await res.json()) as { ok?: boolean; error?: string; meta?: { uploadedAt: string } };
      if (!res.ok || !json.ok) {
        setMessage(`Upload failed: ${json.error ?? res.status}`);
        return;
      }

      setMessage(`Upload complete. Uploaded at: ${json.meta?.uploadedAt ?? ""}`);
      form.reset();
    } catch {
      setMessage("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12 }}>
      <div>
        <label>
          CSV File
          <input name="file" type="file" accept=".csv" required disabled={busy} style={{ display: "block", marginTop: 6 }} />
        </label>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Uploading..." : "Upload & Process"}
      </button>
      {message ? <p style={{ margin: 0, color: "#333" }}>{message}</p> : null}
    </form>
  );
}
