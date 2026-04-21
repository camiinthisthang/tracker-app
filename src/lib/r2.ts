import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) client. Configured via env vars:
 *   - R2_ACCOUNT_ID
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_BUCKET
 *   - R2_PUBLIC_BASE_URL (optional; used to compose the public URL of an
 *     uploaded object. Set it to either your r2.dev subdomain or a custom
 *     domain bound to the bucket, e.g. https://assets.viewtrackr.com)
 *
 * Object keys are namespaced by team + creator so the bucket stays tidy and
 * we can enforce per-team access later if needed.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

/**
 * Create a presigned PUT URL the browser can use to upload `fileName` directly
 * to R2. Returns the presigned URL + the eventual public URL of the object.
 *
 * The object key is `teamId/creatorId/<timestamp>-<safe-filename>` so two
 * creators can't collide and we can rotate by timestamp.
 */
export async function presignUpload(params: {
  teamId: string;
  creatorId: string;
  fileName: string;
  contentType: string;
}): Promise<PresignedUpload> {
  const bucket = requireEnv("R2_BUCKET");
  const publicBase = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const key = `${params.teamId}/${params.creatorId}/${Date.now()}-${safeName}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
  });
  const expiresIn = 60 * 10; // 10 minutes
  const uploadUrl = await getSignedUrl(getR2Client(), cmd, { expiresIn });

  return {
    uploadUrl,
    publicUrl: `${publicBase}/${key}`,
    key,
    expiresIn,
  };
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}
