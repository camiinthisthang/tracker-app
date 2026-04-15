import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";
import {
  computeWeeklyDigest,
  renderWeeklyDigestHtml,
} from "@/lib/reports/weekly";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configs = await prisma.weeklyReportConfig.findMany({
      where: { isEnabled: true, recipients: { isEmpty: false } },
      include: {
        campaign: {
          include: {
            campaignCreators: { include: { creator: true } },
          },
        },
      },
    });

    const now = new Date();
    const weekAgo = startOfDay(subDays(now, 7));

    const results = [];

    for (const config of configs) {
      try {
        // Get metrics for the past week
        const metrics = await prisma.post.aggregate({
          where: {
            campaignId: config.campaignId,
            postedAt: { gte: weekAgo },
          },
          _sum: { views: true, likes: true, comments: true },
          _count: true,
        });

        // Get top 3 posts
        const topPosts = await prisma.post.findMany({
          where: {
            campaignId: config.campaignId,
            postedAt: { gte: weekAgo },
          },
          include: { creator: { select: { handle: true } } },
          orderBy: { views: "desc" },
          take: 3,
        });

        // Send an HTML digest via Resend. If the API key isn't set we still
        // want the cron to no-op gracefully rather than 500.
        let sent = false;
        if (isEmailConfigured() && resend) {
          const digest = await computeWeeklyDigest(
            config.campaign.teamId,
            now
          );
          const html = renderWeeklyDigestHtml(config.campaign.name, digest);
          const subject = `${config.campaign.name} · weekly report (${digest.totalViews.toLocaleString()} views)`;
          try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: config.recipients,
              subject,
              html,
            });
            sent = true;
          } catch (emailErr) {
            console.error("Resend send failed", emailErr);
          }
        } else {
          console.log(
            `[weekly-report] would email ${config.recipients.join(", ")} for ${config.campaign.name}:`,
            {
              postsCreated: metrics._count,
              totalViews: metrics._sum.views,
              topPosts: topPosts.map((p) => ({
                title: p.title,
                views: p.views,
                creator: p.creator.handle,
              })),
            }
          );
        }

        results.push({
          campaignId: config.campaignId,
          campaignName: config.campaign.name,
          recipientCount: config.recipients.length,
          sent,
        });
      } catch (error) {
        console.error(
          `Failed to send report for campaign ${config.campaignId}:`,
          error
        );
        results.push({
          campaignId: config.campaignId,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      reportsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("Weekly report cron error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
