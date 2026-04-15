import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Comma-separated list of allowed email addresses or @domain patterns. */
function parseAllowList(): string[] {
  const raw = process.env.EXEC_ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowed(email: string, allowList: string[]): boolean {
  const lower = email.toLowerCase();
  for (const entry of allowList) {
    if (entry.startsWith("@")) {
      // Domain match: "@firststepcommunities.org"
      if (lower.endsWith(entry)) return true;
    } else {
      // Exact email match
      if (lower === entry) return true;
    }
  }
  return false;
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  // Required in production. Locally you can also set it in dashboard/.env.local.
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: "openid profile email" } },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const allowList = parseAllowList();

      const email =
        (profile as { email?: string; preferred_username?: string } | undefined)?.email ??
        (profile as { email?: string; preferred_username?: string } | undefined)?.preferred_username ??
        user?.email ??
        "";

      // Debug: log to Vercel function logs (remove after auth is working)
      console.log("[auth] signIn profile:", JSON.stringify(profile, null, 2));
      console.log("[auth] signIn user:", JSON.stringify(user));
      console.log("[auth] resolved email:", JSON.stringify(email));
      console.log("[auth] allowList:", JSON.stringify(allowList));
      console.log("[auth] isAllowed:", isAllowed(email, allowList));

      // If you don't set EXEC_ALLOWED_EMAILS, deny sign-in in production.
      if (allowList.length === 0) {
        return process.env.NODE_ENV !== "production";
      }

      return isAllowed(email, allowList);
    },
  },
  pages: {
    error: "/unauthorized",
  },
});
