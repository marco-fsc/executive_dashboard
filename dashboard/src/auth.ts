import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

function parseAllowedEmails(): string[] {
  const raw = process.env.EXEC_ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
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
      const allowed = parseAllowedEmails();

      // If you don't set EXEC_ALLOWED_EMAILS, deny sign-in in production.
      if (allowed.length === 0) {
        return process.env.NODE_ENV !== "production";
      }

      const email =
        (profile as { email?: string; preferred_username?: string } | undefined)?.email ??
        (profile as { email?: string; preferred_username?: string } | undefined)?.preferred_username ??
        user?.email ??
        "";

      return allowed.includes(email.toLowerCase());
    },
  },
  pages: {
    error: "/unauthorized",
  },
});
