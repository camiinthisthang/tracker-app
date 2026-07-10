/**
 * Demo-data seeder for local screenshots/QA. Wipes the connected DB and
 * creates a DropDeck-like workspace with a login, creators (including a
 * shadow-ban replacement account), five weeks of posts across TikTok /
 * Instagram / YouTube Shorts with hooks + sounds, and PostHog attributions.
 *
 * Usage: DATABASE_URL=<local> npx tsx scripts/seed-demo.ts
 * Login: demo@viewtrackr.com / demo1234
 *
 * NEVER run against production.
 */
import bcrypt from "bcryptjs";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech")) {
    throw new Error("Refusing to run the demo seeder against a Neon URL.");
  }

  await prisma.user.deleteMany();
  await prisma.team.deleteMany(); // cascades campaigns/creators/posts/etc.

  const team = await prisma.team.create({
    data: { name: "DropDeck", slug: "dropdeck-demo", settings: { create: {} } },
  });
  const user = await prisma.user.create({
    data: {
      name: "Jacqueline",
      email: "demo@viewtrackr.com",
      passwordHash: await bcrypt.hash("demo1234", 12),
      isSuperAdmin: true,
      memberships: { create: { teamId: team.id, role: "ADMIN" } },
    },
  });
  console.log(`user ${user.email} / demo1234`);

  const campaign = await prisma.campaign.create({
    data: {
      teamId: team.id,
      name: "Poncho Summer",
      startDate: subWeeks(new Date(), 8),
      endDate: addDays(new Date(), 30),
      isActive: true,
    },
  });

  const creatorSpecs = [
    { name: "Brittany", handle: "brittany.creates", yt: "brittanyshorts", tier: "GOLD" },
    { name: "Claire", handle: "claire.pov", yt: null, tier: "SILVER" },
    { name: "Maya", handle: "maya.talks", yt: "mayatalks", tier: "SILVER" },
    { name: "Devon", handle: "devon.daily", yt: null, tier: "BRONZE" },
  ] as const;

  const creators = [];
  for (const spec of creatorSpecs) {
    creators.push(
      await prisma.creator.create({
        data: {
          teamId: team.id,
          name: spec.name,
          handle: spec.handle,
          tier: spec.tier,
          tiktokHandle: spec.handle,
          instagramHandle: spec.handle.replace(/\./g, "_"),
          youtubeHandle: spec.yt,
          campaignCreators: { create: { campaignId: campaign.id } },
        },
      })
    );
  }

  // Brittany got shadow banned and posts from a replacement account now.
  await prisma.creatorAccount.createMany({
    data: [
      {
        creatorId: creators[0].id,
        platform: "TIKTOK",
        handle: "brittany.creates2",
        isActive: true,
        note: "replacement — main shadow banned Jun 30",
      },
      {
        creatorId: creators[0].id,
        platform: "TIKTOK",
        handle: "brittany.old",
        isActive: false,
        note: "banned account, history kept",
      },
    ],
  });

  const hooks = [
    "POV: you finally found a tracker that just works",
    "3 things nobody tells you about UGC",
    "I posted every day for 30 days — here's what happened",
    "Stop doing this in your first 3 seconds",
    "The hook formula that got me 500K views",
    null,
    null,
  ];
  const sounds = [
    ["original sound - brittany.creates", "brittany.creates", true],
    ["Espresso (sped up)", "Sabrina Carpenter", false],
    ["Million Dollar Baby", "Tommy Richman", false],
    ["original sound - maya.talks", "maya.talks", true],
  ] as const;

  // Five weeks of posts. This week is strong for Brittany (top performer),
  // Maya improves week over week, Claire posts most consistently.
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  let ext = 0;
  const posts: Promise<unknown>[] = [];
  for (let w = 4; w >= 0; w--) {
    const weekStart = subWeeks(thisWeek, w);
    for (const [ci, creator] of creators.entries()) {
      const postsThisWeek = ci === 1 ? 6 : 2 + ((ci + w) % 3);
      for (let i = 0; i < postsThisWeek; i++) {
        const day = ci === 1 ? i % 6 : (i * 2 + ci) % 7;
        const postedAt = addDays(weekStart, day);
        postedAt.setHours(10 + ((i * 3) % 9), 15, 0, 0);
        if (postedAt > new Date()) continue;

        const base =
          ci === 0 ? 45000 : ci === 2 ? 8000 * (5 - w) : ci === 1 ? 6000 : 3000;
        const views = Math.round(base * (0.5 + ((ext * 7919) % 100) / 100));
        const platform =
          ext % 3 === 0 && creatorSpecs[ci].yt
            ? "YOUTUBE"
            : ext % 2 === 0
              ? "TIKTOK"
              : "INSTAGRAM";
        const username =
          ci === 0 && platform === "TIKTOK" && w < 2
            ? "brittany.creates2"
            : platform === "YOUTUBE"
              ? (creatorSpecs[ci].yt as string)
              : platform === "INSTAGRAM"
                ? creator.handle.replace(/\./g, "_")
                : creator.handle;
        const sound = platform === "TIKTOK" ? sounds[ext % sounds.length] : null;
        ext++;

        posts.push(
          prisma.post.create({
            data: {
              campaignId: campaign.id,
              creatorId: creator.id,
              platform,
              username,
              externalId: `demo-${ext}`,
              link: `https://example.com/${ext}`,
              title: `Day ${ext}: making it look easy #poncho`,
              hook: hooks[ext % hooks.length],
              postedAt,
              views,
              likes: Math.round(views * (0.06 + (ci === 3 ? 0.09 : 0))),
              comments: Math.round(views * 0.01),
              shares: Math.round(views * 0.008),
              saves: Math.round(views * 0.005),
              musicTitle: sound?.[0] ?? null,
              musicAuthor: sound?.[1] ?? null,
              musicOriginal: sound?.[2] ?? null,
            },
          })
        );
      }
    }
  }
  await Promise.all(posts);
  console.log(`${ext} posts created`);

  // Attributed signups this week — Maya converts best.
  for (let d = 0; d < 5; d++) {
    await prisma.creatorAttribution.create({
      data: {
        creatorId: creators[2].id,
        date: addDays(thisWeek, d),
        signupCount: 4 + d,
      },
    });
    await prisma.creatorAttribution.create({
      data: {
        creatorId: creators[0].id,
        date: addDays(thisWeek, d),
        signupCount: 2,
      },
    });
  }
  console.log("done");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
