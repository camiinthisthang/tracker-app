import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getRequiredSession() {
  const session = await getSession();
  if (!session?.user?.teamId) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Gate a server component / route handler to super admins only.
 * Non-super users get bounced to their role's home.
 */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.isSuperAdmin) {
    redirect(session.user.role === "CREATOR" ? "/home" : "/dashboard");
  }
  return session;
}
