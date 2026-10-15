"use client";

import { useActionState } from "react";
import { signInWithLocalAdmin } from "@/app/_actions/auth";

export function LocalAdminLogin() {
  const [error, action, pending] = useActionState(signInWithLocalAdmin, null);

  return (
    <form action={action} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <h2>Local administrator</h2>
      <label htmlFor="admin-username">Username</label>
      <input id="admin-username" name="username" autoComplete="username" required defaultValue="admin" />
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in as admin"}
      </button>
    </form>
  );
}
