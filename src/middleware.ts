import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const path = req.nextUrl.pathname;

  if (hostname.startsWith("www.")) {
    const url = req.nextUrl.clone();
    url.host = hostname.replace(/^www\./, "");
    return NextResponse.redirect(url, 308);
  }

  const isAdmin = hostname.startsWith("admin.");
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
