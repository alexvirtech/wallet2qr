import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alex@vir-tec.net";

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const isAdmin = hostname.startsWith("admin.");
  const path = req.nextUrl.pathname;

  if (isAdmin) {
    if (path.startsWith("/api/auth")) {
      return NextResponse.next();
    }
    const mainDomain = hostname.replace(/^admin\./, "");
    const url = req.nextUrl.clone();
    url.host = mainDomain;
    url.pathname = `/admin${path === "/" ? "" : path}`;
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin")) {
    if (path.startsWith("/admin/auth-error")) return NextResponse.next();
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL("/admin/auth-error", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
