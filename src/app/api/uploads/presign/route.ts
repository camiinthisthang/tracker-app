import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { presignUpload, isR2Configured } from "@/lib/r2";

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB per file — generous for UGC video

/**
 * Presigned-upload endpoint for creator video files. The client:
 *   1. POSTs { fileName, contentType, size } here
 *   2. Receives a one-time URL it can PUT the raw file bytes to (direct to R2)
 *   3. After the PUT succeeds, POSTs /api/uploads with fileUrl = publicUrl to
 *      create the Upload review record.
 *
 * Only creators can request a presigned URL — we derive creatorId from the
 * session (session.user.creatorId) rather than trusting the body.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.creatorId) {
    return NextResponse.json(
      { error: "Only creators can upload files" },
      { status: 403 },
    );
  }
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error:
          "File upload storage isn't configured yet. Paste a cloud link instead, or ask your manager to enable direct uploads.",
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const fileName =
    typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const contentType =
    typeof body?.contentType === "string"
      ? body.contentType
      : "application/octet-stream";
  const size = typeof body?.size === "number" ? body.size : 0;

  if (!fileName) {
    return NextResponse.json({ error: "fileName required" }, { status: 400 });
  }
  if (size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB.` },
      { status: 400 },
    );
  }

  const presigned = await presignUpload({
    teamId: session.user.teamId,
    creatorId: session.user.creatorId,
    fileName,
    contentType,
  });

  return NextResponse.json(presigned);
}
