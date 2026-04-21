"use client";

import { useState } from "react";
import type { Acl, AclEntry, UserRole } from "@/lib/acl";

interface Props {
  initialAcl: Acl;
  programs: readonly string[];
}

const ROLE_LABELS: Record<Exclude<UserRole, "admin">, string> = {
  executive: "Executive",
  supervisor: "Supervisor",
};

export function AclEditor({ initialAcl, programs }: Props) {
  const [acl, setAcl] = useState<Acl>(initialAcl);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Exclude<UserRole, "admin">>("executive");
  const [newProgram, setNewProgram] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function persist(next: Acl) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/acl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Server error");
      setMsg({ text: "Saved successfully.", ok: true });
    } catch {
      setMsg({ text: "Error saving — check the console.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  function addOrUpdate() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const entry: AclEntry =
      newRole === "supervisor"
        ? { role: "supervisor", program: newProgram || undefined }
        : { role: newRole };
    const next: Acl = { users: { ...acl.users, [email]: entry } };
    setAcl(next);
    persist(next);
    setNewEmail("");
    setNewRole("executive");
    setNewProgram("");
  }

  function remove(email: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [email]: _removed, ...rest } = acl.users;
    const next: Acl = { users: rest };
    setAcl(next);
    persist(next);
  }

  const entries = Object.entries(acl.users);

  return (
    <div>
      {/* Current users */}
      <div className="card" style={{ overflowX: "auto", padding: 0, marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th style={{ padding: "10px 16px", textAlign: "left" }}>Email</th>
              <th style={{ padding: "10px 8px", textAlign: "left" }}>Role</th>
              <th style={{ padding: "10px 8px", textAlign: "left" }}>Program restriction</th>
              <th style={{ padding: "10px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: "16px 16px", color: "var(--color-muted)", fontStyle: "italic" }}
                >
                  No entries yet — all signed-in users default to Executive access.
                </td>
              </tr>
            ) : (
              entries.map(([email, entry]) => (
                <tr key={email}>
                  <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 13 }}>
                    {email}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          entry.role === "supervisor"
                            ? "var(--color-brand)"
                            : "var(--color-surface-alt)",
                        color:
                          entry.role === "supervisor" ? "#fff" : "inherit",
                      }}
                    >
                      {ROLE_LABELS[entry.role as Exclude<UserRole, "admin">] ?? entry.role}
                    </span>
                  </td>
                  <td style={{ padding: "8px", color: "var(--color-muted)" }}>
                    {entry.program ?? "—"}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button
                      style={{ fontSize: 12, padding: "2px 10px" }}
                      onClick={() => remove(email)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / update entry */}
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
          Add or update a user
        </h3>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr auto auto",
            alignItems: "end",
          }}
        >
          <label>
            Email address
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOrUpdate()}
              placeholder="user@firststepcommunities.org"
              style={{ display: "block", marginTop: 4, width: "100%" }}
            />
          </label>

          <label>
            Role
            <select
              value={newRole}
              onChange={(e) => {
                setNewRole(e.target.value as Exclude<UserRole, "admin">);
                setNewProgram("");
              }}
              style={{ display: "block", marginTop: 4 }}
            >
              <option value="executive">Executive</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </label>

          {newRole === "supervisor" ? (
            <label>
              Program
              <select
                value={newProgram}
                onChange={(e) => setNewProgram(e.target.value)}
                style={{ display: "block", marginTop: 4 }}
              >
                <option value="">— select —</option>
                {programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={addOrUpdate} disabled={saving}>
            {saving ? "Saving…" : "Add / Update"}
          </button>
          {msg && (
            <span
              style={{
                fontSize: 13,
                color: msg.ok ? "var(--color-brand-dark)" : "var(--color-high)",
              }}
            >
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
