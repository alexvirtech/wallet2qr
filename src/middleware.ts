import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const isAdmin = hostname.startsWith("admin.");
  const path = req.nextUrl.pathname;

  if (isAdmin) {
    if (
      !path.startsWith("/admin") &&
      !path.startsWith("/api/auth") &&
      !path.startsWith("/api/admin") &&
      !path.startsWith("/_next") &&
      !path.startsWith("/favicon")
    ) {
      const url = req.nextUrl.clone();
      url.pathname = `/admin${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Allow /admin on main domain too (auth is enforced by the layout)
  if (path.startsWith("/admin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
