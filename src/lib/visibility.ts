import type { Prisma } from "@/generated/prisma/client";

interface SessionLike {
  user: {
    teamId: string;
    isSuperAdmin: boolean;
  };
}

/**
 * Visibility filter for Creator queries.
 *
 * Creators are an agency-wide pool: a single Creator can work on campaigns
 * across multiple client teams via CampaignCreator. So a non-super-admin
 * user (a client account manager) should see a creator if EITHER:
 *   - the creator's home team is theirs (Creator.teamId), OR
 *   - the creator is currently assigned to one of their team's campaigns
 *
 * Super admins see every creator.
 */
export function creatorVisibilityWhere(
  session: SessionLike
): Prisma.CreatorWhereInput {
  if (session.user.isSuperAdmin) return {};
  return {
    OR: [
      { teamId: session.user.teamId },
      {
        campaignCreators: {
          some: { campaign: { teamId: session.user.teamId } },
        },
      },
    ],
  };
}

/**
 * Permission check for "can this session see/edit this single creator?"
 *
 * Returns true if the session is super admin, the creator's home team matches,
 * or the creator has at least one CampaignCreator on the session's team.
 *
 * Pass `prismaClient` so this stays usable in API routes without forcing the
 * caller to import @/lib/prisma — tiny ergonomic win for testability.
 */
export async function canAccessCreator(
  prismaClient: {
    campaignCreator: {
      findFirst: (args: {
        where: Prisma.CampaignCreatorWhereInput;
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  creator: { id: string; teamId: string | null },
  session: SessionLike
): Promise<boolean> {
  if (session.user.isSuperAdmin) return true;
  if (creator.teamId === session.user.teamId) return true;
  const overlap = await prismaClient.campaignCreator.findFirst({
    where: {
      creatorId: creator.id,
      campaign: { teamId: session.user.teamId },
    },
    select: { id: true },
  });
  return Boolean(overlap);
}
