import { prisma } from "@/lib/prisma";

/**
 * Shared shape returned when an email is already owned by some row in the
 * system. `table` identifies WHICH row so the caller can render an actionable
 * error + deep-link to the existing record.
 */
export type EmailConflict =
  | {
      table: "user";
      existingId: string;
      message: string;
      suggestion: string;
    }
  | {
      table: "creator";
      existingId: string;
      message: string;
      suggestion: string;
    }
  | {
      table: "application";
      existingId: string;
      message: string;
      suggestion: string;
    };

export interface EmailConflictCheckOptions {
  /**
   * Conflicts to care about. Defaults to all three tables. Some callers only
   * care about a subset — e.g. the creator-signup flow doesn't care about an
   * open application since applying and signing up can coexist.
   */
  check?: Array<"user" | "creator" | "application">;
}

/**
 * Check whether `rawEmail` already owns a row in the User / Creator /
 * CreatorApplication tables. Returns the first conflict found, with a
 * human-readable error message and a next-action suggestion. Returns null if
 * the email is free.
 *
 * Checks in this order: User → Creator → open Application (PENDING /
 * REVIEWING). The UI can then link directly to the existing row via
 * `existingId`.
 */
export async function findEmailConflict(
  rawEmail: string,
  opts: EmailConflictCheckOptions = {}
): Promise<EmailConflict | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;
  const check = opts.check ?? ["user", "creator", "application"];

  if (check.includes("user")) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) {
      return {
        table: "user",
        existingId: user.id,
        message: "A User account already exists with this email.",
        suggestion:
          "Use the team-invite flow to attach them to this workspace instead of creating a new account.",
      };
    }
  }

  if (check.includes("creator")) {
    const creator = await prisma.creator.findFirst({
      where: { email },
      select: { id: true },
    });
    if (creator) {
      return {
        table: "creator",
        existingId: creator.id,
        message: "A Creator already exists with this email.",
        suggestion:
          "Delete the existing creator first, or edit that record instead of creating a duplicate.",
      };
    }
  }

  if (check.includes("application")) {
    const app = await prisma.creatorApplication.findFirst({
      where: {
        email,
        status: { in: ["PENDING", "REVIEWING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (app) {
      return {
        table: "application",
        existingId: app.id,
        message: "An open creator application exists with this email.",
        suggestion:
          "Review and approve the application instead of adding a creator directly.",
      };
    }
  }

  return null;
}
