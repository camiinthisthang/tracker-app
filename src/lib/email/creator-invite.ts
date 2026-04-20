import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";

interface SendCreatorInviteArgs {
  to: string;
  creatorName: string;
  teamName: string;
  inviteUrl: string;
}

export async function sendCreatorInvite({
  to,
  creatorName,
  teamName,
  inviteUrl,
}: SendCreatorInviteArgs) {
  if (!isEmailConfigured() || !resend) {
    return { ok: false as const, reason: "email_not_configured" };
  }

  const firstName = creatorName.split(" ")[0] || creatorName;
  const subject = `${teamName} — you're invited to join as a creator`;

  const text = `Hi ${firstName},

${teamName} invited you to join as a creator on Viewtrackr.

Click the link below to set your password and finish setting up your account — should take about 2 minutes.

${inviteUrl}

Once you're in, you'll be prompted to add your TikTok and Instagram handles so we can start tracking your videos.

See you on the other side,
${teamName}`;

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px;">
  <p style="margin:0 0 14px;">Hi ${firstName},</p>
  <p style="margin:0 0 14px;"><strong>${teamName}</strong> invited you to join as a creator on Viewtrackr.</p>
  <p style="margin:0 0 14px;">Click the button below to set your password and finish setting up your account — should take about 2 minutes.</p>
  <p style="margin:0 0 20px;">
    <a href="${inviteUrl}" style="display:inline-block;background:#1e293b;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;">Accept invite</a>
  </p>
  <p style="margin:0 0 14px;font-size:13px;color:#64748b;">Or paste this link into your browser:<br/><a href="${inviteUrl}" style="color:#2563eb;">${inviteUrl}</a></p>
  <p style="margin:0 0 14px;">Once you're in, you'll be prompted to add your TikTok and Instagram handles so we can start tracking your videos.</p>
  <p style="margin:0;">See you on the other side,<br/>${teamName}</p>
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
      console.error("sendCreatorInvite resend error", error);
      return { ok: false as const, reason: error.message || "send_failed" };
    }
    return { ok: true as const, id: data?.id };
  } catch (err) {
    console.error("sendCreatorInvite threw", err);
    return { ok: false as const, reason: "send_failed" };
  }
}
