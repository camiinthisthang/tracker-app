import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAgencyWideAccess } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const body = await req.json().catch(() => null);
  const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";
  const platform = body?.platform || "TIKTOK";

  if (!creatorId) {
    return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, teamId: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Agency users (super admins / agency managers) may assign creators to any
  // client's campaign; client managers only to their own team's.
  if (
    !hasAgencyWideAccess(session) &&
    campaign.teamId !== session.user.teamId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.campaignCreator.findUnique({
    where: { campaignId_creatorId: { campaignId, creatorId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already assigned" }, { status: 409 });
  }

  const cc = await prisma.campaignCreator.create({
    data: { campaignId, creatorId, platform, isActive: true },
  });

  return NextResponse.json(cc, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const body = await req.json().catch(() => null);
  const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";

  if (!creatorId) {
    return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
  }

  // Editable contract fields. contractedTiktok/Instagram are non-negative
  // integers; monthlyRate is a non-negative dollar amount (up to 2 decimals).
  // Each accepts null (cleared). Absent keys are left untouched.
  const data: {
    contractedTiktok?: number | null;
    contractedInstagram?: number | null;
    monthlyRate?: number | null;
    useDefaultHandles?: boolean;
    countAllPlatforms?: boolean;
  } = {};
  if (typeof body?.useDefaultHandles === "boolean")
    data.useDefaultHandles = body.useDefaultHandles;
  if (typeof body?.countAllPlatforms === "boolean")
    data.countAllPlatforms = body.countAllPlatforms;
  for (const key of ["contractedTiktok", "contractedInstagram"] as const) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: `${key} must be a non-negative integer` },
          { status: 400 }
        );
      }
      data[key] = n;
    }
  }
  if ("monthlyRate" in body) {
    const raw = body.monthlyRate;
    if (raw === null || raw === "") {
      data.monthlyRate = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "monthlyRate must be a non-negative number" },
          { status: 400 }
        );
      }
      data.monthlyRate = Math.round(n * 100) / 100;
    }
  }

  const cc = await prisma.campaignCreator.findUnique({
    where: { campaignId_creatorId: { campaignId, creatorId } },
    include: { campaign: { select: { teamId: true } } },
  });
  if (!cc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasAgencyWideAccess(session) && cc.campaign.teamId !== session.user.teamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.campaignCreator.update({
    where: { id: cc.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const creatorId = searchParams.get("creatorId");
  const campaignId = searchParams.get("campaignId");

  if (!creatorId || !campaignId) {
    return NextResponse.json(
      { error: "creatorId and campaignId are required" },
      { status: 400 }
    );
  }

  const cc = await prisma.campaignCreator.findUnique({
    where: { campaignId_creatorId: { campaignId, creatorId } },
    include: { campaign: { select: { teamId: true } } },
  });
  if (!cc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasAgencyWideAccess(session) && cc.campaign.teamId !== session.user.teamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.campaignCreator.delete({
    where: { id: cc.id },
  });

  return NextResponse.json({ ok: true });
}
