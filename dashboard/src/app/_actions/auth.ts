"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithEntra() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

export async function signOutToHome() {
  await signOut({ redirectTo: "/" });
}
