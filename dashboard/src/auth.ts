import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { isAdminEmail, readAcl } from "@/lib/acl";

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
      const email = (
        (profile as { email?: string; preferred_username?: string } | undefined)?.email ??
        (profile as { email?: string; preferred_username?: string } | undefined)?.preferred_username ??
        user?.email ??
        ""
      ).toLowerCase();

      if (!email) return false;

      // Admin is always allowed.
      if (isAdminEmail(email)) return true;

      // Everyone else must appear in the ACL blob.
      const acl = await readAcl();
      return Object.prototype.hasOwnProperty.call(acl.users, email);
    },
  },
  pages: {
    error: "/unauthorized",
  },
});
