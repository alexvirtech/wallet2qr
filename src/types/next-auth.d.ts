import "next-auth";
import "@auth/core/types";
import "@auth/core/jwt";

declare module "next-auth" {
  interface Session {
    provider?: "google" | "apple";
    providerSub?: string;
    sub?: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    provider?: "google" | "apple";
    providerSub?: string;
    sub?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    oauthProvider?: "google" | "apple";
    oauthSub?: string;
  }
}
