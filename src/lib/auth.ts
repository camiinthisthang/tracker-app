import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";

/**
 * The agency's home team. Identified by `slug` so a human rename of the
 * team name (via Prisma Studio or a future UI) doesn't accidentally demote
 * every agency admin to client_manager. The reset script sets the slug on
 * the agency team to match `AGENCY_TEAM_SLUG`.
 *
 * `AGENCY_TEAM_NAME` is the display fallback used for UI labels and also as
 * a safety-net match for sessions that pre-date the teamSlug rollout.
 *
 * Agency was rebranded from "Tapmore" → "DropDeck". The prod DB row still
 * has slug="tapmore" until the next reset runs (or a manual UPDATE), so the
 * legacy values below are checked as a fallback to avoid demoting existing
 * agency sessions to client_manager on deploy.
 */
export const AGENCY_TEAM_SLUG = "dropdeck";
export const AGENCY_TEAM_NAME = "DropDeck";
const LEGACY_AGENCY_TEAM_SLUG = "tapmore";
const LEGACY_AGENCY_TEAM_NAME = "Tapmore";

/**
 * Every slug / name we recognize as the agency team. Use these for Prisma
 * `in` / `notIn` queries and the boolean helpers below for `===` checks.
 * Lets the whole codebase keep working through the rebrand window without
 * each callsite knowing about the legacy values.
 *
 * Once the prod Team row is renamed to slug="dropdeck" / name="DropDeck"
 * (via the next `scripts/reset-data.ts --confirm` run or a one-off SQL
 * UPDATE), drop the LEGACY_* entries and these arrays collapse to one
 * element each.
 */
export const AGENCY_TEAM_SLUGS: string[] = [
  AGENCY_TEAM_SLUG,
  LEGACY_AGENCY_TEAM_SLUG,
];
export const AGENCY_TEAM_NAMES: string[] = [
  AGENCY_TEAM_NAME,
  LEGACY_AGENCY_TEAM_NAME,
];

export function isAgencyTeamSlug(slug: string | null | undefined): boolean {
  return (
    slug === AGENCY_TEAM_SLUG || slug === LEGACY_AGENCY_TEAM_SLUG
  );
}
export function isAgencyTeamName(name: string | null | undefined): boolean {
  return (
    name === AGENCY_TEAM_NAME || name === LEGACY_AGENCY_TEAM_NAME
  );
}

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
 *   - `agency_manager`→ member of the agency team (slug=dropdeck). Sees all clients.
 *   - `creator`       → CREATOR role membership. Sees only their own stuff.
 *   - `client_manager`→ anything else (ADMIN/MEMBER on a non-agency team).
 */
export function getUserAccessLevel(session: SessionUserLike): AccessLevel {
  const user = session?.user;
  if (!user) return "client_manager"; // callers should have already auth-gated
  if (user.isSuperAdmin) return "super_admin";
  if (user.role === "CREATOR") return "creator";
  // Prefer slug (stable). Fall back to name for sessions issued before the
  // slug was added to the JWT — users just need to re-login to drop the
  // fallback. The helpers accept both the new "dropdeck" and legacy "tapmore"
  // values until the prod DB row is renamed.
  if (isAgencyTeamSlug(user.teamSlug)) return "agency_manager";
  if (!user.teamSlug && isAgencyTeamName(user.teamName)) {
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
  // Super admins may have no team of their own (they oversee all teams) —
  // the middleware already lets them through on the same condition.
  if (!session?.user?.teamId && !session?.user?.isSuperAdmin) {
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
