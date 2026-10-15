"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

export async function signInWithLocalAdmin(
  _previousState: string | null,
  formData: FormData,
): Promise<string | null> {
  if (!process.env.LOCAL_ADMIN_PASSWORD_HASH) {
    return "Local admin sign-in is not configured. Contact the dashboard administrator.";
  }
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") return "Incorrect username or password.";
      console.error("Local admin sign-in failed:", error);
      return "Unable to sign in. Contact the dashboard administrator.";
    }
    throw error;
  }
}

export async function signInWithEntra() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

export async function signOutToHome() {
  await signOut({ redirectTo: "/" });
}
