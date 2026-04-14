import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Public routes — always accessible
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/apply" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/applications" ||
    pathname.startsWith("/reports/") ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".xml")
  ) {
    return NextResponse.next();
  }

  // Not logged in — redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing
  const role = token.role as string;

  // Creator trying to access admin routes
  if (
    role === "CREATOR" &&
    !pathname.startsWith("/home") &&
    !pathname.startsWith("/profile") &&
    !pathname.startsWith("/creator-") &&
    !pathname.startsWith("/api")
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Admin/Member trying to access creator routes
  if (role !== "CREATOR" && (pathname.startsWith("/home") || pathname.startsWith("/profile"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Root redirect
  if (pathname === "/") {
    if (role === "CREATOR") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
