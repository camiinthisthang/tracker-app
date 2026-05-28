import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";
import { BRAND_NAME } from "@/lib/brand";

interface SendManagerInviteArgs {
  to: string;
  teamName: string;
  inviteUrl: string;
  inviterName?: string | null;
  /**
   * "client" = recipient gets scoped visibility into a single client
   * workspace. "agency" = recipient gets cross-client visibility (DropDeck
   * team membership). Affects copy only; the invite row is identical.
   */
  variant?: "client" | "agency";
}

/**
 * Invite a manager or agency admin to a Team workspace via Resend. Parallel
 * to sendCreatorInvite but worded for the manager/admin flow.
 */
export async function sendManagerInvite({
  to,
  teamName,
  inviteUrl,
  inviterName,
  variant = "client",
}: SendManagerInviteArgs) {
  if (!isEmailConfigured() || !resend) {
    return { ok: false as const, reason: "email_not_configured" };
  }

  const fromLabel = inviterName ? `${inviterName} (DropDeck)` : "DropDeck";
  const isAgency = variant === "agency";

  const subject = isAgency
    ? `You're invited to join ${teamName} on ${BRAND_NAME}`
    : `You're invited to manage ${teamName} on ${BRAND_NAME}`;

  const pitch = isAgency
    ? `You'll get admin access to every client workspace we operate — campaigns, creators, posts, and analytics across the board.`
    : `You'll get admin access to see campaigns, creators, posts, and analytics for ${teamName} — nothing else.`;

  const ctaVerb = isAgency ? "join" : "manage";

  const text = `Hi,

${fromLabel} invited you to ${ctaVerb} ${teamName} on ${BRAND_NAME}. ${pitch}

Accept the invite:
${inviteUrl}

This link expires in 14 days.

— ${fromLabel}`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px;">
  <p style="margin:0 0 14px;">Hi,</p>
  <p style="margin:0 0 14px;"><strong>${fromLabel}</strong> invited you to ${ctaVerb} <strong>${teamName}</strong> on ${BRAND_NAME}.</p>
  <p style="margin:0 0 14px;">${pitch}</p>
  <p style="margin:0 0 20px;">
    <a href="${inviteUrl}" style="display:inline-block;background:#1e293b;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;">Accept invite</a>
  </p>
  <p style="margin:0 0 14px;font-size:13px;color:#64748b;">Or paste this link into your browser:<br/><a href="${inviteUrl}" style="color:#2563eb;">${inviteUrl}</a></p>
  <p style="margin:0 0 14px;font-size:13px;color:#64748b;">This link expires in 14 days.</p>
  <p style="margin:0;">— ${fromLabel}</p>
</div>`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      text,
      html,
    });
    if (error) {
      console.error("sendManagerInvite resend error", error);
      return { ok: false as const, reason: error.message || "send_failed" };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("sendManagerInvite threw", err);
    return { ok: false as const, reason: "send_failed" };
  }
}
