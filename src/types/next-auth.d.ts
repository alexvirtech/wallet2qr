import "next-auth";
import "@auth/core/types";
import "@auth/core/jwt";

type OAuthProvider = "google" | "apple" | "github" | "microsoft-entra-id";

declare module "next-auth" {
  interface Session {
    provider?: OAuthProvider;
    providerSub?: string;
    sub?: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    provider?: OAuthProvider;
    providerSub?: string;
    sub?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    oauthProvider?: OAuthProvider;
    oauthSub?: string;
  }
}
