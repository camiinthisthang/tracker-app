"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="mr-2 h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}
