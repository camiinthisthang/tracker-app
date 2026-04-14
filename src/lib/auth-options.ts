import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.teamId = user.teamId ?? "";
        token.teamName = user.teamName ?? "";
        token.role = user.role ?? "MEMBER";
        token.creatorId = user.creatorId;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
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
