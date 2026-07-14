import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ creatorId: string; accountId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId, accountId } = await params;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.creatorAccount.findUnique({
    where: { id: accountId },
  });
  if (!account || account.creatorId !== creatorId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const data: {
    isActive?: boolean;
    isShadowbanned?: boolean;
    note?: string | null;
    handle?: string;
  } = {};
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.isShadowbanned === "boolean")
    data.isShadowbanned = body.isShadowbanned;
  if ("note" in (body ?? {})) {
    data.note = typeof body.note === "string" ? body.note.trim() || null : null;
  }
  // Editable handle — for typo fixes ONLY. Renaming drops the old username
  // from knownHandlesFor(), so the next sync's stale-handle prune would
  // hard-delete every post stored under it (snapshots cascade). Guard like
  // DELETE does: a handle with synced posts can't be renamed — add the new
  // handle as a separate account and deactivate this one instead.
  if ("handle" in (body ?? {})) {
    const handle =
      typeof body.handle === "string"
        ? body.handle.trim().replace(/^@+/, "")
        : "";
    if (!handle) {
      return NextResponse.json(
        { error: "Handle can't be empty" },
        { status: 400 }
      );
    }
    if (handle.toLowerCase() !== account.handle.toLowerCase()) {
      const postCount = await prisma.post.count({
        where: {
          creatorId,
          platform: account.platform,
          username: { equals: account.handle, mode: "insensitive" },
        },
      });
      if (postCount > 0) {
        return NextResponse.json(
          {
            error: `This handle has ${postCount} synced post${
              postCount === 1 ? "" : "s"
            } — renaming would wipe that history on the next sync. Add the new handle as a separate account and deactivate this one instead.`,
          },
          { status: 409 }
        );
      }
    }
    const clash = await prisma.creatorAccount.findUnique({
      where: {
        creatorId_platform_handle: {
          creatorId,
          platform: account.platform,
          handle,
        },
      },
      select: { id: true },
    });
    if (clash && clash.id !== accountId) {
      return NextResponse.json(
        { error: "They already have that handle on this platform" },
        { status: 409 }
      );
    }
    data.handle = handle;
  }

  const updated = await prisma.creatorAccount.update({
    where: { id: accountId },
    data,
  });

  return NextResponse.json(updated);
}

/**
 * Hard-delete an account row — for typo'd handles that never synced
 * anything. Guarded: if posts exist under this username on this platform,
 * refuse and point at Deactivate instead (deleting the row would orphan the
 * history and the stale-handle prune would wipe it on the next sync).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ creatorId: string; accountId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId, accountId } = await params;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.creatorAccount.findUnique({
    where: { id: accountId },
  });
  if (!account || account.creatorId !== creatorId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const postCount = await prisma.post.count({
    where: {
      creatorId,
      platform: account.platform,
      username: { equals: account.handle, mode: "insensitive" },
    },
  });
  if (postCount > 0) {
    return NextResponse.json(
      {
        error: `This handle has ${postCount} synced post${
          postCount === 1 ? "" : "s"
        } — deactivate it instead so the history is kept`,
      },
      { status: 409 }
    );
  }

  await prisma.creatorAccount.delete({ where: { id: accountId } });
  return NextResponse.json({ ok: true });
}
