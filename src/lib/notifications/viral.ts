import axios from "axios";
import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";

export const DEFAULT_VIRAL_THRESHOLD = 50_000;

export interface NotificationPrefs {
  viralEmail?: boolean;
  viralSms?: boolean;
  phoneNumber?: string | null;
  threshold?: number | null;
}

function parsePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  return {
    viralEmail: Boolean(p.viralEmail),
    viralSms: Boolean(p.viralSms),
    phoneNumber:
      typeof p.phoneNumber === "string" && p.phoneNumber.trim().length > 0
        ? p.phoneNumber
        : null,
    threshold: typeof p.threshold === "number" ? p.threshold : null,
  };
}

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  await axios.post(
    url,
    new URLSearchParams({ To: to, From: from, Body: body }),
    {
      auth: { username: sid, password: token },
      timeout: 15_000,
    }
  );
}

/**
 * Detect newly-viral posts for a single creator (posts whose view delta from
 * yesterday's snapshot crossed the threshold) and fire email + SMS as
 * configured. Idempotent per (postId, channel) via `viral_notifications`.
 */
export async function processViralNotificationsForCreator(
  creatorId: string
): Promise<{ fired: number; skipped: number; errors: string[] }> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: {
      id: true,
      name: true,
      email: true,
      notificationPrefs: true,
    },
  });
  if (!creator) return { fired: 0, skipped: 0, errors: [] };

  const prefs = parsePrefs(creator.notificationPrefs);
  if (!prefs.viralEmail && !prefs.viralSms) {
    return { fired: 0, skipped: 0, errors: [] };
  }

  const threshold =
    typeof prefs.threshold === "number" && prefs.threshold > 0
      ? prefs.threshold
      : DEFAULT_VIRAL_THRESHOLD;

  const today = startOfDay(new Date());
  const yesterday = startOfDay(subDays(new Date(), 1));

  const posts = await prisma.post.findMany({
    where: {
      creatorId,
      metricsHistory: { some: { date: today } },
    },
    select: {
      id: true,
      title: true,
      link: true,
      metricsHistory: {
        where: { date: { in: [today, yesterday] } },
        select: { date: true, views: true },
      },
    },
  });

  const errors: string[] = [];
  let fired = 0;
  let skipped = 0;

  for (const post of posts) {
    const todaySnap = post.metricsHistory.find(
      (m) => m.date.getTime() === today.getTime()
    );
    const yesterdaySnap = post.metricsHistory.find(
      (m) => m.date.getTime() === yesterday.getTime()
    );
    if (!todaySnap) continue;
    const delta = todaySnap.views - (yesterdaySnap?.views ?? 0);
    if (delta < threshold) continue;

    // Fire via each enabled channel, skipping if we already sent for this post.
    if (prefs.viralEmail && creator.email) {
      const already = await prisma.viralNotification.findUnique({
        where: { postId_channel: { postId: post.id, channel: "EMAIL" } },
      });
      if (!already) {
        if (isEmailConfigured() && resend) {
          try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: creator.email,
              subject: "Your video is going viral",
              html: `<p>Hey ${creator.name?.split(" ")[0] ?? "there"},</p>
<p>Your post jumped <strong>${delta.toLocaleString()}</strong> views in the last 24h — it's going viral. Capitalize on the momentum: respond to comments, post a follow-up, and pin it.</p>
<p><a href="${post.link}">${post.title?.slice(0, 80) || post.link}</a></p>`,
            });
            await prisma.viralNotification.create({
              data: { postId: post.id, creatorId, channel: "EMAIL" },
            });
            fired += 1;
          } catch (err) {
            errors.push(`email post=${post.id}: ${(err as Error).message}`);
            await prisma.viralNotification.create({
              data: {
                postId: post.id,
                creatorId,
                channel: "EMAIL",
                status: "FAILED",
                errorMsg: (err as Error).message,
              },
            });
          }
        } else {
          skipped += 1;
          errors.push(`email post=${post.id}: RESEND_API_KEY not set`);
        }
      }
    }

    if (prefs.viralSms && prefs.phoneNumber) {
      const already = await prisma.viralNotification.findUnique({
        where: { postId_channel: { postId: post.id, channel: "SMS" } },
      });
      if (!already) {
        if (twilioConfigured()) {
          try {
            await sendSms(
              prefs.phoneNumber,
              `Your video is going viral — +${delta.toLocaleString()} views in 24h. ${post.link}`
            );
            await prisma.viralNotification.create({
              data: { postId: post.id, creatorId, channel: "SMS" },
            });
            fired += 1;
          } catch (err) {
            errors.push(`sms post=${post.id}: ${(err as Error).message}`);
            await prisma.viralNotification.create({
              data: {
                postId: post.id,
                creatorId,
                channel: "SMS",
                status: "FAILED",
                errorMsg: (err as Error).message,
              },
            });
          }
        } else {
          skipped += 1;
          errors.push(
            `sms post=${post.id}: Twilio creds not configured (set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)`
          );
        }
      }
    }
  }

  return { fired, skipped, errors };
}
