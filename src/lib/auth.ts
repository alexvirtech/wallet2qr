import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alex@vir-tec.net";

export type OAuthProvider = "google" | "apple" | "github" | "microsoft-entra-id";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    MicrosoftEntraId({
      clientId: process.env.AUTH_MICROSOFT_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account) {
        token.oauthProvider = account.provider as OAuthProvider;
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
