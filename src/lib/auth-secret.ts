/**
 * The secret NextAuth uses to sign/verify session JWTs. Must be identical
 * everywhere a JWT is produced or read — the auth config AND the middleware's
 * getToken() — or sessions sign on one side and fail to decode on the other
 * (symptom: login succeeds but redirects straight back to /login).
 *
 * Production requires the real NEXTAUTH_SECRET. Preview/dev deployments run in
 * production mode too, so without a secret NextAuth won't boot ("server
 * configuration" error). For QA we fall back on non-production deployments to
 * a secret derived from the already-set TEST_LOGIN_PASSWORD, so previews work
 * without NEXTAUTH_SECRET being scoped to the Preview environment. Never used
 * in production.
 *
 * Reads only process.env, so it is safe to import in edge middleware.
 */
export function resolveAuthSecret(): string | undefined {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (
    process.env.VERCEL_ENV !== "production" &&
    process.env.TEST_LOGIN_PASSWORD
  ) {
    return `viewtrackr-preview-secret-${process.env.TEST_LOGIN_PASSWORD}`;
  }
  return undefined;
}
