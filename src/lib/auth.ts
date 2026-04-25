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
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/admin`;
    },
  },
  pages: {
    error: "/admin/auth-error",
  },
});
