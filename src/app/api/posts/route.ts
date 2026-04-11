import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);

    const campaignId = searchParams.get("campaignId");
    const creatorId = searchParams.get("creatorId");
    const platform = searchParams.get("platform");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "postedAt";
    const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "50");

    // Build where clause — only posts from campaigns belonging to this team
    const where: Prisma.PostWhereInput = {
      campaign: { teamId: session.user.teamId },
    };

    if (campaignId) where.campaignId = campaignId;
    if (creatorId) where.creatorId = creatorId;
    if (platform) where.platform = platform as Prisma.EnumPlatformFilter;

    if (startDate || endDate) {
      where.postedAt = {};
      if (startDate) where.postedAt.gte = new Date(startDate);
      if (endDate) where.postedAt.lte = new Date(endDate);
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, handle: true } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      data: posts,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
