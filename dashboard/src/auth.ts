import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { getAdminEmail, isAdminEmail, readAcl } from "@/lib/acl";
import { verifyAdminCredentials } from "@/lib/local-admin";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  // Required in production. Locally you can also set it in dashboard/.env.local.
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Local admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const valid = await verifyAdminCredentials(
          credentials.username,
          credentials.password,
          process.env.LOCAL_ADMIN_PASSWORD_HASH,
        );
        if (!valid) return null;
        return { id: "local-admin", name: "Local administrator", email: getAdminEmail() };
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: "openid profile email" } },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = [profile?.email, profile?.preferred_username, user.email]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        ?.trim().toLowerCase();

      if (!email) return false;
      user.email = email;

      // Admin is always allowed.
      if (isAdminEmail(email)) return true;

      // Everyone else must appear in the ACL blob.
      const acl = await readAcl();
      return Object.prototype.hasOwnProperty.call(acl.users, email);
    },
  },
  pages: {
    signIn: "/",
    error: "/unauthorized",
  },
});
