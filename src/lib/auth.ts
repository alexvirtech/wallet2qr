import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alex@vir-tec.net";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      return user.email === ADMIN_EMAIL;
    },
  },
  pages: {
    error: "/admin/auth-error",
  },
});
