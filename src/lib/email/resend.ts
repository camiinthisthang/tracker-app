import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

// Fallback to resend's default test sender so local dev without a verified
// domain still works. Spam delivery from onboarding@resend.dev is bad, so
// anything that should actually land in an inbox needs RESEND_FROM_EMAIL set
// to an address on a domain verified in the Resend dashboard.
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Viewtrackr <onboarding@resend.dev>";

export function isEmailConfigured() {
  return Boolean(apiKey);
}
