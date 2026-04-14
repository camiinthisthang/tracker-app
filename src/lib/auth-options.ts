import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * When a user signs in with Google for the first time, try to auto-claim any
 * pending invite for their email. Covers two paths:
 *   1. Client-manager invites (TeamInvite) → create TeamMember(ADMIN), mark accepted
 *   2. Creator records pre-created by the agency with a matching email →
 *      create TeamMember(CREATOR) linked to the Creator row
 *
 * If neither matches, the user still signs in but ends up with no team
 * membership. Middleware then routes them to /pending-approval.
 */
async function claimPendingAccessForEmail(userId: string, rawEmail: string) {
  const email = rawEmail.toLowerCase();

  // Skip if they already have any team membership
  const existingMembership = await prisma.teamMember.findFirst({
    where: { userId },
  });
  if (existingMembership) return;

  // Option 1: pending TeamInvite
  const invite = await prisma.teamInvite.findFirst({
    where: {
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (invite) {
    await prisma.teamMember.create({
      data: {
        userId,
        teamId: invite.teamId,
        role: invite.role,
      },
    });
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return;
  }

  // Option 2: Creator record with matching email, not yet linked
  const creator = await prisma.creator.findFirst({
    where: {
      email,
      teamMember: null,
    },
  });

  if (creator) {
    await prisma.teamMember.create({
      data: {
        userId,
        teamId: creator.teamId,
        role: "CREATOR",
        creatorId: creator.id,
      },
    });
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            memberships: {
              include: { team: true },
              take: 1,
            },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        const membership = user.memberships[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          teamId: membership?.teamId ?? "",
          teamName: membership?.team.name ?? "",
          role: (membership?.role ?? "MEMBER") as "ADMIN" | "MEMBER" | "CREATOR",
          creatorId: membership?.creatorId ?? undefined,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Allow a Google sign-in to link to an existing email/password user.
            // Safe here because we only accept verified Google emails.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Only auto-claim invites for OAuth sign-ins. Credentials sign-in already
      // returns membership info directly from authorize().
      if (account?.provider === "google" && user?.id && user.email) {
        try {
          await claimPendingAccessForEmail(user.id, user.email);
        } catch (err) {
          console.error("claimPendingAccessForEmail failed", err);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // On initial sign-in, `user` is populated. For credentials sign-in this
      // already contains team info from authorize(). For Google, it only has
      // id/email/name/image, so we need to look up membership + super-admin
      // status from the DB.
      if (user) {
        token.id = user.id;
        token.isSuperAdmin = user.isSuperAdmin ?? false;

        if (user.teamId !== undefined) {
          token.teamId = user.teamId ?? "";
          token.teamName = user.teamName ?? "";
          token.role = user.role ?? "MEMBER";
          token.creatorId = user.creatorId;
        } else {
          // Google sign-in path — fetch membership & super-admin flag fresh.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
              memberships: {
                include: { team: true },
                take: 1,
              },
            },
          });
          const membership = dbUser?.memberships[0];
          token.teamId = membership?.teamId ?? "";
          token.teamName = membership?.team.name ?? "";
          token.role = (membership?.role ?? "MEMBER") as
            | "ADMIN"
            | "MEMBER"
            | "CREATOR";
          token.creatorId = membership?.creatorId ?? undefined;
          token.isSuperAdmin = dbUser?.isSuperAdmin ?? false;
        }
      }

      // Allow client-triggered session refresh (useSession().update()) to
      // re-pull team info, e.g. right after accepting an invite.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: {
            memberships: { include: { team: true }, take: 1 },
          },
        });
        const membership = dbUser?.memberships[0];
        token.teamId = membership?.teamId ?? "";
        token.teamName = membership?.team.name ?? "";
        token.role = (membership?.role ?? "MEMBER") as
          | "ADMIN"
          | "MEMBER"
          | "CREATOR";
        token.creatorId = membership?.creatorId ?? undefined;
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.teamId = token.teamId;
      session.user.teamName = token.teamName;
      session.user.role = token.role;
      session.user.creatorId = token.creatorId;
      session.user.isSuperAdmin = token.isSuperAdmin ?? false;
      return session;
    },
  },
};
