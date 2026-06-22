import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";

/**
 * Internal inbox that should hear about every new inbound lead — brand
 * inquiries and creator applications. Defaults to hey@dropdeck.xyz; override
 * with TEAM_NOTIFICATION_EMAIL (comma-separated for multiple recipients).
 */
const TEAM_INBOX = (
  process.env.TEAM_NOTIFICATION_EMAIL || "hey@dropdeck.xyz"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL || "https://tracker-app-nu-inky.vercel.app";

type BrandInquiryLike = {
  name: string;
  email: string;
  company: string;
  link: string | null;
  startWindow: string | null;
  about: string;
};

type CreatorApplicationLike = {
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  about: string;
  videoUrls: string[];
};

function wrap(title: string, rows: [string, string][], about: string, cta: string) {
  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#9a9aa3;font-size:13px;">${k}</td><td style="padding:2px 0;color:#232328;font-size:13px;">${v}</td></tr>`
    )
    .join("");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#232328;">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#ee2324;margin:0 0 6px;">${title}</p>
  <table style="border-collapse:collapse;margin:0 0 16px;">${rowHtml}</table>
  <p style="white-space:pre-wrap;background:#f9f8f3;border-radius:8px;padding:12px;font-size:14px;line-height:1.5;margin:0 0 18px;">${about}</p>
  <p style="margin:0;"><a href="${cta}" style="display:inline-block;background:#ee2324;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">Review in dashboard</a></p>
</div>`;
}

async function send(opts: {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  if (!isEmailConfigured() || !resend || TEAM_INBOX.length === 0) {
    return { ok: false as const, reason: "email_not_configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_INBOX,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    if (error) {
      console.error("team notification resend error", error);
      return { ok: false as const, reason: error.message || "send_failed" };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("team notification threw", err);
    return { ok: false as const, reason: "send_failed" };
  }
}

export async function notifyNewBrandInquiry(inquiry: BrandInquiryLike) {
  const subject = `New brand inquiry — ${inquiry.company}`;
  const text = `New brand inquiry via the /brands page.

Company: ${inquiry.company}
Name:    ${inquiry.name}
Email:   ${inquiry.email}
Link:    ${inquiry.link || "—"}
Start:   ${inquiry.startWindow || "—"}

${inquiry.about}

Review: ${APP_BASE}/brands`;
  const html = wrap(
    "New brand inquiry",
    [
      ["Company", inquiry.company],
      ["Name", inquiry.name],
      ["Email", inquiry.email],
      ["Link", inquiry.link || "—"],
      ["Start", inquiry.startWindow || "—"],
    ],
    inquiry.about,
    `${APP_BASE}/brands`
  );
  // Reply-to the brand so hitting reply from hey@ goes straight to the lead.
  return send({ subject, text, html, replyTo: inquiry.email });
}

export async function notifyNewCreatorApplication(app: CreatorApplicationLike) {
  const subject = `New creator application — ${app.name}`;
  const text = `New creator application via the /apply page.

Name:     ${app.name}
Email:    ${app.email}
Phone:    ${app.phone || "—"}
Location: ${app.location || "—"}
Instagram:${app.instagramHandle || "—"}
TikTok:   ${app.tiktokHandle || "—"}
Videos:   ${app.videoUrls.join(", ") || "—"}

${app.about}

Review: ${APP_BASE}/applications`;
  const html = wrap(
    "New creator application",
    [
      ["Name", app.name],
      ["Email", app.email],
      ["Phone", app.phone || "—"],
      ["Location", app.location || "—"],
      ["Instagram", app.instagramHandle || "—"],
      ["TikTok", app.tiktokHandle || "—"],
    ],
    app.about,
    `${APP_BASE}/applications`
  );
  return send({ subject, text, html, replyTo: app.email });
}
