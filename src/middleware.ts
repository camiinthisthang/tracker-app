import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // viewtrackr.* is being deprecated — its homepage now goes to the app dashboard.
  // dropdeck.xyz is unaffected (keeps the marketing landing at "/").
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host.includes("viewtrackr") && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public routes — always accessible
  if (
    pathname === "/" ||
    pathname === "/brands" ||
    pathname === "/creators" ||
    pathname.startsWith("/site") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/apply" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/applications" ||
    pathname === "/api/invite/team/accept" ||
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

  // Logged in but no team membership (typically a Google sign-in that didn't
  // match any pending invite). Park them on /pending-approval until a super
  // admin assigns them — but let super admins through, they manage things from
  // /clients without having a team themselves.
  const teamId = (token.teamId as string) || "";
  const isSuperAdmin = Boolean(token.isSuperAdmin);
  if (!teamId && !isSuperAdmin) {
    if (
      !pathname.startsWith("/pending-approval") &&
      !pathname.startsWith("/api") &&
      pathname !== "/logout"
    ) {
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }
    return NextResponse.next();
  }

  // Role-based routing
  const role = token.role as string;

  // Creator trying to access admin routes. Super admins are exempt: a creator
  // who's also been granted isSuperAdmin (e.g. staff who also post) gets the
  // full admin view despite their CREATOR membership role.
  if (
    role === "CREATOR" &&
    !isSuperAdmin &&
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
    if (role === "CREATOR" && !isSuperAdmin) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
