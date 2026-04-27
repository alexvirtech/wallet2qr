import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// TODO(A1-apple): add Apple provider when credentials are available
// import Apple from "next-auth/providers/apple";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alex@vir-tec.net";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    // TODO(A1-apple): uncomment when Apple credentials are ready
    // Apple({
    //   clientId: process.env.AUTH_APPLE_ID,
    //   clientSecret: process.env.AUTH_APPLE_SECRET,
    // }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        token.oauthProvider = account.provider as "google" | "apple";
        token.oauthSub = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      session.provider = token.oauthProvider;
      session.providerSub = token.oauthSub;
      session.sub = token.oauthSub ?? token.sub;
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    error: "/admin/auth-error",
  },
});
