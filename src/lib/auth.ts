import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";

/**
 * The agency's home team. Identified by `slug` so a human rename of the
 * team name (via Prisma Studio or a future UI) doesn't accidentally demote
 * every agency admin to client_manager. The reset script sets slug="tapmore"
 * on the agency team.
 *
 * `AGENCY_TEAM_NAME` is the display fallback used for UI labels and also as
 * a safety-net match for sessions that pre-date the teamSlug rollout.
 */
export const AGENCY_TEAM_SLUG = "tapmore";
export const AGENCY_TEAM_NAME = "Tapmore";

export type AccessLevel =
  | "super_admin"
  | "agency_manager"
  | "client_manager"
  | "creator";

interface SessionUserLike {
  user?: {
    role?: "ADMIN" | "MEMBER" | "CREATOR";
    isSuperAdmin?: boolean;
    teamName?: string | null;
    teamSlug?: string | null;
  } | null;
}

/**
 * Derive the caller's access level from an existing session. No DB query —
 * relies on the membership info baked into the NextAuth JWT.
 *
 * Returns the most privileged level that matches:
 *   - `super_admin`   → platform admin (e.g. Cami). `isSuperAdmin=true`.
 *   - `agency_manager`→ member of the agency team (slug=tapmore). Sees all clients.
 *   - `creator`       → CREATOR role membership. Sees only their own stuff.
 *   - `client_manager`→ anything else (ADMIN/MEMBER on a non-agency team).
 */
export function getUserAccessLevel(session: SessionUserLike): AccessLevel {
  const user = session?.user;
  if (!user) return "client_manager"; // callers should have already auth-gated
  if (user.isSuperAdmin) return "super_admin";
  if (user.role === "CREATOR") return "creator";
  // Prefer slug (stable). Fall back to name for sessions issued before the
  // slug was added to the JWT — users just need to re-login to drop the fallback.
  if (user.teamSlug === AGENCY_TEAM_SLUG) return "agency_manager";
  if (!user.teamSlug && user.teamName === AGENCY_TEAM_NAME) {
    return "agency_manager";
  }
  return "client_manager";
}

/**
 * True if the user has cross-tenant visibility: super admins + agency managers.
 * Client managers and creators are scoped to their own team.
 */
export function hasAgencyWideAccess(session: SessionUserLike): boolean {
  const level = getUserAccessLevel(session);
  return level === "super_admin" || level === "agency_manager";
}

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getRequiredSession() {
  const session = await getSession();
  if (!session?.user?.teamId) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Gate a server component / route handler to super admins only.
 * Non-super users get bounced to their role's home.
 */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.isSuperAdmin) {
    redirect(session.user.role === "CREATOR" ? "/home" : "/dashboard");
  }
  return session;
}

/**
 * Gate to anyone with agency-wide access (super admins + agency managers).
 * Client managers and creators get bounced to their role's home.
 */
export async function requireAgencyAccess() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!hasAgencyWideAccess(session)) {
    redirect(session.user.role === "CREATOR" ? "/home" : "/dashboard");
  }
  return session;
}
