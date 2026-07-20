import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-secret";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: resolveAuthSecret() });
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") || "").toLowerCase();

  // dropdeck.xyz is the marketing site; everything else (viewtrackr.com,
  // vercel.app previews/default domains, localhost) is the app. The three
  // landing paths ("/", "/brands", "/creators") are STATIC marketing pages on
  // the marketing host, but REAL app routes elsewhere (e.g. /creators = the
  // admin creator roster). The old rule treated every non-viewtrackr host as
  // marketing, which sent app users on vercel.app URLs to the static creators
  // landing page when they clicked the Creators tab. Marketing pages remain
  // previewable on any host directly at /site/*.html.
  const isMarketingHost = host.includes("dropdeck");

  // App homepage -> straight into the dashboard.
  if (!isMarketingHost && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Marketing landing pages (dropdeck hosts only): serve the static files in
  // /public/site. Everywhere else these paths fall through to the app.
  if (isMarketingHost) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/site/index.html", request.url));
    }
    if (pathname === "/brands") {
      return NextResponse.rewrite(new URL("/site/brands.html", request.url));
    }
    if (pathname === "/creators") {
      return NextResponse.rewrite(new URL("/site/creators.html", request.url));
    }
  }

  // Public routes — always accessible (app auth pages, public APIs, and the
  // static marketing assets under /site).
  if (
    pathname.startsWith("/site") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/apply" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/auth") ||
    // Vercel cron requests carry no session cookie — gating them here 307'd
    // every nightly sync to /login since launch. The routes authenticate
    // themselves via the CRON_SECRET bearer header.
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/applications" ||
    pathname === "/api/inquiries" ||
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

  // Root redirect (safety net; "/" is normally handled by host rules above)
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
