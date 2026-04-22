import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";

interface SendManagerInviteArgs {
  to: string;
  teamName: string;
  inviteUrl: string;
  inviterName?: string | null;
}

/**
 * Invite a client-team manager (ADMIN role) to an existing Team workspace.
 * Parallel to sendCreatorInvite but worded for the manager flow —
 * recipient gets admin visibility into campaigns / creators / analytics for
 * that one client only.
 */
export async function sendManagerInvite({
  to,
  teamName,
  inviteUrl,
  inviterName,
}: SendManagerInviteArgs) {
  if (!isEmailConfigured() || !resend) {
    return { ok: false as const, reason: "email_not_configured" };
  }

  const fromLabel = inviterName ? `${inviterName} (Tapmore)` : "Tapmore";
  const subject = `You're invited to manage ${teamName} on Viewtrackr`;

  const text = `Hi,

${fromLabel} invited you to manage ${teamName} on Viewtrackr. You'll get admin access to see campaigns, creators, posts, and analytics for ${teamName} — nothing else.

Accept the invite:
${inviteUrl}

This link expires in 14 days.

— ${fromLabel}`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px;">
  <p style="margin:0 0 14px;">Hi,</p>
  <p style="margin:0 0 14px;"><strong>${fromLabel}</strong> invited you to manage <strong>${teamName}</strong> on Viewtrackr.</p>
  <p style="margin:0 0 14px;">You'll get admin access to see campaigns, creators, posts, and analytics for ${teamName} — nothing else.</p>
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
