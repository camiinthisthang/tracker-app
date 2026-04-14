import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { subDays, addDays, startOfDay } from "date-fns";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const PLATFORMS = ["TIKTOK", "INSTAGRAM"] as const;
const TIERS = ["TRAINING", "BRONZE", "SILVER", "GOLD"] as const;

const CREATOR_DATA = [
  { name: "Sophia Chen", handle: "sophia.creates", tier: "GOLD" },
  { name: "Marcus Rivera", handle: "marcus.lifestyle", tier: "GOLD" },
  { name: "Ava Thompson", handle: "ava.beauty", tier: "SILVER" },
  { name: "Jake Morrison", handle: "jake.fitness", tier: "SILVER" },
  { name: "Luna Park", handle: "luna.skincare", tier: "SILVER" },
  { name: "Ethan Brooks", handle: "ethan.tech", tier: "BRONZE" },
  { name: "Mia Rodriguez", handle: "mia.foodie", tier: "BRONZE" },
  { name: "Noah Williams", handle: "noah.travel", tier: "BRONZE" },
  { name: "Emma Davis", handle: "emma.fashion", tier: "TRAINING" },
  { name: "Liam Cooper", handle: "liam.gaming", tier: "TRAINING" },
  { name: "Olivia Kim", handle: "olivia.wellness", tier: "SILVER" },
  { name: "Aiden Patel", handle: "aiden.chats", tier: "BRONZE" },
];

// Hooks grouped with strength tiers to make the analytics page show
// realistic winners vs. underperformers.
// strength: higher = higher conversion rate from views to referrals
const HOOKS = [
  { hook: "POV: you finally tried _", strength: 2.8 },
  { hook: "3 things no one tells you about _", strength: 2.5 },
  { hook: "Stop doing _, do this instead", strength: 2.4 },
  { hook: "Testing viral products so you don't have to", strength: 2.1 },
  { hook: "I was today years old when I found this", strength: 1.9 },
  { hook: "The truth about _", strength: 1.7 },
  { hook: "What $50 vs $500 gets you", strength: 1.5 },
  { hook: "Replying to the most asked question", strength: 1.3 },
  { hook: "Before and after - 30 days", strength: 1.2 },
  { hook: "Day in my life", strength: 0.8 },
  { hook: "Honest review after using _", strength: 0.7 },
  { hook: "5 hacks that actually work", strength: 0.6 },
];

const POST_TITLES = [
  "3 things I wish I knew before trying this",
  "POV: you finally found the one",
  "This changed my entire routine",
  "No one talks about this enough",
  "Honest review after 30 days",
  "The truth about this product",
  "Why I switched and never looked back",
  "My morning routine using only these",
  "Is it worth the hype? Let me show you",
  "I was today years old when I found this",
  "Stop scrolling - you need to see this",
  "The best kept secret in skincare",
  "Day in my life as a creator",
  "How I went viral with this simple trick",
  "Replying to the most asked question",
  "What $50 gets you vs $500",
  "Testing viral products so you don't have to",
  "My honest take on the new launch",
  "5 hacks that actually work",
  "Before and after - 2 weeks results",
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.postMetricsSnapshot.deleteMany();
  await prisma.campaignDailyMetric.deleteMany();
  await prisma.contentTraits.deleteMany();
  await prisma.notificationRule.deleteMany();
  await prisma.weeklyReportConfig.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.task.deleteMany();
  await prisma.post.deleteMany();
  await prisma.campaignCreator.deleteMany();
  await prisma.creatorEarning.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.teamSettings.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  // Create team
  const team = await prisma.team.create({
    data: {
      name: "Viewtrackr",
      slug: "viewtrackr",
      settings: { create: { timezone: "America/Los_Angeles" } },
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash("password123", 12);
  const admin = await prisma.user.create({
    data: {
      name: "Cami",
      email: "cami@test.com",
      passwordHash,
      isSuperAdmin: true,
      memberships: {
        create: { teamId: team.id, role: "ADMIN" },
      },
    },
  });

  // Create a second team member
  await prisma.user.create({
    data: {
      name: "Nick Johnson",
      email: "nick@viewtrackr.com",
      passwordHash,
      memberships: {
        create: { teamId: team.id, role: "MEMBER" },
      },
    },
  });

  console.log(`Created team: ${team.name}`);
  console.log(`Admin login: cami@test.com / password123`);

  // Create creators
  const creators = [];
  for (const data of CREATOR_DATA) {
    const creator = await prisma.creator.create({
      data: {
        teamId: team.id,
        name: data.name,
        handle: data.handle,
        tier: data.tier as typeof TIERS[number],
        isActive: true,
        email: `${data.handle.replace(".", "")}@gmail.com`,
      },
    });
    creators.push(creator);
  }
  console.log(`Created ${creators.length} creators`);

  // Give the first creator a login account so you can see the creator view
  const firstCreator = creators[0];
  await prisma.user.create({
    data: {
      name: firstCreator.name,
      email: "creator@test.com",
      passwordHash,
      memberships: {
        create: {
          teamId: team.id,
          role: "CREATOR",
          creatorId: firstCreator.id,
        },
      },
    },
  });
  await prisma.creator.update({
    where: { id: firstCreator.id },
    data: { email: "creator@test.com" },
  });
  console.log(
    `Creator login: creator@test.com / password123 (@${firstCreator.handle})`
  );

  // Create campaigns
  const now = new Date();
  const campaigns = [
    {
      name: "Spring Creator Push",
      startDate: subDays(now, 30),
      endDate: addDays(now, 30),
      hashtags: ["#sponsored", "#ad"],
      weeklyPostTarget: 50,
      ugcEngineer: "Ana Martinez",
    },
    {
      name: "Summer Skincare Launch",
      startDate: subDays(now, 14),
      endDate: addDays(now, 45),
      hashtags: ["#skincareroutine", "#sponsored"],
      weeklyPostTarget: 30,
      ugcEngineer: "Nick Johnson",
    },
    {
      name: "Back to School",
      startDate: subDays(now, 7),
      endDate: addDays(now, 60),
      hashtags: [],
      weeklyPostTarget: 40,
      ugcEngineer: "Ana Martinez",
    },
    {
      name: "Holiday Gift Guide",
      startDate: addDays(now, 30),
      endDate: addDays(now, 90),
      hashtags: ["#giftguide", "#holiday"],
      weeklyPostTarget: 25,
      ugcEngineer: "Nick Johnson",
      isActive: false,
    },
  ];

  const campaignRecords = [];
  for (const data of campaigns) {
    const campaign = await prisma.campaign.create({
      data: {
        teamId: team.id,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
        hashtags: data.hashtags,
        weeklyPostTarget: data.weeklyPostTarget,
        ugcEngineer: data.ugcEngineer,
        lastSyncAt: subDays(now, 0.5),
      },
    });
    campaignRecords.push(campaign);
  }
  console.log(`Created ${campaignRecords.length} campaigns`);

  // Assign creators to campaigns
  for (const campaign of campaignRecords.slice(0, 3)) {
    const assignedCreators =
      campaign.name === "Spring Creator Push"
        ? creators
        : campaign.name === "Summer Skincare Launch"
        ? creators.slice(0, 7)
        : creators.slice(3, 10);

    for (const creator of assignedCreators) {
      const platform = pickRandom(PLATFORMS);
      await prisma.campaignCreator.create({
        data: {
          campaignId: campaign.id,
          creatorId: creator.id,
          platform,
          videosPerDay: rand(1, 4),
          isActive: true,
        },
      });
    }
  }
  console.log("Assigned creators to campaigns");

  // Create posts with realistic metrics
  let postCount = 0;
  for (const campaign of campaignRecords.slice(0, 3)) {
    const ccs = await prisma.campaignCreator.findMany({
      where: { campaignId: campaign.id },
      include: { creator: true },
    });

    for (const cc of ccs) {
      const numPosts = rand(5, 20);
      for (let i = 0; i < numPosts; i++) {
        // Weight posts towards the current week so the creator progress
        // tracker shows realistic recent activity for the demo.
        const postedAt =
          i < cc.videosPerDay * 3
            ? subDays(now, rand(0, 5)) // this week
            : subDays(now, rand(1, 28)); // historical
        const views = rand(100, 500000);
        const likes = Math.floor(views * (rand(3, 15) / 100));
        const comments = Math.floor(likes * (rand(2, 10) / 100));
        const shares = Math.floor(likes * (rand(1, 8) / 100));
        const saves = Math.floor(likes * (rand(5, 20) / 100));

        // Pick a hook and compute referrals proportional to views × hook strength
        const hookData = pickRandom(HOOKS);
        // Conversion: strength is a base % with some noise
        const conversionPct = hookData.strength * (0.7 + Math.random() * 0.6);
        const referrals = Math.floor(views * (conversionPct / 100));

        const post = await prisma.post.create({
          data: {
            campaignId: campaign.id,
            creatorId: cc.creatorId,
            platform: cc.platform,
            username: cc.creator.handle,
            title: pickRandom(POST_TITLES),
            hook: hookData.hook,
            externalId: `${cc.platform.toLowerCase()}_${Date.now()}_${rand(10000, 99999)}`,
            link: `https://www.${cc.platform.toLowerCase()}.com/@${cc.creator.handle}/video/${rand(1000000, 9999999)}`,
            thumbnailUrl: `https://picsum.photos/seed/${rand(1, 1000)}/270/480`,
            postedAt,
            views,
            likes,
            comments,
            shares,
            saves,
            referrals,
          },
        });

        // Create metrics snapshot for each post
        await prisma.postMetricsSnapshot.create({
          data: {
            postId: post.id,
            date: startOfDay(postedAt),
            views,
            likes,
            comments,
            shares,
            saves,
          },
        });

        postCount++;
      }
    }
  }
  console.log(`Created ${postCount} posts with metrics`);

  // Generate campaign daily metrics for the last 28 days
  for (const campaign of campaignRecords.slice(0, 3)) {
    for (let d = 28; d >= 0; d--) {
      const date = startOfDay(subDays(now, d));

      const dayMetrics = await prisma.post.aggregate({
        where: {
          campaignId: campaign.id,
          postedAt: { lte: date },
        },
        _sum: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
        },
        _count: true,
      });

      const activeCreators = await prisma.campaignCreator.count({
        where: { campaignId: campaign.id, isActive: true },
      });

      await prisma.campaignDailyMetric.create({
        data: {
          campaignId: campaign.id,
          date,
          totalPosts: dayMetrics._count,
          totalViews: dayMetrics._sum.views ?? 0,
          totalLikes: dayMetrics._sum.likes ?? 0,
          totalShares: dayMetrics._sum.shares ?? 0,
          totalSaves: dayMetrics._sum.saves ?? 0,
          totalComments: dayMetrics._sum.comments ?? 0,
          activeCreators,
        },
      });
    }
  }
  console.log("Generated campaign daily metrics (28 days)");

  // Create tasks for the next 7 days
  const taskTypes = [
    "POST_VIDEOS",
    "RESPOND_TO_COMMENTS",
    "UPLOAD_FOR_REVIEW",
    "REVIEW_FEEDBACK",
  ] as const;
  const taskTitles: Record<string, string> = {
    POST_VIDEOS: "review feedback + post 3 videos",
    RESPOND_TO_COMMENTS: "respond to comments",
    UPLOAD_FOR_REVIEW: "upload 6 videos for review",
    REVIEW_FEEDBACK: "review feedback + post 3 videos",
  };

  let taskCount = 0;
  for (const campaign of campaignRecords.slice(0, 2)) {
    const ccs = await prisma.campaignCreator.findMany({
      where: { campaignId: campaign.id },
    });

    for (const cc of ccs.slice(0, 5)) {
      for (let d = -3; d <= 5; d++) {
        const dueDate = startOfDay(addDays(now, d));
        const type = pickRandom(taskTypes);
        const isCompleted = d < 0 ? Math.random() > 0.3 : false;

        await prisma.task.create({
          data: {
            campaignId: campaign.id,
            creatorId: cc.creatorId,
            type,
            title: taskTitles[type],
            dueDate,
            isCompleted,
            completedAt: isCompleted ? dueDate : null,
          },
        });
        taskCount++;
      }
    }
  }
  console.log(`Created ${taskCount} tasks`);

  // Create some uploads
  const uploadFiles = [
    "skincare-routine-v2.mp4",
    "product-review-final.mp4",
    "morning-routine-take3.mp4",
    "unboxing-haul.mp4",
    "day-in-my-life.mp4",
    "tutorial-basics.mp4",
  ];

  for (const campaign of campaignRecords.slice(0, 2)) {
    const ccs = await prisma.campaignCreator.findMany({
      where: { campaignId: campaign.id },
    });

    for (const cc of ccs.slice(0, 3)) {
      for (let i = 0; i < rand(1, 3); i++) {
        await prisma.upload.create({
          data: {
            campaignId: campaign.id,
            creatorId: cc.creatorId,
            fileName: pickRandom(uploadFiles),
            fileUrl: `https://storage.example.com/uploads/${Date.now()}.mp4`,
            fileSize: rand(5000000, 50000000),
            status: pickRandom(["PENDING", "APPROVED", "REJECTED"]),
            feedback:
              Math.random() > 0.5
                ? pickRandom([
                    "Great work! Approved.",
                    "Please re-record with better lighting",
                    "Love the hook, approved!",
                    "Audio quality needs improvement",
                  ])
                : null,
            reviewedAt: Math.random() > 0.5 ? subDays(now, rand(1, 5)) : null,
          },
        });
      }
    }
  }
  console.log("Created sample uploads");

  // Create a notification rule
  await prisma.notificationRule.create({
    data: {
      campaignId: campaignRecords[0].id,
      type: "THRESHOLD_HIT",
      name: "Threshold Rule #1",
      description: "Send notifications when any post reaches 50K views",
      webhookUrl: "https://hooks.slack.com/services/example",
      thresholdMetric: "views",
      thresholdValue: 50000,
      isEnabled: true,
    },
  });
  console.log("Created notification rule");

  // Create weekly report config with public link
  await prisma.weeklyReportConfig.create({
    data: {
      campaignId: campaignRecords[0].id,
      isEnabled: true,
      recipients: ["cami@test.com", "nick@viewtrackr.com"],
      publicSlug: "spring-push-2026",
    },
  });
  console.log("Created weekly report config");

  // Create demo creator messages (manager → creator)
  const firstFewCreators = creators.slice(0, 5);
  const demoMessages = [
    {
      type: "ANNOUNCEMENT" as const,
      title: "Welcome to Viewtrackr — read this first",
      body: "This is your creator home base. Check Tasks every morning, upload b-roll for review before posting, and message us here if anything is blocking you. Pinned announcements stay up top so you never miss them.",
      isPinned: true,
    },
    {
      type: "HOOK_SUGGESTION" as const,
      title: "New hook to test this week",
      body: "Try leading with 'POV: you finally tried _' — it's converting at 2.8% right now, our top performer. Use it on your next 3 videos and we'll review results Monday.",
      isPinned: false,
    },
    {
      type: "FEEDBACK" as const,
      title: "Great work on the 30-day review video",
      body: "Your before/after structure drove a spike in referrals. Let's make a follow-up with the same format but a different product angle.",
      isPinned: false,
    },
    {
      type: "ANNOUNCEMENT" as const,
      title: "Spring Creator Push is live",
      body: "The new campaign kicks off today. 2 videos/day target, hashtags #sponsored and #ad required on every post. Brief is in the app.",
      isPinned: false,
    },
    {
      type: "CAMPAIGN_UPDATE" as const,
      title: "Reminder: cross-post to Instagram",
      body: "Every video needs to go on TikTok AND Instagram — don't forget Reels. We saw a 40% reach bump last week from cross-posting.",
      isPinned: false,
    },
  ];

  for (const creator of firstFewCreators) {
    for (const msg of demoMessages) {
      await prisma.creatorMessage.create({
        data: {
          creatorId: creator.id,
          campaignId: campaignRecords[0].id,
          type: msg.type,
          title: msg.title,
          body: msg.body,
          isRead: msg.isPinned ? false : Math.random() > 0.6,
          isPinned: msg.isPinned,
          createdAt: subDays(now, rand(0, 7)),
        },
      });
    }
  }
  console.log("Created demo creator messages");

  console.log("\n✅ Seed complete!");
  console.log("Login with: cami@test.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
