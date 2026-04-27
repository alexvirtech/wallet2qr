import "next-auth";
import "@auth/core/types";
import "@auth/core/jwt";

declare module "next-auth" {
  interface Session {
    provider?: "google" | "apple";
    sub?: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    provider?: "google" | "apple";
    sub?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    provider?: "google" | "apple";
  }
}
