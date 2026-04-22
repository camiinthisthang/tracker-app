import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      teamId: string;
      teamName: string;
      teamSlug: string;
      role: "ADMIN" | "MEMBER" | "CREATOR";
      creatorId?: string;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    teamId?: string;
    teamName?: string;
    teamSlug?: string;
    role?: "ADMIN" | "MEMBER" | "CREATOR";
    creatorId?: string;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    teamId: string;
    teamName: string;
    teamSlug: string;
    role: "ADMIN" | "MEMBER" | "CREATOR";
    creatorId?: string;
    isSuperAdmin?: boolean;
  }
}
